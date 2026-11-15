/* =====================================================================
   LE SITE DES INVITÉS · hors des étapes, au service du mariage
   Le site Squarespace du mariage est l'espace des invités : chacun y entre
   par son lien personnel, l'outil y pose la salutation, le formulaire, le
   pass et les maisons partenaires en accord. Ici : l'adresse du site, le
   script installé ou non (détecté à la première visite d'un invité), l'état
   de chaque page, et ce que les invités en font (liens ouverts, réponses).
   État : mariage.parametres.site ({ pages, detecte_le, origine }).
   ===================================================================== */
const db = require("./db");
const store = require("./store");
const partenaires = require("./partenaires");

const PAGES = [
  { k: "accueil", l: "Accueil", h: "Salutation personnelle, noms des mariés, bouton Confirmer votre présence." },
  { k: "programme", l: "Programme du week end", h: "Les moments auxquels chaque invité est convié." },
  { k: "hebergement", l: "Hébergement", h: "Ajoutez un bloc Code contenant <div data-yid=\"hebergement\"></div> : les maisons en accord et publiées s'y affichent seules." },
  { k: "transport", l: "Accès et transport", h: "Navettes, chauffeurs, parkings, gares et aéroports." },
  { k: "conciergerie", l: "Conciergerie", h: "Spas, tables, dégustations proposés pendant le séjour." },
  { k: "faq", l: "Questions fréquentes" },
  { k: "espace", l: "Votre espace", h: "La page où l'invité retrouve sa réponse et son pass." }
];
const ETATS = ["à faire", "en cours", "prête"];
const SCRIPT = '<script src="https://invites.yidyesido.info/yid-invite.js" defer></script>';
const hote = (u) => { try { return new URL(/^https?:/.test(u) ? u : "https://" + u).hostname.replace(/^www\./, ""); } catch (e) { return ""; } };

async function vue(code) {
  const m = await store.mariageFresh(code); if (!m) throw new Error("mariage inconnu");
  const S = (m.parametres || {}).site || {}, P = S.pages || {};
  const st = (await db.query(`SELECT count(*) FILTER (WHERE jeton IS NOT NULL)::int AS liens, count(*) FILTER (WHERE vu_le IS NOT NULL)::int AS ouverts,
      count(*) FILTER (WHERE reponse_le IS NOT NULL)::int AS reponses FROM contact_recu WHERE mariage_id = $1 AND NOT desactive`, [m.id]))[0];
  const maisons = await partenaires.publies(m.id);
  return { site: m.site || null, script: SCRIPT, detecte_le: S.detecte_le || null, origine: S.origine || null,
    pages: PAGES.map(p => Object.assign({}, p, { etat: (P[p.k] || {}).etat || "à faire", le: (P[p.k] || {}).le || null, par: (P[p.k] || {}).par || null })),
    etats: ETATS, stats: st, maisons };
}

async function agir(code, op, b, u) {
  const m = await store.mariageFresh(code); if (!m) throw new Error("mariage inconnu");
  const p = m.parametres || {}, S = p.site = p.site || {};
  if (op === "page") {
    const k = String(b.k || ""); if (!PAGES.some(x => x.k === k)) throw new Error("page inconnue"); if (!ETATS.includes(b.etat)) throw new Error("état inconnu");
    S.pages = S.pages || {}; S.pages[k] = { etat: b.etat, le: new Date().toISOString(), par: u.nom };
    await db.query("UPDATE mariage SET parametres = $2, modifie_le = now() WHERE id = $1", [m.id, p]);
    await store.journal(m.id, "Site des invités", PAGES.find(x => x.k === k).l + " : " + b.etat, null, null, u.nom); return;
  }
  if (op === "adresse") {
    const s = String(b.site || "").trim().replace(/\/+$/, ""); if (s && !/^https?:\/\/[^\s]+\.[^\s]+$/.test(s)) throw new Error("Adresse du site incomplète : elle commence par https://");
    await db.query("UPDATE mariage SET site = $2, modifie_le = now() WHERE id = $1", [m.id, s || null]);
    await store.journal(m.id, "Site des invités", "Adresse : " + (s || "retirée"), { site: m.site }, { site: s || null }, u.nom); return;
  }
  throw new Error("opération inconnue");
}

/* Appelé à chaque ouverture d'un lien personnel : la première ouverture est notée, et le script est réputé installé
   dès qu'une visite vient du domaine du site (au plus une écriture par jour). */
async function visite(c, m, origine) {
  if (!c.vu_le) await db.query("UPDATE contact_recu SET vu_le = now() WHERE id = $1 AND vu_le IS NULL", [c.id]);
  const h = hote(origine || ""); if (!h || !m.site) return;
  const S = (m.parametres || {}).site || {};
  if (S.detecte_le && Date.now() - new Date(S.detecte_le) < 864e5) return;
  if (h !== hote(m.site) && !/squarespace\.com$/.test(h)) return;
  const p = m.parametres || {}; p.site = Object.assign({}, S, { detecte_le: new Date().toISOString(), origine: h });
  await db.query("UPDATE mariage SET parametres = $2 WHERE id = $1", [m.id, p]);
}

module.exports = { vue, agir, visite, PAGES };
