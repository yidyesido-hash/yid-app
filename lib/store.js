/* =====================================================================
   STOCKAGE YES I DO · Postgres (lib/db.js)
   Les foyers et leurs personnes, les réponses versionnées, le journal,
   la file d'attente Excel et la limite de requêtes.
   Tout passe par la clé du foyer ; rien n'est supprimé, on désactive.
   ===================================================================== */
const db = require("./db");

/* ---------- mariages ---------- */
const mariageCache = {};
async function mariage(code) {
  code = String(code || "").toUpperCase();
  if (mariageCache[code]) return mariageCache[code];
  const r = await db.query("SELECT * FROM mariage WHERE code = $1", [code]);
  if (r[0]) mariageCache[code] = r[0];
  return r[0] || null;
}
/* Crée la ligne du mariage depuis sa configuration si elle n'existe pas encore (socle v1.0 ;
   la déclaration complète par l'écran Paramètres arrive en v1.1). */
async function ensureMariage(cfg) {
  const m = await mariage(cfg.id);
  if (m) return m;
  const dossier = (cfg.excel && cfg.excel.path ? cfg.excel.path.split("/").slice(0, -1).join("/") : null);
  await db.query(
    "INSERT INTO mariage (code, prenoms, statut, site, dossier, langue_defaut, parametres) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (code) DO NOTHING",
    [cfg.id, cfg.couple, ({ AK00: "Test", AM27: "Clos" })[cfg.id] || "En préparation", cfg.site || null, dossier, "en", { origine: "configuration " + cfg.id }]);
  await journal(null, "Mariage créé depuis la configuration", cfg.id, null, { code: cfg.id, prenoms: cfg.couple }, "application");
  delete mariageCache[cfg.id];
  return mariage(cfg.id);
}
async function mariages() { return db.query("SELECT code, prenoms, statut, date_mariage, lieu, site, dossier, boite_email, cree_le FROM mariage WHERE NOT desactive ORDER BY cree_le"); }

/* ---------- journal ---------- */
async function journal(mariageId, operation, detail, avant, apres, operateur) {
  await db.query("INSERT INTO journal (mariage_id, operation, detail, avant, apres, operateur) VALUES ($1,$2,$3,$4,$5,$6)",
    [mariageId, operation, detail == null ? null : String(detail), avant == null ? null : avant, apres == null ? null : apres, operateur || "application"]);
}
async function readJournal(mariageId, limit) {
  return db.query("SELECT * FROM journal WHERE ($1::int IS NULL OR mariage_id = $1) ORDER BY id DESC LIMIT $2", [mariageId, limit || 200]);
}

/* ---------- foyers : la forme « household » attendue par le moteur de formulaires ---------- */
function toHousehold(f, personnes) {
  return {
    id: f.id, key: f.cle, name: f.nom_affichage,
    members: (personnes || []).filter(p => !p.desactive).sort((a, b) => a.ordre - b.ordre).map(p => ({ id: p.code, name: p.nom, child: !!p.enfant, age: p.age || "" })),
    inner: !!f.proches, plusOne: !!f.accompagnant, events: f.evenements || undefined,
    email: f.email || "", phone: f.telephone || "", lang: f.langue || "en", statut: f.statut, desactive: !!f.desactive
  };
}
async function household(code, key) {
  const m = await mariage(code); if (!m) return null;
  const f = (await db.query("SELECT * FROM foyer WHERE mariage_id = $1 AND cle = $2", [m.id, key]))[0];
  if (!f || f.desactive) return null;
  const p = await db.query("SELECT * FROM personne WHERE foyer_id = $1", [f.id]);
  return toHousehold(f, p);
}
async function householdByName(code, name) {
  const m = await mariage(code); if (!m) return null;
  const f = (await db.query("SELECT * FROM foyer WHERE mariage_id = $1 AND lower(nom_affichage) = lower($2) AND NOT desactive ORDER BY id LIMIT 1", [m.id, name]))[0];
  if (!f) return null;
  const p = await db.query("SELECT * FROM personne WHERE foyer_id = $1", [f.id]);
  return toHousehold(f, p);
}
/* Enregistre un foyer importé (création ou mise à jour) et ses personnes. Les personnes sont
   remplacées par la liste reçue : l'import de la liste qualifiée fait foi, jamais une saisie. */
