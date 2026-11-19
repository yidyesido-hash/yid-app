/* =====================================================================
   ÉTAPE 6 · PLAN DE TABLE ET JOUR J
   Le plan : des tables (nom, places), et chaque foyer présent placé à
   une table, avec le nombre de personnes qu'il compte. L'outil signale
   une table trop pleine et les foyers encore à placer, cercle par cercle.
   Le jour J : une liste d'accueil pour l'équipe, à la main sur un
   téléphone : chercher un nom, voir sa table, le marquer arrivé.
   État : mariage.parametres.plan ({ tables, placements, arrives }).
   ===================================================================== */
const db = require("./db");
const store = require("./store");
const liste = require("./liste");

const propre = (s) => String(s == null ? "" : s).trim();
const present = (c) => c.reponse_le && !/regret/.test((c.reponse || {}).presence || "");
const personnes = (c) => { const r = c.reponse || {}; if (Number.isInteger(r.personnes)) return r.personnes; return 1 + (r.accompagnant || (c.invitation === "Invitation pour deux" && r.vient_accompagne !== "Non, je viendrai seul(e)") ? 1 : 0) + (Array.isArray(r.enfants) ? r.enfants.length : (Number(c.nb_enfants) || 0)); };

function etat(m) { const p = m.parametres || {}, P = p.plan || {}; return { p, P: { tables: P.tables || [], placements: P.placements || {}, arrives: P.arrives || {}, accueil: P.accueil || { x: 50, y: 94 } } }; }
/* Ce que le QR code d'un pass contient : le lien personnel de l'invité (son téléphone l'ouvre), ou YID:jeton. */
const jetonDe = (txt) => { const s = String(txt || ""); const a = s.match(/[?&]yid=([a-z0-9]{12})/i) || s.match(/^YID:([a-z0-9]{12})$/i) || s.match(/^([a-z0-9]{12})$/i); return a ? a[1].toLowerCase() : null; };
async function sauver(m, p, P) { p.plan = P; await db.query("UPDATE mariage SET parametres = $2, modifie_le = now() WHERE id = $1", [m.id, p]); }

async function vue(code) {
  const m = await store.mariageFresh(code); if (!m) throw new Error("mariage inconnu");
  const { P } = etat(m), j = await liste.liste(code);
  /* les foyers à placer : ceux qui ont confirmé, et à défaut de réponses, les fiches complètes */
  const pres = j.contacts.filter(c => !c.desactive && present(c));
  const foyers = pres.map(c => ({ id: c.id, jeton: c.jeton || null, nom: c.nom_repertoire, numero: c.numero, lien: c.lien, hebergement: (c.reponse || {}).hebergement || c.hebergement || null, mot: (c.reponse || {}).mot || null, arrivee: (c.reponse || {}).arrivee || null, personnes: personnes(c), cercle: c.cercle, cote: c.cote, accompagnant: (c.reponse || {}).accompagnant || null, enfants: Array.isArray((c.reponse || {}).enfants) ? c.reponse.enfants.map(e => e.prenom).filter(Boolean) : [],
    table: P.placements[c.id] || null, arrive: P.arrives[c.id] || null }))
    .sort((a, b) => ((a.cercle || {}).rang || 9) - ((b.cercle || {}).rang || 9) || a.nom.localeCompare(b.nom, "fr"));
  P.tables.forEach((t, i) => { if (t.x == null || t.y == null) { t.x = 12 + (i % 5) * 19; t.y = 12 + Math.floor(i / 5) * 18; } });
  const tables = P.tables.map(t => { const ici = foyers.filter(f => f.table === t.id); const n = ici.reduce((s, f) => s + f.personnes, 0); return Object.assign({}, t, { occupees: n, trop: t.places && n > t.places, foyers: ici.map(f => f.id) }); });
  const places = foyers.filter(f => f.table && tables.some(t => t.id === f.table));
  const passMode = (((m.parametres || {}).formulaire || {}).pass) || null;
  return { pass: passMode, accueil: P.accueil, tables, foyers, a_placer: foyers.filter(f => !places.includes(f)).length, personnes: foyers.reduce((s, f) => s + f.personnes, 0),
    arrives: foyers.filter(f => f.arrive).reduce((s, f) => s + f.personnes, 0) };
}

