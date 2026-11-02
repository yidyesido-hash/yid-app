/* =====================================================================
   NUMÉROS DE TÉLÉPHONE · normalisation (doctrine collect v2)
   Règles : les indicatifs sont préservés ; « 00 » vaut indicatif ; le 0
   de composition après l'indicatif est retiré ; un numéro nu est présumé
   du pays de résidence si sa longueur et son préfixe collent ; un numéro
   nu qui commence par l'indicatif du pays de résidence est accepté (règle
   née du réel : « 33612345678 » tapé sans +) ; les numéros d'outre mer
   tapés à la française prennent leur vrai indicatif ; les fixes sont
   signalés, jamais rejetés. On ne devine pas : ce qui ne colle pas est
   signalé « format à vérifier », ce qui est impossible « invalide ».
   Résultat : { numero: "+33612345678" ou null, statut, brut }
     statut : ok | fixe probable | format à vérifier | invalide | sans numéro
   ===================================================================== */
const pays = require("./pays");

function nettoyer(brut) {
  let s = String(brut == null ? "" : brut).trim().replace(/^tel:/i, "");
  s = s.replace(/[\s.\-()  /]/g, "");
  if (/^\+/.test(s)) s = "+" + s.slice(1).replace(/\D/g, "");
  else s = s.replace(/\D/g, "");
  return s;
}
function indicatifDe(digits) {
  for (const n of [3, 2, 1]) { const c = digits.slice(0, n); if (pays.INDICATIFS.includes(c) || pays.parIndicatif(c)) return c; }
  return null;
}
function juger(p, national) {
  if (!p) return national.length < 6 || national.length > 13 ? "format à vérifier" : "ok";
  if (!p.lg.includes(national.length)) return "format à vérifier";
  if (p.mob.length && p.mob.some(x => national.startsWith(x))) return "ok";
  if (p.fixe.length && p.fixe.some(x => national.startsWith(x))) return "fixe probable";
  if (!p.mob.length) return "ok";                 /* pays sans distinction mobile fixe */
  return "format à vérifier";
}

function normaliser(brut, paysResidence) {
  const s = nettoyer(brut);
  if (!s) return { numero: null, statut: "sans numéro", brut: String(brut == null ? "" : brut) };
  const res = pays.parCode(paysResidence) || pays.parNom(paysResidence) || pays.parCode("FR");
  let digits = s.startsWith("00") ? "+" + s.slice(2) : s;
  if (digits.replace(/\D/g, "").length < 7) return { numero: null, statut: "invalide", brut: String(brut) };

  if (digits.startsWith("+")) {
    const d = digits.slice(1);
    const ind = indicatifDe(d);
    if (!ind) return { numero: null, statut: "invalide", brut: String(brut) };
    const p = pays.parIndicatif(ind);
    let national = d.slice(ind.length);
    if (p && p.trunk && national.startsWith("0")) national = national.slice(1);
    if (!national) return { numero: null, statut: "invalide", brut: String(brut) };
    /* un +33 posé sur un numéro d'outre mer (069x, 0639) : l'indicatif est corrigé et la correction annotée, jamais devinée au delà */
    if (ind === "33" && national.length === 9) {
      const dom = pays.DOM.find(([pfx]) => national.startsWith(pfx.slice(1)));
      if (dom) return { numero: "+" + dom[1] + national, statut: "ok", brut: String(brut), correction: `Indicatif corrigé : +33 remplacé par +${dom[1]} (préfixe outre mer ${dom[0]})` };
    }
    return { numero: "+" + ind + national, statut: juger(p, national), brut: String(brut) };
  }
  /* numéro nu */
  if (res.code === "FR" || res.trunk) {
    for (const [prefixe, ind] of pays.DOM) if (digits.startsWith(prefixe) && digits.length === 10) return { numero: "+" + ind + digits.slice(1), statut: "ok", brut: String(brut) };
  }
  if (res.trunk && digits.startsWith("0")) {
    const national = digits.slice(1);
    const st = juger(res, national);
    if (st !== "format à vérifier") return { numero: "+" + res.ind + national, statut: st, brut: String(brut) };
    return { numero: "+" + res.ind + national, statut: "format à vérifier", brut: String(brut) };
  }
  /* commence par l'indicatif du pays de résidence, tapé sans + */
  if (digits.startsWith(res.ind)) {
    let national = digits.slice(res.ind.length);
    if (res.trunk && national.startsWith("0")) national = national.slice(1);
    const st = juger(res, national);
    if (st !== "format à vérifier") return { numero: "+" + res.ind + national, statut: st, brut: String(brut) };
  }
  /* numéro national sans 0 (pays sans 0 de composition, ou saisie sans le 0) */
  const st = juger(res, digits);
  if (st !== "format à vérifier") return { numero: "+" + res.ind + digits, statut: st, brut: String(brut) };
  /* un autre pays tapé sans + ? On cherche les pays dont l'indicatif ouvre le numéro et dont le format colle :
     un seul candidat, on le prend et on l'annote ; plusieurs, on signale sans deviner. */
  const candidats = pays.PAYS.filter(p => p.ind !== res.ind && digits.startsWith(p.ind) && (() => { let n = digits.slice(p.ind.length); if (p.trunk && n.startsWith("0")) n = n.slice(1); return p.lg.includes(n.length) && (!p.mob.length || p.mob.some(x => n.startsWith(x))); })())
    .filter((p, i, arr) => arr.findIndex(q => q.ind === p.ind) === i);
  if (candidats.length === 1) {
    const p = candidats[0]; let n = digits.slice(p.ind.length); if (p.trunk && n.startsWith("0")) n = n.slice(1);
    return { numero: "+" + p.ind + n, statut: "ok", brut: String(brut), correction: `Pays déduit du numéro : ${p.nom} (+${p.ind}), tapé sans le signe +` };
  }
  if (candidats.length > 1) return { numero: null, statut: "pays incertain", brut: String(brut), propositions: candidats.map(p => `${p.nom} (+${p.ind})`) };
  /* un indicatif connu ouvre le numéro mais le format ne colle pas (ou le pays n'est pas détaillé) : on garde l'indicatif tel quel et on signale */
  const ind = indicatifDe(digits);
  if (ind && digits.length >= 8 && digits.length <= 15 && !(res.trunk && digits.startsWith("0"))) return { numero: "+" + digits, statut: "format à vérifier", brut: String(brut) };
  return { numero: "+" + res.ind + digits, statut: "format à vérifier", brut: String(brut) };
}

/* Deux numéros sont quasi identiques si une seule position diffère ou si l'un est l'autre à un chiffre près. */
function quasiIdentiques(a, b) {
  if (!a || !b || a === b) return false;
  const x = a.replace(/\D/g, ""), y = b.replace(/\D/g, "");
  if (x.length === y.length) { let d = 0; for (let i = 0; i < x.length; i++) if (x[i] !== y[i] && ++d > 1) return false; return d === 1; }
  if (Math.abs(x.length - y.length) === 1) { const [l, c] = x.length > y.length ? [x, y] : [y, x]; for (let i = 0; i < l.length; i++) if (l.slice(0, i) + l.slice(i + 1) === c) return true; }
  return false;
}

module.exports = { normaliser, nettoyer, quasiIdentiques };
