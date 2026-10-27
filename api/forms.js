/* =====================================================================
   API YES I DO · une seule fonction Vercel : /api/forms
   Côté invité (clé du foyer dans le lien) :
     ?action=profile  GET   profil discret du foyer (cercle des proches, langue)
     ?action=form     GET   formulaire construit pour ce foyer, prérempli
     ?action=submit   POST  enregistrement (nouvelle version), puis écriture Excel
   Côté équipe (connexion) :
     ?action=admin-login    POST  mot de passe -> jeton de session (12 heures)
     ?action=admin-check    POST  les trois voyants : base, SharePoint, boîte
     ?action=admin-mariages POST  les mariages connus de l'application
     ?action=admin-list     POST  suivi des foyers d'un mariage
     ?action=admin-import   POST  import de la liste qualifiée (CSV)
     ?action=admin-export   POST  exports CSV
     ?action=admin-sync     POST  rejoue la file d'attente Excel
     ?action=admin-headers  POST  en-têtes attendus dans le classeur
     ?action=admin-journal  POST  dernières opérations du journal
   ===================================================================== */
const crypto = require("crypto");
const store = require("../lib/store");
const graph = require("../lib/graph");
const engine = require("../lib/engine");
const WEDDINGS = require("../lib/weddings");

const VERSION = "1.0";
const ORIGINS = (process.env.ALLOWED_ORIGINS || "*").split(",").map(s => s.trim()).filter(Boolean);

function cors(req, res) {
  const o = req.headers.origin || "";
  const allow = ORIGINS.includes("*") ? "*" : (ORIGINS.includes(o) ? o : ORIGINS[0]);
  res.setHeader("Access-Control-Allow-Origin", allow);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Admin-Password, X-Admin-Token");
  res.setHeader("Cache-Control", "no-store");
}
function send(res, code, obj) { res.statusCode = code; res.setHeader("Content-Type", "application/json; charset=utf-8"); res.end(JSON.stringify(obj)); }
function ip(req) { return String(req.headers["x-forwarded-for"] || (req.socket && req.socket.remoteAddress) || "local").split(",")[0].trim(); }
async function body(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") { try { return JSON.parse(req.body); } catch (e) { return {}; } }
  return new Promise((ok) => { let d = ""; req.on("data", c => (d += c)); req.on("end", () => { try { ok(JSON.parse(d || "{}")); } catch (e) { ok({}); } }); });
}
function query(req) { const u = new URL(req.url, "http://x"); return Object.fromEntries(u.searchParams.entries()); }

