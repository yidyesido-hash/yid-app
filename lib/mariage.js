/* =====================================================================
   MARIAGES · déclaration (étape Cadrage), dossier SharePoint, classeurs
   miroirs, fiche call 1, accueil et réglages.
   ===================================================================== */
const db = require("./db");
const store = require("./store");
const graph = require("./graph");
const xlsx = require("./xlsx");
const pdf = require("./pdf");
const checklist = require("./checklist");

const ETAPES = checklist.ETAPES;
const safe = (s) => String(s || "").replace(/[\\/:*?"<>|#%]/g, " ").replace(/\s+/g, " ").trim();

/* ---------- réglages : textes vivants ---------- */
const CHEMINEMENT_DEFAUT = [
  "1. Cadrage. Le premier rendez vous avec le couple : nous reprenons le devis, nous découvrons leur mariage, nous fixons la date de remise de la liste et la date de clôture. Le mariage existe alors dans l'outil, avec son dossier et ses classeurs.",
  "2. Contacts reçus. Le couple nous envoie les contacts de son téléphone, par email ou en les déposant dans son espace. L'outil les lit, les contrôle, retire les doublons et construit la liste.",
  "3. Liste d'invités. Nous qualifions la liste ligne par ligne avec le couple : côté, invitation, lien, enfants, hébergement. Quand une ligne est complète, son foyer reçoit sa clé, pour toujours.",
  "4. Premier contact et invitations. Chaque foyer est appelé comme à un rendez vous, ou reçoit son lien personnel. La plateforme s'ouvre, les invitations partent.",
  "5. Confirmations et suivi. Les invités confirment et répondent aux formulaires ; l'outil relance avec mesure, détecte les anomalies, et nous ne voyons que les exceptions.",
  "6. Séjour et logistique. Hébergements, chauffeurs, navettes, conciergerie : tout ce qui concerne le séjour de chaque invité, avec les rapports pour le lieu et les prestataires.",
  "7. Plan de table et jour J. Le placement de chaque personne, les pass, l'accueil sur place et l'escorte jusqu'à la table.",
  "8. Clôture. Le remerciement, le bilan avec le couple, puis la suppression des données des invités sous trente jours."
].join("\n");

async function reglage(cle) { const r = await db.query("SELECT valeur FROM reglage WHERE cle = $1", [cle]); return r[0] ? r[0].valeur : null; }
async function reglages() {
  let c = await reglage("cheminement");
  if (c === null) { await db.query("INSERT INTO reglage (cle, valeur, modifie_par) VALUES ('cheminement', $1, 'installation') ON CONFLICT DO NOTHING", [CHEMINEMENT_DEFAUT]); c = CHEMINEMENT_DEFAUT; }
  return { cheminement: c, etapes: ETAPES };
}
async function saveReglage(cle, valeur, operateur) {
  const avant = await reglage(cle);
  await db.query("INSERT INTO reglage (cle, valeur, modifie_par, modifie_le) VALUES ($1,$2,$3,now()) ON CONFLICT (cle) DO UPDATE SET valeur = EXCLUDED.valeur, modifie_par = EXCLUDED.modifie_par, modifie_le = now()", [cle, String(valeur), operateur]);
  await store.journal(null, "Réglage modifié", cle, avant === null ? null : { valeur: String(avant).slice(0, 400) }, { valeur: String(valeur).slice(0, 400) }, operateur);
}

/* ---------- code du mariage : initiales + année, unique ---------- */
async function codeLibre(initiales, dateMariage) {
  const base = (initiales || "XX").toUpperCase() + String(dateMariage || "").slice(2, 4);
  let code = base, n = 2;
  while ((await db.query("SELECT 1 FROM mariage WHERE code = $1", [code])).length) code = base + n++;
  return code;
}

/* ---------- miroirs ---------- */
function feuillesPilotage(data, prenoms) {
  const params = checklist.fiche(data).flatMap(s => s.rows.map(r => [s.heading.slice(0, 1), r[0], r[1]]));
  return [
    { name: "Paramètres", table: "Parametres", headers: ["Partie", "Champ", "Valeur"], rows: params },
    { name: "Base invités", table: "BaseInvites", headers: ["Clé", "Nom dans votre téléphone", "Téléphone", "Côté", "Invitation", "Lien avec vous", "Précision", "Besoin d'assistance", "Nombre d'enfants", "Nom", "Prénom", "Désactivé", "Deuxième numéro trouvé", "Source", "Statut", "Canal", "Langue", "Email", "Relais"], rows: [] },
    { name: "Personnes", table: "Personnes", headers: ["Clé", "Foyer", "Prénom", "Nom", "Enfant", "Âge", "Présence", "Menu", "Régime", "Table"], rows: [] },
    { name: "Campagne", table: "Campagne", headers: ["Clé", "Foyer", "Nature", "Canal", "Message", "Date", "Opérateur", "Réponse"], rows: [] },
    { name: "Suivi", table: "Suivi", headers: ["Clé", "Foyer", "Confirmation", "Voyage", "Hébergement", "Chauffeur", "Navettes", "Charte", "Relances", "Dernière interaction", "Anomalies ouvertes"], rows: [] },
    { name: "Journal", table: "Journal", headers: ["Date", "Opération", "Détail", "Avant", "Après", "Opérateur"], rows: [] }
  ];
}
const feuillesContacts = () => [
  { name: "Reçus", table: "Recus", headers: ["Reçu le", "Source", "Côté", "Nom de répertoire", "Numéros", "Fichier"], rows: [] },
  { name: "Anomalies", table: "Anomalies", headers: ["Détectée le", "Type", "Foyer", "Détail", "État", "Décision", "Tranchée par", "Tranchée le"], rows: [] }
];

async function creerSharePoint(m, data, version) {
  const out = { dossier: null, classeurs: [], fiche: null, erreurs: [] };
  if (!graph.enabled()) { out.erreurs.push("Microsoft non configuré : rien n'a été créé sur SharePoint."); return out; }
  const dossier = "Listes d'invités/" + safe(m.prenoms);
  try {
    await graph.ensureFolder("Listes d'invités"); await graph.ensureFolder(dossier); await graph.ensureFolder(dossier + "/Contacts");
    out.dossier = dossier;
  } catch (e) { out.erreurs.push("Dossier : " + e.message); return out; }
  const pil = dossier + "/Pilotage " + safe(m.prenoms) + ".xlsx", con = dossier + "/Contacts reçus " + safe(m.prenoms) + ".xlsx";
  for (const [p, feuilles] of [[pil, feuillesPilotage(data, m.prenoms)], [con, feuillesContacts()]]) {
    try {
      let exists = null; try { exists = await graph.getItem(p); } catch (e) { if (e.status !== 404) throw e; }
      if (exists) { if (p === pil) await graph.rewriteTable(p, "Parametres", feuilles[0].rows); out.classeurs.push(p + " (existant, Paramètres réécrit)"); }
      else { await graph.putFile(p, xlsx.build(feuilles), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"); out.classeurs.push(p); }
    } catch (e) { out.erreurs.push(p.split("/").pop() + " : " + e.message); }
  }
  try {
    const name = `${dossier}/${safe(m.prenoms)} - Fiche call 1 - ${new Date().toISOString().slice(0, 10)} - v${version}.pdf`;
    await graph.putFile(name, pdf.build({ title: "Fiche du call 1 · " + m.prenoms, subtitle: "Cadrage du mariage, " + (data.lieu || "") + ", " + (data.date_mariage || ""), meta: `Version ${version} · interne Yes I Do`, sections: checklist.fiche(data) }), "application/pdf");
    out.fiche = name;
  } catch (e) { out.erreurs.push("Fiche PDF : " + e.message); }
  return out;
}

/* ---------- déclarer ou mettre à jour ---------- */
async function declarer(input, operateur, codeExistant) {
  const { data, errors } = checklist.validate(input);
  if (errors.length) return { ok: false, errors };
  const existing = codeExistant ? await store.mariage(codeExistant) : null;
  const today = new Date().toISOString().slice(0, 10);
  const code = existing ? existing.code : await codeLibre(data.initiales, data.date_mariage);
  const version = (existing ? existing.fiche_version : 0) + 1;
  const cols = {
    prenoms: data.prenoms, statut: data.statut, date_mariage: data.date_mariage, lieu: data.lieu, pays: data.pays, pack: data.pack, langue_defaut: data.langue_defaut,
    date_remise: data.date_remise, date_arret: data.date_arret, prevu_contrat: data.prevu_contrat, seuil: data.seuil || null, site: data.site || null, boite_email: data.boite_email || null,
    initiales: data.initiales, date_demarrage: existing ? existing.date_demarrage : today, delai_arret_jours: data.delai_arret_jours, purge_prevue: data.purge_prevue,
    parametres: Object.assign({}, existing ? existing.parametres : {}, { checklist: data, hebergement: data.hebergement, lieux_hebergement: data.lieux_hebergement, periodes: data.periodes, regime_enfants: data.regime_enfants, consigne_enfants: data.consigne_enfants, proches: data.proches, listes_attendues: data.listes_attendues, quotas: data.quotas_map || {}, conciergerie: data.conciergerie, regie: data.regie, support: data.support, telephones: { epoux: data.telephone_epoux, epouse: data.telephone_epouse }, volume_estime: data.volume_estime || null }),
    fiche_version: version
  };
  const keys = Object.keys(cols);
  let m;
  if (existing) {
    await db.query(`UPDATE mariage SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(", ")}, modifie_le = now() WHERE code = $1`, [code, ...keys.map(k => cols[k])]);
    await store.journal(existing.id, "Paramètres du mariage mis à jour", code, { fiche_version: existing.fiche_version, date_remise: existing.date_remise, date_arret: existing.date_arret, prevu_contrat: existing.prevu_contrat }, { fiche_version: version, date_remise: data.date_remise, date_arret: data.date_arret, prevu_contrat: data.prevu_contrat }, operateur);
  } else {
    const etapes = { 1: new Date().toISOString() };
    const r = await db.query(`INSERT INTO mariage (code, etape, etapes, ${keys.join(", ")}) VALUES ($1, 2, $2, ${keys.map((k, i) => `$${i + 3}`).join(", ")}) RETURNING id`, [code, etapes, ...keys.map(k => cols[k])]);
    await store.journal(r[0].id, "Mariage déclaré", code + " · " + data.prenoms, null, { code, prenoms: data.prenoms, date_mariage: data.date_mariage, statut: data.statut, prevu_contrat: data.prevu_contrat, date_remise: data.date_remise, date_arret: data.date_arret }, operateur);
  }
  m = await store.mariageFresh(code);
  const sp = await creerSharePoint(m, data, version);
  const dossier = sp.dossier || m.dossier;
  await db.query("UPDATE mariage SET dossier = $2, fiche_pdf = coalesce($3, fiche_pdf), sharepoint = $4 WHERE code = $1", [code, dossier, sp.fiche, sp]);
  await store.journal(m.id, sp.erreurs.length ? "SharePoint : création partielle" : "SharePoint : dossier, classeurs et fiche à jour", [sp.dossier, ...sp.classeurs, sp.fiche].filter(Boolean).join(" · ") + (sp.erreurs.length ? " · " + sp.erreurs.join(" ; ") : ""), null, null, "application");
  let boite = null;
  if (data.boite_email) { boite = await graph.mailboxCheck(data.boite_email); if (boite.ok) await db.query("UPDATE mariage SET boite_verifiee_le = now() WHERE code = $1", [code]); }
  return { ok: true, code, created: !existing, version, sharepoint: sp, boite, mariage: await store.mariageFresh(code) };
}

/* ---------- accueil ---------- */
async function accueil() {
  const rows = await db.query(`SELECT m.*, (SELECT count(*) FROM anomalie a WHERE a.mariage_id = m.id AND a.etat = 'ouverte') AS anomalies,
     (SELECT count(*) FROM foyer f WHERE f.mariage_id = m.id AND NOT f.desactive) AS foyers FROM mariage m WHERE NOT m.desactive ORDER BY m.date_mariage NULLS LAST, m.cree_le`);
  const list = rows.map(m => {
    const franchies = Object.keys(m.etapes || {}).length;
    return { code: m.code, prenoms: m.prenoms, statut: m.statut, date_mariage: m.date_mariage, lieu: m.lieu, etape: m.etape, etapes: m.etapes, franchies, progression: Math.round(franchies / 8 * 100), date_remise: m.date_remise, date_arret: m.date_arret, anomalies: Number(m.anomalies), foyers: Number(m.foyers), prevu_contrat: m.prevu_contrat, dossier: m.dossier, fiche_pdf: m.fiche_pdf, boite_email: m.boite_email, boite_verifiee_le: m.boite_verifiee_le, site: m.site, sharepoint: m.sharepoint };
  });
  return { mariages: list, reglages: await reglages(), journal: await store.readJournal(null, 12) };
}
async function fiche(code) {
  const m = await store.mariageFresh(code); if (!m) return null;
  const foyers = (await db.query("SELECT count(*) AS n FROM foyer WHERE mariage_id = $1 AND NOT desactive", [m.id]))[0].n;
  return Object.assign({}, m, { foyers: Number(foyers), franchies: Object.keys(m.etapes || {}).length, checklist: (m.parametres || {}).checklist || null, etapes_libelles: ETAPES });
}

module.exports = { reglages, saveReglage, declarer, accueil, fiche, ETAPES, CHEMINEMENT_DEFAUT };
