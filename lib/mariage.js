/* =====================================================================
   MARIAGES · création (étape Fiche du mariage), dossier SharePoint, classeurs
   miroirs avec leur Lisez moi, fiche call 1, accueil, guide et réglages.
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
  "1. Fiche du mariage. Le premier rendez vous avec le couple : nous reprenons le devis, nous découvrons leur mariage, nous fixons la date de remise de la liste et la date de clôture. Le mariage existe alors dans l'outil, avec son dossier et ses classeurs.",
  "2. Liste d'invités. Le couple et ses proches désignés nous envoient les contacts de leur téléphone, par email sur la boîte du mariage ou en les déposant. La machine lit, met les numéros au format international, retire les doublons et signale ce qu'une personne doit trancher. Puis la liste se qualifie ligne par ligne avec le couple, en un seul rendez vous : côté, invitation, lien, enfants, hébergement. Une ligne verte est complète et reçoit sa clé, pour toujours.",
  "3. Premier contact et invitations. Chaque foyer est appelé comme à un rendez vous, ou reçoit son lien personnel. La plateforme s'ouvre, les invitations partent.",
  "4. Confirmations et suivi. Les invités confirment et répondent aux formulaires ; l'outil relance avec mesure, détecte les anomalies, et nous ne voyons que les exceptions.",
  "5. Séjour et logistique. Hébergements, chauffeurs, navettes, conciergerie : tout ce qui concerne le séjour de chaque invité, avec les rapports pour le lieu et les prestataires.",
  "6. Plan de table et jour J. Le placement de chaque personne, les pass, l'accueil sur place et l'escorte jusqu'à la table.",
  "7. Clôture. Le remerciement, le bilan avec le couple, puis la suppression des données des invités sous trente jours."
].join("\n");
/* Une ressource par ligne : « Titre | adresse | une phrase ». Deux listes : l'équipe (son métier) et la direction (stratégie, structure). */
const RESSOURCES_EQUIPE_DEFAUT = [
  "Espace SharePoint YID Yes I Do | https://yidyesido.sharepoint.com/sites/YIDYesIDo | Les dossiers des mariages, un par couple, dans « Listes d'invités ».",
  "Guide et ressources de l'application | #/guide | Le cheminement d'un mariage en sept étapes et les règles de l'outil."
].join("\n");
const RESSOURCES_DIRECTION_DEFAUT = [
  "Plan de construction du CRM | https://claude.ai/artifact/9433267b-b1ca-4464-834d-f92ca9958820 | Le plan de bout en bout, phase par phase, avec le registre des remarques.",
  "Phase 1 · Accueil et cadrage | https://claude.ai/artifact/a9832a88-3273-41ba-9bf0-27af29a819f7 | Ce qui a été construit, les gestes à faire et la recette.",
  "Phase 2 · Contacts reçus | https://claude.ai/artifact/a9832a88-3273-41ba-9bf0-27af29a819f7 | Le doc de la phase en cours."
].join("\n");
const ACCUSE_DEFAUT = "Bonjour,\n\nVotre fichier de contacts nous est bien parvenu. {lus} fiches lues, {ajoutes} ajoutées à votre liste, {connus} déjà connues.\n\nNous préparons la suite et revenons vers vous très prochainement.\n\nBien à vous,\nL'équipe Yes I Do";
const DEFAUTS = { cheminement: CHEMINEMENT_DEFAUT, ressources_equipe: RESSOURCES_EQUIPE_DEFAUT, ressources_direction: RESSOURCES_DIRECTION_DEFAUT, theme_defaut: "clair", accuse_modele: ACCUSE_DEFAUT, accuse_actif: "Oui", tel_cecilia: "", tel_regis: "", tel_ligne: "" };
const DIRECTION = ["ressources_direction", "accuse_modele", "accuse_actif"];   /* réglages réservés aux administrateurs, en lecture comme en écriture */

