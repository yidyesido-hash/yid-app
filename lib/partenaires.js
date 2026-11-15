/* =====================================================================
   PARTENAIRES · hors des étapes, au service de chaque mariage
   Le répertoire des prestataires de la conciergerie (hôtels, autocaristes,
   chauffeurs, spas, tables, dégustations, lieux, planners), repris de la
   cartographie YID et enrichi à chaque échange. Pour chaque mariage, une
   sélection suivie de bout en bout : à contacter, contacté, en discussion,
   proposition reçue, accord, décliné ; l'accord garde les chambres, le tarif
   invités, la date butoir et le circuit de réservation. Chaque appel suit un
   guide propre à la famille du prestataire et laisse une trace : qui, quand,
   combien de temps, les réponses, l'issue et la prochaine relance.
   Règle tenue par les guides : on ne nomme jamais le couple ni son planner
   à un prestataire ; on parle d'un mariage, d'une date et d'un lieu.
   ===================================================================== */
const db = require("./db");
const store = require("./store");

const propre = (s) => String(s == null ? "" : s).trim();
const sansAccent = (s) => propre(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const cleDe = (nom, ville) => (sansAccent(nom) + "|" + sansAccent(ville)).replace(/[^a-z0-9|]+/g, " ").replace(/\s+/g, " ").trim();
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

const CATEGORIES = {
  hotel: { l: "Hôtels", f: "hotel" }, venue: { l: "Lieux", f: "lieu" }, autocar: { l: "Autocaristes", f: "transport" }, chauffeur: { l: "Chauffeurs", f: "transport" },
  spa: { l: "Spas", f: "conciergerie" }, table: { l: "Tables étoilées", f: "conciergerie" }, degustation: { l: "Vins et fromages", f: "conciergerie" },
  planner: { l: "Wedding planners", f: "lieu" }, voyage: { l: "Voyage de groupe", f: "transport" }, jet: { l: "Jets", f: "transport" }, helico: { l: "Hélicoptères", f: "transport" },
  location: { l: "Location de véhicules", f: "transport" }, papeterie: { l: "Invitations", f: "autre" }, coffret: { l: "Coffrets", f: "autre" }, coursier: { l: "Coursiers", f: "autre" }, autre: { l: "Autres", f: "autre" }
};
const STATUTS = ["à contacter", "contacté", "en discussion", "proposition reçue", "accord", "décliné"];
const CANAUX = ["appel", "whatsapp", "email", "rendez-vous", "note"];
const ISSUES = ["accord", "proposition attendue", "à rappeler", "messagerie, rappeler", "pas le bon interlocuteur", "décliné"];

/* Les guides d'appel, par famille. {date}, {lieu}, {invites}, {signataire} se remplissent depuis la fiche du mariage. */
const GUIDES = {
  hotel: { titre: "Appel hôtel, accord pour les invités",
    ouverture: "Bonjour, {signataire} de Yes I Do. Nous prenons soin des invités d'un mariage le {date} {lieu}, environ {invites} invités, et nous cherchons à les loger dans les meilleures conditions. Auriez vous quelques instants, ou la bonne personne pour en parler ?",
    questions: [
      { k: "interlocuteur", l: "L'interlocuteur", t: "texte", aide: "Nom, fonction, ligne directe ou email. On ne repart jamais sans." },
      { k: "chambres", l: "Chambres disponibles sur ces nuits", t: "nombre", aide: "Le volume réel, nuit par nuit si besoin." },
      { k: "tarif", l: "Tarif invités par chambre et par nuit", t: "texte", aide: "Petit déjeuner inclus ou non. Comparer au prix public du jour." },
      { k: "reservation", l: "Circuit de réservation", t: "choix", o: ["Lien de paiement direct à l'invité", "Réservation portée par YID, l'invité paie l'hôtel", "Code ou lien de groupe", "À définir"], aide: "YID ne touche jamais l'argent des invités." },
      { k: "butoir", l: "Date butoir du tarif", t: "date", aide: "Après cette date, les chambres repartent à la vente." },
      { k: "annulation", l: "Conditions d'annulation et arrhes", t: "texte" },
      { k: "commission", l: "Rémunération de YID", t: "texte", aide: "Apporteur d'affaires facturé à l'hôtel après le mariage, ou marge sur tarif. Ne pas insister au premier appel." },
      { k: "acces", l: "Parking, navette, temps jusqu'au lieu", t: "texte" },
      { k: "suites", l: "Suites ou chambres familiales pour les proches", t: "texte" }
    ] },
  transport: { titre: "Appel transporteur ou chauffeur",
    ouverture: "Bonjour, {signataire} de Yes I Do. Nous organisons le transport des invités d'un mariage le {date} {lieu}, environ {invites} invités. Je souhaiterais vous présenter les trajets pour obtenir une proposition.",
    questions: [
      { k: "interlocuteur", l: "L'interlocuteur", t: "texte" },
      { k: "mode", l: "Facturation", t: "choix", o: ["Mise à disposition par créneau", "Au trajet", "À la journée"], aide: "Les transporteurs raisonnent souvent en mise à disposition." },
      { k: "vehicules", l: "Véhicules et capacités", t: "texte", aide: "Minivan 7, minibus 19, autocar 50 ou plus." },
      { k: "acces", l: "Accès des véhicules au lieu", t: "texte", aide: "Un autocar passe t il le portail et l'allée ?" },
      { k: "nuit", l: "Majoration de nuit et amplitude chauffeur", t: "texte", aide: "À obtenir par écrit pour les retours de soirée." },
      { k: "tarif", l: "Tarif annoncé", t: "texte" },
      { k: "paiement", l: "Acompte et paiement", t: "texte" },
      { k: "butoir", l: "Validité de la proposition", t: "date" }
    ] },
  conciergerie: { titre: "Appel conciergerie (spa, table, dégustation)",
    ouverture: "Bonjour, {signataire} de Yes I Do. Nous accompagnons les invités d'un mariage le {date} {lieu}, et nous aimerions leur proposer votre maison pendant leur séjour.",
    questions: [
      { k: "interlocuteur", l: "L'interlocuteur", t: "texte" },
      { k: "creneaux", l: "Créneaux possibles sur le week end", t: "texte", aide: "Jours de fermeture compris." },
      { k: "groupe", l: "Taille de groupe acceptée", t: "texte" },
      { k: "tarif", l: "Tarif partenaire", t: "texte", aide: "Remise de 10 à 15 % sur les soins, tarif net sur les ateliers. Les tables étoilées ne commissionnent pas." },
      { k: "transfert", l: "Transfert depuis les hôtels", t: "texte" },
      { k: "butoir", l: "Date limite pour bloquer", t: "date" }
    ] },
  lieu: { titre: "Appel lieu ou planner",
    ouverture: "Bonjour, {signataire} de Yes I Do. Nous prenons en charge l'expérience des invités d'un mariage le {date} {lieu}, et nous aimerions caler avec vous ce qui touche à leur accueil.",
    questions: [
      { k: "interlocuteur", l: "L'interlocuteur", t: "texte" },
      { k: "capacite", l: "Capacité et couchages sur place", t: "texte" },
      { k: "contraintes", l: "Contraintes d'accès, horaires, prestataires imposés", t: "texte" },
      { k: "accueil", l: "Point d'accueil des invités le jour J", t: "texte" },
      { k: "suite", l: "La suite convenue", t: "texte" }
    ] },
  autre: { titre: "Appel prestataire",
    ouverture: "Bonjour, {signataire} de Yes I Do. Nous accompagnons les invités d'un mariage le {date} {lieu}, et nous pensons à votre maison.",
    questions: [
      { k: "interlocuteur", l: "L'interlocuteur", t: "texte" },
      { k: "besoin", l: "Ce que la maison peut faire", t: "texte" },
      { k: "tarif", l: "Tarif annoncé", t: "texte" },
      { k: "suite", l: "La suite convenue", t: "texte" }
    ] }
};
const familleDe = (cat) => (CATEGORIES[cat] || CATEGORIES.autre).f;

function nettoyer(p) {
  const cat = CATEGORIES[propre(p.categorie || p.cat)] ? propre(p.categorie || p.cat) : "autre";
  return { categorie: cat, destination: propre(p.destination || p.dest).slice(0, 60) || null, gamme: propre(p.gamme).slice(0, 20) || null, etoiles: num(p.etoiles) ? Math.max(1, Math.min(5, num(p.etoiles))) : null,
    nom: propre(p.nom).slice(0, 160), ville: propre(p.ville).slice(0, 160) || null, lat: num(p.lat), lng: num(p.lng), note: propre(p.note).slice(0, 3000) || null, prix: propre(p.prix).slice(0, 600) || null,
    site: propre(p.site || p.web).replace(/^https?:\/\//, "").slice(0, 200) || null, email: propre(p.email).slice(0, 160) || null, telephone: propre(p.telephone || p.tel).slice(0, 80) || null,
    whatsapp: propre(p.whatsapp).slice(0, 40) || null, contact_nom: propre(p.contact_nom).slice(0, 120) || null, relation: propre(p.relation).slice(0, 120) || null, verifie: !!(p.verifie || p.verif) };
}

/* Import de la cartographie : un collage JSON ({ data: [...] } ou un tableau), sans doublon (nom et ville).
   Une fiche déjà connue garde ce que l'équipe a appris (interlocuteur, téléphone, email) : l'import ne fait que compléter. */
async function importer(texte, u) {
  let j; try { j = JSON.parse(String(texte || "")); } catch (e) { throw new Error("Le collage n'est pas lisible : copiez de nouveau depuis la cartographie."); }
  const L = Array.isArray(j) ? j : Array.isArray(j.data) ? j.data : null;
  if (!L || !L.length) throw new Error("Aucune fiche dans le collage.");
  let ajoutes = 0, completes = 0;
  const connus = new Map((await db.query("SELECT * FROM partenaire")).map(x => [x.cle, x]));
  for (const brut of L.slice(0, 3000)) {
    const p = nettoyer(brut); if (!p.nom) continue;
    const cle = cleDe(p.nom, p.ville), ex = connus.get(cle);
    if (!ex) {
      connus.set(cle, Object.assign({ cle }, p));
      await db.query(`INSERT INTO partenaire (cle, categorie, destination, gamme, etoiles, nom, ville, lat, lng, note, prix, site, email, telephone, relation, verifie, source)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`, [cle, p.categorie, p.destination, p.gamme, p.etoiles, p.nom, p.ville, p.lat, p.lng, p.note, p.prix, p.site, p.email, p.telephone, p.relation, p.verifie, propre(j.version || "cartographie")]);
      ajoutes++;
    } else {
      const maj = {}; ["destination", "gamme", "etoiles", "lat", "lng", "note", "prix", "site", "email", "telephone", "relation"].forEach(k => { if ((ex[k] == null || ex[k] === "") && p[k] != null) maj[k] = p[k]; });
      const ks = Object.keys(maj); if (ks.length) { await db.query(`UPDATE partenaire SET ${ks.map((k, i) => k + " = $" + (i + 2)).join(", ")}, modifie_le = now() WHERE id = $1`, [ex.id, ...ks.map(k => maj[k])]); completes++; }
    }
  }
  await store.journal(null, "Partenaires importés", `${ajoutes} ajouté(s), ${completes} complété(s) depuis la cartographie`, null, null, u.nom);
  return { ajoutes, completes };
}

async function repertoire(f) {
  f = f || {};
  /* premier lancement : le répertoire se remplit seul avec la cartographie v6 livrée avec l'outil */
  if (!(await db.query("SELECT count(*)::int AS n FROM partenaire"))[0].n) {
    try { await importer(require("fs").readFileSync(require("path").join(__dirname, "cartographie-v6.json"), "utf8"), { nom: "Yes I Do" }); } catch (e) { /* le répertoire reste vide, l'import manuel reste possible */ }
  }
  const ps = await db.query(`SELECT p.*, (SELECT max(le) FROM partenaire_echange e WHERE e.partenaire_id = p.id) AS dernier_echange,
      (SELECT count(*)::int FROM partenaire_echange e WHERE e.partenaire_id = p.id) AS echanges,
      (SELECT count(*)::int FROM mariage_partenaire mp WHERE mp.partenaire_id = p.id AND mp.statut = 'accord') AS accords
    FROM partenaire p WHERE p.actif ORDER BY p.destination NULLS LAST, p.categorie, p.nom`);
  const dest = [...new Set(ps.map(p => p.destination).filter(Boolean))];
  return { partenaires: ps, destinations: dest, categories: Object.keys(CATEGORIES).map(k => ({ k, l: CATEGORIES[k].l, n: ps.filter(p => p.categorie === k).length })).filter(c => c.n || c.k === "hotel") };
}

async function fiche(id) {
  const p = (await db.query("SELECT * FROM partenaire WHERE id = $1", [Number(id)]))[0]; if (!p) throw new Error("partenaire inconnu");
  const echanges = await db.query(`SELECT e.*, m.prenoms AS mariage, m.code FROM partenaire_echange e LEFT JOIN mariage m ON m.id = e.mariage_id WHERE e.partenaire_id = $1 ORDER BY e.le DESC LIMIT 200`, [p.id]);
  const mariages = await db.query(`SELECT mp.*, m.prenoms, m.code, m.date_mariage FROM mariage_partenaire mp JOIN mariage m ON m.id = mp.mariage_id WHERE mp.partenaire_id = $1 ORDER BY mp.modifie_le DESC`, [p.id]);
  return { partenaire: p, echanges, mariages, guide: GUIDES[familleDe(p.categorie)], famille: familleDe(p.categorie) };
}

async function enregistrer(b, u) {
  const p = nettoyer(b); if (!p.nom) throw new Error("Le nom est requis.");
  if (b.id) {
    const ks = Object.keys(p);
    await db.query(`UPDATE partenaire SET ${ks.map((k, i) => k + " = $" + (i + 2)).join(", ")}, modifie_le = now() WHERE id = $1`, [Number(b.id), ...ks.map(k => p[k])]);
    await store.journal(null, "Partenaire modifié", p.nom, null, null, u.nom); return Number(b.id);
  }
  const cle = cleDe(p.nom, p.ville); if ((await db.query("SELECT id FROM partenaire WHERE cle = $1", [cle])).length) throw new Error("Cette maison existe déjà dans le répertoire.");
  const r = await db.query(`INSERT INTO partenaire (cle, categorie, destination, gamme, etoiles, nom, ville, lat, lng, note, prix, site, email, telephone, whatsapp, contact_nom, relation, verifie, source)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,'équipe') RETURNING id`, [cle, p.categorie, p.destination, p.gamme, p.etoiles, p.nom, p.ville, p.lat, p.lng, p.note, p.prix, p.site, p.email, p.telephone, p.whatsapp, p.contact_nom, p.relation, p.verifie]);
  await store.journal(null, "Partenaire ajouté", p.nom, null, null, u.nom); return r[0].id;
}

/* ---------- pour un mariage ---------- */
async function mariageDe(code) { const m = await store.mariageFresh(code); if (!m) throw new Error("mariage inconnu"); return m; }
function contexteGuide(m, u) {
  const ck = (m.parametres || {}).checklist || {}, d = m.date_mariage ? new Date(String(m.date_mariage).slice(0, 10) + "T12:00:00Z").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" }) : "la date prévue";
  const l = propre(m.lieu || ck.lieu).split(",")[0];
  const art = !l ? "" : /^(domaine|château|chateau|manoir|moulin|clos|mas|prieuré|palais|pavillon|relais|logis)\b/i.test(l) ? "au " : /^(abbaye|villa|maison|bastide|ferme|salle|grange|orangerie|bergerie|chartreuse|commanderie)\b/i.test(l) ? "à la " : /^[aeiouyhéèâ]/i.test(l) ? "à l'" : "à ";
  return { date: d, lieu: l ? art + l : "dans votre région", invites: ck.volume_estime || ck.prevu_contrat || "une centaine d'", signataire: (u && u.nom || "Régis").split(" ")[0] };
}
const remplir = (t, x) => String(t || "").replace(/\{(\w+)\}/g, (a, k) => x[k] != null ? x[k] : a);

async function suivi(code, u) {
  const m = await mariageDe(code);
  const ls = await db.query(`SELECT mp.*, p.nom, p.ville, p.categorie, p.destination, p.etoiles, p.telephone, p.whatsapp, p.email, p.site, p.contact_nom, p.prix, p.lat, p.lng,
      (SELECT max(e.le) FROM partenaire_echange e WHERE e.partenaire_id = p.id AND e.mariage_id = mp.mariage_id) AS dernier_echange,
      (SELECT count(*)::int FROM partenaire_echange e WHERE e.partenaire_id = p.id AND e.mariage_id = mp.mariage_id) AS echanges
    FROM mariage_partenaire mp JOIN partenaire p ON p.id = mp.partenaire_id WHERE mp.mariage_id = $1 ORDER BY p.categorie, p.nom`, [m.id]);
  const ajd = new Date().toISOString().slice(0, 10);
  const familles = {};
  ls.forEach(l => { const f = familleDe(l.categorie); (familles[f] = familles[f] || { f, n: 0, statuts: {} }); familles[f].n++; familles[f].statuts[l.statut] = (familles[f].statuts[l.statut] || 0) + 1; });
  const hotels = ls.filter(l => l.categorie === "hotel" && l.statut === "accord");
  const echanges = await db.query(`SELECT e.*, p.nom FROM partenaire_echange e JOIN partenaire p ON p.id = e.partenaire_id WHERE e.mariage_id = $1 ORDER BY e.le DESC LIMIT 60`, [m.id]);
  return { mariage: { code: m.code, prenoms: m.prenoms, date_mariage: m.date_mariage, lieu: m.lieu }, selection: ls, familles: Object.values(familles), statuts: STATUTS, issues: ISSUES, canaux: CANAUX,
    chambres_accord: hotels.reduce((s, l) => s + (Number((l.accord || {}).chambres) || 0), 0),
    a_relancer: ls.filter(l => l.relance_le && String(l.relance_le).slice(0, 10) <= ajd && !["accord", "décliné"].includes(l.statut)).length,
    echanges, guides: Object.fromEntries(Object.keys(GUIDES).map(k => [k, Object.assign({}, GUIDES[k], { ouverture: remplir(GUIDES[k].ouverture, contexteGuide(m, u)) })])),
    familles_cat: Object.fromEntries(Object.keys(CATEGORIES).map(k => [k, CATEGORIES[k].f])), categories: CATEGORIES };
}

async function agir(code, op, b, u) {
  const m = await mariageDe(code), pid = Number(b.partenaire);
  const lien = async () => { const x = (await db.query("SELECT mp.*, p.nom FROM mariage_partenaire mp JOIN partenaire p ON p.id = mp.partenaire_id WHERE mp.mariage_id = $1 AND mp.partenaire_id = $2", [m.id, pid]))[0]; if (!x) throw new Error("Ce partenaire n'est pas dans la sélection du mariage."); return x; };
  if (op === "ajouter") {
    const ids = (Array.isArray(b.ids) ? b.ids : [pid]).map(Number).filter(Boolean).slice(0, 200);
    for (const id of ids) await db.query("INSERT INTO mariage_partenaire (mariage_id, partenaire_id, ajoute_par) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING", [m.id, id, u.nom]);
    await store.journal(m.id, "Partenaires", `${ids.length} maison(s) ajoutée(s) à la sélection`, null, null, u.nom); return;
  }
  if (op === "retirer") { const x = await lien(); await db.query("DELETE FROM mariage_partenaire WHERE mariage_id = $1 AND partenaire_id = $2", [m.id, pid]); await store.journal(m.id, "Partenaires", "Retiré de la sélection : " + x.nom, null, null, u.nom); return; }
  if (op === "regler") {
    const x = await lien(), acc = Object.assign({}, x.accord || {});
    if (b.accord) ["chambres", "tarif", "butoir", "reservation", "conditions", "interlocuteur"].forEach(k => { if (b.accord[k] !== undefined) acc[k] = k === "chambres" ? (num(b.accord[k]) || null) : propre(b.accord[k]).slice(0, 600) || null; });
    const statut = STATUTS.includes(b.statut) ? b.statut : x.statut;
    await db.query("UPDATE mariage_partenaire SET statut = $3, accord = $4, publie = $5, notes = $6, relance_le = $7, modifie_le = now() WHERE mariage_id = $1 AND partenaire_id = $2",
      [m.id, pid, statut, acc, b.publie !== undefined ? !!b.publie : x.publie, b.notes !== undefined ? propre(b.notes).slice(0, 3000) : x.notes, b.relance_le !== undefined ? (propre(b.relance_le) || null) : x.relance_le]);
    if (statut !== x.statut) await store.journal(m.id, "Partenaires", `${x.nom} : ${x.statut} → ${statut}`, { statut: x.statut }, { statut }, u.nom);
    return;
  }
  if (op === "echange") {
    const x = await lien(), canal = CANAUX.includes(b.canal) ? b.canal : "note", issue = ISSUES.includes(b.issue) ? b.issue : null;
    const rep = {}; Object.keys(b.reponses || {}).slice(0, 30).forEach(k => { const v = propre(b.reponses[k]).slice(0, 600); if (v) rep[k.slice(0, 40)] = v; });
    const relance = propre(b.relance_le) || null;
    await db.query("INSERT INTO partenaire_echange (partenaire_id, mariage_id, canal, issue, resume, reponses, duree_min, relance_le, par) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      [pid, m.id, canal, issue, propre(b.resume).slice(0, 3000) || null, rep, num(b.duree_min), relance, u.nom]);
    /* l'échange fait avancer la sélection et enrichit la fiche du répertoire */
    const statut = issue === "accord" ? "accord" : issue === "décliné" ? "décliné" : issue === "proposition attendue" ? "en discussion" : x.statut === "à contacter" ? "contacté" : x.statut;
    const acc = Object.assign({}, x.accord || {}); ["chambres", "tarif", "butoir", "reservation", "interlocuteur"].forEach(k => { if (rep[k]) acc[k] = k === "chambres" ? (num(rep[k]) || rep[k]) : rep[k]; });
    await db.query("UPDATE mariage_partenaire SET statut = $3, accord = $4, relance_le = $5, modifie_le = now() WHERE mariage_id = $1 AND partenaire_id = $2", [m.id, pid, statut, acc, relance]);
    if (rep.interlocuteur) await db.query("UPDATE partenaire SET contact_nom = COALESCE(contact_nom, $2), verifie = true, modifie_le = now() WHERE id = $1", [pid, rep.interlocuteur.slice(0, 120)]);
    await store.journal(m.id, "Partenaires", `${canal === "appel" ? "Appel" : canal[0].toUpperCase() + canal.slice(1)} avec ${x.nom}${issue ? ", " + issue : ""}`, null, null, u.nom);
    return;
  }
  throw new Error("opération inconnue");
}

/* Ce que le site des invités montre : les maisons en accord et publiées, avec ce qui aide l'invité à choisir. */
async function publies(mariageId) {
  return (await db.query(`SELECT p.nom, p.ville, p.categorie, p.etoiles, p.site, mp.accord FROM mariage_partenaire mp JOIN partenaire p ON p.id = mp.partenaire_id
    WHERE mp.mariage_id = $1 AND mp.publie AND mp.statut = 'accord' ORDER BY p.categorie, p.nom`, [mariageId]))
    .map(x => ({ nom: x.nom, ville: x.ville, categorie: x.categorie, etoiles: x.etoiles, site: x.site, tarif: (x.accord || {}).tarif || null, butoir: (x.accord || {}).butoir || null }));
}

/* Les relances partenaires dues, pour À faire aujourd'hui. */
async function relancesDues(mariageId) {
  const ajd = new Date().toISOString().slice(0, 10);
  return (await db.query(`SELECT count(*)::int AS n FROM mariage_partenaire WHERE mariage_id = $1 AND relance_le IS NOT NULL AND relance_le <= $2 AND statut NOT IN ('accord','décliné')`, [mariageId, ajd]))[0].n;
}

module.exports = { CATEGORIES, STATUTS, GUIDES, importer, repertoire, fiche, enregistrer, suivi, agir, publies, relancesDues, cleDe };
