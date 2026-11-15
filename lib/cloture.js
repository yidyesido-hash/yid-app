/* =====================================================================
   ÉTAPE 7 · CLÔTURE
   Trois temps : le remerciement aux invités (modèle de la messagerie),
   le bilan avec le couple (les chiffres du mariage, la date du rendez
   vous, les retours du couple, ce que l'équipe retient), puis la
   suppression des données des invités, au plus tard trente jours après
   le mariage. La suppression garde le bilan chiffré, le plan des tables
   sans noms et la trace des opérations sans leur contenu ; elle efface
   les invités, leurs réponses, leurs numéros, leurs emails, les lots
   reçus et le détail du journal. Elle est définitive et réservée à un
   administrateur, qui retape le code du mariage pour la confirmer.
   État : mariage.parametres.cloture ({ rdv, retours, notes, coches,
   bilan, purge }).
   ===================================================================== */
const db = require("./db");
const store = require("./store");
const liste = require("./liste");
const checklist = require("./checklist");

const JOUR = 864e5;
const propre = (s) => String(s == null ? "" : s).trim();
const present = (c) => c.reponse_le && !/regret/.test((c.reponse || {}).presence || "");
const COCHES = [
  { k: "merci", l: "Le remerciement est parti aux invités", h: "Messagerie, envoi groupé, modèle « Remerciement après le mariage »." },
  { k: "bilan", l: "Le bilan est fait avec le couple" },
  { k: "sharepoint", l: "Le dossier SharePoint du mariage est vidé des listes d'invités", h: "Les fichiers Excel reçus et le collect : l'outil ne les supprime pas lui même." },
  { k: "boite", l: "La boîte email du mariage est archivée", h: "Les échanges avec les invités contiennent leurs coordonnées." },
  { k: "whatsapp", l: "Les conversations WhatsApp avec les invités sont supprimées du téléphone YID" }
];

function etat(m) { const p = m.parametres || {}; return { p, C: Object.assign({ coches: {} }, p.cloture || {}) }; }
async function sauver(m, p, C) { p.cloture = C; await db.query("UPDATE mariage SET parametres = $2, modifie_le = now() WHERE id = $1", [m.id, p]); }

/* Les chiffres du mariage, calculés sur les données vivantes, figés au moment de la suppression. */
async function calculer(m) {
  const j = await liste.liste(m.code), act = j.contacts.filter(c => !c.desactive), p = m.parametres || {}, P = p.plan || {};
  const pers = (c) => { const r = c.reponse || {}; return 1 + (r.accompagnant ? 1 : 0) + (Array.isArray(r.enfants) ? r.enfants.length : 0); };
  const rep = act.filter(c => c.reponse_le), pres = act.filter(present), contactes = act.filter(c => c.premier_contact && c.premier_contact.etat);
  const delais = rep.map(c => { const h = ((c.premier_contact || {}).historique || []).find(x => /envoy/.test(x.etat || "")); return h ? (new Date(c.reponse_le) - new Date(h.le)) / JOUR : null; }).filter(x => x != null && x >= 0).sort((a, b) => a - b);
  const arrives = pres.filter(c => (P.arrives || {})[c.id]);
  const emails = (p.emails || []).reduce((s, c) => s + Object.keys(c.envoyes || {}).length, 0);
  return {
    invites: act.length, contactes: contactes.length, reponses: rep.length, taux_reponse: act.length ? Math.round(rep.length / act.length * 100) : 0,
    presents: pres.length, declines: rep.length - pres.length, personnes_attendues: pres.reduce((s, c) => s + pers(c), 0),
    personnes_accueillies: arrives.reduce((s, c) => s + pers(c), 0), foyers_accueillis: arrives.length,
    delai_median_jours: delais.length ? Math.round(delais[Math.floor(delais.length / 2)] * 10) / 10 : null,
    emails_envoyes: emails, appels_guides: (p.appels || []).length, tables: (P.tables || []).length,
    calcule_le: new Date().toISOString()
  };
}

async function vue(code) {
  const m = await store.mariageFresh(code); if (!m) throw new Error("mariage inconnu");
  const { C } = etat(m), d = m.date_mariage ? String(m.date_mariage).slice(0, 10) : null;
  const purge_prevue = d ? checklist.datePurge(d) : null, passe = d ? new Date(d + "T23:59:59Z") < new Date() : false;
  return {
    date_mariage: d, passe, test: m.statut === "Test", purge_prevue,
    jours_avant_purge: purge_prevue ? Math.ceil((new Date(purge_prevue + "T23:59:59Z") - Date.now()) / JOUR) : null,
    purge: C.purge || null, bilan: C.purge ? C.bilan : await calculer(m),
    rdv: C.rdv || null, retours: C.retours || "", notes: C.notes || "",
    coches: COCHES.map(x => Object.assign({}, x, { ok: !!C.coches[x.k], le: (C.coches[x.k] || {}).le || null, par: (C.coches[x.k] || {}).par || null })),
    close: !!(m.etapes || {})[7]
  };
}