async function reglage(cle) { const r = await db.query("SELECT valeur FROM reglage WHERE cle = $1", [cle]); return r[0] ? r[0].valeur : null; }
async function reglages(role) {
  const out = { etapes: ETAPES };
  /* l'ancienne liste unique « ressources » (build 1.1.1) devient la liste de direction */
  const ancienne = await reglage("ressources");
  if (ancienne !== null && (await reglage("ressources_direction")) === null) await db.query("INSERT INTO reglage (cle, valeur, modifie_par) VALUES ('ressources_direction', $1, 'installation') ON CONFLICT DO NOTHING", [ancienne]);
  for (const cle of Object.keys(DEFAUTS)) {
    if (role && role !== "administrateur" && DIRECTION.includes(cle)) continue;
    let v = await reglage(cle);
    if (v === null) { await db.query("INSERT INTO reglage (cle, valeur, modifie_par) VALUES ($1, $2, 'installation') ON CONFLICT DO NOTHING", [cle, DEFAUTS[cle]]); v = DEFAUTS[cle]; }
    out[cle] = v;
  }
  return out;
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

/* ---------- miroirs : un classeur en lecture, une table par objet, un Lisez moi en tête ---------- */
const REGLE_MIROIR = "Ce classeur est un miroir : l'application l'écrit, l'équipe le lit. Une modification faite ici n'est pas relue par l'application ; la saisie se fait dans l'application. Vos tableaux de bord peuvent pointer sur ces tables par formule, ils resteront justes.";
function lisezMoi(prenoms, onglets) {
  return { name: "Lisez moi", table: "LisezMoi", headers: ["Onglet", "À quoi il sert", "Qui l'écrit", "Quand il se remplit"],
    rows: [["Lisez moi", `Ce guide. Classeur du mariage ${prenoms}. ${REGLE_MIROIR}`, "L'application, à la création", "Une fois"]].concat(onglets) };
}
function feuillesPilotage(data, prenoms) {
  const params = checklist.fiche(data).flatMap(s => s.rows.map(r => [s.heading.slice(0, 1), r[0], r[1]]));
  return [
    lisezMoi(prenoms, [
      ["Paramètres", "La fiche du premier rendez vous (étape 1, Fiche du mariage) : partie A le devis, partie B la découverte du mariage, partie C les réglages. Une ligne par question, avec la réponse.", "L'application", "À la création du mariage, puis réécrit à chaque modification de la fiche du mariage"],
      ["Base invités", "Un foyer par ligne, avec sa clé. Le foyer est l'unité d'invitation : un couple, une famille, une personne seule. La clé ne change jamais.", "L'application", "Étape 3, Liste d'invités, quand une ligne qualifiée devient un foyer"],
      ["Personnes", "Une personne par ligne, rattachée à son foyer : présence, menu, régime, table.", "L'application", "Étape 3 pour les personnes, étapes 5 à 7 pour leurs réponses et leur place"],
      ["Campagne", "Chaque message envoyé ou appel passé à un foyer : nature, canal, date, qui l'a fait, réponse obtenue.", "L'application", "Étape 4, Premier contact, puis à chaque relance"],
      ["Suivi", "L'état de chaque foyer en une ligne : confirmation, voyage, hébergement, chauffeur, navettes, charte, relances, anomalies ouvertes.", "L'application", "Étape 5, Confirmations et suivi, mis à jour à chaque réponse"],
      ["Journal", "Tout ce qui a été fait sur ce mariage : quoi, quand, par qui, et pour une modification, la valeur avant et la valeur après.", "L'application", "En continu, à chaque opération"]
    ]),
    { name: "Paramètres", table: "Parametres", headers: ["Partie", "Champ", "Valeur"], rows: params },
    { name: "Base invités", table: "BaseInvites", headers: ["Clé", "Nom dans votre téléphone", "Téléphone", "Côté", "Invitation", "Lien avec vous", "Précision", "Besoin d'assistance", "Nombre d'enfants", "Nom", "Prénom", "Désactivé", "Deuxième numéro trouvé", "Source", "Statut", "Canal", "Langue", "Email", "Relais"], rows: [] },
    { name: "Personnes", table: "Personnes", headers: ["Clé", "Foyer", "Prénom", "Nom", "Enfant", "Âge", "Présence", "Menu", "Régime", "Table"], rows: [] },
    { name: "Campagne", table: "Campagne", headers: ["Clé", "Foyer", "Nature", "Canal", "Message", "Date", "Opérateur", "Réponse"], rows: [] },
    { name: "Suivi", table: "Suivi", headers: ["Clé", "Foyer", "Confirmation", "Voyage", "Hébergement", "Chauffeur", "Navettes", "Charte", "Relances", "Dernière interaction", "Anomalies ouvertes"], rows: [] },
    { name: "Journal", table: "Journal", headers: ["Date", "Opération", "Détail", "Avant", "Après", "Opérateur"], rows: [] }
  ];
}
const feuillesContacts = (prenoms) => [
  lisezMoi(prenoms, [
    ["Reçus", "Chaque contact reçu du couple ou de ses proches, tel qu'il est arrivé : nom de répertoire, numéros, source (export de l'époux, de l'épouse, liste d'un proche), fichier d'origine. C'est la preuve, on n'y touche pas.", "L'application", "Étape 2, Contacts reçus, à chaque fichier reçu par email ou déposé"],
    ["Anomalies", "Ce que la machine a détecté et qu'une personne doit trancher : doublons, numéros illisibles, contacts sans nom. La décision et son auteur sont inscrits.", "L'application pour la détection, l'équipe pour la décision", "Étape 2, puis à chaque import"]
  ]),
  { name: "Reçus", table: "Recus", headers: ["Reçu le", "Source", "Côté", "Nom de répertoire", "Numéros", "Fichier"], rows: [] },
  { name: "Anomalies", table: "Anomalies", headers: ["Détectée le", "Type", "Foyer", "Détail", "État", "Décision", "Tranchée par", "Tranchée le"], rows: [] }
];

/* attend une promesse au plus ms millisecondes, sinon rend la valeur de repli (la promesse continue sans bloquer la réponse) */
function borne(promesse, ms, repli) {
  let t; const delai = new Promise(r => { t = setTimeout(() => r(repli()), ms); });
  return Promise.race([promesse.catch(e => { throw e; }), delai]).finally(() => clearTimeout(t));
}
async function creerSharePoint(m, data, version) {
  const out = { dossier: null, classeurs: [], fiche: null, erreurs: [] };
  if (!graph.enabled()) { out.erreurs.push("Microsoft non configuré : rien n'a été créé sur SharePoint."); return out; }
  const dossier = "Listes d'invités/" + safe(m.prenoms);
  try {
    await graph.ensureFolder("Listes d'invités"); await graph.ensureFolder(dossier); await graph.ensureFolder(dossier + "/Contacts");
    out.dossier = dossier;
  } catch (e) { out.erreurs.push("Dossier : " + e.message); return out; }
  const pil = dossier + "/Pilotage " + safe(m.prenoms) + ".xlsx", con = dossier + "/Contacts reçus " + safe(m.prenoms) + ".xlsx";
  /* les deux classeurs et la fiche PDF partent en même temps : Graph est lent, l'enchaînement dépassait la limite de 60 s */
  const classeur = async ([p, feuilles]) => {
    try {
      let exists = null; try { exists = await graph.getItem(p); } catch (e) { if (e.status !== 404) throw e; }
      if (exists) {
        const notes = [];
        if (p === pil) { await graph.rewriteTable(p, "Parametres", feuilles[1].rows); notes.push("Paramètres réécrit"); }
        try { const r = await graph.ensureSheet(p, feuilles[0]); if (!r.existed) notes.push("onglet Lisez moi ajouté"); } catch (e) { out.erreurs.push(p.split("/").pop() + ", onglet Lisez moi : " + e.message); }
        out.classeurs.push(p + " (existant" + (notes.length ? ", " + notes.join(", ") : "") + ")");
      }
      else { await graph.putFile(p, xlsx.build(feuilles), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"); out.classeurs.push(p); }
    } catch (e) { out.erreurs.push(p.split("/").pop() + " : " + e.message); }
  };
  const fichePdf = async () => {
    try {
      const name = `${dossier}/${safe(m.prenoms)} - Fiche call 1 - ${new Date().toISOString().slice(0, 10)} - v${version}.pdf`;
      await graph.putFile(name, pdf.build({ title: "Fiche du call 1 · " + m.prenoms, subtitle: "Fiche du mariage, " + (data.lieu || "") + ", " + (data.date_mariage || ""), meta: `Version ${version} · interne Yes I Do`, sections: checklist.fiche(data) }), "application/pdf");
      out.fiche = name;
    } catch (e) { out.erreurs.push("Fiche PDF : " + e.message); }
  };
  await Promise.all([classeur([pil, feuillesPilotage(data, m.prenoms)]), classeur([con, feuillesContacts(m.prenoms)]), fichePdf()]);
  return out;
}

/* ---------- différence champ par champ entre deux fiches de cadrage ---------- */
const LIBELLES = (() => { const o = {}; checklist.SECTIONS.forEach(s => s.champs.forEach(f => { o[f.k] = f.n + ". " + f.l; })); o.date_arret = "Date de clôture calculée"; o.purge_prevue = "Date de purge prévue"; o.fiche_version = "Version de la fiche"; o.code = "Code du mariage"; o.valeur = "Texte"; o.role = "Rôle"; o.actif = "Actif"; o.mot_de_passe = "Mot de passe"; return o; })();
const plat = (x) => Array.isArray(x) ? x.join(" ; ") : (x && typeof x === "object") ? JSON.stringify(x) : (x === undefined || x === null) ? "" : String(x);
function difference(avantData, apresData) {
  const avant = {}, apres = {};
  const keys = new Set(Object.keys(avantData || {}).concat(Object.keys(apresData || {})));
  for (const k of keys) {
    if (k === "quotas_map") continue;
    const a = plat((avantData || {})[k]), b = plat((apresData || {})[k]);
    if (a !== b) { avant[k] = a; apres[k] = b; }
  }
  return { avant, apres, n: Object.keys(apres).length };
}

/* ---------- créer ou mettre à jour ---------- */
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
  let m, diff = null;
  if (existing) {
    diff = difference((existing.parametres || {}).checklist || {}, data);
    await db.query(`UPDATE mariage SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(", ")}, modifie_le = now() WHERE code = $1`, [code, ...keys.map(k => cols[k])]);
    const libelles = Object.keys(diff.apres).map(k => LIBELLES[k] || k);
    await store.journal(existing.id, "Fiche du mariage modifiée", `${code} · fiche version ${existing.fiche_version} vers ${version} · ${diff.n} champ(s) modifié(s)` + (libelles.length ? " : " + libelles.join(" ; ") : ""), Object.assign({ fiche_version: existing.fiche_version }, diff.avant), Object.assign({ fiche_version: version }, diff.apres), operateur);
  } else {
    const etapes = { 1: new Date().toISOString() };
    const r = await db.query(`INSERT INTO mariage (code, etape, etapes, ${keys.join(", ")}) VALUES ($1, 2, $2, ${keys.map((k, i) => `$${i + 3}`).join(", ")}) RETURNING id`, [code, etapes, ...keys.map(k => cols[k])]);
    await store.journal(r[0].id, "Mariage créé", code + " · " + data.prenoms, null, { code, prenoms: data.prenoms, date_mariage: data.date_mariage, statut: data.statut, prevu_contrat: data.prevu_contrat, date_remise: data.date_remise, date_arret: data.date_arret }, operateur);
  }
  m = await store.mariageFresh(code);
  /* le cadrage est déjà enregistré en base : SharePoint et la boîte ont un temps borné pour ne jamais faire échouer l'enregistrement */
  const sp = await borne(creerSharePoint(m, data, version), 35000, () => ({ dossier: m.dossier || null, classeurs: [], fiche: null, erreurs: ["SharePoint n'a pas répondu à temps. La fiche du mariage est bien enregistrée ; le classeur et la fiche seront mis à jour au prochain enregistrement."] }));
  const dossier = sp.dossier || m.dossier;
  await db.query("UPDATE mariage SET dossier = $2, fiche_pdf = coalesce($3, fiche_pdf), sharepoint = $4 WHERE code = $1", [code, dossier, sp.fiche, sp]);
  await store.journal(m.id, sp.erreurs.length ? "SharePoint : création partielle" : "SharePoint : dossier, classeurs et fiche à jour", [sp.dossier, ...sp.classeurs, sp.fiche].filter(Boolean).concat(sp.erreurs).join(" · "), null, null, "application");
  let boite = null;
  if (data.boite_email) boite = await borne(verifierBoite(code, data.boite_email, operateur), 12000, () => ({ ok: false, detail: "Vérification de la boîte trop longue, à relancer depuis la fiche du mariage." }));
  return { ok: true, code, created: !existing, version, diff, sharepoint: sp, boite, mariage: await store.mariageFresh(code) };
}

/* ---------- la boîte email du mariage : vérifier, mémoriser le résultat ---------- */
async function verifierBoite(code, adresse, operateur) {
  const r = await graph.mailboxCheck(adresse);
  const m = await store.mariage(code);
  const etat = Object.assign({}, (m && m.parametres) || {}, { boite: { ok: r.ok, detail: r.detail, verifiee_le: new Date().toISOString() } });
  await db.query("UPDATE mariage SET parametres = $2" + (r.ok ? ", boite_verifiee_le = now()" : "") + " WHERE code = $1", [code, etat]);
  await store.journal(m ? m.id : null, "Vérification de la boîte du mariage", (adresse || "") + " : " + r.detail, null, null, operateur);
  await store.mariageFresh(code);
  return r;
}

/* ---------- accueil ---------- */
async function accueil() {
  const rows = await db.query(`SELECT m.*, (SELECT count(*) FROM anomalie a WHERE a.mariage_id = m.id AND a.etat = 'ouverte') AS anomalies,
     (SELECT count(*) FROM foyer f WHERE f.mariage_id = m.id AND NOT f.desactive) AS foyers FROM mariage m WHERE NOT m.desactive ORDER BY m.date_mariage NULLS LAST, m.cree_le`);
  const list = rows.map(m => {
    const terminees = Object.keys(m.etapes || {}).length;
    return { code: m.code, photo_cle: m.photo_cle || null, prenoms: m.prenoms, statut: m.statut, date_mariage: m.date_mariage, lieu: m.lieu, etape: m.etape, etapes: m.etapes, terminees, progression: Math.round(terminees / 7 * 100), date_remise: m.date_remise, date_arret: m.date_arret, anomalies: Number(m.anomalies), foyers: Number(m.foyers), prevu_contrat: m.prevu_contrat, dossier: m.dossier, fiche_pdf: m.fiche_pdf, boite_email: m.boite_email, boite_verifiee_le: m.boite_verifiee_le, boite: (m.parametres || {}).boite || null, site: m.site, sharepoint: m.sharepoint };
  });
  return { mariages: list, reglages: await reglages(), journal: await store.readJournal(null, 12) };
}
async function fiche(code) {
  const m = await store.mariageFresh(code); if (!m) return null;
  const foyers = (await db.query("SELECT count(*) AS n FROM foyer WHERE mariage_id = $1 AND NOT desactive", [m.id]))[0].n;
  return Object.assign({}, m, { foyers: Number(foyers), terminees: Object.keys(m.etapes || {}).length, checklist: (m.parametres || {}).checklist || null, boite: (m.parametres || {}).boite || null, etapes_libelles: ETAPES });
}


/* La photo du mariage : une image réduite par le navigateur, servie par une clé publique non devinable. */
async function setPhoto(code, dataUrl, operateur) {
  const m = await store.mariageFresh(code); if (!m) throw new Error("mariage introuvable");
  const v = String(dataUrl || "");
  if (!v) { await db.query("DELETE FROM photo_mariage WHERE mariage_id = $1", [m.id]); await db.query("UPDATE mariage SET photo_cle = NULL WHERE id = $1", [m.id]); await store.journal(m.id, "Fiche du mariage modifiée", "Photo du mariage retirée", null, null, operateur); return null; }
  const mt = v.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/); if (!mt) throw new Error("image non reconnue");
  if (mt[2].length > 1600000) throw new Error("image trop lourde");
  const cle = require("crypto").randomBytes(18).toString("base64url");
  await db.query("INSERT INTO photo_mariage (mariage_id, type, donnees, modifie_par) VALUES ($1, $2, $3, $4) ON CONFLICT (mariage_id) DO UPDATE SET type = $2, donnees = $3, modifie_le = now(), modifie_par = $4", [m.id, mt[1], mt[2], operateur]);
  await db.query("UPDATE mariage SET photo_cle = $2 WHERE id = $1", [m.id, cle]);
  await store.journal(m.id, "Fiche du mariage modifiée", "Nouvelle photo du mariage", null, null, operateur);
  return cle;
}
async function photo(cle) {
  const r = await db.query("SELECT p.type, p.donnees FROM photo_mariage p JOIN mariage m ON m.id = p.mariage_id WHERE m.photo_cle = $1", [String(cle || "").slice(0, 40)]);
  return r[0] ? { type: r[0].type, buffer: Buffer.from(r[0].donnees, "base64") } : null;
}

module.exports = { setPhoto, photo, reglages, saveReglage, DIRECTION, declarer, verifierBoite, accueil, fiche, difference, feuillesPilotage, feuillesContacts, LIBELLES, ETAPES, CHEMINEMENT_DEFAUT };
