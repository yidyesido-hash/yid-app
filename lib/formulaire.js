/* =====================================================================
   LE FORMULAIRE DES INVITÉS, CÔTÉ SERVEUR (moteur v2, méthode YID)
   Compose la configuration du mariage (fiche, parties A et D) et le foyer
   (collect), sert le moteur partagé public/formulaire/moteur.js, puis
   relit chaque réponse avec ce même moteur : rien n'est enregistré qui
   n'aurait pas été accepté à l'écran. La réponse stockée garde les champs
   historiques (presence, accompagnant, enfants, hebergement, mot) lus par
   le plan, la logistique, les emails, la clôture et l'espace.
   ===================================================================== */
const db = require("./db");
const store = require("./store");
const accueil = require("./accueil");
const MOTEUR = require("../public/formulaire/moteur.js");
const PAYS = require("../public/formulaire/pays.js");

const propre = (s) => String(s == null ? "" : s).trim();
const MOIS = { en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"], fr: ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"], pt: ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"] };
const JOURS = { en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"], fr: ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"], pt: ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"] };
function d(iso) { return iso ? new Date(String(iso).slice(0, 10) + "T12:00:00Z") : null; }
function dateL(iso, l, avecJour) {
  const x = d(iso); if (!x) return "";
  const j = x.getUTCDate(), mo = MOIS[l][x.getUTCMonth()], an = x.getUTCFullYear(), jr = JOURS[l][x.getUTCDay()];
  if (l === "pt") return (avecJour ? jr + ", " : "") + j + " de " + mo + " de " + an;
  if (l === "en") return (avecJour ? jr + " " : "") + j + " " + mo + " " + an;
  return (avecJour ? jr + " " : "") + (j === 1 ? "1er" : j) + " " + mo + " " + an;
}
const bi = (f) => ({ fr: f("fr"), pt: f("pt"), en: f("en") });
/* Les mots des mariés (moments, plats, nuits), traduits par la fiche (D15, D16) ; à défaut, ils restent en français. */
function traducteur(f) {
  const T = { en: {}, pt: {} };
  ["en", "pt"].forEach(l => (((f.traductions || {})[l]) || []).forEach(x => { const m = String(x).match(/^(.+?)\s=\s(.+)$/); if (m) T[l][m[1].trim().toLowerCase()] = m[2].trim(); }));
  return (fr) => { const k = String(fr || "").trim(); return { fr: k, pt: T.pt[k.toLowerCase()] || k, en: T.en[k.toLowerCase()] || k }; };
}
const oui = (v) => v === "Oui" || v === true;

/* Les moments, depuis le programme de la fiche (D1) ; un mariage déclaré avant la 1.22 garde sa liste de libellés. */
function moments(f) {
  const T = traducteur(f);
  const P = Array.isArray(f.programme) && f.programme.length ? f.programme : (f.moments || []).map(l => ({ libelle: typeof l === "string" ? l : (l && l.libelle) || "", heure: "", lieu: "", acces: "Tous les invités", service: /vin d.honneur|cocktail|d[îi]ner|d[ée]jeuner|brunch|repas|r[ée]ception|soir[ée]e|buffet/i.test(String(l)) ? (/d[îi]ner|d[ée]jeuner|repas/i.test(String(l)) ? "Repas servi à table" : "Cocktail ou vin d'honneur") : "Rien n'est servi" }));
  const L = P.filter(m => propre(m.libelle)).map((m, i) => {
    const d = [m.heure ? m.heure.replace(":", " h ") : "", propre(m.lieu)].filter(Boolean).join(", ");
    return { id: "m" + (i + 1), l: T(propre(m.libelle)), d: d ? { fr: d, pt: d, en: [m.heure || "", propre(m.lieu)].filter(Boolean).join(", ") } : null, ouvert: m.acces !== "Sur invitation", traiteur: m.service !== "Rien n'est servi", service: m.service };
  });
  const repas = L.find(m => m.service === "Repas servi à table") || L.find(m => m.service === "Buffet");
  if (repas) repas.repas = true;
  return L;
}

