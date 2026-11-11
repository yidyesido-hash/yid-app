/* =====================================================================
   API YES I DO · une seule fonction Vercel : /api/forms
   Côté invité (clé du foyer dans le lien) :
     ?action=profile  GET   profil discret du foyer (cercle des proches, langue)
     ?action=form     GET   formulaire construit pour ce foyer, prérempli
     ?action=submit   POST  enregistrement (nouvelle version), puis écriture Excel
   Côté équipe (connexion) :
     ?action=admin-login    POST  prénom et mot de passe (ou mot de passe d'installation seul) -> jeton de session (12 heures)
     ?action=admin-check    POST  les trois voyants : base, SharePoint, boîte
     ?action=admin-mariages POST  les mariages connus de l'application
     ?action=admin-list     POST  suivi des foyers d'un mariage
     ?action=admin-import   POST  import de la liste qualifiée (CSV)
     ?action=admin-export   POST  exports CSV
     ?action=admin-sync     POST  rejoue la file d'attente Excel
     ?action=admin-headers  POST  en-têtes attendus dans le classeur
     ?action=admin-journal  POST  dernières opérations du journal
     ?action=admin-accueil  POST  l'accueil : mariages, jauges, cheminement, journal récent
     ?action=admin-checklist POST la checklist du call 1 (structure) et la date de remise proposée
     ?action=admin-declarer POST  déclarer un mariage (ou le mettre à jour avec w=CODE) : base, SharePoint, fiche PDF, boîte
     ?action=admin-mariage  POST  la fiche d'un mariage (w=CODE)
     ?action=admin-boite    POST  revérifier la boîte email d'un mariage (w=CODE)
     ?action=admin-reglages POST  lire (sans corps) ou enregistrer (cle, valeur) un réglage
     ?action=admin-liste     POST  étape 2 Liste d'invités : lignes, lots, anomalies, tuiles, quotas, règles (w=CODE)
     ?action=admin-importer  POST  déposer un lot : source, cote, proche, fichiers [{ name, b64 }] .vcf .csv ou collect .xlsx (w=CODE)
     ?action=admin-qualifier POST  qualifier une ligne : id, champs { cote, invitation, lien, precision, nb_enfants, hebergement, assistance, nom, prenom, periodes [liste, ou "tous"] }
     ?action=admin-qualifier-groupe POST  le même champ sur plusieurs lignes cochées : ids, champs { invitation | lien | precision | nb_enfants | hebergement | assistance | periodes }
     ?action=admin-anomalie  POST  trancher une ou plusieurs anomalies : ids, decision
     ?action=admin-contact   POST  désactiver ou réactiver des lignes : ids, desactive, motif
     ?action=admin-cote      POST  changer le côté de lignes : ids, cote
     ?action=admin-nommer    POST  nommer une fiche sans nom : id, nom
     ?action=admin-numero    POST  appliquer un numéro à une ligne : id, numero
     ?action=admin-lot       POST  corriger la source d'un lot : id, source, cote, proche
     ?action=admin-relever   POST  relever la boîte du mariage maintenant
     ?action=admin-vider     POST  remise à zéro de la liste (administrateur, confirmation = code du mariage)
     ?action=admin-export-liste POST la liste propre en classeur (base64)
     ?action=admin-sharepoint POST réécrire l'onglet Base invités du classeur Pilotage
     ?action=admin-etape     POST  terminer une étape : n (2 exige une liste sans rouge ni orange) ; ouvrir : true ouvre l'étape n sans terminer la précédente
     ?action=admin-demander  POST  ce qui manque sera demandé à l'invité : ids, retirer
     ?action=admin-attente   POST  liste d'attente : ids, op entrer | monter | descendre | retirer
     ?action=admin-utilisateurs POST  l'équipe : les accès nommés (administrateur seulement)
     ?action=admin-utilisateur  POST  créer ou modifier un accès : nom, role, password, desactive (administrateur seulement)
     ?action=admin-espace    POST  le lien de l'espace mariés : op lire | creer | renouveler | couper | modifiable (valeur) (w=CODE)
   Côté mariés (lien personnel, clé j, sans compte) :
     ?action=espace-voir      POST  leur mariage, leur parcours, leur liste (champs du couple seulement), les règles d'or
     ?action=espace-qualifier POST  compléter une ligne : id, champs { cote, invitation, lien, precision, nb_enfants, hebergement, assistance, nom, prenom, periodes }
     ?action=espace-retirer   POST  retirer ou remettre un invité : id, retire
     ?action=espace-deposer   POST  envoyer d'autres contacts : fichiers [{ name, b64 }], cote
   ===================================================================== */