async function saveHousehold(code, hh, operateur) {
  const m = await mariage(code); if (!m) throw new Error("mariage inconnu : " + code);
  const existing = (await db.query("SELECT * FROM foyer WHERE mariage_id = $1 AND cle = $2", [m.id, hh.key]))[0];
  let id;
  if (existing) {
    id = existing.id;
    await db.query("UPDATE foyer SET nom_affichage=$1, proches=$2, accompagnant=$3, email=$4, telephone=$5, langue=$6, evenements=$7, desactive=false, modifie_le=now() WHERE id=$8",
      [hh.name, !!hh.inner, !!hh.plusOne, hh.email || null, hh.phone || null, hh.lang || "en", hh.events || null, id]);
    await db.query("UPDATE personne SET desactive = true WHERE foyer_id = $1", [id]);
  } else {
    id = (await db.query("INSERT INTO foyer (mariage_id, cle, nom_affichage, nom_repertoire, proches, accompagnant, email, telephone, langue, evenements, source) VALUES ($1,$2,$3,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id",
      [m.id, hh.key, hh.name, !!hh.inner, !!hh.plusOne, hh.email || null, hh.phone || null, hh.lang || "en", hh.events || null, hh.source || "import liste"]))[0].id;
  }
  const ops = (hh.members || []).map((p, i) => ["INSERT INTO personne (foyer_id, ordre, code, nom, enfant, age, desactive) VALUES ($1,$2,$3,$4,$5,$6,false)", [id, i + 1, p.id, p.name, !!p.child, p.age || null]]);
  if (ops.length) await db.batch(ops);
  await journal(m.id, existing ? "Foyer mis à jour" : "Foyer créé", hh.name, existing ? { cle: existing.cle, nom: existing.nom_affichage } : null, { cle: hh.key, nom: hh.name, personnes: (hh.members || []).length }, operateur);
  return { id, created: !existing };
}
async function keys(code) {
  const m = await mariage(code); if (!m) return [];
  return (await db.query("SELECT cle FROM foyer WHERE mariage_id = $1 AND NOT desactive ORDER BY nom_affichage", [m.id])).map(r => r.cle);
}
/* Tous les foyers d'un mariage avec leurs personnes et leur dernière réponse par formulaire, en trois requêtes. */
async function allHouseholds(code) {
  const m = await mariage(code); if (!m) return [];
  const [foyers, personnes, reponses] = await Promise.all([
    db.query("SELECT * FROM foyer WHERE mariage_id = $1 AND NOT desactive ORDER BY nom_affichage", [m.id]),
    db.query("SELECT p.* FROM personne p JOIN foyer f ON f.id = p.foyer_id WHERE f.mariage_id = $1 AND NOT p.desactive", [m.id]),
    db.query("SELECT DISTINCT ON (foyer_id, formulaire) foyer_id, formulaire, contenu, langue, extra, cree_le FROM reponse WHERE mariage_id = $1 AND foyer_id IS NOT NULL ORDER BY foyer_id, formulaire, version DESC", [m.id])
  ]);
  const byFoyer = {}; personnes.forEach(p => (byFoyer[p.foyer_id] = byFoyer[p.foyer_id] || []).push(p));
  const ans = {}; reponses.forEach(r => { (ans[r.foyer_id] = ans[r.foyer_id] || {})[r.formulaire] = { data: r.contenu, at: r.cree_le, lang: r.langue, extra: r.extra || {} }; });
  return foyers.map(f => ({ hh: toHousehold(f, byFoyer[f.id]), answers: ans[f.id] || {} }));
}