/* Les trajets : ceux réglés en logistique (avec leurs rotations de retour) priment sur la liste de la fiche (D11). */
function trajets(m, f) {
  const T = traducteur(f), L = require("./logistique").config(m);
  if (L.navettes.length) return L.navettes.map(n => { const l = `${n.moment} : ${n.de} vers ${n.vers}${n.depart ? ", départ " + n.depart : ""}`; return { id: String(n.id), l: T(l), retours: (n.retours || []).slice(), de: n.de }; });
  return [];
}
function config(m) {
  const p = m.parametres || {}, ck = p.checklist || {}, f = p.formulaire || {};
  const hebRegime = ck.hebergement === "Tous les invités" ? "tous" : ck.hebergement === "Une partie des invités" ? "partiel" : "aucun";
  const lieux = (ck.lieux_hebergement || p.lieux_hebergement || []).map(propre).filter(Boolean);
  const M = moments(f), assis = M.some(x => x.service === "Repas servi à table");
  const plats = assis ? (f.plats || []).map(propre).filter(Boolean).map((l, i) => ({ v: "p" + (i + 1), l: traducteur(f)(l) })) : [];
  const dm = m.date_mariage;
  const jours = [-1, 0, 1].map(k => { const x = d(dm); if (!x) return null; x.setUTCDate(x.getUTCDate() + k); const iso = x.toISOString().slice(0, 10); return { v: iso, l: bi(l => { const s = dateL(iso, l, true); return s.charAt(0).toUpperCase() + s.slice(1); }) }; }).filter(Boolean);
  return {
    maries: accueil.maries(m).couple || m.prenoms,
    quand: bi(l => { const s = dateL(dm, l, true); return (s.charAt(0).toUpperCase() + s.slice(1)) + (m.lieu || ck.lieu ? (l === "pt" ? ", " : ", ") + (m.lieu || ck.lieu) : ""); }),
    reponseAvant: bi(l => dateL(f.date_reponse, l)), modifJusqu: bi(l => dateL(f.date_modification, l)),
    moments: M,
    heb: { gere: hebRegime, offert: hebRegime !== "aucun" && oui(f.hebergement_offert), lieux, lieu: lieux[0] || "", nuits: traducteur(f)(propre(f.nuits)), acces: oui(f.acces_anticipe) },
    plats, cuisson: oui(f.cuisson), ageMenu: Number(f.age_menu_enfant) || null,
    protection: oui(f.protection_liste != null ? f.protection_liste : f.audience_maitrisee), pass: f.pass || (oui(f.protection_liste || f.audience_maitrisee) ? "Pass de contrôle, avec QR" : "Pass d'accueil, avec QR"), arrivees: oui(f.arrivees) || require("./logistique").config(m).transfert, jours,
    trajets: trajets(m, f),
    conciergerie: oui(ck.conciergerie), engagement: oui(f.engagement_horaires),
    langues: f.langues || [m.langue_defaut || "fr"], site: m.site || null,
    paysPrio: ["FR", "BE", "LU", "CH", "PT", "GB"]
  };
}
/* Le moteur v2 ne s'ouvre que sur un mariage dont la partie D de la fiche est remplie. */
function actif(m) { const f = ((m && m.parametres) || {}).formulaire || {}; return ((Array.isArray(f.programme) && f.programme.length > 0) || (Array.isArray(f.moments) && f.moments.length > 0)) && !!f.date_reponse; }

/* Le numéro en deux morceaux : l'indicatif (pays) et le numéro national. */
function telephone(num) {
  const n = propre(num).replace(/[\s.()-]/g, "");
  if (!/^\+\d{6,}$/.test(n)) return { ind: "FR", tel: n.replace(/^\+33/, "") };
  const cands = PAYS.filter(p => n.startsWith(p[1].replace(/\s/g, ""))).sort((a, b) => b[1].length - a[1].length);
  const meme = cands.filter(p => cands[0] && p[1] === cands[0][1]), pref = meme.find(p => ["FR", "US", "GB", "RU", "IT", "NO", "FI"].includes(p[0])) || meme[0];
  return pref ? { ind: pref[0], tel: n.slice(pref[1].replace(/\s/g, "").length) } : { ind: "FR", tel: n };
}

function foyer(c, m) {
  const cfg = config(m), nbAcc = Number.isInteger(c.nb_accompagnants) ? c.nb_accompagnants : null;
  let type = "libre";
  if (nbAcc != null && nbAcc >= 2) type = "plusieurs";
  else if (c.invitation === "Invitation pour deux" || nbAcc === 1 && propre(c.accompagnant)) type = "deux";
  else if (c.invitation === "Invitation unique" || nbAcc === 0) type = "unique";
  const per = require("./liste").presences(c), heb = propre(c.hebergement);
  const loge = cfg.heb.gere === "tous" ? cfg.heb.offert : cfg.heb.gere === "partiel" ? !!heb && heb !== "Par leurs propres moyens" : false;
  const t = telephone(c.numero || c.numero_brut);
  const L = propre(c.langue || m.langue_defaut || "fr").toLowerCase();
  return {
    type, max: type === "plusieurs" ? Math.min(nbAcc, 5) : null, accNom: type === "deux" ? propre(c.accompagnant) || null : null,
    enfants: Number.isInteger(c.nb_enfants) && c.nb_enfants > 0 ? Math.min(c.nb_enfants, 7) : 0,
    loge, lieu: cfg.heb.lieux.includes(heb) ? heb : cfg.heb.lieu,
    moments: per.length ? cfg.moments.filter(x => per.includes(x.l.fr)).map(x => x.id) : null,
    langue: L === "pt" || L === "en" ? L : L === "nl" ? "en" : "fr",
    civ: accueil.CIVILITES.includes(c.civilite) ? c.civilite : "", nom: propre(c.nom), prenom: propre(c.prenom), appel: accueil.appel(c, m), ind: t.ind, tel: t.tel, email: propre(c.email)
  };
}