const crypto = require("crypto");
const store = require("../lib/store");
const graph = require("../lib/graph");
const engine = require("../lib/engine");
const WEDDINGS = require("../lib/weddings");

const VERSION = "1.5.1";
const liste = require("../lib/liste");
const utilisateurs = require("../lib/utilisateurs");
const mariages = require("../lib/mariage");
const checklist = require("../lib/checklist");
const espace = require("../lib/espace");
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
function makeToken(hours, who) {
  const exp = Date.now() + (hours || 12) * 3600 * 1000;
  const payload = Buffer.from(JSON.stringify({ exp, nom: who.nom, role: who.role })).toString("base64url");
  const sig = crypto.createHmac("sha256", SECRET()).update(payload).digest("base64url");
  return payload + "." + sig;
}
/* Lit le jeton : renvoie { nom, role } s'il est signé et encore valable, sinon null. */
function readToken(tok) {
  if (!tok || !process.env.ADMIN_PASSWORD) return null;
  const [payload, sig] = String(tok).split(".");
  if (!payload || !sig) return null;
  const want = crypto.createHmac("sha256", SECRET()).update(payload).digest("base64url");
  if (want.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(want), Buffer.from(sig))) return null;
  try { const t = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")); return t.exp > Date.now() ? { nom: t.nom || "administrateur", role: t.role || "administrateur" } : null; } catch (e) { return null; }
}
const INSTALLATION = { nom: "administrateur", role: "administrateur" };
/* Qui parle ? Le jeton de session, ou le mot de passe d'installation donné directement. */
function who(req, b) { return readToken(req.headers["x-admin-token"]) || (okPassword(req.headers["x-admin-password"] || b.password) ? INSTALLATION : null); }

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
      const boites = {};
      for (const m of await require("../lib/db").query("SELECT code FROM mariage WHERE NOT desactive AND boite_email IS NOT NULL AND statut <> 'Clos'")) { try { boites[m.code] = await liste.relever(m.code, "tâche planifiée", true, await mariages.reglages()); } catch (e) { boites[m.code] = { erreur: e.message }; } }
      return send(res, 200, { ok: true, out, boites });
    }

    /* ---------- connexion et vérifications : sans mariage ---------- */
    if (action === "admin-login") {
      if (!(await store.rateLimit(ip(req), 10))) return send(res, 429, { ok: false, error: "slow down" });
      const prenom = String(b.prenom || "").trim();
      let u = null;
      if (prenom) u = await utilisateurs.verify(prenom, b.password);
      else if (okPassword(b.password)) u = INSTALLATION;
      if (!u) return send(res, 401, { ok: false, error: "password" });
      await store.journal(null, "Connexion", u.nom + " · " + ip(req), null, null, u.nom);
      return send(res, 200, { ok: true, token: makeToken(12, u), nom: u.nom, role: u.role, version: VERSION, equipe: await utilisateurs.count(), theme: (await mariages.reglages(u.role)).theme_defaut });
    }
    /* Un souci signalé depuis la note de bas de page : gardé au journal maître avec l'écran, la version et l'appareil. */
    if (action === "admin-signaler") {
      const u = who(req, b); if (!u) return send(res, 401, { ok: false, error: "password" });
      const texte = String(b.texte || "").trim().slice(0, 2000);
      if (!texte) return send(res, 422, { ok: false, detail: "Une phrase suffit." });
      const ctx = { ecran: String(b.ecran || "").slice(0, 200), version: String(b.version || VERSION).slice(0, 20), appareil: String(b.appareil || "").slice(0, 300) };
      await store.journal(null, "Souci signalé", texte, null, ctx, u.nom);
      return send(res, 200, { ok: true });
    }
    if (action === "admin-check") {
      const u = who(req, b); if (!u) return send(res, 401, { ok: false, error: "password" });
      const out = { ok: true, version: VERSION, base: {}, sharepoint: {}, boite: {} };
      try {
        const v = await store.version();
        const n = (await require("../lib/db").query("SELECT (SELECT count(*) FROM mariage) AS mariages, (SELECT count(*) FROM foyer WHERE NOT desactive) AS foyers, (SELECT count(*) FROM reponse) AS reponses, (SELECT count(*) FROM excel_attente) AS attente"))[0];
        out.base = { ok: true, detail: `Postgres ${store.backend() === "neon" ? "Neon" : "local"} (${store.host()}), schéma version ${v.v}, ${n.mariages} mariage(s), ${n.foyers} foyer(s), ${n.reponses} réponse(s), ${n.attente} écriture(s) Excel en attente.` };
      } catch (e) { out.base = { ok: false, detail: e.message }; }
      const g = await graph.check();
      out.sharepoint = { ok: !!(g.site.ok && g.write.ok), detail: [g.site.detail, g.write.detail].filter(Boolean).join(" "), url: g.site.url };
      out.boite = { ok: !!g.mail.ok, detail: g.mail.detail };
      await store.journal(null, "Vérification de la connexion", `base ${out.base.ok ? "ok" : "ko"}, SharePoint ${out.sharepoint.ok ? "ok" : "ko"}, boîte ${out.boite.ok ? "ok" : "ko"}`, null, null, u.nom);
      return send(res, 200, out);
    }
    if (action === "admin-mariages") {
      const u = who(req, b); if (!u) return send(res, 401, { ok: false, error: "password" });
      for (const id of Object.keys(WEDDINGS)) await store.ensureMariage(WEDDINGS[id]);
      return send(res, 200, { ok: true, mariages: await store.mariages() });
    }
    if (action === "admin-accueil") {
      const u = who(req, b); if (!u) return send(res, 401, { ok: false, error: "password" });
      for (const id of Object.keys(WEDDINGS)) await store.ensureMariage(WEDDINGS[id]);
      const acc = await mariages.accueil(); acc.reglages = await mariages.reglages(u.role);
      return send(res, 200, Object.assign({ ok: true, version: VERSION }, acc));
    }
    if (action === "admin-checklist") {
      const u = who(req, b); if (!u) return send(res, 401, { ok: false, error: "password" });
      return send(res, 200, { ok: true, sections: checklist.SECTIONS, etapes: checklist.ETAPES, remise: b.date_mariage ? checklist.dateRemiseProposee(b.date_mariage) : null, arret: b.date_mariage && b.delai_arret_jours ? checklist.dateArret(b.date_mariage, b.delai_arret_jours) : null });
    }
    if (action === "admin-declarer") {
      const u = who(req, b); if (!u) return send(res, 401, { ok: false, error: "password" });
      if (u.role !== "administrateur") return send(res, 403, { ok: false, error: "role", detail: "La fiche du mariage se modifie par un administrateur ; l'équipe la lit." });
      const r = await mariages.declarer(b.data || {}, u.nom, q.w || b.w || null);
      return send(res, r.ok ? 200 : 422, r);
    }
    if (action === "admin-reglages") {
      const u = who(req, b); if (!u) return send(res, 401, { ok: false, error: "password" });
      if (b.cle) {
        const cle = String(b.cle).slice(0, 60);
        if (u.role !== "administrateur") return send(res, 403, { ok: false, error: "role", detail: "Les réglages se modifient par un administrateur." });
        await mariages.saveReglage(cle, String(b.valeur || ""), u.nom);
      }
      return send(res, 200, Object.assign({ ok: true, moi: u }, await mariages.reglages(u.role)));
    }
    if (action === "admin-journal") {
      const u = who(req, b); if (!u) return send(res, 401, { ok: false, error: "password" });
      const m = q.w || b.w ? await store.mariage(q.w || b.w) : null;
      return send(res, 200, { ok: true, journal: await store.readJournal(m ? m.id : null, Math.min(Number(b.limit) || 200, 1000)), libelles: mariages.LIBELLES, mariage: m ? { code: m.code, prenoms: m.prenoms } : null });
    }
    if (action === "admin-utilisateurs" || action === "admin-utilisateur") {
      const u = who(req, b); if (!u) return send(res, 401, { ok: false, error: "password" });
      if (u.role !== "administrateur") return send(res, 403, { ok: false, error: "role", detail: "Réservé aux administrateurs." });
      if (action === "admin-utilisateur") { const r = await utilisateurs.save(b, u.nom); if (!r.ok) return send(res, 422, r); }
      return send(res, 200, { ok: true, utilisateurs: await utilisateurs.list(), roles: utilisateurs.ROLES, moi: u });
    }

    /* ---------- espace mariés : le couple entre par son lien personnel (clé j), sans compte ---------- */
    if (action.indexOf("espace-") === 0) {
      if (!(await store.rateLimit(ip(req), action === "espace-voir" ? 240 : 120))) return send(res, 429, { ok: false, error: "slow down", detail: "Un instant, puis réessayez." });
      const m = await espace.parJeton(b.j || q.j);
      if (!m) return send(res, 404, { ok: false, error: "lien", detail: "Ce lien n'est plus valable. Écrivez nous, nous vous en adressons un nouveau." });
      try {
        if (action === "espace-qualifier") await espace.qualifier(m, b.id, b.champs || {});
        else if (action === "espace-retirer") await espace.retirer(m, b.id, !!b.retire);
        else if (action === "espace-deposer") {
          const fichiers = (b.fichiers || []).slice(0, 10).map(f => ({ name: String(f.name || "contacts.vcf").slice(0, 120), buffer: Buffer.from(String(f.b64 || ""), "base64") })).filter(f => f.buffer.length);
          const recu = await espace.deposer(m, fichiers, b.cote, !!b.attente);
          return send(res, 200, Object.assign({ ok: true, recu }, await espace.voir(await store.mariageFresh(m.code))));
        }
        else if (action !== "espace-voir") return send(res, 400, { ok: false, error: "action" });
      } catch (e) { return send(res, 422, { ok: false, error: "espace", detail: e.message }); }
      return send(res, 200, Object.assign({ ok: true }, await espace.voir(await store.mariageFresh(m.code))));
    }

    const w = String(q.w || b.w || "").toUpperCase();
    if (action === "admin-espace") {
      const u = who(req, b); if (!u) return send(res, 401, { ok: false, error: "password" });
      const op = String(b.op || "lire");
      if (op !== "lire" && u.role !== "administrateur") return send(res, 403, { ok: false, error: "role", detail: "Le lien et le parcours de l'espace mariés se règlent par un administrateur." });
      try {
        if (op === "lire") { const f = await store.mariageFresh(w); if (!f) return send(res, 404, { ok: false, error: "wedding" }); return send(res, 200, { ok: true, espace: { jeton: f.espace_jeton || null, modifiable: f.espace_modifiable !== false, le: f.espace_le || null } }); }
        return send(res, 200, { ok: true, espace: await espace.gerer(w, op, b.valeur, u.nom) });
      } catch (e) { return send(res, 422, { ok: false, error: "espace", detail: e.message }); }
    }
    if (action === "admin-mariage" || action === "admin-boite") {
      const u = who(req, b); if (!u) return send(res, 401, { ok: false, error: "password" });
      const m = await mariages.fiche(w);
      if (!m) return send(res, 404, { ok: false, error: "wedding" });
      if (action === "admin-boite") {
        const r = await mariages.verifierBoite(w, m.boite_email, u.nom);
        return send(res, 200, { ok: true, boite: r, mariage: await mariages.fiche(w) });
      }
      let releve = null;
      if (m.boite_email && graph.enabled()) { try { releve = await liste.relever(w, u.nom, false, await mariages.reglages()); } catch (e) { releve = { detail: e.message }; } }
      return send(res, 200, { ok: true, mariage: releve && releve.releve ? await mariages.fiche(w) : m, formulaires: !!WEDDINGS[w], moi: u, releve });
    }
    if (["admin-liste", "admin-importer", "admin-qualifier", "admin-qualifier-groupe", "admin-demander", "admin-attente", "admin-anomalie", "admin-contact", "admin-cote", "admin-nommer", "admin-numero", "admin-lot", "admin-relever", "admin-vider", "admin-export-liste", "admin-archive", "admin-etape", "admin-sharepoint"].includes(action)) {
      const u = who(req, b); if (!u) return send(res, 401, { ok: false, error: "password" });
      const m = await store.mariage(w); if (!m) return send(res, 404, { ok: false, error: "wedding" });
      const refus = (e, k) => send(res, 422, { ok: false, error: k || "liste", detail: e.message });
      const ids = () => (Array.isArray(b.ids) ? b.ids : [b.id]).map(Number).filter(Boolean);
      if (action === "admin-importer") {
        const fichiers = (b.fichiers || []).map(f => ({ name: String(f.name || "contacts.vcf").slice(0, 120), buffer: Buffer.from(String(f.b64 || ""), "base64") })).filter(f => f.buffer.length);
        if (!fichiers.length) return send(res, 422, { ok: false, error: "fichiers", detail: "Aucun fichier reçu." });
        try { const accuse = await liste.importer(w, { source: b.source, cote: b.cote, proche: b.proche, origine: "dépôt", attente: !!b.attente }, fichiers, u.nom); return send(res, 200, Object.assign({ ok: true }, accuse)); }
        catch (e) { return refus(e, "import"); }
      }
      try {
        if (action === "admin-qualifier") await liste.qualifier(w, Number(b.id), b.champs || {}, u.nom);
        if (action === "admin-qualifier-groupe") await liste.qualifierGroupe(w, ids(), b.champs || {}, u.nom);
        if (action === "admin-demander") { const d = await liste.demander(w, ids(), !!b.retirer, u.nom); return send(res, 200, Object.assign({ ok: true, demande: d }, await liste.liste(w))); }
        if (action === "admin-attente") await liste.attente(w, ids(), String(b.op || ""), u.nom);
        if (action === "admin-anomalie") await liste.trancher(w, ids(), b.decision, u.nom);
        if (action === "admin-contact") await liste.desactiver(w, ids(), !!b.desactive, b.motif, u.nom);
        if (action === "admin-cote") await liste.changerCote(w, ids(), b.cote, u.nom);
        if (action === "admin-nommer") await liste.nommer(w, Number(b.id), b.nom, u.nom);
        if (action === "admin-numero") await liste.appliquerNumero(w, Number(b.id), b.numero, u.nom);
        if (action === "admin-lot") await liste.corrigerLot(w, Number(b.id), b, u.nom);
        if (action === "admin-vider") { if (u.role !== "administrateur") return send(res, 403, { ok: false, error: "role", detail: "Réservé aux administrateurs." }); if (String(b.confirmation || "").toUpperCase() !== m.code) return send(res, 422, { ok: false, error: "confirmation", detail: "Pour confirmer, saisir le code du mariage : " + m.code }); await liste.vider(w, u.nom); }
        if (action === "admin-sharepoint") { await liste.miroirBase(await store.mariageFresh(w)); }
      } catch (e) { return refus(e); }
      if (action === "admin-export-liste") { const x = await liste.exporter(w); await store.journal(m.id, "Collect exporté", x.nom, null, null, u.nom); return send(res, 200, { ok: true, nom: x.nom, b64: x.buffer.toString("base64") }); }
      if (action === "admin-archive") { if (u.role !== "administrateur") return send(res, 403, { ok: false, error: "role" }); return send(res, 200, { ok: true, archive: await liste.archive(w) }); }
      if (action === "admin-relever") { const r = await liste.relever(w, u.nom, true, await mariages.reglages()); return send(res, 200, Object.assign({ ok: true, releve: r }, await liste.liste(w))); }
      if (action === "admin-etape") {
        const n = Math.max(1, Math.min(7, Number(b.n) || 0)); if (!n) return send(res, 422, { ok: false, error: "etape" });
        const fresh = await store.mariageFresh(w); const etapes = Object.assign({}, fresh.etapes || {});
        if (b.ouvrir) {
          /* ouvrir une étape sans terminer la précédente : le premier contact commence pour les invités verts pendant que la liste se termine */
          if (n === 3) { const j = await liste.liste(w); if (!j.contacts.some(c => !c.desactive && c.etat === "complète")) return send(res, 422, { ok: false, error: "etape", detail: "Aucun invité vert pour l'instant : le premier contact s'ouvrira dès qu'une fiche sera complète." }); }
          const ouverte = Math.min(7, Math.max(fresh.etape || 1, n));
          await require("../lib/db").query("UPDATE mariage SET etape = $2, modifie_le = now() WHERE id = $1", [fresh.id, ouverte]);
          await store.journal(fresh.id, "Étape ouverte", n + ". " + (checklist.ETAPES[n - 1] || "") + " (la précédente reste ouverte)", { etape: fresh.etape }, { etape: ouverte }, u.nom);
          return send(res, 200, { ok: true, mariage: await mariages.fiche(w) });
        }
        if (n === 2) {
          const j = await liste.liste(w);
          const restent = j.contacts.filter(c => !c.desactive && c.etat !== "complète");
          if (!j.contacts.some(c => !c.desactive)) return send(res, 422, { ok: false, error: "etape", detail: "Aucune ligne dans la liste : l'étape ne peut pas être terminée." });
          if (restent.length) return send(res, 422, { ok: false, error: "etape", detail: `${restent.length} ligne(s) ne sont pas encore vertes (${restent.filter(c => c.etat === "à voir").length} à voir avec YID, ${restent.filter(c => c.etat === "à compléter").length} à compléter avec le couple).` });
        }
        etapes[n] = new Date().toISOString();
        const suivante = Math.min(7, Math.max(fresh.etape || 1, n + 1));
        await require("../lib/db").query("UPDATE mariage SET etapes = $2, etape = $3, modifie_le = now() WHERE id = $1", [fresh.id, etapes, suivante]);
        await store.journal(fresh.id, "Étape terminée", n + ". " + (checklist.ETAPES[n - 1] || ""), { etape: fresh.etape }, { etape: suivante }, u.nom);
        return send(res, 200, { ok: true, mariage: await mariages.fiche(w) });
      }
      return send(res, 200, Object.assign({ ok: true }, await liste.liste(w)));
    }
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
      const u = who(req, b); if (!u) return send(res, 401, { ok: false, error: "password" });

      if (action === "admin-import") {
        const list = householdsFromCSV(b.csv);
        const out = []; let created = 0;
        for (const h of list) {
          const prev = (h.key && (await store.household(w, h.key))) || (await store.householdByName(w, h.name));
          h.key = prev ? prev.key : (h.key || newKey());
          const r = await store.saveHousehold(w, h, u.nom);
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