/* ---------- connexion de l'équipe : mot de passe puis jeton signé ---------- */
const SECRET = () => crypto.createHash("sha256").update("yid-app|" + (process.env.ADMIN_PASSWORD || "")).digest();
function okPassword(given) {
  const want = process.env.ADMIN_PASSWORD || "";
  if (!want || !given) return false;
  const a = Buffer.from(String(given)), b = Buffer.from(want);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function makeToken(hours) {
  const exp = Date.now() + (hours || 12) * 3600 * 1000;
  const payload = Buffer.from(JSON.stringify({ exp, role: "administrateur" })).toString("base64url");
  const sig = crypto.createHmac("sha256", SECRET()).update(payload).digest("base64url");
  return payload + "." + sig;
}
function okToken(tok) {
  if (!tok || !process.env.ADMIN_PASSWORD) return false;
  const [payload, sig] = String(tok).split(".");
  if (!payload || !sig) return false;
  const want = crypto.createHmac("sha256", SECRET()).update(payload).digest("base64url");
  if (want.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(want), Buffer.from(sig))) return false;
  try { return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")).exp > Date.now(); } catch (e) { return false; }
}
function authed(req, b) { return okToken(req.headers["x-admin-token"]) || okPassword(req.headers["x-admin-password"] || b.password); }

function newKey() {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const b = crypto.randomBytes(10); let k = ""; for (let i = 0; i < 10; i++) k += abc[b[i] % abc.length]; return k;
}
const cleanKey = (k) => String(k || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40);

/* ---------- Excel : écriture directe, file d'attente en cas d'échec ---------- */
async function pushRows(cfg, groups) {
  if (!graph.enabled()) return { skipped: true };
  let failed = 0;
  for (const p of await store.pending(cfg.id)) {
    try { await graph.addRows(p.classeur, p.tableau, p.lignes); await store.dequeueExcel(p.id); }
    catch (e) { failed++; await store.retryExcel(p.id, e.message); console.error(e.message); }
  }
  for (const [table, rows] of groups) {
    try { await graph.addRows(cfg.excel.path, table, rows); }
    catch (e) { failed++; await store.queueExcel(cfg.id, cfg.excel.path, table, rows, e.message); console.error(e.message); }
  }
  return { ok: !failed, pending: failed };
}

/* ---------- CSV ---------- */
function parseCSV(text) {
  text = String(text || "").replace(/^﻿/, "");
  const first = text.split(/\r?\n/)[0] || "";
  const delim = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ";" : (first.includes("\t") ? "\t" : ",");
  const out = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true;
    else if (c === delim) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); out.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); out.push(row); }
  return out.filter(r => r.some(x => x.trim()));
}
function toCSV(rows) { return "﻿" + rows.map(r => r.map(v => { v = v == null ? "" : String(v); return /[";\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(";")).join("\r\n"); }
const norm = (s) => String(s || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const truthy = (s) => ["oui", "yes", "ja", "x", "1", "true", "vrai"].includes(norm(s));

/* liste : foyer ; membres (séparés par /) ; enfants « Prénom Nom (8) / ... » ; proches ; email ; telephone ; langue ; accompagnant ; cle */
function householdsFromCSV(text) {
  const rows = parseCSV(text); if (!rows.length) return [];
  const head = rows[0].map(norm);
  const col = (names) => head.findIndex(h => names.includes(h));
  const iF = col(["foyer", "household", "nom du foyer"]), iM = col(["membres", "members", "invites", "invités"]), iE = col(["enfants", "children", "kids"]),
        iP = col(["proches", "inner", "cercle", "vendredi"]), iMail = col(["email", "e-mail", "mail"]), iT = col(["telephone", "téléphone", "phone", "tel"]),
        iL = col(["langue", "language", "lang"]), iA = col(["accompagnant", "plus one", "plus_one", "+1"]), iK = col(["cle", "clé", "key"]);
  if (iF < 0 || iM < 0) throw new Error("Colonnes attendues : foyer, membres (et facultatives : enfants, proches, email, telephone, langue, accompagnant, cle)");
  return rows.slice(1).map(r => {
    const g = (i) => (i >= 0 ? (r[i] || "").trim() : "");
    const members = g(iM).split("/").map(s => s.trim()).filter(Boolean).map((n, i) => ({ id: "m" + (i + 1), name: n }));
    const kids = g(iE).split("/").map(s => s.trim()).filter(Boolean).map((n, i) => { const m = n.match(/^(.*?)\s*\((\d{1,2})\)\s*$/); return { id: "c" + (i + 1), name: m ? m[1].trim() : n, age: m ? m[2] : "", child: true }; });
    const lang = norm(g(iL)).slice(0, 2);
    return { key: cleanKey(g(iK)), name: g(iF), members: members.concat(kids), inner: truthy(g(iP)), email: g(iMail), phone: g(iT), lang: ["en", "fr", "nl"].includes(lang) ? lang : "en", plusOne: truthy(g(iA)) };
  }).filter(h => h.name && h.members.length);
}
const linkFor = (cfg, hh) => cfg.site.replace(/\/$/, "") + "/?k=" + hh.key + (hh.lang && hh.lang !== "en" ? "&lang=" + hh.lang : "");

/* =====================================================================
   POINT D'ENTRÉE
   ===================================================================== */
module.exports = async (req, res) => {
  cors(req, res);
  if (req.method === "OPTIONS") { res.statusCode = 204; return res.end(); }
  const q = query(req);
  const action = q.action || "";
  try {
    await store.migrate();
    const b = req.method === "POST" ? await body(req) : {};

    /* ---------- tâche planifiée Vercel : rejoue la file d'attente Excel ---------- */
    if (action === "cron-sync") {
      const auth = req.headers.authorization || "";
      if (!process.env.CRON_SECRET || auth !== "Bearer " + process.env.CRON_SECRET) return send(res, 401, { ok: false });
      const out = {}; for (const id of Object.keys(WEDDINGS)) { await store.ensureMariage(WEDDINGS[id]); out[id] = await pushRows(WEDDINGS[id], []); }
      return send(res, 200, { ok: true, out });
    }

    /* ---------- connexion et vérifications : sans mariage ---------- */
    if (action === "admin-login") {
      if (!(await store.rateLimit(ip(req), 10))) return send(res, 429, { ok: false, error: "slow down" });
      if (!okPassword(b.password)) return send(res, 401, { ok: false, error: "password" });
      await store.journal(null, "Connexion à l'administration", ip(req), null, null, "administrateur");
      return send(res, 200, { ok: true, token: makeToken(12), version: VERSION });
    }
    if (action === "admin-check") {
      if (!authed(req, b)) return send(res, 401, { ok: false, error: "password" });
      const out = { ok: true, version: VERSION, base: {}, sharepoint: {}, boite: {} };
      try {
        const v = await store.version();
        const n = (await require("../lib/db").query("SELECT (SELECT count(*) FROM mariage) AS mariages, (SELECT count(*) FROM foyer WHERE NOT desactive) AS foyers, (SELECT count(*) FROM reponse) AS reponses, (SELECT count(*) FROM excel_attente) AS attente"))[0];
        out.base = { ok: true, detail: `Postgres ${store.backend() === "neon" ? "Neon" : "local"} (${store.host()}), schéma version ${v.v}, ${n.mariages} mariage(s), ${n.foyers} foyer(s), ${n.reponses} réponse(s), ${n.attente} écriture(s) Excel en attente.` };
      } catch (e) { out.base = { ok: false, detail: e.message }; }
      const g = await graph.check();
      out.sharepoint = { ok: !!(g.site.ok && g.write.ok), detail: [g.site.detail, g.write.detail].filter(Boolean).join(" "), url: g.site.url };
      out.boite = { ok: !!g.mail.ok, detail: g.mail.detail };
      await store.journal(null, "Vérification de la connexion", `base ${out.base.ok ? "ok" : "ko"}, SharePoint ${out.sharepoint.ok ? "ok" : "ko"}, boîte ${out.boite.ok ? "ok" : "ko"}`, null, null, "administrateur");
      return send(res, 200, out);
    }
    if (action === "admin-mariages") {
      if (!authed(req, b)) return send(res, 401, { ok: false, error: "password" });
      for (const id of Object.keys(WEDDINGS)) await store.ensureMariage(WEDDINGS[id]);
      return send(res, 200, { ok: true, mariages: await store.mariages() });
    }
    if (action === "admin-journal") {
      if (!authed(req, b)) return send(res, 401, { ok: false, error: "password" });
      const m = q.w || b.w ? await store.mariage(q.w || b.w) : null;
      return send(res, 200, { ok: true, journal: await store.readJournal(m ? m.id : null, 200) });
    }

    const w = String(q.w || b.w || "").toUpperCase();
    const cfg = WEDDINGS[w];
    if (!cfg) return send(res, 404, { ok: false, error: "wedding" });
    await store.ensureMariage(cfg);

    /* ---------- côté invité ---------- */
    if (action === "profile" || action === "form" || action === "submit") {
      if (!(await store.rateLimit(ip(req), action === "submit" ? 20 : 90))) return send(res, 429, { ok: false, error: "slow down" });
      const key = cleanKey(q.k || b.k);
      const hh = key ? await store.household(w, key) : null;
      const lang = engine.LANGS.includes(q.lang || b.lang) ? (q.lang || b.lang) : (hh && hh.lang) || "en";

      if (action === "profile") {
        if (!hh) return send(res, 200, { ok: true, matched: false });
        return send(res, 200, { ok: true, matched: true, inner: !!hh.inner, lang: hh.lang || "en", greeting: engine.firstNames(hh, lang) });
      }

      const form = String(q.f || b.f || "");
      if (!engine.FORMS.includes(form)) return send(res, 400, { ok: false, error: "form" });
      const extra = {}; ["hotel", "driver"].forEach(k => { const v = q[k] !== undefined ? q[k] : (b.extra || {})[k]; if (v) extra[k] = String(v).slice(0, 60); });
      const answers = hh ? await store.answers(w, key) : {};
      const schema = engine.build(cfg, hh, form, lang, extra, answers);

      if (action === "form") return send(res, 200, Object.assign({ ok: true, ui: engine.UI[lang] }, schema));

      /* submit */
      if (b.website) return send(res, 200, { ok: true, done: schema.done });            /* champ piège : robot */
      const { data, errors } = engine.validate(schema, b.data || {});
      if (errors.length) return send(res, 422, { ok: false, errors });
      const saved = await store.saveAnswer(w, hh, form, hh ? data : Object.assign({ unmatched: true, key_given: key }, data), lang, extra, "invite", String(req.headers["user-agent"] || "").slice(0, 120));
      let excel;
      try { excel = await pushRows(cfg, engine.rows(cfg, hh, form, data, lang)); } catch (e) { excel = { error: e.message }; }
      return send(res, 200, { ok: true, done: schema.done, version: saved.version, excel: excel && excel.ok !== false });
    }

    /* ---------- administration d'un mariage ---------- */
    if (action.startsWith("admin-")) {
      if (!authed(req, b)) return send(res, 401, { ok: false, error: "password" });

      if (action === "admin-import") {
        const list = householdsFromCSV(b.csv);
        const out = []; let created = 0;
        for (const h of list) {
          const prev = (h.key && (await store.household(w, h.key))) || (await store.householdByName(w, h.name));
          h.key = prev ? prev.key : (h.key || newKey());
          const r = await store.saveHousehold(w, h, "administrateur");
          if (r.created) created++;
          out.push([h.name, h.key, linkFor(cfg, h), h.inner ? "oui" : "non", h.members.length, r.created ? "créé" : "mis à jour"]);
        }
        return send(res, 200, { ok: true, count: out.length, created, csv: toCSV([["Foyer", "Clé", "Lien personnel", "Proches", "Personnes", "Import"]].concat(out)) });
      }

      if (action === "admin-list") {
        const all = await store.allHouseholds(w);
        const list = all.map(({ hh, answers }) => Object.assign(engine.status(cfg, hh, answers), { statut: hh.statut, lien: linkFor(cfg, hh) }));
        list.sort((a, b2) => a.foyer.localeCompare(b2.foyer));
        const pend = await store.pending(w);
        return send(res, 200, { ok: true, couple: cfg.couple, households: list, storage: "Postgres " + (store.backend() === "neon" ? "Neon" : "local"), excel: graph.enabled() ? "branché" : "non branché", pending: pend.length, version: VERSION });
      }

      if (action === "admin-export") {
        const kind = q.kind || b.kind || "suivi";
        const all = await store.allHouseholds(w), H = engine.headers(cfg), T = cfg.excel.tables;
        if (kind === "suivi") {
          const rows = [["Foyer", "Clé", "Proches", "Confirmation", "Voyage", "Hébergement", "Chauffeur", "Navettes", "Charte", "Dernière activité", "Lien"]];
          for (const { hh, answers } of all) { const s = engine.status(cfg, hh, answers); rows.push([s.foyer, s.key, s.proches, s.confirmation, s.voyage, s.hebergement, s.chauffeur, s.navettes, s.charte, s.derniere_activite, linkFor(cfg, hh)]); }
          return send(res, 200, { ok: true, csv: toCSV(rows) });
        }
        const map = { invites: ["confirm", T.guests], voyages: ["confirm", T.travel], hebergement: ["accommodation", T.accommodation], ailleurs: ["elsewhere", T.elsewhere], transferts: ["driver", T.driver], navettes: ["shuttle", T.shuttle], conciergerie: ["concierge", T.concierge], charte: ["charter", T.charter] };
        if (!map[kind]) return send(res, 400, { ok: false, error: "kind" });
        const [form, table] = map[kind]; const rows = [H[table]];
        for (const { hh, answers } of all) { const a = answers[form]; if (!a) continue; engine.rows(cfg, hh, form, a.data, a.lang).filter(g => g[0] === table).forEach(g => g[1].forEach(r => rows.push(r))); }
        return send(res, 200, { ok: true, csv: toCSV(rows) });
      }

      if (action === "admin-sync") return send(res, 200, Object.assign({ ok: true }, await pushRows(cfg, [])));
      if (action === "admin-headers") return send(res, 200, { ok: true, tables: engine.headers(cfg), path: cfg.excel.path });
    }

    return send(res, 400, { ok: false, error: "action" });
  } catch (e) {
    console.error(e);
    return send(res, 500, { ok: false, error: "server", detail: String(e.message || e).slice(0, 300) });
  }
};