/* L'état envoyé par la page : borné en taille, chaque texte raccourci, aucune clé exotique. */
function assainir(x, prof) {
  if (prof > 6) return undefined;
  if (x == null || typeof x === "boolean" || typeof x === "number") return x;
  if (typeof x === "string") return x.slice(0, 1500);
  if (Array.isArray(x)) return x.slice(0, 20).map(v => assainir(v, prof + 1));
  if (typeof x === "object") { const o = {}; Object.keys(x).slice(0, 60).forEach(k => { if (/^[a-zA-Z0-9_]{1,40}$/.test(k) && k !== "__proto__" && k !== "constructor" && k !== "prototype") o[k] = assainir(x[k], prof + 1); }); return o; }
  return undefined;
}

function vue(c, m) {
  const etat = c.brouillon || (c.reponse && c.reponse.etat) || null;
  if (etat) etat.step = c.reponse_le ? "recap" : (etat.step || "accueil");
  return { v: 2, cfg: config(m), foyer: foyer(c, m), etat, deja: !!c.reponse_le, repondu_le: c.reponse_le, modifiable: modifiable(m) };
}
function modifiable(m) { const f = ((m.parametres || {}).formulaire) || {}; if (!f.date_modification) return true; return new Date().toISOString().slice(0, 10) <= f.date_modification; }

/* Lecture et contrôle d'un état : le même moteur que l'écran. */
function relire(c, m, brut) {
  const S = assainir(brut || {}, 0) || {};
  const e = MOTEUR.creer(config(m), foyer(c, m), S);
  return { e, S: e.etat(), manque: S.presence === "oui" ? e.verifierTout() : [] };
}

async function brouillon(c, m, brut) {
  if (JSON.stringify(brut || {}).length > 60000) throw new Error("Réponse trop volumineuse.");
  const { S } = relire(c, m, brut);
  await db.query("UPDATE contact_recu SET brouillon = $2 WHERE id = $1", [c.id, S]);
  return { ok: true };
}

async function repondre(c, m, brut) {
  if (JSON.stringify(brut || {}).length > 60000) throw new Error("Réponse trop volumineuse.");
  if (c.reponse_le && !modifiable(m)) throw new Error("Les réponses ne sont plus modifiables. Notre équipe reste à votre écoute.");
  const { e, S, manque } = relire(c, m, brut);
  if (!["oui", "non", "inconnu"].includes(S.presence)) throw new Error("Il manque votre réponse à l'invitation.");
  if (manque.length) throw new Error("Il manque encore : " + manque.join(", ") + ".");
  const sig = e.signaux(), avant = c.reponse || null;
  if (S.presence === "inconnu") {
    await db.query("UPDATE contact_recu SET brouillon = $2, signaux = $3, modifie_le = now() WHERE id = $1", [c.id, S, JSON.stringify(sig)]);
    await store.journal(m.id, "Réponse de l'invité", `${c.nom_repertoire} ne sait pas encore s'il pourra venir`, null, null, "invité");
    return { ok: true, presence: "inconnu", present: false };
  }
  const rep = Object.assign(e.compat(), { etat: S, detail: e.personnes(), recap: e.collecte().rows, a_confirmer: e.aConfirmer(), langue: e.langue() });
  const email = S.presence === "oui" && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(propre(S.coord.email)) ? propre(S.coord.email).toLowerCase() : null;
  await db.query("UPDATE contact_recu SET reponse = $2, reponse_le = now(), brouillon = NULL, signaux = $3, modifie_le = now()" + (email ? ", email = $4" : "") + " WHERE id = $1", email ? [c.id, rep, JSON.stringify(sig), email] : [c.id, rep, JSON.stringify(sig)]);
  const n = rep.personnes || 0;
  await store.journal(m.id, avant ? "Réponse modifiée par l'invité" : "Réponse de l'invité", `${c.nom_repertoire} : ${S.presence === "oui" ? "présent, " + n + " personne(s)" : "absent"}${sig.length ? " · " + sig.length + " signal(aux)" : ""}`, avant ? { presence: avant.presence, personnes: avant.personnes } : null, { presence: rep.presence, personnes: n }, "invité");
  let recap = null;
  if (S.presence === "oui" && email) { try { recap = await require("./recap").envoyer(c, m, e, rep, email); } catch (x) { await store.journal(m.id, "Récapitulatif non envoyé", `${c.nom_repertoire} : ${x.message}`, null, null, "système"); } }
  return { ok: true, presence: S.presence, present: S.presence === "oui", recap: !!recap };
}

/* Pour l'équipe : les signaux de tous les foyers, ceux qui demandent une action d'abord. */
async function signaux(code) {
  const m = (await db.query("SELECT * FROM mariage WHERE code = $1", [code]))[0]; if (!m) throw new Error("mariage inconnu");
  const rows = await db.query("SELECT id, cle, nom_repertoire, signaux, reponse_le FROM contact_recu WHERE mariage_id = $1 AND NOT desactive AND jsonb_array_length(signaux) > 0 ORDER BY cle", [m.id]);
  return rows.map(r => ({ id: r.id, cle: r.cle, nom: r.nom_repertoire, signaux: r.signaux, repondu: !!r.reponse_le }));
}

module.exports = { config, foyer, actif, vue, relire, brouillon, repondre, signaux, telephone, dateL, moments };