async function agir(code, op, b, u) {
  const m = await store.mariageFresh(code); if (!m) throw new Error("mariage inconnu");
  const { p, P } = etat(m);
  if (op === "disposer") {
    const pos = b.positions || {}, clamp = (v) => Math.max(0, Math.min(100, Number(v) || 0));
    for (const t of P.tables) if (pos[t.id]) { t.x = clamp(pos[t.id].x); t.y = clamp(pos[t.id].y); }
    if (b.accueil) P.accueil = { x: clamp(b.accueil.x), y: clamp(b.accueil.y) };
    await sauver(m, p, P); await store.journal(m.id, "Plan de table", "Disposition de la salle enregistrée", null, null, u.nom); return;
  }
  if (op === "scan") {
    const jt = jetonDe(b.texte);
    const c = jt ? (await db.query("SELECT id, nom_repertoire, reponse, reponse_le, desactive FROM contact_recu WHERE jeton = $1 AND mariage_id = $2", [jt, m.id]))[0] : null;
    if (!c || c.desactive) return { scan: { statut: "inconnu" } };
    if (!present(c)) return { scan: { statut: "absent", id: c.id, nom: c.nom_repertoire } };
    if (P.arrives[c.id]) return { scan: { statut: "deja", id: c.id, nom: c.nom_repertoire, le: P.arrives[c.id].le, par: P.arrives[c.id].par } };
    P.arrives[c.id] = { le: new Date().toISOString(), par: u.nom, scan: true };
    await sauver(m, p, P); await store.journal(m.id, "Jour J", `${c.nom_repertoire} accueilli (pass scanné)`, null, null, u.nom);
    return { scan: { statut: "ok", id: c.id, nom: c.nom_repertoire } };
  }
  if (op === "tables") {
    if (!Array.isArray(b.tables)) throw new Error("tables attendues");
    const anc = {}; P.tables.forEach(t => { anc[t.id] = t; });
    P.tables = b.tables.slice(0, 120).map((t, i) => { const id = propre(t.id) || Date.now().toString(36) + i, a = anc[id] || {}; return { id, nom: propre(t.nom).slice(0, 60) || "Table " + (i + 1), places: Math.max(0, Math.min(40, Number(t.places) || 0)) || null, x: a.x != null ? a.x : 12 + (i % 5) * 19, y: a.y != null ? a.y : 12 + Math.floor(i / 5) * 18 }; });
    const ids = new Set(P.tables.map(t => t.id));
    for (const k of Object.keys(P.placements)) if (!ids.has(P.placements[k])) delete P.placements[k];
    await sauver(m, p, P); await store.journal(m.id, "Plan de table", `${P.tables.length} table(s) réglée(s)`, null, null, u.nom); return;
  }
  const id = Number(b.contact);
  const c = (await db.query("SELECT id, nom_repertoire FROM contact_recu WHERE id = $1 AND mariage_id = $2 AND NOT desactive", [id, m.id]))[0];
  if (!c) throw new Error("fiche introuvable");
  if (op === "placer") {
    const t = b.table ? P.tables.find(x => x.id === String(b.table)) : null;
    if (b.table && !t) throw new Error("table inconnue");
    if (t) P.placements[id] = t.id; else delete P.placements[id];
    await sauver(m, p, P); await store.journal(m.id, "Plan de table", `${c.nom_repertoire} : ${t ? t.nom : "retiré de sa table"}`, null, null, u.nom); return;
  }
  if (op === "arrive") {
    if (b.on) P.arrives[id] = { le: new Date().toISOString(), par: u.nom }; else delete P.arrives[id];
    await sauver(m, p, P); await store.journal(m.id, "Jour J", `${c.nom_repertoire} ${b.on ? "accueilli" : "arrivée annulée"}`, null, null, u.nom); return;
  }
  throw new Error("opération inconnue");
}

module.exports = { vue, agir, jetonDe, present };
