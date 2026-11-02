/* =====================================================================
   ÉQUIPE · accès nommés
   Chaque personne de l'équipe a son prénom et son mot de passe : le
   journal enregistre ainsi qui a fait quoi. Le mot de passe d'installation
   (variable ADMIN_PASSWORD) reste la clé de secours, sous le nom
   « administrateur ». Les mots de passe sont stockés sous forme
   d'empreinte (scrypt), jamais en clair. On ne supprime pas un accès,
   on le désactive.
   ===================================================================== */
const crypto = require("crypto");
const db = require("./db");
const store = require("./store");

const ROLES = ["administrateur", "équipe"];

function hash(password) {
  const salt = crypto.randomBytes(16).toString("base64url");
  const h = crypto.scryptSync(String(password), salt, 32).toString("base64url");
  return "scrypt$" + salt + "$" + h;
}
function verifyHash(secret, password) {
  if (!secret || !password) return false;
  const [algo, salt, h] = String(secret).split("$");
  if (algo !== "scrypt" || !salt || !h) return false;
  const want = crypto.scryptSync(String(password), salt, 32).toString("base64url");
  return want.length === h.length && crypto.timingSafeEqual(Buffer.from(want), Buffer.from(h));
}
const clean = (s) => String(s || "").trim().replace(/\s+/g, " ").slice(0, 40);

async function list() {
  return db.query("SELECT id, nom, role, desactive, cree_le, derniere_connexion FROM utilisateur ORDER BY desactive, lower(nom)");
}
async function count() { return Number((await db.query("SELECT count(*) AS n FROM utilisateur WHERE NOT desactive AND secret IS NOT NULL"))[0].n); }
async function byName(nom) { return (await db.query("SELECT * FROM utilisateur WHERE lower(nom) = lower($1)", [clean(nom)]))[0] || null; }

/* Connexion : renvoie l'utilisateur si le prénom et le mot de passe correspondent. */
async function verify(nom, password) {
  const u = await byName(nom);
  if (!u || u.desactive || !verifyHash(u.secret, password)) return null;
  await db.query("UPDATE utilisateur SET derniere_connexion = now() WHERE id = $1", [u.id]);
  return { id: u.id, nom: u.nom, role: u.role };
}

/* Créer un accès, changer son mot de passe ou son rôle, le désactiver ou le réactiver. */
async function save(input, operateur) {
  const nom = clean(input.nom);
  if (nom.length < 2) return { ok: false, error: "Le prénom doit faire au moins deux lettres." };
  if (nom.toLowerCase() === "administrateur") return { ok: false, error: "Ce nom est réservé au mot de passe d'installation." };
  const role = ROLES.includes(input.role) ? input.role : "équipe";
  const existing = await byName(nom);
  const password = input.password ? String(input.password) : "";
  if (password && password.length < 8) return { ok: false, error: "Le mot de passe doit faire au moins huit caractères." };
  if (!existing) {
    if (!password) return { ok: false, error: "Un mot de passe est nécessaire pour créer un accès." };
    await db.query("INSERT INTO utilisateur (nom, role, secret) VALUES ($1,$2,$3)", [nom, role, hash(password)]);
    await store.journal(null, "Accès créé", nom + " · " + role, null, { nom, role }, operateur);
    return { ok: true, created: true };
  }
  const desactive = input.desactive === undefined ? existing.desactive : !!input.desactive;
  await db.query("UPDATE utilisateur SET role = $2, desactive = $3, secret = coalesce($4, secret), modifie_le = now() WHERE id = $1", [existing.id, role, desactive, password ? hash(password) : null]);
  const changes = {};
  if (existing.role !== role) changes.role = [existing.role, role];
  if (!!existing.desactive !== desactive) changes.actif = [!existing.desactive, !desactive];
  if (password) changes.mot_de_passe = ["(ancien)", "(nouveau)"];
  const avant = {}, apres = {}; Object.keys(changes).forEach(k => { avant[k] = changes[k][0]; apres[k] = changes[k][1]; });
  await store.journal(null, desactive && !existing.desactive ? "Accès désactivé" : "Accès modifié", nom, avant, apres, operateur);
  return { ok: true, created: false };
}

module.exports = { list, count, verify, save, ROLES };
