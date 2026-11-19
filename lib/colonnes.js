/* =====================================================================
   LES COLONNES DU MARIAGE (décision du 18 novembre 2026)
   Un socle fixe, déduit de la fiche, et des colonnes ajoutées librement,
   mariage par mariage, à tout moment. Ajouter une colonne revient à
   passer la méthode YID : qui détient l'information, à quoi elle sert,
   pour quels foyers, pourquoi on la pose, quelles réponses, pour qui dans
   le foyer, ce qu'ouvre chaque réponse, aucune promesse non garantie.
   Si l'invité détient l'information et qu'elle sert, la colonne crée une
   question du formulaire, rédigée selon nos règles ; elle ne part aux
   invités qu'après avoir été vue dans l'aperçu (activée par l'équipe).
   Stockage : mariage.parametres.colonnes ; valeurs du couple dans
   contact_recu.qualification.colonnes ; réponses dans reponse.etat.extra.
   ===================================================================== */
const db = require("./db");
const store = require("./store");

const DETENTEURS = { maries: "Les mariés", equipe: "L'équipe Yes I Do", invite: "L'invité" };
const USAGES = ["Le traiteur", "La wedding planner", "L'équipe Yes I Do", "La décoratrice", "Le transporteur", "L'hébergement", "Les mariés"];
const POUR = { tous: "Tous les foyers", loges: "Les foyers logés", non_loges: "Les foyers non logés", enfants: "Les foyers avec enfants", accompagnes: "Les foyers accompagnés" };
const REPONSES = { ouinon: "Oui ou non", unique: "Un choix parmi une liste", multiple: "Plusieurs choix", texte: "Un texte libre", nombre: "Un nombre", heure: "Une heure" };
const PORTEES = { foyer: "Le foyer entier", personne: "Chaque personne" };
const ETAPES = { accomp: "Ceux qui vous accompagnent", moments: "La journée", voyage: "Votre venue", heberg: "Votre hébergement", table: "À table", fin1: "Pour conclure" };
const SOCLE = ["Langue", "Nom de l'accompagnant", "Accompagnants autorisés", "Présence"];
const propre = (s) => String(s == null ? "" : s).trim();
const INTERDITS = [/la personne qui partage votre vie/i, /d'ici le mariage, nous restons/i, /d'ores et déjà/i, /cela prend cinq minutes/i, /tels qu'ils doivent figurer/i, /\bQR\b/];
const ACCORDS = [/\b(prête|ravie|invitée|accompagnée|seule|certaine|présente)\b/i];

/* La méthode, en clair : la colonne crée une question seulement si l'invité détient l'information et qu'elle sert. */
function decision(c) {
  if (c.detenteur !== "invite") return { question: false, pourquoi: (c.detenteur === "maries" ? "Les mariés détiennent" : "L'équipe Yes I Do détient") + " l'information : la colonne se remplit au collect ou dans l'outil, sans question à l'invité." };
  if (!(c.usages || []).length) return { question: false, pourquoi: "Personne ne se sert de la réponse : pas de question (test 1 de la méthode)." };
  if (!c.promesse_ok) return { question: false, pourquoi: "La question laisserait entendre un service non garanti : à reformuler avant toute question (test 8)." };
  return { question: true, pourquoi: "L'invité détient l'information et la réponse sert " + c.usages.join(", ").toLowerCase() + " : la colonne crée une question, visible après validation de l'aperçu." };
}

/* Une première formulation, selon nos règles (vouvoiement, cadre, aucun accord au genre) ; l'équipe l'ajuste. */
function proposer(c) {
  const sujet = propre(c.sujet || c.nom).replace(/[?.]$/, "");
  const cadre = propre(c.cadre);
  const pers = c.portee === "personne";
  let q;
  if (c.reponses === "ouinon") q = pers ? `${sujet} : qui est concerné dans votre foyer ?` : `${sujet} ?`;
  else if (c.reponses === "texte") q = `${sujet} : pourriez-vous nous le préciser ?`;
  else if (c.reponses === "nombre") q = `${sujet} : combien ?`;
  else if (c.reponses === "heure") q = `${sujet} : à quelle heure ?`;
  else q = `${sujet} : quelle est votre préférence ?`;
  return { fr: q.charAt(0).toUpperCase() + q.slice(1), aide: cadre };
}

function controler(c) {
  const e = [];
  if (!propre(c.nom)) e.push("Nom de la colonne à renseigner.");
  if (!DETENTEURS[c.detenteur]) e.push("Qui détient l'information ?");
  if (c.detenteur === "invite") {
    if (!(c.usages || []).length) e.push("À qui sert la réponse ?");
    if (!POUR[c.pour] && !/^colonne:/.test(c.pour || "")) e.push("Pour quels foyers ?");
    if (!propre(c.cadre)) e.push("Pourquoi la pose-t-on ? La phrase de cadre, du type « Afin de… ».");
    if (!REPONSES[c.reponses]) e.push("Quelles réponses ?");
    if (["unique", "multiple"].includes(c.reponses) && (c.options || []).length < 2) e.push("Au moins deux choix.");
    if (!PORTEES[c.portee]) e.push("Pour qui dans le foyer ?");
    if (!ETAPES[c.etape]) e.push("À quelle étape du formulaire ?");
    const q = propre((c.question || {}).fr);
    if (q) { INTERDITS.forEach(r => { if (r.test(q)) e.push("Tournure écartée dans la question : « " + q.match(r)[0] + " »."); }); ACCORDS.forEach(r => { if (r.test(q)) e.push("Accord au genre dans la question : « " + q.match(r)[0] + " » (nous ne connaissons pas le genre de l'invité)."); }); }
  }
  return e;
}

function nettoyer(b, ancien) {
  const c = Object.assign({}, ancien || {});
  const L = (x) => (Array.isArray(x) ? x : String(x || "").split(";")).map(propre).filter(Boolean).slice(0, 12);
  ["nom", "sujet", "cadre", "pour", "reponses", "portee", "etape", "detenteur"].forEach(k => { if (b[k] !== undefined) c[k] = propre(b[k]).slice(0, 300); });
  if (b.usages !== undefined) c.usages = L(b.usages).filter(u => USAGES.includes(u));
  if (b.options !== undefined) c.options = L(b.options);
  ["inconnu", "precision", "facultatif", "promesse_ok", "collect"].forEach(k => { if (b[k] !== undefined) c[k] = !!b[k]; });
  if (b.question !== undefined) c.question = { fr: propre((b.question || {}).fr).slice(0, 300), en: propre((b.question || {}).en).slice(0, 300), pt: propre((b.question || {}).pt).slice(0, 300), aide: propre((b.question || {}).aide).slice(0, 300) };
  return c;
}

async function lister(code) {
  const m = await store.mariageFresh(code); if (!m) throw new Error("mariage inconnu");
  const L = ((m.parametres || {}).colonnes || []).map(c => Object.assign({}, c, { decision: decision(c) }));
  return { colonnes: L, socle: socle(m), referentiel: { detenteurs: DETENTEURS, usages: USAGES, pour: POUR, reponses: REPONSES, portees: PORTEES, etapes: ETAPES }, suggestions: await suggestions(m.id) };
}

/* Les colonnes du socle, déduites de la fiche : présentes au collect seulement quand la fiche les rend utiles. */
function socle(m) {
  const f = ((m.parametres || {}).formulaire) || {}, P = Array.isArray(f.programme) ? f.programme : [];
  const L = [];
  if ((f.langues || []).length > 1) L.push("Langue");
  L.push("Nom de l'accompagnant", "Accompagnants autorisés");
  if (P.some(x => x.acces === "Sur invitation")) L.push("Présence");
  return L;
}

/* Les colonnes déjà créées pour d'autres mariages : proposées, jamais imposées. */
async function suggestions(id) {
  const rows = await db.query("SELECT parametres->'colonnes' AS c FROM mariage WHERE id <> $1 AND parametres ? 'colonnes'", [id]).catch(() => []);
  const vus = {}; rows.forEach(r => (r.c || []).forEach(c => { if (c && c.nom && !vus[c.nom]) vus[c.nom] = { nom: c.nom, detenteur: c.detenteur, reponses: c.reponses, options: c.options || [], usages: c.usages || [], cadre: c.cadre || "", sujet: c.sujet || "" }; }));
  return Object.values(vus).slice(0, 30);
}

async function agir(code, op, b, u) {
  const m = await store.mariageFresh(code); if (!m) throw new Error("mariage inconnu");
  const p = Object.assign({}, m.parametres || {}), L = (p.colonnes || []).slice();
  const sauver = async (msg) => { p.colonnes = L; await db.query("UPDATE mariage SET parametres = $2, modifie_le = now() WHERE id = $1", [m.id, p]); if (msg) await store.journal(m.id, "Colonnes du mariage", msg, null, null, u.nom); };
  if (op === "proposer") { const c = nettoyer(b, {}); return { proposition: proposer(c), decision: decision(c), erreurs: controler(Object.assign({}, c, { question: c.question || proposer(c) })) }; }
  if (op === "ajouter") {
    const c = nettoyer(b, {}); if (!c.question || !c.question.fr) c.question = Object.assign({ en: "", pt: "" }, proposer(c));
    const e = controler(c); if (e.length) throw new Error(e.join(" "));
    if (L.some(x => x.nom.toLowerCase() === c.nom.toLowerCase())) throw new Error("Une colonne porte déjà ce nom.");
    c.id = "c" + Date.now().toString(36); c.active = false; c.collect = c.detenteur === "maries"; c.cree_le = new Date().toISOString(); c.par = u.nom;
    L.push(c); await sauver(`Colonne « ${c.nom} » ajoutée : ${decision(c).question ? "question à valider dans l'aperçu" : "sans question à l'invité"}`); return { id: c.id, decision: decision(c) };
  }
  const i = L.findIndex(x => x.id === String(b.id || "")); if (i < 0) throw new Error("colonne introuvable");
  if (op === "modifier") { const c = nettoyer(b, L[i]); const e = controler(c); if (e.length) throw new Error(e.join(" ")); c.active = c.active && decision(c).question; L[i] = c; await sauver(`Colonne « ${c.nom} » modifiée`); return {}; }
  if (op === "activer") { if (b.on && !decision(L[i]).question) throw new Error(decision(L[i]).pourquoi); if (b.on && !b.apercu_vu) throw new Error("Ouvrez d'abord l'aperçu du formulaire : la question n'est envoyée qu'après avoir été vue."); L[i].active = !!b.on; L[i].active_le = b.on ? new Date().toISOString() : null; await sauver(`Question « ${L[i].nom} » ${b.on ? "activée dans le formulaire" : "retirée du formulaire"}`); return {}; }
  if (op === "supprimer") { const n = L[i].nom; L.splice(i, 1); await sauver(`Colonne « ${n} » supprimée (les valeurs déjà saisies restent dans l'historique des fiches)`); return {}; }
  if (op === "valeur") {
    const c = (await db.query("SELECT id, qualification, nom_repertoire FROM contact_recu WHERE id = $1 AND mariage_id = $2", [Number(b.contact), m.id]))[0]; if (!c) throw new Error("fiche introuvable");
    const q = Object.assign({}, c.qualification || {}); q.colonnes = Object.assign({}, q.colonnes || {}); const v = propre(b.valeur).slice(0, 300);
    if (v) q.colonnes[L[i].id] = v; else delete q.colonnes[L[i].id];
    await db.query("UPDATE contact_recu SET qualification = $2, modifie_le = now() WHERE id = $1", [c.id, q]);
    await store.journal(m.id, "Ligne qualifiée", `${c.nom_repertoire} · ${L[i].nom} : ${v || "effacé"}`, null, null, u.nom); return {};
  }
  throw new Error("opération inconnue");
}

/* Ce que le moteur du formulaire reçoit : les questions actives seulement. */
function questions(m) {
  return (((m.parametres || {}).colonnes) || []).filter(c => c.active && decision(c).question).map(c => ({ id: c.id, nom: c.nom, q: { fr: c.question.fr, en: c.question.en || c.question.fr, pt: c.question.pt || c.question.fr }, aide: c.question.aide || c.cadre || "", reponses: c.reponses, options: c.options || [], inconnu: !!c.inconnu, precision: !!c.precision, facultatif: !!c.facultatif, portee: c.portee, pour: c.pour, etape: c.etape }));
}
/* Pour l'aperçu de l'équipe : la question d'une colonne, active ou non. */
function questionsApercu(m, id) {
  return (((m.parametres || {}).colonnes) || []).filter(c => decision(c).question && (c.active || c.id === id)).map(c => questions({ parametres: { colonnes: [Object.assign({}, c, { active: true })] } })[0]);
}

module.exports = { DETENTEURS, USAGES, POUR, REPONSES, PORTEES, ETAPES, SOCLE, decision, proposer, controler, lister, agir, questions, questionsApercu, socle };
