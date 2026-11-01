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
/* MS_SITE accepte trois formes : l'identifiant complet « hote,guid,guid », l'adresse
   « yidyesido.sharepoint.com:/sites/YIDYesIDo », ou un identifiant seul (résolu au premier appel). */
const SITE_RAW = process.env.MS_SITE || (process.env.MS_DRIVE || "").replace(/^\/sites\//, "").replace(/\/drive.*$/, "");
let SITE = SITE_RAW.includes(",") ? SITE_RAW : "";
let DRIVE = SITE ? `/sites/${SITE}/drive` : "";
let cache = { token: null, exp: 0, roles: [] };

function enabled() { return !!(T && C && S && SITE_RAW); }

/* Résout l'identifiant complet du site quand MS_SITE est donné sous une autre forme. */
async function resolveSite() {
  if (SITE) return SITE;
  const t = await token();
  const tryGet = async (path) => { const r = await fetch("https://graph.microsoft.com/v1.0" + path + "?$select=id,displayName,webUrl", { headers: { Authorization: "Bearer " + t } }); const j = await r.json().catch(() => ({})); return r.ok ? j : null; };
  let s = SITE_RAW.includes(":") ? await tryGet("/sites/" + SITE_RAW) : null;
  if (!s && /^[0-9a-f-]{36}$/i.test(SITE_RAW)) {
    /* identifiant seul : on cherche le site dont la collection ou le web porte cet identifiant */
    const r = await fetch("https://graph.microsoft.com/v1.0/sites?search=*&$select=id,displayName,webUrl", { headers: { Authorization: "Bearer " + t } });
    const j = await r.json().catch(() => ({}));
    s = (j.value || []).find(x => String(x.id).toLowerCase().includes(SITE_RAW.toLowerCase())) || null;
  }
  if (!s) throw new Error("Site SharePoint introuvable pour MS_SITE = " + SITE_RAW + ". Attendu : « yidyesido.sharepoint.com:/sites/YIDYesIDo » ou l'identifiant complet avec virgules.");
  SITE = s.id; DRIVE = `/sites/${SITE}/drive`;
  return SITE;
}

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
  if (!SITE) await resolveSite();
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
  await resolveSite();
  await call("POST", `${DRIVE}/root:/${itemPath(workbookPath)}:/workbook/tables/${encodeURIComponent(table)}/rows/add`, { values: rows });
  return { ok: true };
}

/* ---------- fichiers : dossiers et petits fichiers texte ---------- */
async function getItem(path) { await resolveSite(); return call("GET", `${DRIVE}/root:/${itemPath(path)}`); }
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
  await resolveSite();
  return call("PUT", `${DRIVE}/root:/${itemPath(path)}:/content`, text, "text/plain; charset=utf-8");
}
/* Dépose un fichier binaire (moins de 4 Mo : classeur, PDF). Renvoie l'élément créé (id, webUrl). */
async function putFile(path, buffer, contentType) {
  await resolveSite();
  return call("PUT", `${DRIVE}/root:/${itemPath(path)}:/content`, buffer, contentType || "application/octet-stream");
}
/* Remplace toutes les lignes d'un tableau nommé par de nouvelles (onglet Paramètres, miroirs). */
async function rewriteTable(workbookPath, table, rows) {
  await resolveSite();
  const base = `${DRIVE}/root:/${itemPath(workbookPath)}:/workbook/tables/${encodeURIComponent(table)}`;
  const cur = await call("GET", `${base}/rows?$select=index`);
  const n = (cur.value || []).length;
  for (let i = 0; i < n; i++) await call("DELETE", `${base}/rows/itemAt(index=0)`);
  if (rows.length) await call("POST", `${base}/rows/add`, { values: rows });
  return { ok: true, replaced: n, added: rows.length };
}
/* La boîte du mariage existe t elle et l'application peut elle la lire ? */
async function mailboxCheck(address) {
  if (!enabled()) return { ok: false, detail: "Microsoft non configuré." };
  if (!address) return { ok: false, detail: "Aucune adresse renseignée." };
  try {
    const r = await call("GET", `/users/${encodeURIComponent(address)}/mailFolders/inbox?$select=id,totalItemCount`);
    return { ok: true, detail: `Boîte ${address} lue, ${r.totalItemCount || 0} message(s) dans la réception.` };
  } catch (e) {
    if (e.status === 404) return { ok: false, detail: `Boîte ${address} introuvable : la créer dans l'administration Microsoft 365 (boîte partagée), puis revérifier.` };
    if (e.status === 403 || e.status === 401) return { ok: false, detail: `Lecture refusée sur ${address} : l'autorisation Mail.Read manque ou n'est pas consentie.` };
    return { ok: false, detail: e.message };
  }
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
      await resolveSite();
      const s = await call("GET", `/sites/${SITE}?$select=displayName,webUrl`);
      const root = await call("GET", `${DRIVE}/root?$select=name,webUrl`);
      out.site = { ok: true, detail: `Site ${s.displayName || ""} lu, bibliothèque ${root.name || ""} accessible.`, url: s.webUrl || root.webUrl };
    } catch (e) { out.site = { ok: false, detail: e.message }; out.write = { ok: false, detail: "Non testée tant que le site n'est pas lu." }; }
    if (out.site.ok) try {
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

module.exports = { enabled, addRows, getItem, ensureFolder, putText, putFile, rewriteTable, mailboxCheck, call, roles, check, resolveSite, drive: () => DRIVE, site: () => SITE };