async function purger(m, u) {
  const id = m.id, { p, C } = etat(m);
  C.bilan = await calculer(m);
  const f = "(SELECT id FROM foyer WHERE mariage_id = $1)", cr = "(SELECT id FROM contact_recu WHERE mariage_id = $1)";
  await db.batch([
    [`DELETE FROM anomalie WHERE mariage_id = $1 OR contact_id IN ${cr} OR autre_contact_id IN ${cr}`, [id]],
    [`DELETE FROM reponse WHERE mariage_id = $1`, [id]],
    [`DELETE FROM message WHERE mariage_id = $1`, [id]],
    [`DELETE FROM personne WHERE foyer_id IN ${f}`, [id]],
    [`UPDATE foyer SET relais_id = NULL WHERE mariage_id = $1`, [id]],
    [`DELETE FROM foyer WHERE mariage_id = $1`, [id]],
    [`DELETE FROM contact_recu WHERE mariage_id = $1`, [id]],
    [`DELETE FROM lot WHERE mariage_id = $1`, [id]],
    [`DELETE FROM excel_attente WHERE mariage_id = $1`, [id]],
    [`UPDATE journal SET detail = NULL, avant = NULL, apres = NULL WHERE mariage_id = $1`, [id]]
  ]);
  /* ce qui, dans les réglages du mariage, nomme ou situe des invités */
  delete p.appel; delete p.messagerie_lus; delete p.listes_attendues;
  if (Array.isArray(p.appels)) p.appels = p.appels.map(a => ({ id: a.id, debut: a.debut, fin: a.fin, duree_min: a.duree_min, par: a.par }));
  if (Array.isArray(p.emails)) p.emails = p.emails.map(c => ({ id: c.id, nom: c.nom, cle: c.cle, audience: c.audience, statut: c.statut, envoyes_n: Object.keys(c.envoyes || {}).length }));
  if (p.plan) p.plan = { tables: p.plan.tables || [], accueil: p.plan.accueil };
  C.purge = { le: new Date().toISOString(), par: u.nom };
  C.coches = C.coches || {};
  await sauver(m, p, C);
  await db.query("UPDATE mariage SET espace_jeton = NULL WHERE id = $1", [id]);
  await store.journal(id, "Données des invités supprimées", `${C.bilan.invites} invité(s), le bilan chiffré est conservé`, null, null, u.nom);
}

async function agir(code, op, b, u) {
  const m = await store.mariageFresh(code); if (!m) throw new Error("mariage inconnu");
  const { p, C } = etat(m);
  if (op === "noter") {
    if (b.rdv !== undefined) C.rdv = propre(b.rdv).slice(0, 16) || null;
    if (b.retours !== undefined) C.retours = propre(b.retours).slice(0, 4000);
    if (b.notes !== undefined) C.notes = propre(b.notes).slice(0, 4000);
    await sauver(m, p, C); return;
  }
  if (op === "cocher") {
    const k = String(b.k || ""); if (!COCHES.some(x => x.k === k)) throw new Error("case inconnue");
    C.coches = C.coches || {}; if (b.on) C.coches[k] = { le: new Date().toISOString(), par: u.nom }; else delete C.coches[k];
    await sauver(m, p, C); await store.journal(m.id, "Clôture", (b.on ? "Fait : " : "Rouvert : ") + COCHES.find(x => x.k === k).l, null, null, u.nom); return;
  }
  if (op === "purger") {
    if (u.role !== "administrateur") throw new Error("La suppression des données est réservée à un administrateur.");
    if (C.purge) throw new Error("Les données de ce mariage sont déjà supprimées.");
    const d = m.date_mariage ? String(m.date_mariage).slice(0, 10) : null;
    /* pas d'exception pour un mariage Test : un mariage réel sert aussi de terrain d'essai, on ne vide jamais une liste vivante */
    if (!d || new Date(d + "T23:59:59Z") >= new Date()) throw new Error("La suppression s'ouvre le lendemain du mariage.");
    if (propre(b.confirme).toUpperCase() !== String(m.code).toUpperCase()) throw new Error("Retapez le code du mariage pour confirmer.");
    await purger(m, u); return;
  }
  if (op === "clore") {
    if (!C.purge) throw new Error("Le mariage se clôt une fois les données des invités supprimées.");
    const etapes = Object.assign({}, m.etapes || {}); etapes[7] = new Date().toISOString();
    await db.query("UPDATE mariage SET etapes = $2, etape = 7, statut = CASE WHEN statut = 'Test' THEN statut ELSE 'Clos' END, modifie_le = now() WHERE id = $1", [m.id, etapes]);
    await store.journal(m.id, "Étape terminée", "7. Clôture, le mariage est clos", null, null, u.nom); return;
  }
  throw new Error("opération inconnue");
}

module.exports = { vue, agir, COCHES };
