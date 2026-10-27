/* =====================================================================
   MICROSOFT 365 · Graph en mode application (sans utilisateur connecté)
   Variables : MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET,
               MS_SITE  = identifiant du site SharePoint (YIDYesIDo)
               ou MS_DRIVE = "/sites/{id}/drive" (ancienne forme, acceptée).
   L'application Entra « Yes I Do Espace mariés » porte les autorisations :
   Sites.Selected (lecture et écriture sur ce site), Mail.Send, Mail.Read.
   Sans ces variables, l'écriture Excel est ignorée : les réponses restent
   en base et la file d'attente les rejoue plus tard.
   ===================================================================== */
const T = process.env.MS_TENANT_ID, C = process.env.MS_CLIENT_ID, S = process.env.MS_CLIENT_SECRET;
const DRIVE = process.env.MS_DRIVE || (process.env.MS_SITE ? `/sites/${process.env.MS_SITE}/drive` : "");
const SITE = process.env.MS_SITE || (DRIVE.match(/^\/sites\/([^/]+)/) || [])[1] || "";
let cache = { token: null, exp: 0, roles: [] };

function enabled() { return !!(T && C && S && DRIVE); }

async function token() {
  if (cache.token && Date.now() < cache.exp - 60000) return cache.token;
  const body = new URLSearchParams({ client_id: C, client_secret: S, grant_type: "client_credentials", scope: "https://graph.microsoft.com/.default" });
  const r = await fetch(`https://login.microsoftonline.com/${T}/oauth2/v2.0/token`, { method: "POST", body });
  const j = await r.json();
  if (!j.access_token) throw new Error("Jeton Microsoft refusé : " + (j.error_description || j.error || r.status).toString().slice(0, 200));
  let roles = [];
  try { roles = JSON.parse(Buffer.from(j.access_token.split(".")[1], "base64url").toString("utf8")).roles || []; } catch (e) { roles = []; }
  cache = { token: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000, roles };
  return cache.token;
}
async function roles() { await token(); return cache.roles; }

async function call(method, path, body, contentType) {
  const t = await token();
  const r = await fetch("https://graph.microsoft.com/v1.0" + path, {
    method, headers: Object.assign({ Authorization: "Bearer " + t }, body !== undefined ? { "Content-Type": contentType || "application/json" } : {}),
    body: body === undefined ? undefined : (contentType ? body : JSON.stringify(body))
  });
  const txt = await r.text();
  let j = {}; try { j = txt ? JSON.parse(txt) : {}; } catch (e) { j = { raw: txt }; }
  if (!r.ok) { const err = new Error(`Graph ${r.status} ${method} ${path.split("?")[0]} : ${(j.error && j.error.message) || txt.slice(0, 200)}`); err.status = r.status; throw err; }
  return j;
}
function itemPath(path) { return path.split("/").map(encodeURIComponent).join("/"); }

/* ---------- Excel : ajouter des lignes à un tableau nommé ---------- */
async function addRows(workbookPath, table, rows) {
  if (!enabled()) return { skipped: true };
  if (!rows.length) return { ok: true };
  await call("POST", `${DRIVE}/root:/${itemPath(workbookPath)}:/workbook/tables/${encodeURIComponent(table)}/rows/add`, { values: rows });
  return { ok: true };
}

/* ---------- fichiers : dossiers et petits fichiers texte ---------- */
async function getItem(path) { return call("GET", `${DRIVE}/root:/${itemPath(path)}`); }
async function ensureFolder(path) {
  try { return await getItem(path); }
  catch (e) {
    if (e.status !== 404) throw e;
    const parts = path.split("/"); const name = parts.pop(); const parent = parts.join("/");
    const url = parent ? `${DRIVE}/root:/${itemPath(parent)}:/children` : `${DRIVE}/root/children`;
    return call("POST", url, { name, folder: {}, "@microsoft.graph.conflictBehavior": "fail" });
  }
}
async function putText(path, text) {
  return call("PUT", `${DRIVE}/root:/${itemPath(path)}:/content`, text, "text/plain; charset=utf-8");
}

/* ---------- vérification de la connexion : le site, l'écriture, la boîte ---------- */
async function check() {
  const out = { configured: enabled(), site: {}, write: {}, mail: {} };
  if (!enabled()) {
    out.site = { ok: false, detail: "Variables Microsoft absentes (MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET, MS_SITE)." };
    out.write = { ok: false, detail: "Non testée." }; out.mail = { ok: false, detail: "Non testée." };
    return out;
  }
  try {
    const rl = await roles();
    try {
      const s = SITE ? await call("GET", `/sites/${SITE}?$select=displayName,webUrl`) : {};
      const root = await call("GET", `${DRIVE}/root?$select=name,webUrl`);
      out.site = { ok: true, detail: `Site ${s.displayName || ""} lu, bibliothèque ${root.name || ""} accessible.`, url: s.webUrl || root.webUrl };
    } catch (e) { out.site = { ok: false, detail: e.message }; }
    try {
      const folder = "Listes d'invités";
      await ensureFolder(folder);
      const stamp = new Date().toISOString();
      await putText(folder + "/Vérification Yes I Do.txt", "Dernière vérification de l'application Yes I Do : " + stamp + "\r\nCe fichier est réécrit à chaque vérification, il ne contient aucune donnée.");
      out.write = { ok: true, detail: "Écriture vérifiée dans « " + folder + " » à " + stamp.replace("T", " ").slice(0, 19) + " UTC." };
    } catch (e) { out.write = { ok: false, detail: e.message + (e.status === 403 ? " L'autorisation Sites.Selected n'est accordée qu'en lecture sur ce site : il faut la passer en écriture." : "") }; }
    const send = rl.includes("Mail.Send"), read = rl.includes("Mail.Read") || rl.includes("Mail.ReadWrite");
    out.mail = { ok: send, roles: rl, detail: send ? ("Envoi d'emails autorisé (Mail.Send)" + (read ? ", lecture des boîtes autorisée (Mail.Read)." : ". Lecture des boîtes non encore autorisée : nécessaire à la phase Recevoir les contacts.")) : "Mail.Send absent du jeton : ajouter l'autorisation d'application Mail.Send et accorder le consentement administrateur." };
  } catch (e) {
    out.site = { ok: false, detail: e.message }; out.write = { ok: false, detail: "Non testée." }; out.mail = { ok: false, detail: "Non testée." };
  }
  return out;
}

module.exports = { enabled, addRows, getItem, ensureFolder, putText, call, roles, check, drive: () => DRIVE, site: () => SITE };
