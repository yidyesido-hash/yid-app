/* =====================================================================
   LE LIEN PERSONNEL DE L'INVITÉ (M18, M20 à M24)
   L'invité reste sur le site Squarespace du mariage. Le script Yes I Do
   y lit son jeton, demande ici ce que nous savons de lui, et insère son
   message d'accueil puis un formulaire qui ne demande que ce qui manque.
   Le jeton est aléatoire (jamais la clé AC001, qui se devine) : un lien
   ne dévoile que la fiche de son invité.
   ===================================================================== */
const crypto = require("crypto");
const db = require("./db");
const store = require("./store");
const accueil = require("./accueil");
const espace = require("./espace");

const ALPHA = "abcdefghjkmnpqrstuvwxyz23456789";
function nouveauJeton() { const b = crypto.randomBytes(12); let s = ""; for (let i = 0; i < 12; i++) s += ALPHA[b[i] % ALPHA.length]; return s; }
const propre = (s) => String(s == null ? "" : s).trim();

/* Chaque fiche active reçoit son jeton, une fois pour toutes ; l'outil ne propose le lien que sur une fiche complète. */
async function assurer(mariageId) {
  const rows = await db.query("SELECT id FROM contact_recu WHERE mariage_id = $1 AND jeton IS NULL AND NOT desactive", [mariageId]);
  for (const r of rows) await db.query("UPDATE contact_recu SET jeton = $2 WHERE id = $1 AND jeton IS NULL", [r.id, nouveauJeton()]);
  return rows.length;
}

/* L'adresse du site du mariage, déclarée sur sa fiche, suivie du jeton. */
function lien(m, jeton) {
  const site = propre(m.site || "");
  if (!site || !jeton) return null;
  const base = /^https?:\/\//.test(site) ? site : "https://" + site;
  return base.replace(/\/+$/, "") + "/?yid=" + jeton;
}

async function charger(jeton) {
  const j = propre(jeton).toLowerCase();
  if (!/^[a-z0-9]{12}$/.test(j)) return null;
  const c = (await db.query("SELECT * FROM contact_recu WHERE jeton = $1 AND NOT desactive", [j]))[0];
  if (!c) return null;
  const m = (await db.query("SELECT * FROM mariage WHERE id = $1", [c.mariage_id]))[0];
  return m ? { c, m } : null;
}

/* Les questions, selon ce que la fiche sait déjà et le profil de l'invité. */
function questions(c, m) {
  const q = c.qualification || {}, ad = Array.isArray(q.a_demander) ? q.a_demander : [], r = c.reponse || {}, out = [];
  const p = accueil.profil(c.lien);
  out.push({ k: "presence", type: "choix", l: p === "parents" || p === "fratrie" ? "Serez vous à leurs côtés ce jour là ?" : "Serez vous des nôtres ?", o: ["Avec joie, je serai présent(e)", "À regret, je ne pourrai pas venir"], v: r.presence || null, requis: true });
  const acc = accueil.accompagnant(c);
  if (acc.etat === "connu") out.push({ k: "accompagnant", type: "fixe", l: "Vous serez accompagné(e) de", v: acc.libelle, si: "presence:0" });
  else if (acc.etat === "à indiquer") out.push({ k: "accompagnant", type: "texte", l: "Qui vous accompagnera ?", aide: "Son prénom et son nom, pour l'accueillir comme il se doit.", v: r.accompagnant || "", requis: true, si: "presence:0" });
  else if (acc.etat === "à décider" && ad.includes("seul ou accompagné")) {
    out.push({ k: "vient_accompagne", type: "choix", l: "Viendrez vous accompagné(e) ?", o: ["Oui", "Non, je viendrai seul(e)"], v: r.vient_accompagne || null, requis: true, si: "presence:0" });
    out.push({ k: "accompagnant", type: "texte", l: "Qui vous accompagnera ?", aide: "Son prénom et son nom.", v: r.accompagnant || "", requis: true, si: "vient_accompagne:0" });
  }
  const nb = Number.isInteger(c.nb_enfants) ? c.nb_enfants : null;
  if (nb && nb > 0) out.push({ k: "enfants", type: "enfants", l: nb > 1 ? "Vos enfants" : "Votre enfant", aide: "Leur prénom et leur âge suffisent.", n: nb, v: Array.isArray(r.enfants) ? r.enfants : [], requis: true, si: "presence:0" });
  else if (ad.includes("enfants")) out.push({ k: "nb_enfants", type: "choix", l: "Viendrez vous avec des enfants ?", o: ["Non", "1", "2", "3", "4"], v: r.nb_enfants || null, requis: true, si: "presence:0" });
  out.push({ k: "mot", type: "long", l: p === "parents" || p === "fratrie" || p === "temoins" ? "Un mot pour nous, une attention à prévoir ?" : "Un mot pour les mariés ou pour nous ?", v: r.mot || "", si: "presence:*" });
  return out;
}

async function lire(jeton) {
  const x = await charger(jeton); if (!x) return null;
  const { c, m } = x, ap = accueil.apercu(c, m), ck = ((m.parametres || {}).checklist) || {};
  return {
    couple: accueil.maries(m).couple || m.prenoms, date: m.date_mariage, lieu: m.lieu || ck.lieu || "",
    salutation: ap.salutation, appel: accueil.appel(c, m), accroche: ap.accroche, profil: ap.profil,
    questions: questions(c, m), deja: !!c.reponse_le, repondu_le: c.reponse_le,
    equipe: await espace.equipe()
  };
}

async function repondre(jeton, b) {
  const x = await charger(jeton); if (!x) throw new Error("lien inconnu");
  const { c, m } = x, qs = questions(c, m), v = {}, src = (b && b.reponses) || {};
  const val = (k) => v[k];
  const actif = (q) => { if (!q.si) return true; const [k, i] = q.si.split(":"); if (i === "*") return !!val(k); const qq = qs.find(z => z.k === k); return qq && qq.o && val(k) === qq.o[Number(i)]; };
  for (const q of qs) {
    if (q.type === "fixe") continue;
    let r = src[q.k];
    if (q.type === "choix") r = q.o.includes(r) ? r : null;
    else if (q.type === "enfants") r = (Array.isArray(r) ? r : []).slice(0, q.n).map(e => ({ prenom: propre(e && e.prenom).slice(0, 60), age: Number.isInteger(Number(e && e.age)) && propre(e && e.age) !== "" ? Math.max(0, Math.min(25, Number(e.age))) : null }));
    else r = propre(r).slice(0, q.type === "long" ? 1500 : 120) || null;
    v[q.k] = r;
    if (!actif(q)) { v[q.k] = null; continue; }
    const vide = r == null || (q.type === "enfants" && (r.length < q.n || r.some(e => !e.prenom || e.age == null)));
    if (q.requis && vide) throw new Error("Il manque une réponse : " + q.l.replace(/\s*\?$/, "").toLowerCase() + ".");
  }
  const avant = c.reponse || null;
  await db.query("UPDATE contact_recu SET reponse = $2, reponse_le = now(), modifie_le = now() WHERE id = $1", [c.id, v]);
  const vient = v.presence === qs[0].o[0];
  await store.journal(m.id, "Réponse de l'invité", `${c.nom_repertoire} a répondu sur son lien personnel : ${vient ? "présent" : "absent"}${v.accompagnant ? ", accompagné de " + v.accompagnant : ""}${Array.isArray(v.enfants) && v.enfants.length ? ", " + v.enfants.length + " enfant(s)" : ""}`, avant, v, "invité");
  return { ok: true, present: vient };
}

module.exports = { nouveauJeton, assurer, lien, lire, repondre, questions };
