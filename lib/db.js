/* =====================================================================
   BASE DE DONNÉES YES I DO · Postgres
   En production : Neon via son point d'entrée HTTP (aucune dépendance,
   la variable DATABASE_URL est posée par Vercel quand la base est reliée).
   En local (recette) : PGlite, un Postgres complet dans Node, fichier
   test/data ; même SQL, mêmes résultats.
   Surface : query(sql, params) -> lignes ; batch([[sql, params], ...])
   -> lignes de chaque requête, dans une seule transaction.
   ===================================================================== */
const URL_ = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL_UNPOOLED || "";

let pglite = null;
async function local() {
  if (pglite) return pglite;
  const { PGlite } = require("@electric-sql/pglite");
  const dir = process.env.PGLITE_DIR || require("path").join(__dirname, "..", "test", "data");
  pglite = new PGlite(dir);
  await pglite.waitReady;
  return pglite;
}

/* Valeurs texte de Neon vers les types JavaScript, d'après l'identifiant de type Postgres. */
function cast(v, oid) {
  if (v === null || v === undefined) return null;
  switch (oid) {
    case 16: return v === "t" || v === true;                 /* bool */
    case 20: case 21: case 23: case 26: case 700: case 701: case 1700: return Number(v); /* entiers, réels, numeric */
    case 114: case 3802: return typeof v === "string" ? JSON.parse(v) : v;  /* json, jsonb */
    default: return v;                                        /* texte, dates et horodatages restent en texte ISO */
  }
}
function normalizeRows(rows, fields, raw) {
  if (!rows || !rows.length) return [];
  return rows.map(r => {
    const o = {};
    for (const f of fields) {
      let v = r[f.name];
      if (raw) v = cast(v, f.dataTypeID);
      else if (v instanceof Date) v = f.dataTypeID === 1082 ? v.toISOString().slice(0, 10) : v.toISOString();
      o[f.name] = v;
    }
    return o;
  });
}
function neonHost() { try { return new URL(URL_).hostname; } catch (e) { throw new Error("DATABASE_URL illisible"); } }
function prep(params) { return (params || []).map(p => (p !== null && typeof p === "object" && !(p instanceof Date)) ? JSON.stringify(p) : p instanceof Date ? p.toISOString() : p); }

async function neon(bodyObj, headers) {
  const r = await fetch(`https://${neonHost()}/sql`, {
    method: "POST",
    headers: Object.assign({ "Neon-Connection-String": URL_, "Content-Type": "application/json", "Neon-Raw-Text-Output": "true", "Neon-Array-Mode": "false" }, headers || {}),
    body: JSON.stringify(bodyObj)
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error("Postgres " + r.status + ": " + (j.message || j.error || JSON.stringify(j)).slice(0, 300));
  return j;
}

async function query(sql, params) {
  if (URL_) {
    const j = await neon({ query: sql, params: prep(params) });
    return normalizeRows(j.rows, j.fields, true);
  }
  const db = await local();
  const r = await db.query(sql, prep(params));
  return normalizeRows(r.rows, r.fields, false);
}

async function batch(list) {
  if (!list.length) return [];
  if (URL_) {
    const j = await neon({ queries: list.map(([sql, params]) => ({ query: sql, params: prep(params) })) }, { "Neon-Batch-Isolation-Level": "ReadCommitted", "Neon-Batch-Read-Only": "false" });
    return (j.results || []).map(x => normalizeRows(x.rows, x.fields, true));
  }
  const db = await local();
  return db.transaction(async (tx) => {
    const out = [];
    for (const [sql, params] of list) { const r = await tx.query(sql, prep(params)); out.push(normalizeRows(r.rows, r.fields, false)); }
    return out;
  });
}

/* ---------- schéma et migrations : un fichier SQL par version, appliqué une seule fois ---------- */
const fs = require("fs"), path = require("path");
let migrated = false;
async function migrate() {
  if (migrated) return;
  await query("CREATE TABLE IF NOT EXISTS schema_version (version integer PRIMARY KEY, applique_le timestamptz NOT NULL DEFAULT now())");
  const done = new Set((await query("SELECT version FROM schema_version")).map(r => r.version));
  const dir = path.join(__dirname, "migrations");
  const files = fs.readdirSync(dir).filter(f => /^\d+.*\.sql$/.test(f)).sort();
  for (const f of files) {
    const v = parseInt(f, 10);
    if (done.has(v)) continue;
    const sql = fs.readFileSync(path.join(dir, f), "utf8");
    /* une migration = une transaction ; les instructions sont séparées par une ligne « ;; » pour rester lisibles */
    const stmts = sql.split(/\n;;\s*\n/).map(s => s.trim()).filter(Boolean);
    await batch(stmts.map(s => [s, []]).concat([["INSERT INTO schema_version (version) VALUES ($1)", [v]]]));
  }
  migrated = true;
}
async function version() {
  const r = await query("SELECT max(version) AS v, max(applique_le) AS le FROM schema_version");
  return r[0] || { v: null, le: null };
}

module.exports = { query, batch, migrate, version, backend: () => (URL_ ? "neon" : "pglite"), host: () => (URL_ ? neonHost() : "local") };
