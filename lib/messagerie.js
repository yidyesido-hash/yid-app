/* =====================================================================
   LA MESSAGERIE DU MARIAGE (M39) · hors des étapes
   La boîte du mariage, vue depuis l'outil : reçus (invités, couple),
   envoyés (pour vérifier ce qui est parti), brouillons (les envois
   groupés en préparation), écrire ou répondre à un invité.
   Lire ne marque rien comme lu : la relève des contacts du couple garde
   son propre fonctionnement. Écrire passe par un aperçu puis une
   confirmation ; un mariage en statut Test n'écrit qu'à l'équipe.
   ===================================================================== */
const db = require("./db");
const store = require("./store");
const graph = require("./graph");
const emails = require("./emails");

const propre = (s) => String(s == null ? "" : s).trim();
const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(propre(e));
const FAUX = () => !!process.env.YID_MAIL_FAKE;

async function contexte(code) {
  const m = await store.mariageFresh(code); if (!m) throw new Error("mariage inconnu");
  if (!m.boite_email) throw new Error("Ce mariage n'a pas encore de boîte email (fiche du mariage).");
  if (!FAUX() && !graph.enabled()) throw new Error("La connexion Microsoft n'est pas active sur ce serveur.");
  return m;
}
/* Qui écrit : un invité de la liste, le couple, ou une adresse inconnue. */
async function annuaire(m) {
  const rows = await db.query("SELECT id, nom_repertoire, email FROM contact_recu WHERE mariage_id = $1 AND email IS NOT NULL AND NOT desactive", [m.id]);
  const map = {}; for (const r of rows) map[propre(r.email).toLowerCase()] = { id: r.id, nom: r.nom_repertoire };
  const ck = ((m.parametres || {}).checklist) || {};
  for (const k of ["email_epoux", "email_epouse"]) if (ck[k]) map[propre(ck[k]).toLowerCase()] = { couple: true, nom: "Le couple" };
  return map;
}
const qui = (map, adr) => map[propre(adr).toLowerCase()] || null;

/* L'état lu ou non lu est tenu par l'outil, pas par la boîte : la relève des contacts du couple
   s'appuie sur les messages non lus de la boîte, il ne faut pas y toucher. */
const lus = (m) => new Set(((m.parametres || {}).messagerie_lus) || []);
async function marquer(m, ids) {
  const p = m.parametres || {}, set = lus(m); ids.forEach(i => set.add(String(i)));
  p.messagerie_lus = Array.from(set).slice(-800);
  await db.query("UPDATE mariage SET parametres = $2 WHERE id = $1", [m.id, p]);
}
async function dossier(code, nom) {
  const m = await contexte(code), map = await annuaire(m), L = lus(m);
  let list;
  if (FAUX()) list = nom === "recus" ? (global.__YID_INBOX || []) : (global.__YID_MAILS || []).filter(x => x.de === m.boite_email).map((x, i) => ({ id: "f" + i, subject: x.objet, toRecipients: [{ emailAddress: { address: x.a } }], sentDateTime: x.le || new Date().toISOString(), bodyPreview: "" }));
  else {
    const f = nom === "recus" ? "inbox" : "sentitems", sel = "id,subject,from,toRecipients,receivedDateTime,sentDateTime,bodyPreview,isRead";
    list = ((await graph.call("GET", `/users/${encodeURIComponent(m.boite_email)}/mailFolders/${f}/messages?$select=${sel}&$top=40&$orderby=${nom === "recus" ? "receivedDateTime" : "sentDateTime"} desc`)).value || []);
  }
  return list.map(x => {
    const adr = nom === "recus" ? ((x.from || {}).emailAddress || {}).address : (((x.toRecipients || [])[0] || {}).emailAddress || {}).address;
    const nomAdr = nom === "recus" ? ((x.from || {}).emailAddress || {}).name : null;
    return { id: x.id, objet: x.subject || "(sans objet)", adresse: adr || "", nom: nomAdr || "", fiche: qui(map, adr), le: x.receivedDateTime || x.sentDateTime, apercu: propre(x.bodyPreview).slice(0, 180), lu: nom !== "recus" || L.has(String(x.id)) };
  });
}