/* ---------- réponses : une nouvelle version à chaque envoi ---------- */
async function answers(code, key) {
  const m = await mariage(code); if (!m) return {};
  const rows = await db.query(
    "SELECT DISTINCT ON (r.formulaire) r.formulaire, r.contenu, r.langue, r.extra, r.cree_le FROM reponse r JOIN foyer f ON f.id = r.foyer_id WHERE r.mariage_id = $1 AND f.cle = $2 ORDER BY r.formulaire, r.version DESC", [m.id, key]);
  const out = {}; rows.forEach(r => { out[r.formulaire] = { data: r.contenu, at: r.cree_le, lang: r.langue, extra: r.extra || {} }; });
  return out;
}
async function saveAnswer(code, hh, form, data, lang, extra, origine, navigateur) {
  const m = await mariage(code); if (!m) throw new Error("mariage inconnu : " + code);
  const foyerId = hh ? hh.id : null;
  const v = foyerId ? (await db.query("SELECT coalesce(max(version),0)+1 AS v FROM reponse WHERE foyer_id = $1 AND formulaire = $2", [foyerId, form]))[0].v : 1;
  const r = await db.query("INSERT INTO reponse (mariage_id, foyer_id, formulaire, version, contenu, langue, extra, origine, navigateur) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id, cree_le",
    [m.id, foyerId, form, v, data, lang || null, extra || {}, origine || "invite", navigateur || null]);
  if (foyerId && form === "confirm") {
    /* présence par événement : « att__<événement> » = personnes présentes ; aucune personne nulle part = déclin */
    const att = Object.keys(data || {}).filter(k => k.startsWith("att__"));
    const statut = !att.length ? null : att.some(k => Array.isArray(data[k]) && data[k].length) ? "Confirmé" : "Décliné";
    if (statut) await db.query("UPDATE foyer SET statut = $1, modifie_le = now() WHERE id = $2 AND statut <> $1", [statut, foyerId]);
  }
  return { id: r[0].id, version: v, at: r[0].cree_le };
}

/* ---------- file d'attente Excel ---------- */
async function pending(code) {
  const m = await mariage(code); if (!m) return [];
  return db.query("SELECT id, classeur, tableau, lignes, tentatives FROM excel_attente WHERE mariage_id = $1 ORDER BY id", [m.id]);
}
async function queueExcel(code, classeur, tableau, lignes, erreur) {
  const m = await mariage(code);
  await db.query("INSERT INTO excel_attente (mariage_id, classeur, tableau, lignes, tentatives, derniere_erreur) VALUES ($1,$2,$3,$4,1,$5)", [m.id, classeur, tableau, lignes, (erreur || "").slice(0, 300)]);
}
async function dequeueExcel(id) { await db.query("DELETE FROM excel_attente WHERE id = $1", [id]); }
async function retryExcel(id, erreur) { await db.query("UPDATE excel_attente SET tentatives = tentatives + 1, derniere_erreur = $2 WHERE id = $1", [id, (erreur || "").slice(0, 300)]); }

/* ---------- limite de requêtes par adresse et par minute ---------- */
async function rateLimit(ip, limit) {
  const k = ip + ":" + Math.floor(Date.now() / 60000);
  const r = await db.query(
    "INSERT INTO limite_requetes (cle, n, expire_le) VALUES ($1, 1, now() + interval '2 minutes') ON CONFLICT (cle) DO UPDATE SET n = limite_requetes.n + 1 RETURNING n", [k]);
  if (Math.random() < 0.02) db.query("DELETE FROM limite_requetes WHERE expire_le < now()").catch(() => {});
  return r[0].n <= limit;
}

module.exports = {
  backend: db.backend, migrate: db.migrate, version: db.version, host: db.host,
  mariage, ensureMariage, mariages, journal, readJournal,
  household, householdByName, saveHousehold, keys, allHouseholds,
  answers, saveAnswer, pending, queueExcel, dequeueExcel, retryExcel, rateLimit
};
