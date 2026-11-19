/* =====================================================================
   CLÉS D'ACCÈS · connexion par empreinte ou reconnaissance faciale
   L'appareil garde une clé privée, protégée par son empreinte, son
   visage ou son code ; le serveur ne garde que la clé publique. Aucune
   donnée biométrique ne quitte jamais l'appareil. Le mot de passe reste
   la clé de secours. Une clé se pose une fois connecté, par appareil.
   ===================================================================== */
const crypto = require("crypto");
const W = require("@simplewebauthn/server");
const db = require("./db");
const store = require("./store");

const NOM = "Yes I Do";
const SECRET = () => crypto.createHash("sha256").update("yid-cle|" + (process.env.ADMIN_PASSWORD || "")).digest();
/* le domaine de la clé : tout yidyesido.info (l'adresse peut changer de sous domaine sans perdre les clés), sinon l'hôte */
function contexte(req) {
  const hote = String(req.headers["x-forwarded-host"] || req.headers.host || "localhost").split(",")[0].trim(), nu = hote.split(":")[0];
  const local = /^(localhost|127\.0\.0\.1)$/.test(nu);
  return { rpID: /(^|\.)yidyesido\.info$/.test(nu) ? "yidyesido.info" : nu, origin: (local ? "http://" : "https://") + hote };
}
/* le défi voyage signé chez le client : pas d'état à garder côté serveur */
function sceller(o) { const p = Buffer.from(JSON.stringify(Object.assign({ exp: Date.now() + 5 * 60000 }, o))).toString("base64url"); return p + "." + crypto.createHmac("sha256", SECRET()).update(p).digest("base64url"); }
function ouvrir(t) {
  const [p, s] = String(t || "").split("."); if (!p || !s) return null;
  const w = crypto.createHmac("sha256", SECRET()).update(p).digest("base64url");
  if (w.length !== s.length || !crypto.timingSafeEqual(Buffer.from(w), Buffer.from(s))) return null;
  try { const o = JSON.parse(Buffer.from(p, "base64url").toString("utf8")); return o.exp > Date.now() ? o : null; } catch (e) { return null; }
}
async function utilisateur(nom) { return (await db.query("SELECT id, nom, role, desactive FROM utilisateur WHERE lower(nom) = lower($1)", [String(nom || "").trim()]))[0] || null; }
const cles = (uid) => db.query("SELECT id, cred_id, appareil, cree_le, derniere_le, transports FROM cle_acces WHERE utilisateur_id = $1 ORDER BY cree_le", [uid]);

/* ---------- poser une clé sur l'appareil (connecté, accès nommé) ---------- */
async function optionsCreer(req, moi) {
  const u = await utilisateur(moi.nom); if (!u || u.desactive) throw new Error("L'empreinte se pose sur un accès nommé : connectez vous avec votre prénom.");
  const { rpID } = contexte(req), deja = await cles(u.id);
  const options = await W.generateRegistrationOptions({ rpName: NOM, rpID, userName: u.nom, userDisplayName: u.nom, userID: new TextEncoder().encode("yid-" + u.id), attestationType: "none",
    excludeCredentials: deja.map(c => ({ id: c.cred_id })), authenticatorSelection: { authenticatorAttachment: "platform", residentKey: "preferred", userVerification: "required" } });
  return { options, defi: sceller({ c: options.challenge, u: u.id, t: "creer" }) };
}
async function creer(req, moi, b) {
  const d = ouvrir(b.defi), u = await utilisateur(moi.nom);
  if (!d || d.t !== "creer" || !u || d.u !== u.id) throw new Error("La demande a expiré : recommencez.");
  const { rpID, origin } = contexte(req);
  const v = await W.verifyRegistrationResponse({ response: b.reponse, expectedChallenge: d.c, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true });
  if (!v.verified || !v.registrationInfo) throw new Error("L'appareil n'a pas confirmé.");
  const c = v.registrationInfo.credential, appareil = String(b.appareil || "Cet appareil").slice(0, 80);
  await db.query("INSERT INTO cle_acces (utilisateur_id, cred_id, cle_publique, compteur, transports, appareil) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (cred_id) DO NOTHING", [u.id, c.id, Buffer.from(c.publicKey).toString("base64url"), c.counter || 0, ((b.reponse.response || {}).transports || []).join(","), appareil]);
  await store.journal(null, "Empreinte ou visage activé", u.nom + " · " + appareil, null, null, u.nom);
  return { cles: await liste(moi) };
}
async function liste(moi) { const u = await utilisateur(moi.nom); return u ? (await cles(u.id)).map(c => ({ id: c.id, cred: c.cred_id, appareil: c.appareil, cree_le: c.cree_le, derniere_le: c.derniere_le })) : []; }
async function retirer(moi, id) {
  const u = await utilisateur(moi.nom); if (!u) return;
  const r = await db.query("DELETE FROM cle_acces WHERE id = $1 AND utilisateur_id = $2 RETURNING appareil", [Number(id), u.id]);
  if (r.length) await store.journal(null, "Empreinte ou visage retiré", u.nom + " · " + (r[0].appareil || ""), null, null, u.nom);
}

/* ---------- entrer avec l'empreinte ou le visage ---------- */
async function optionsEntrer(req, prenom) {
  const { rpID } = contexte(req), u = prenom ? await utilisateur(prenom) : null, L = u && !u.desactive ? await cles(u.id) : [];
  const options = await W.generateAuthenticationOptions({ rpID, userVerification: "required", allowCredentials: L.map(c => ({ id: c.cred_id, transports: c.transports ? c.transports.split(",") : undefined })) });
  return { options, defi: sceller({ c: options.challenge, t: "entrer" }), connu: L.length > 0 };
}
async function entrer(req, b) {
  const d = ouvrir(b.defi); if (!d || d.t !== "entrer") throw new Error("La demande a expiré : recommencez.");
  const id = String((b.reponse || {}).id || "");
  const c = (await db.query("SELECT k.*, u.nom, u.role, u.desactive FROM cle_acces k JOIN utilisateur u ON u.id = k.utilisateur_id WHERE k.cred_id = $1", [id]))[0];
  if (!c || c.desactive) throw new Error("Cet appareil n'est pas reconnu. Entrez avec votre mot de passe.");
  const { rpID, origin } = contexte(req);
  const v = await W.verifyAuthenticationResponse({ response: b.reponse, expectedChallenge: d.c, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true,
    credential: { id: c.cred_id, publicKey: new Uint8Array(Buffer.from(c.cle_publique, "base64url")), counter: Number(c.compteur) || 0, transports: c.transports ? c.transports.split(",") : undefined } });
  if (!v.verified) throw new Error("L'appareil n'a pas confirmé.");
  await db.query("UPDATE cle_acces SET compteur = $2, derniere_le = now() WHERE id = $1", [c.id, v.authenticationInfo.newCounter || 0]);
  await db.query("UPDATE utilisateur SET derniere_connexion = now() WHERE id = $1", [c.utilisateur_id]);
  return { nom: c.nom, role: c.role, appareil: c.appareil };
}

module.exports = { optionsCreer, creer, liste, retirer, optionsEntrer, entrer, contexte };