async function lire(code, id) {
  const m = await contexte(code); await marquer(m, [id]);
  if (FAUX()) { const x = (global.__YID_INBOX || []).find(y => y.id === id); if (!x) throw new Error("message introuvable"); return { id, objet: x.subject, html: "<p>" + (x.bodyPreview || "") + "</p>", de: x.from.emailAddress.address }; }
  const x = await graph.call("GET", `/users/${encodeURIComponent(m.boite_email)}/messages/${encodeURIComponent(id)}?$select=id,subject,from,body,receivedDateTime,toRecipients`);
  return { id: x.id, objet: x.subject, html: (x.body || {}).content || "", de: (((x.from || {}).emailAddress) || {}).address || "", le: x.receivedDateTime };
}

async function repondre(code, id, texte, u) {
  const m = await contexte(code), t = propre(texte); if (!t) throw new Error("Le message est vide.");
  if (FAUX()) (global.__YID_MAILS = global.__YID_MAILS || []).push({ de: m.boite_email, a: "réponse:" + id, objet: "Re", le: new Date().toISOString() });
  else await graph.call("POST", `/users/${encodeURIComponent(m.boite_email)}/messages/${encodeURIComponent(id)}/reply`, { comment: t });
  await store.journal(m.id, "Email", "Réponse envoyée depuis la messagerie du mariage", null, null, u.nom);
}

/* Un email à une personne : aperçu d'abord (rien ne part), puis envoi confirmé. */
async function ecrire(code, b, u, envoyer) {
  const m = await contexte(code), a = propre(b.a).toLowerCase(), objet = propre(b.objet), corps = String(b.corps || "");
  if (!emailOk(a)) throw new Error("Adresse email incomplète.");
  if (!objet || !propre(corps)) throw new Error("Indiquez un objet et un message.");
  const c = b.contact ? (await db.query("SELECT * FROM contact_recu WHERE id = $1 AND mariage_id = $2", [Number(b.contact), m.id]))[0] : null;
  const pour = c || { id: 0, nom_repertoire: "", prenom: "", civilite: null, lien: null, jeton: null };
  const html = emails.html(corps, pour, m), sujet = emails.remplir(objet, pour, m);
  if (!envoyer) return { apercu: { a, objet: sujet, html } };
  if (m.statut === "Test" && !/@yidyesido\.(info|onmicrosoft\.com)$/i.test(a)) throw new Error("Mariage en statut Test : il n'écrit qu'à l'équipe Yes I Do.");
  if (FAUX()) (global.__YID_MAILS = global.__YID_MAILS || []).push({ de: m.boite_email, a, objet: sujet, le: new Date().toISOString() });
  else await graph.call("POST", `/users/${encodeURIComponent(m.boite_email)}/sendMail`, { message: { subject: sujet, body: { contentType: "HTML", content: html }, toRecipients: [{ emailAddress: { address: a } }] }, saveToSentItems: true });
  await store.journal(m.id, "Email", `Email « ${sujet} » envoyé à ${c ? c.nom_repertoire : a}`, null, null, u.nom);
  return { envoye: true };
}

async function destinataires(code) {
  const m = await store.mariageFresh(code); if (!m) throw new Error("mariage inconnu");
  return (await db.query("SELECT id, nom_repertoire AS nom, email FROM contact_recu WHERE mariage_id = $1 AND email IS NOT NULL AND email <> '' AND NOT desactive ORDER BY nom_repertoire", [m.id]));
}

async function nonLus(code) { const l = await dossier(code, "recus"); return l.filter(x => !x.lu).length; }
async function toutLu(code) { const m = await contexte(code), l = await dossier(code, "recus"); await marquer(m, l.map(x => x.id)); }

module.exports = { nonLus, toutLu, dossier, lire, repondre, ecrire, destinataires };
