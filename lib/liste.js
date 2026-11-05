/* =====================================================================
   LISTE D'INVITÉS · étape 2 d'un mariage (étapes « Contacts reçus » et
   « Liste d'invités » fusionnées, décision Cécilia et Régis du 2 novembre).
   En haut, la réception : exports du couple et des proches, par dépôt ou par
   la boîte du mariage, collect v4 de l'ancien outil. En dessous, une seule
   liste : chaque ligne se qualifie (côté, invitation, lien, précision,
   enfants, hébergement, présence) et porte un état : à compléter, complète,
   à voir avec YID, désactivée. La machine lit, normalise, dédoublonne,
   détecte et annote ; une personne décide ; rien n'est supprimé ; tout est
   journalisé et reflété dans les classeurs SharePoint du mariage.
   Règles reprises de l'outil d'import de Cécilia (Ajouter v6.4) : libellés
   d'anomalie « l'état d'abord, l'action ensuite », plusieurs motifs par
   ligne avec le doublon en tête, +33 posé sur un numéro d'outre mer corrigé
   et annoté, pays déduit ou signalé, export des mariés prioritaire sur la
   liste d'un proche, fiche sans nom nommée, fiche avec seul un email gardée.
   ===================================================================== */
const db = require("./db");
const store = require("./store");
const graph = require("./graph");
const vcf = require("./vcf");
const tel = require("./telephone");
const pays = require("./pays");
const xlsx = require("./xlsx");
const xlsxread = require("./xlsxread");

const COTES = ["Épouse", "Époux"];
const INVITATIONS = ["Invitation pour deux", "Invitation unique", "Ne sait pas encore"];
const LIENS = ["Témoin", "Demoiselle ou Garçon d'honneur", "Père / Mère", "Frère / Sœur", "Grand-parent", "Oncle / Tante", "Cousin / Cousine", "Neveu / Nièce", "Famille élargie", "Ami(e) proche", "Ami(e)", "Invité(e) des parents", "Invité(e) d'un proche", "Collègue", "Autre"];
const PRECISION_OBLIGATOIRE = ["Invité(e) d'un proche", "Autre"];
/* Les motifs, l'état d'abord, l'action ensuite. [nom] est remplacé par le nom de l'autre ligne. L'ordre est la priorité : le doublon en tête. */
const MOTIFS = {
  "même numéro que": "Même numéro que [nom] : une seule personne ? Désactiver une des deux lignes",
  "doublon probable avec": "Doublon probable avec [nom] : une ou deux personnes ?",
  "présent dans les deux répertoires": "Présent dans les deux répertoires : côté à confirmer",
  "sans numéro": "Sans numéro : à compléter ou désactiver",
  "numéro dans le nom": "Sans numéro, mais un numéro figure dans le nom : à confirmer puis appliquer",
  "invalide": "Numéro invalide : à vérifier avec le couple",
  "pays incertain": "Pays incertain : à confirmer avec le couple",
  "format à vérifier": "Format à vérifier : indicatif incertain",
  "fixe probable": "Fixe probable : contact par appel ou SMS",
  "deux numéros sans marquage": "Deux numéros sans marquage : numéro principal à confirmer",
  "sans nom": "Fiche sans nom : à nommer",
  "repris du collect": "Repris du collect : [nom]"
};
const PRIORITE = Object.keys(MOTIFS);
const DOUBLONS = ["même numéro que", "doublon probable avec", "présent dans les deux répertoires"];
const famille = (type) => (DOUBLONS.includes(type) ? "doublon" : "numéro");
const normNom = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const safe = (s) => String(s || "").replace(/[\\/:*?"<>|#%]/g, " ").replace(/\s+/g, " ").trim();
const prenomDe = (s) => String(s || "").split("(")[0].trim();
const ouiNon = (v) => (v === true || /^oui$/i.test(String(v || "")) ? true : false);

async function mariageDe(code) { const m = await store.mariageFresh(code); if (!m) throw new Error("mariage inconnu : " + code); return m; }
function codePays(m) { const p = pays.parNom(m.pays) || pays.parCode(m.pays); return p ? p.code : "FR"; }

/* ---------- règles de qualification du mariage, lues du cadrage ---------- */
function regles(m) {
  const p = m.parametres || {}, c = p.checklist || {};
  const lieux = (p.lieux_hebergement || c.lieux_hebergement || []).slice();
  const regimeHeb = c.hebergement === "Tous les invités" ? "tous" : c.hebergement === "Une partie des invités" ? "partie" : "aucun";
  return {
    enfants: c.regime_enfants === "Sans enfants" ? "sans" : c.regime_enfants === "Mixte" ? "mixte" : "avec",
    consigne_enfants: c.consigne_enfants || "",
    hebergement: regimeHeb,
    lieux: regimeHeb === "tous" ? lieux.concat(["Par leurs propres moyens"]) : lieux,
    periodes: c.multi_periodes === "Oui" ? (p.periodes || c.periodes || []) : [],
    proches: [...new Set((p.listes_attendues || []).concat(p.proches || []).map(prenomDe).filter(Boolean))],
    precisions: (p.proches || []).slice(),
    quotas: p.quotas || {},
    prevu: m.prevu_contrat || null, seuil: m.seuil || null, volume_heberge: p.volume_estime_heberge || null,
    initiales: m.initiales || "XX", date_arret: m.date_arret || null
  };
}
/* Les moments où l'invité est présent : une liste (l'ancienne présence unique est lue comme une liste d'un seul moment). */
function presences(c) { const q = c.qualification || {}; return Array.isArray(q.periodes) ? q.periodes : q.periode ? [q.periode] : []; }
/* Ce qui manque à une ligne pour être complète. */
function manque(c, r) {
  const out = [];
  if (!c.cote) out.push("côté");
  if (!INVITATIONS.includes(c.invitation)) out.push("invitation");
  if (!LIENS.includes(c.lien)) out.push("lien");
  if (PRECISION_OBLIGATOIRE.includes(c.lien) && !String(c.precision || "").trim()) out.push("précision");
  if (r.enfants !== "sans" && !(Number.isInteger(c.nb_enfants) && c.nb_enfants >= 0)) out.push("enfants");
  if (r.hebergement === "tous" && !r.lieux.includes(c.hebergement)) out.push("hébergement");
  if (r.periodes.length && !presences(c).some(p => r.periodes.includes(p))) out.push("présence");
  return out;
}
function etatDe(c, r) {
  if (c.desactive) return "désactivée";
  if (c.motifs) return "à voir";
  return manque(c, r).length ? "à compléter" : "complète";
}

/* ---------- lecture ---------- */
async function contactsDe(mariageId, tous) {
  return db.query(`SELECT c.*, l.source AS lot_source, l.origine,
      l.numero AS lot_numero, l.libelle AS lot_libelle,
      (SELECT string_agg(a.type || CASE WHEN a.detail->>'autre' IS NOT NULL THEN ' ' || (a.detail->>'autre') ELSE '' END, ' ; ' ORDER BY a.id) FROM anomalie a WHERE a.contact_id = c.id AND a.etat = 'ouverte') AS motifs,
      (SELECT json_agg(json_build_object('id', a.id, 'type', a.type, 'autre', a.detail->>'autre', 'libelle', a.detail->>'libelle', 'propositions', a.detail->'propositions') ORDER BY a.id) FROM anomalie a WHERE a.contact_id = c.id AND a.etat = 'ouverte') AS anomalies
    FROM contact_recu c LEFT JOIN lot l ON l.id = c.lot_id WHERE c.mariage_id = $1 AND NOT c.archive ${tous ? "" : "AND NOT c.desactive"} ORDER BY c.id`, [mariageId]);
}
const RANG = { "à voir": 2, "désactivée": 4, "complète": 0, "à compléter": 0 };
function trier(list) {
  const cote = (c) => (c.cote === "Épouse" ? 0 : c.cote === "Époux" ? 1 : 2);
  return list.slice().sort((a, b) => RANG[a.etat] - RANG[b.etat] || cote(a) - cote(b) || normNom(a.nom_repertoire).localeCompare(normNom(b.nom_repertoire)));
}
function tuiles(contacts, r) {
  const actifs = contacts.filter(c => !c.desactive), propres = actifs.filter(c => c.etat !== "à voir");
  const parCote = (f) => ({ epouse: propres.filter(c => c.cote === "Épouse").reduce((n, c) => n + f(c), 0), epoux: propres.filter(c => c.cote === "Époux").reduce((n, c) => n + f(c), 0) });
  const attendus = (c) => (c.invitation === "Invitation pour deux" ? 2 : 1);
  const haute = (c) => (c.invitation === "Invitation pour deux" || c.invitation === "Ne sait pas encore" ? 2 : 1);
  const enfants = (c) => (Number.isInteger(c.nb_enfants) ? c.nb_enfants : 0);
  const loges = propres.filter(c => c.hebergement && c.hebergement !== "Par leurs propres moyens").reduce((n, c) => n + attendus(c), 0);
  const t = {
    recues: { n: propres.length, cotes: parCote(() => 1) },
    completees: { n: propres.filter(c => c.etat === "complète").length, sur: propres.length },
    attendus: { n: propres.reduce((n, c) => n + attendus(c), 0), cotes: parCote(attendus) },
    estimation_haute: { n: propres.reduce((n, c) => n + haute(c), 0), cotes: parCote(haute) },
    a_confirmer: { n: propres.filter(c => c.invitation === "Ne sait pas encore").length },
    desactives: { n: contacts.length - actifs.length },
    a_voir: { n: actifs.filter(c => c.etat === "à voir").length, couple: actifs.filter(c => c.etat === "à compléter").length },
    enfants: { n: propres.reduce((n, c) => n + enfants(c), 0), cotes: parCote(enfants) },
    prevu: { n: r.prevu, depassement: r.prevu ? Math.max(0, propres.reduce((n, c) => n + attendus(c), 0) - r.prevu) : 0 },
    loges: { n: loges, sur: r.volume_heberge, depassement: r.volume_heberge ? loges > r.volume_heberge : false },
    a_preciser: { n: actifs.filter(c => !c.cote).length }
  };
  t.convives = { n: t.attendus.n + t.enfants.n }; t.plafond = { n: t.estimation_haute.n + t.enfants.n };
  return t;
}
async function liste(code) {
  const m = await mariageDe(code), r = regles(m);
  const [brut, lots, anomalies] = await Promise.all([
    contactsDe(m.id, true),
    db.query("SELECT * FROM lot WHERE mariage_id = $1 AND NOT desactive ORDER BY id DESC", [m.id]),
    db.query("SELECT a.*, c.nom_repertoire AS nom, c.numero FROM anomalie a LEFT JOIN contact_recu c ON c.id = a.contact_id WHERE a.mariage_id = $1 AND a.contact_id IS NOT NULL AND a.etat = 'ouverte' ORDER BY a.id DESC", [m.id])
  ]);
  const contacts = brut.map(c => Object.assign(c, { etat: etatDe(c, r), manque: c.desactive ? [] : manque(c, r), anomalies: (c.anomalies || []).map(a => Object.assign(a, { famille: famille(a.type) })), famille: (c.anomalies || []).some(a => DOUBLONS.includes(a.type)) ? "doublon" : (c.anomalies || []).length ? "numéro" : null }));
  const quotas = (m.parametres && m.parametres.listes_attendues || []).map(pr => { const q = r.quotas[prenomDe(pr)] || r.quotas[pr] || null; const n = contacts.filter(c => !c.desactive && c.proche && normNom(c.proche) === normNom(prenomDe(pr))).reduce((s, c) => s + (c.invitation === "Invitation pour deux" ? 2 : 1), 0); return { proche: pr, quota: q, recus: n, depassement: q !== null && n > q }; });
  for (const l of lots) { const du = contacts.filter(c => c.lot_id === l.id && !c.desactive); l.repartition = { epouse: du.filter(c => c.cote === "Épouse").length, epoux: du.filter(c => c.cote === "Époux").length, sans: du.filter(c => !c.cote).length }; }
  const t = tuiles(contacts, r); t.doublons = { n: contacts.filter(c => !c.desactive && c.famille === "doublon").length }; t.numeros = { n: contacts.filter(c => !c.desactive && c.famille === "numéro").length };
  return { contacts: trier(contacts), lots, anomalies, tuiles: t, quotas, regles: r, cotes: COTES, invitations: INVITATIONS, liens: LIENS, motifs: MOTIFS, boite: (m.parametres || {}).boite || null, accuse: (m.parametres || {}).accuse !== "Non", etape2: !!((m.etapes || {})[2]) };
}

/* ---------- déduction du côté et du proche d'un lot ---------- */
function deduire(m, lot, cards) {
  const c = (m.parametres || {}).checklist || {}, r = regles(m);
  const adresse = String(lot.expediteur || "").toLowerCase().trim(), nomExp = String(lot.expediteur_nom || "").trim();
  if (lot.cote && COTES.includes(lot.cote)) return { cote: lot.cote, proche: lot.proche || null, deduction: "indiqué au dépôt" };
  if (adresse && c.email_epoux && adresse === String(c.email_epoux).toLowerCase().trim()) return { cote: "Époux", proche: null, deduction: "expéditeur : email de l'époux (C5)" };
  if (adresse && c.email_epouse && adresse === String(c.email_epouse).toLowerCase().trim()) return { cote: "Épouse", proche: null, deduction: "expéditeur : email de l'épouse (C6)" };
  /* l'objet de l'email ou le nom du fichier dit le côté (consigne donnée au couple quand une seule adresse envoie tout) */
  const texte = normNom((lot.objet || "") + " " + (lot.fichiers || []).join(" "));
  const ditEpouse = /\b(epouse|mariee|bride)\b/.test(texte), ditEpoux = /\b(epoux|marie|groom)\b/.test(texte);
  if (ditEpouse !== ditEpoux) return { cote: ditEpouse ? "Épouse" : "Époux", proche: null, deduction: "objet de l'email ou nom du fichier : « " + (lot.objet || (lot.fichiers || []).join(", ")).slice(0, 60) + " »" };
  const prochesNom = r.proches.find(p => nomExp && normNom(nomExp).includes(normNom(p)) || (adresse && normNom(adresse.split("@")[0]).includes(normNom(p))));
  if (prochesNom) {
    const entree = (c.proches || []).find(x => normNom(prenomDe(x)) === normNom(prochesNom)) || "";
    const cote = /épouse|mariée|de clarisse/i.test(entree) ? "Épouse" : /époux|marié|d'alexander/i.test(entree) ? "Époux" : null;
    return { cote, proche: prochesNom, deduction: `expéditeur reconnu comme proche déclaré : ${prochesNom}` + (cote ? ", côté lu dans son rôle" : ", côté à préciser") };
  }
  const versions = [...new Set(cards.map(k => String(k.version || "").slice(0, 3)))];
  const tel21 = versions.length === 1 && versions[0] === "2.1", tel30 = versions.length === 1 && (versions[0] === "3.0" || versions[0] === "4.0");
  if (c.telephone_epoux && c.telephone_epouse && c.telephone_epoux !== c.telephone_epouse && (tel21 || tel30)) {
    const android = tel21;
    const cote = (c.telephone_epoux === "Android") === android ? "Époux" : "Épouse";
    return { cote, proche: null, deduction: `fichier vCard ${versions[0]} (${android ? "Android" : "iPhone"}) et téléphones déclarés au cadrage (B12, B13)` };
  }
  return { cote: null, proche: lot.proche || null, deduction: adresse ? "expéditeur inconnu de la fiche du mariage et téléphones identiques : côté à préciser" : "côté non indiqué" };
}

/* ---------- lecture d'un collect v4 (ancien outil) ---------- */
function lireCollect(buffer) {
  const w = xlsxread.lire(buffer);
  const f = w.feuilles.find(x => x.nom === "Liste invités") || w.feuilles[0];
  if (!f) throw new Error("Classeur sans onglet Liste invités.");
  const rows = xlsxread.lignes(f);
  const hi = rows.findIndex(r => r.some(v => String(v || "").trim() === "Nom dans votre téléphone"));
  if (hi < 0) throw new Error("Collect non reconnu : en-tête « Nom dans votre téléphone » introuvable.");
  const head = rows[hi].map(v => normNom(v));
  const col = (...names) => head.findIndex(h => names.some(n => h === normNom(n) || h.startsWith(normNom(n))));
  const I = { nom: col("Nom dans votre téléphone"), tel: col("Téléphone"), cote: col("Côté"), inv: col("Invitation"), lien: col("Lien avec vous"), prec: col("Précision"), assist: col("Besoin d'assistance"), enf: col("Nombre d'enfants"), heb: col("Hébergement", "Logé"), nomf: col("Nom (facultatif)"), pren: col("Prénom (facultatif)"), des: col("Désactiver"), tel2: col("Deuxième numéro"), src: col("Source"), ctrl: col("Contrôle") };
  const out = [];
  for (let r = hi + 1; r < rows.length; r++) {
    const row = rows[r], g = (i) => (i >= 0 && row[i] !== null && row[i] !== undefined ? String(row[i]).trim() : "");
    if (!g(I.nom) && !g(I.tel)) continue;
    const ref = xlsxread.colName(I.tel + 1) + (r + 1);
    out.push({ nom: g(I.nom), telephones: [g(I.tel), g(I.tel2)].filter(Boolean).map((t, k) => ({ brut: t, pref: k === 0, type: "" })), version: "collect",
      collect: { cote: g(I.cote), invitation: g(I.inv), lien: g(I.lien), precision: g(I.prec), assistance: ouiNon(g(I.assist)), nb_enfants: g(I.enf) === "" ? null : Number(g(I.enf)), hebergement: g(I.heb), nom: g(I.nomf), prenom: g(I.pren), desactive: ouiNon(g(I.des)), source: g(I.src), controle: g(I.ctrl), note: f.notes[ref] || f.notes[xlsxread.colName(I.nom + 1) + (r + 1)] || "" } });
  }
  return out;
}

/* ---------- import d'un lot ---------- */
async function importer(code, lot, fichiers, operateur) {
  const m = await mariageDe(code), r = regles(m);
  const paysCode = codePays(m);
  const avertissements = [];
  let cards = [];
  for (const f of fichiers) cards = cards.concat(/\.xlsx$/i.test(f.name) ? lireCollect(f.buffer) : vcf.lire(f.buffer, f.name, lot.source));
  if (!cards.length) throw new Error("Aucun contact lisible dans " + fichiers.map(f => f.name).join(", ") + ".");
  const collect = cards.some(k => k.collect);
  const ded = collect ? { cote: null, proche: null, deduction: "collect v4 : côté et source lus ligne par ligne" } : deduire(m, Object.assign({}, lot, { fichiers: fichiers.map(f => f.name) }), cards);
  const source = String(lot.source || "").trim().slice(0, 80) || (collect ? "Collect v4" : lot.origine === "email" ? "Email de " + (lot.expediteur_nom || lot.expediteur || "inconnu") : "Export");
  const cote = ded.cote, proche = ded.proche ? String(ded.proche).slice(0, 60) : null;

  /* pare feu : une fiche sans nom, sans numéro et sans email n'entre pas ; elle est comptée et tracée */
  const vides = cards.filter(k => !String(k.nom || "").trim() && !k.telephones.length && !k.email && !k.collect).length;
  cards = cards.filter(k => String(k.nom || "").trim() || k.telephones.length || k.email || k.collect);
  if (!cards.length) throw new Error(`${vides} fiche(s) vide(s) et rien d'autre dans ${fichiers.map(f => f.name).join(", ")}.`);
  const existants = await contactsDe(m.id, false);
  const numero = Number((await db.query("SELECT coalesce(max(numero), 0) + 1 AS n FROM lot WHERE mariage_id = $1", [m.id]))[0].n);
  const qui = lot.expediteur_nom || (lot.expediteur ? String(lot.expediteur).split("@")[0] : null) || (collect ? "collect v4" : operateur);
  const libelle = `Lot ${numero} · ${collect ? "les deux côtés" : cote || (proche ? "liste de " + proche : qui)} · ${new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`;
  const lotId = (await db.query("INSERT INTO lot (mariage_id, source, cote, proche, fichier, origine, email_id, expediteur, operateur, deduction, numero, libelle, objet, vides, collect) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id", [m.id, source, cote, proche, fichiers.map(f => f.name).join(" ; ").slice(0, 300), lot.origine || "dépôt", lot.email_id || null, lot.expediteur || null, operateur, ded.deduction, numero, libelle, lot.objet || null, vides, collect]))[0].id;

  const batch = [], anomalies = [], mentions = [], reprises = [], enrichissements = [];
  let connus = 0;
  const addA = (ref, type, autre, numero, extra) => anomalies.push(Object.assign({ ref, type, autreRef: autre ? (autre.id ? { id: autre.id } : { batch: autre.batch }) : null, autreNom: autre ? (autre.nom_repertoire || autre.nom) : null, numero: numero || null }, extra || {}));
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i], q = card.collect || null;
    let nom = String(card.nom || "").trim().slice(0, 200);
    const propres = [];
    const lus = card.telephones.map(t => Object.assign(tel.normaliser(t.brut, paysCode), { pref: t.pref }));
    const valides = []; for (const t of lus) if (t.numero && !valides.some(v => v.numero === t.numero)) valides.push(t);
    const principal = valides.find(t => t.pref) || valides[0] || null;
    const numero2 = valides.find(t => t !== principal) || null;
    let statut = principal ? principal.statut : (lus.some(t => t.statut === "pays incertain") ? "pays incertain" : lus.length ? "invalide" : "sans numéro");
    const corrections = lus.filter(t => t.correction).map(t => ({ le: new Date().toISOString(), texte: t.correction, brut: t.brut, numero: t.numero }));
    const nomVide = !nom || nom === "(sans nom)";
    if (nomVide) nom = principal ? "(sans nom) " + principal.numero : "(sans nom)";
    const dansLeNom = !principal ? (String(card.nom || "").match(/(?:\+?\d[\d .-]{7,}\d)/) || [])[0] : null;
    if (statut === "sans numéro" && dansLeNom) propres.push(["numéro dans le nom", dansLeNom.trim(), { propositions: [tel.normaliser(dansLeNom, paysCode).numero].filter(Boolean) }]);
    else if (statut !== "ok") propres.push([statut, principal ? principal.numero : lus.map(t => t.brut).join(" ; "), statut === "pays incertain" ? { propositions: (lus.find(t => t.propositions) || {}).propositions || [] } : null]);
    if (nomVide) propres.push(["sans nom", principal ? principal.numero : "", null]);
    if (valides.length >= 2 && !valides.some(t => t.pref)) propres.push(["deux numéros sans marquage", valides.map(v => v.numero).join(" et "), null]);
    if (q && q.controle) propres.push(["repris du collect", q.controle, { autreNom: q.controle }]);
    const rowCote = q ? (COTES.includes(q.cote) ? q.cote : null) : cote;
    const rowSource = q && q.source ? q.source : source;
    const row = { batch: i, nom, nomn: normNom(nom), numero: principal ? principal.numero : null, numero_2: numero2 ? numero2.numero : null, brut: lus.map(t => t.brut).join(" ; ").slice(0, 200), statut: statut === "pays incertain" ? "pays incertain" : statut, numeros: lus, cote: rowCote, source: rowSource, proche, lien: q ? (LIENS.includes(q.lien) ? q.lien : null) : (proche ? "Invité(e) d'un proche" : null), precision: q ? (q.precision || null) : (proche || null), corrections, email: card.email || null,
      invitation: q && INVITATIONS.includes(q.invitation) ? q.invitation : null, assistance: q ? !!q.assistance : false, nb_enfants: q && Number.isInteger(q.nb_enfants) ? q.nb_enfants : null, hebergement: q && q.hebergement ? q.hebergement : null, nomf: q ? q.nom || null : null, prenom: q ? q.prenom || null : null, desactive: q ? !!q.desactive : false, note: q && q.note ? q.note : null };
    if (!principal && !nomVide && !lus.length && !row.email && !q) { avertissements.push(`Fiche « ${nom} » sans numéro ni email : ajoutée pour décision.`); }

    /* contre l'existant */
    const memeNumero = row.numero ? existants.find(e => e.numero === row.numero || (e.numero_2 && e.numero_2 === row.numero) || (row.numero_2 && e.numero === row.numero_2)) : null;
    const memeNomSansNumero = !row.numero ? existants.find(e => !e.numero && normNom(e.nom_repertoire) === row.nomn && row.nomn) : null;
    /* déjà connu : même numéro et même nom ; ou même numéro venu d'une liste de proche quand l'export des mariés arrive (le couple prime) ; ou même nom sans numéro des deux côtés */
    const connu = memeNumero && (normNom(memeNumero.nom_repertoire) === row.nomn || (!proche && memeNumero.proche)) ? memeNumero : memeNomSansNumero;
    if (connu) {
      connus++;
      const ms = Array.isArray(connu.mentions) ? connu.mentions : [];
      if (connu.source !== rowSource && !ms.some(x => x.texte === "aussi proposé par " + rowSource)) mentions.push({ id: connu.id, texte: "aussi proposé par " + rowSource });
      if (rowCote && connu.cote && connu.cote !== rowCote) {
        const deja = await db.query("SELECT 1 FROM anomalie WHERE contact_id = $1 AND type = 'présent dans les deux répertoires' AND etat = 'ouverte'", [connu.id]);
        if (!deja.length) addA({ id: connu.id }, "présent dans les deux répertoires", null, row.numero);
      }
      /* l'export des mariés prime sur la liste d'un proche : le nom, le lien et la précision deviennent ceux du couple, l'ancien nom tracé */
      if (!proche && connu.proche && normNom(connu.nom_repertoire) !== row.nomn) reprises.push({ id: connu.id, nom, ancien: connu.nom_repertoire, source: rowSource, cote: rowCote || connu.cote });
      /* une ligne connue reprise d'un collect : sa qualification complète ce qui est encore vide, sans écraser */
      if (q) enrichissements.push({ id: connu.id, row });
      continue;
    }
    for (const [type, numero, extra] of propres) addA({ batch: i }, type, extra && extra.autreNom ? { nom: extra.autreNom } : null, numero, extra && extra.propositions ? { propositions: extra.propositions } : null);
    if (memeNumero) { addA({ batch: i }, "même numéro que", memeNumero, row.numero); addA({ id: memeNumero.id }, "même numéro que", row, row.numero); }
    else {
      const homonyme = existants.find(e => normNom(e.nom_repertoire) === row.nomn && row.nomn && !nomVide);
      const quasi = row.numero ? existants.find(e => tel.quasiIdentiques(e.numero, row.numero)) : null;
      const d = homonyme || quasi;
      if (d) { addA({ batch: i }, "doublon probable avec", d, row.numero); addA({ id: d.id }, "doublon probable avec", row, d.numero); }
    }
    for (const b of batch) {
      if (row.numero && (b.numero === row.numero || (b.numero_2 && b.numero_2 === row.numero))) { addA({ batch: i }, "même numéro que", b, row.numero); addA({ batch: b.batch }, "même numéro que", row, row.numero); }
      else if ((row.nomn && b.nomn === row.nomn && !nomVide) || (row.numero && tel.quasiIdentiques(b.numero, row.numero))) { addA({ batch: i }, "doublon probable avec", b, row.numero); addA({ batch: b.batch }, "doublon probable avec", row, b.numero); }
    }
    batch.push(row);
  }

  /* écriture groupée */
  const ids = {};
  if (batch.length) {
    const res = await db.batch(batch.map(row => ["INSERT INTO contact_recu (mariage_id, lot_id, nom_repertoire, numeros, source, cote, fichier, brut, numero, numero_2, numero_brut, statut_numero, lien, precision, proche, corrections, email, invitation, assistance, nb_enfants, hebergement, nom, prenom, desactive, note, motif_desactivation) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26) RETURNING id",
      [m.id, lotId, row.nom, row.numeros.map(t => ({ brut: t.brut, numero: t.numero, statut: t.statut, pref: !!t.pref })), row.source, row.cote, fichiers[0] ? fichiers[0].name : null, { nom: row.nom, telephones: row.numeros.map(t => t.brut) }, row.numero, row.numero_2, row.brut, row.statut, row.lien, row.precision, row.proche, JSON.stringify(row.corrections), row.email, row.invitation, row.assistance, row.nb_enfants, row.hebergement, row.nomf, row.prenom, row.desactive, row.note, row.desactive ? "désactivé dans le collect d'origine" : null]]));
    batch.forEach((row, i) => { ids[row.batch] = res[i][0].id; row.id = res[i][0].id; });
  }
  const idDe = (ref) => (ref.id !== undefined ? ref.id : ids[ref.batch]);
  const ops = [], vus = new Set();
  for (const a of anomalies) {
    const cid = idDe(a.ref), autreId = a.autreRef ? idDe(a.autreRef) : null;
    const k = cid + "|" + a.type + "|" + (autreId || 0); if (vus.has(k)) continue; vus.add(k);
    ops.push(["INSERT INTO anomalie (mariage_id, contact_id, autre_contact_id, type, detail) SELECT $1,$2,$3,$4,$5 WHERE NOT EXISTS (SELECT 1 FROM anomalie WHERE contact_id = $2 AND type = $4 AND etat = 'ouverte' AND coalesce(autre_contact_id, 0) = coalesce($3, 0))", [m.id, cid, autreId, a.type, { autre: a.autreNom, numero: a.numero, lot: lotId, libelle: MOTIFS[a.type].replace("[nom]", a.autreNom || ""), propositions: a.propositions || null }]]);
  }
  for (const mt of mentions) ops.push(["UPDATE contact_recu SET mentions = mentions || $2::jsonb, modifie_le = now() WHERE id = $1", [mt.id, JSON.stringify([{ texte: mt.texte, lot: lotId, le: new Date().toISOString() }])]]);
  for (const rp of reprises) ops.push(["UPDATE contact_recu SET nom_repertoire = $2, source = $3, cote = coalesce($4, cote), proche = NULL, lien = NULL, precision = NULL, corrections = corrections || $5::jsonb, modifie_le = now() WHERE id = $1", [rp.id, rp.nom, rp.source, rp.cote, JSON.stringify([{ le: new Date().toISOString(), texte: `Nom repris de l'export des mariés (${rp.source}) ; nom donné par la liste d'un proche : « ${rp.ancien} ». Lien et précision à reprendre.` }])]]);
  for (const en of enrichissements) ops.push(["UPDATE contact_recu SET cote = coalesce(cote, $2), invitation = coalesce(invitation, $3), lien = coalesce(lien, $4), precision = coalesce(precision, $5), nb_enfants = coalesce(nb_enfants, $6), hebergement = coalesce(hebergement, $7), assistance = assistance OR $8, nom = coalesce(nom, $9), prenom = coalesce(prenom, $10), note = coalesce(note, $11), modifie_le = now() WHERE id = $1", [en.id, en.row.cote, en.row.invitation, en.row.lien, en.row.precision, en.row.nb_enfants, en.row.hebergement, !!en.row.assistance, en.row.nomf, en.row.prenom, en.row.note]]);
  if (ops.length) await db.batch(ops);
  await poserCles(m, r);

  /* quotas, proche non déclaré, clôture, côté */
  const p = Object.assign({}, m.parametres || {});
  let quota = null;
  if (proche) {
    const declares = (p.listes_attendues || []).map(prenomDe), ancres = (p.proches || []).map(prenomDe);
    if (!declares.some(x => normNom(x) === normNom(proche))) {
      avertissements.push(ancres.some(x => normNom(x) === normNom(proche)) ? `${proche} est un proche de rattachement (B7) mais n'était pas déclaré comme contributeur (B8) : ajouté à la liste des proches qui transmettent une liste.` : `${proche} n'était pas déclaré dans la fiche du mariage : ajouté à la liste des proches qui transmettent une liste. À confirmer avec le couple.`);
      p.listes_attendues = (p.listes_attendues || []).concat([proche]); if (p.checklist) p.checklist.listes_attendues = p.listes_attendues;
      await db.query("UPDATE mariage SET parametres = $2, modifie_le = now() WHERE id = $1", [m.id, p]);
      await store.journal(m.id, "Proche contributeur ajouté", proche + " (à l'import de sa liste)", null, { listes_attendues: p.listes_attendues }, operateur);
    }
    const qk = Object.keys(r.quotas).find(k => normNom(k) === normNom(proche));
    const q = qk ? r.quotas[qk] : null;
    const n = Number((await db.query("SELECT count(*) AS n FROM contact_recu WHERE mariage_id = $1 AND NOT desactive AND lower(proche) = lower($2)", [m.id, proche]))[0].n);
    quota = { proche, quota: q, recus: n, depassement: q !== null && n > q };
    if (quota.depassement) avertissements.push(`Quota ${proche} : ${n} pour ${q} prévus, dépassement à arbitrer avec le couple.`);
  }
  const today = new Date().toISOString().slice(0, 10);
  if (m.date_arret && today > m.date_arret) avertissements.push(`La base est arrêtée depuis le ${m.date_arret} : ajout tardif, à valider.`);
  if (!cote && !collect) avertissements.push("Côté non déduit (" + ded.deduction + ") : à préciser dans les lots reçus.");
  if (vides) avertissements.push(`${vides} fiche(s) vide(s) (ni nom, ni numéro, ni email) ignorée(s).`);
  if (collect) avertissements.push(`Collect v4 lu : ${batch.length} ligne(s) reprise(s) avec leur qualification, ${enrichissements.length} ligne(s) déjà connue(s) complétée(s) par le collect, ${batch.filter(b => b.desactive).length} désactivée(s), ${batch.filter(b => b.note).length} note(s) conservée(s).`);
  const corrigees = batch.filter(b => b.corrections.length).length; if (corrigees) avertissements.push(`${corrigees} numéro(s) corrigé(s) par la machine (indicatif d'outre mer ou pays tapé sans +), chacun annoté sur sa ligne.`);

  const aVoir = Number((await db.query("SELECT count(DISTINCT contact_id) AS n FROM anomalie WHERE mariage_id = $1 AND etat = 'ouverte' AND contact_id IS NOT NULL", [m.id]))[0].n);
  const accuse = { lus: cards.length, ajoutes: batch.length, connus, a_voir: aVoir, quota, avertissements, lot: lotId, libelle, source, cote, proche, deduction: ded.deduction, vides };

  const sp = { archives: [], erreurs: [] };
  if (graph.enabled() && m.dossier) {
    const stamp = new Date().toISOString().slice(0, 10);
    fichiers.forEach((f, k) => { const ext = (f.name.match(/\.[A-Za-z0-9]+$/) || [".vcf"])[0]; sp.archives.push({ f, path: `${m.dossier}/Contacts/${safe(m.prenoms)} - ${safe(source)} - ${stamp}${fichiers.length > 1 ? " - " + (k + 1) : ""}${ext}` }); });
    for (const a of sp.archives) { try { await graph.putFile(a.path, a.f.buffer, "application/octet-stream"); } catch (e) { sp.erreurs.push("Archive : " + e.message); } }
    await miroirs(m, lotId, batch, source, cote).catch(e => sp.erreurs.push("Classeur : " + e.message));
    if (sp.archives.length) await db.query("UPDATE lot SET archive = $2 WHERE id = $1", [lotId, sp.archives.map(a => a.path).join(" ; ")]);
  }
  await db.query("UPDATE lot SET lus = $2, ajoutes = $3, connus = $4, a_voir = $5, detail = $6 WHERE id = $1", [lotId, accuse.lus, accuse.ajoutes, accuse.connus, aVoir, { avertissements, quota, sharepoint: sp }]);
  await store.journal(m.id, collect ? "Collect v4 repris" : "Contacts reçus", `${source}${cote ? " · " + cote : ""}${proche ? " · liste de " + proche : ""} · ${accuse.lus} lu(s), ${accuse.ajoutes} ajouté(s), ${connus} déjà connu(s), ${aVoir} à voir · ${ded.deduction}` + (avertissements.length ? " · " + avertissements.join(" ") : ""), null, null, operateur);
  return Object.assign(accuse, { sharepoint: sp });
}

/* ---------- la clé : posée quand une ligne devient complète, jamais réutilisée ---------- */
async function poserCles(m, r) {
  r = r || regles(m);
  const rows = await contactsDe(m.id, false);
  const sans = rows.filter(c => !c.cle && !c.motifs && !manque(c, r).length);
  if (!sans.length) return 0;
  let n = Number((await db.query("SELECT compteur_cle FROM mariage WHERE id = $1", [m.id]))[0].compteur_cle) || 0;
  const ops = [];
  for (const c of sans) { n++; ops.push(["UPDATE contact_recu SET cle = $2, complet_le = coalesce(complet_le, now()), modifie_le = now() WHERE id = $1", [c.id, (m.initiales || "XX").toUpperCase() + String(n).padStart(3, "0")]]); }
  ops.push(["UPDATE mariage SET compteur_cle = $2 WHERE id = $1", [m.id, n]]);
  await db.batch(ops);
  return sans.length;
}

/* ---------- qualification d'une ligne ---------- */
const CHAMPS = ["cote", "invitation", "lien", "precision", "nb_enfants", "hebergement", "assistance", "nom", "prenom", "periodes"];
async function qualifier(code, id, champs, operateur, groupe) {
  const m = await mariageDe(code), r = regles(m);
  const c = (await db.query("SELECT * FROM contact_recu WHERE id = $1 AND mariage_id = $2", [id, m.id]))[0];
  if (!c) throw new Error("ligne inconnue");
  const avant = {}, apres = {}, sets = [], vals = [id]; let k = 2;
  const q = Object.assign({}, c.qualification || {});
  for (const ch of CHAMPS) {
    if (champs[ch] === undefined) continue;
    let v = champs[ch];
    if (ch === "cote" && v && !COTES.includes(v)) throw new Error("côté inconnu");
    if (ch === "invitation" && v && !INVITATIONS.includes(v)) throw new Error("invitation inconnue");
    if (ch === "lien" && v && !LIENS.includes(v)) throw new Error("lien inconnu");
    if (ch === "nb_enfants") { v = v === "" || v === null ? null : Number(v); if (v !== null && (!Number.isInteger(v) || v < 0 || v > 7)) throw new Error("enfants : nombre entre 0 et 7"); }
    if (ch === "hebergement" && v && r.hebergement === "tous" && !r.lieux.includes(v)) throw new Error("hébergement : choisir dans la liste");
    if (ch === "assistance") v = ouiNon(v);
    if (ch === "periodes") {
      let l = Array.isArray(v) ? v : v ? [v] : [];
      if (l.includes("tous")) l = r.periodes.slice();
      l = [...new Set(l.map(String))];
      if (l.some(p => !r.periodes.includes(p))) throw new Error("présence : choisir dans la liste");
      q.periodes = r.periodes.filter(p => l.includes(p)); delete q.periode; continue;
    }
    if (typeof v === "string") v = v.trim().slice(0, 200) || null;
    if (String(c[ch] == null ? "" : c[ch]) === String(v == null ? "" : v)) continue;
    avant[ch] = c[ch]; apres[ch] = v; sets.push(`${ch} = $${k++}`); vals.push(v);
  }
  if (champs.periode !== undefined && champs.periodes === undefined) return qualifier(code, id, Object.assign({}, champs, { periodes: champs.periode ? [champs.periode] : [], periode: undefined }), operateur);
  if (champs.periodes !== undefined && presences(c).join("|") !== q.periodes.join("|")) { avant.presence = presences(c).join(" ; ") || null; apres.presence = q.periodes.join(" ; ") || null; sets.push(`qualification = $${k++}`); vals.push(q); }
  if (!sets.length) return { ok: true, rien: true };
  await db.query(`UPDATE contact_recu SET ${sets.join(", ")}, modifie_le = now() WHERE id = $1`, vals);
  await store.journal(m.id, groupe ? "Ligne qualifiée (action groupée)" : "Ligne qualifiée", `${c.nom_repertoire}${c.cle ? " · " + c.cle : ""} · ${Object.keys(apres).join(", ")}`, avant, apres, operateur);
  if (groupe) return { ok: true };
  const posees = await poserCles(m, r);
  return { ok: true, cles: posees };
}

/* Le même champ appliqué d'un coup à plusieurs lignes cochées (présence, invitation, lien, hébergement, enfants, assistance). */
const GROUPABLES = ["invitation", "lien", "precision", "nb_enfants", "hebergement", "assistance", "periodes"];
async function qualifierGroupe(code, ids, champs, operateur) {
  const propres = {}; for (const k of GROUPABLES) if (champs[k] !== undefined) propres[k] = champs[k];
  if (!Object.keys(propres).length) throw new Error("Choisir le champ à appliquer.");
  if (!ids.length) throw new Error("Cochez des lignes.");
  if (ids.length > 150) throw new Error("150 lignes au plus à la fois : appliquer en deux fois.");
  const m = await mariageDe(code);
  for (const id of ids) await qualifier(code, id, propres, operateur, true);
  const posees = await poserCles(m, regles(m));
  return { ok: true, n: ids.length, cles: posees };
}

/* ---------- décisions humaines, une ou plusieurs lignes à la fois ---------- */
async function trancher(code, ids, decision, operateur) {
  const m = await mariageDe(code);
  if (!String(decision || "").trim()) throw new Error("La décision doit être écrite : elle reste au journal.");
  const list = (await db.query("SELECT a.*, c.nom_repertoire AS nom FROM anomalie a LEFT JOIN contact_recu c ON c.id = a.contact_id WHERE a.mariage_id = $1 AND a.id = ANY($2::int[]) AND a.etat = 'ouverte'", [m.id, "{" + ids.map(Number).filter(Boolean).join(",") + "}"]));
  if (!list.length) throw new Error("aucune anomalie ouverte parmi les lignes cochées");
  const ops = list.map(a => ["UPDATE anomalie SET etat = 'tranchée', decision = $2, tranchee_par = $3, tranchee_le = now() WHERE id = $1", [a.id, String(decision).slice(0, 400), operateur]]);
  await db.batch(ops);
  for (const a of list) { await recalculerEtat(a.contact_id); await store.journal(m.id, "Anomalie tranchée", `${a.nom || ""} · ${(a.detail && a.detail.libelle) || a.type} · ${decision}`, { etat: "ouverte" }, { etat: "tranchée", decision: String(decision).slice(0, 400) }, operateur); }
  await poserCles(m);
  if (graph.enabled() && m.dossier) await miroirs(m, null, [], null, null).catch(() => {});
  return { ok: true, n: list.length };
}
async function recalculerEtat(contactId) {
  if (!contactId) return;
  const n = Number((await db.query("SELECT count(*) AS n FROM anomalie WHERE contact_id = $1 AND etat = 'ouverte'", [contactId]))[0].n);
  await db.query("UPDATE contact_recu SET etat = $2, modifie_le = now() WHERE id = $1", [contactId, n ? "anomalie" : "propre"]);
}
async function desactiver(code, ids, desactive, motif, operateur) {
  const m = await mariageDe(code);
  const list = await db.query("SELECT * FROM contact_recu WHERE mariage_id = $1 AND id = ANY($2::int[])", [m.id, "{" + ids.map(Number).filter(Boolean).join(",") + "}"]);
  if (!list.length) throw new Error("aucune ligne");
  if (desactive && !String(motif || "").trim()) throw new Error("Le motif de la désactivation doit être écrit.");
  await db.batch(list.map(c => ["UPDATE contact_recu SET desactive = $2, motif_desactivation = $3, modifie_le = now() WHERE id = $1", [c.id, !!desactive, desactive ? String(motif).slice(0, 300) : null]]));
  for (const c of list) await store.journal(m.id, desactive ? "Ligne désactivée" : "Ligne réactivée", `${c.nom_repertoire} (${c.numero || "sans numéro"})` + (motif ? " · " + motif : ""), { desactive: !!c.desactive }, { desactive: !!desactive }, operateur);
  return { ok: true, n: list.length };
}
async function changerCote(code, ids, cote, operateur) {
  const m = await mariageDe(code);
  if (!COTES.includes(cote)) throw new Error("côté inconnu");
  const list = await db.query("SELECT id, nom_repertoire, cote FROM contact_recu WHERE mariage_id = $1 AND id = ANY($2::int[])", [m.id, "{" + ids.map(Number).filter(Boolean).join(",") + "}"]);
  if (!list.length) throw new Error("aucune ligne");
  await db.batch(list.map(c => ["UPDATE contact_recu SET cote = $2, modifie_le = now() WHERE id = $1", [c.id, cote]]));
  await store.journal(m.id, "Côté changé", list.map(c => c.nom_repertoire).join(", ").slice(0, 300), { cote: [...new Set(list.map(c => c.cote))].join(", ") }, { cote }, operateur);
  await poserCles(m);
  return { ok: true, n: list.length };
}
async function nommer(code, id, nom, operateur) {
  const m = await mariageDe(code);
  const c = (await db.query("SELECT * FROM contact_recu WHERE id = $1 AND mariage_id = $2", [id, m.id]))[0];
  if (!c) throw new Error("ligne inconnue");
  nom = String(nom || "").trim().slice(0, 200); if (!nom) throw new Error("nom vide");
  await db.query("UPDATE contact_recu SET nom_repertoire = $2, corrections = corrections || $3::jsonb, modifie_le = now() WHERE id = $1", [id, nom, JSON.stringify([{ le: new Date().toISOString(), texte: `Nommée par ${operateur} ; nom de répertoire d'origine : « ${c.nom_repertoire} »` }])]);
  await db.query("UPDATE anomalie SET etat = 'tranchée', decision = $2, tranchee_par = $3, tranchee_le = now() WHERE contact_id = $1 AND type = 'sans nom' AND etat = 'ouverte'", [id, "Nommée : " + nom, operateur]);
  await recalculerEtat(id);
  await store.journal(m.id, "Fiche nommée", `${c.nom_repertoire} devient ${nom}`, { nom: c.nom_repertoire }, { nom }, operateur);
  return { ok: true };
}
async function appliquerNumero(code, id, numero, operateur) {
  const m = await mariageDe(code);
  const c = (await db.query("SELECT * FROM contact_recu WHERE id = $1 AND mariage_id = $2", [id, m.id]))[0];
  if (!c) throw new Error("ligne inconnue");
  const n = tel.normaliser(numero, codePays(m));
  if (!n.numero || n.statut === "invalide") throw new Error("numéro illisible");
  await db.query("UPDATE contact_recu SET numero = $2, numero_2 = CASE WHEN numero IS NOT NULL AND numero <> $2 THEN numero ELSE numero_2 END, statut_numero = $3, corrections = corrections || $4::jsonb, modifie_le = now() WHERE id = $1", [id, n.numero, n.statut, JSON.stringify([{ le: new Date().toISOString(), texte: `Numéro appliqué par ${operateur} : ${n.numero}${c.numero ? " ; ancien numéro rangé en deuxième numéro : " + c.numero : ""}` }])]);
  await db.query("UPDATE anomalie SET etat = 'tranchée', decision = $2, tranchee_par = $3, tranchee_le = now() WHERE contact_id = $1 AND type IN ('sans numéro', 'numéro dans le nom', 'invalide', 'pays incertain', 'format à vérifier', 'fixe probable', 'deux numéros sans marquage', 'repris du collect') AND etat = 'ouverte'", [id, "Numéro appliqué : " + n.numero, operateur]);
  await recalculerEtat(id);
  await store.journal(m.id, "Numéro appliqué", `${c.nom_repertoire} · ${n.numero}`, { numero: c.numero }, { numero: n.numero }, operateur);
  await poserCles(m);
  return { ok: true, numero: n.numero, statut: n.statut };
}
async function corrigerLot(code, lotId, input, operateur) {
  const m = await mariageDe(code);
  const l = (await db.query("SELECT * FROM lot WHERE id = $1 AND mariage_id = $2", [lotId, m.id]))[0];
  if (!l) throw new Error("lot inconnu");
  const source = input.source !== undefined ? String(input.source).trim().slice(0, 80) || l.source : l.source;
  const cote = input.cote !== undefined ? (COTES.includes(input.cote) ? input.cote : null) : l.cote;
  const proche = input.proche !== undefined ? (String(input.proche).trim().slice(0, 60) || null) : l.proche;
  if (l.collect && !cote && !proche) {
    /* lot collect : côté et source se lisent ligne par ligne ; seul le nom de la provenance du lot change, les lignes gardent les leurs */
    await db.query("UPDATE lot SET source = $2 WHERE id = $1", [lotId, source]);
    await store.journal(m.id, "Source corrigée", `lot ${l.numero || lotId} (collect)`, { source: l.source }, { source }, operateur);
    return { ok: true };
  }
  await db.query("UPDATE lot SET source = $2, cote = $3, proche = $4, deduction = 'corrigé par ' || $5, libelle = 'Lot ' || coalesce(numero, id) || ' · ' || coalesce($3, CASE WHEN $4::text IS NOT NULL THEN 'liste de ' || $4 ELSE 'côté à préciser' END) || ' · ' || to_char(recu_le, 'DD/MM') WHERE id = $1", [lotId, source, cote, proche, operateur]);
  await db.query("UPDATE contact_recu SET source = $2, cote = coalesce($3, cote), proche = $4, lien = CASE WHEN $4::text IS NOT NULL THEN 'Invité(e) d''un proche' WHEN lien = 'Invité(e) d''un proche' AND proche IS NOT NULL THEN NULL ELSE lien END, precision = CASE WHEN $4::text IS NOT NULL THEN $4 WHEN proche IS NOT NULL THEN NULL ELSE precision END, modifie_le = now() WHERE lot_id = $1", [lotId, source, cote, proche]);
  await store.journal(m.id, "Source corrigée", `lot ${lotId}`, { source: l.source, cote: l.cote, proche: l.proche }, { source, cote, proche }, operateur);
  await poserCles(m);
  return { ok: true };
}
/* Remise à zéro de la liste : tout est désactivé et journalisé, rien n'est supprimé ; l'historique reste. */
async function vider(code, operateur) {
  const m = await mariageDe(code);
  const n = Number((await db.query("SELECT count(*) AS n FROM contact_recu WHERE mariage_id = $1 AND NOT desactive", [m.id]))[0].n);
  await db.batch([
    ["UPDATE contact_recu SET archive = true, archive_le = now(), modifie_le = now() WHERE mariage_id = $1 AND NOT archive", [m.id]],
    ["UPDATE anomalie SET etat = 'tranchée', decision = 'liste remise à zéro', tranchee_par = $2, tranchee_le = now() WHERE mariage_id = $1 AND etat = 'ouverte'", [m.id, operateur]],
    ["UPDATE lot SET desactive = true WHERE mariage_id = $1", [m.id]],
    ["UPDATE mariage SET etapes = etapes - '2', etape = LEAST(etape, 2) WHERE id = $1", [m.id]]
  ]);
  const total = Number((await db.query("SELECT count(*) AS n FROM contact_recu WHERE mariage_id = $1 AND archive_le = (SELECT max(archive_le) FROM contact_recu WHERE mariage_id = $1)", [m.id]))[0].n);
  await store.journal(m.id, "Liste remise à zéro", `${total} ligne(s) archivée(s) (dont ${n} active(s)), lots et anomalies clos ; la liste repart vide, l'archive reste consultable par un administrateur`, { lignes_actives: n }, { lignes_actives: 0 }, operateur);
  await store.mariageFresh(code);
  return { ok: true, n };
}

/* ---------- la boîte du mariage ---------- */
function modeleAccuse(reg) { return reg && reg.accuse_modele ? reg.accuse_modele : ACCUSE_DEFAUT; }
const ACCUSE_DEFAUT = "Bonjour,\n\nVotre fichier de contacts nous est bien parvenu. {lus} fiches lues, {ajoutes} ajoutées à votre liste, {connus} déjà connues.\n\nNous préparons la suite et revenons vers vous très prochainement.\n\nBien à vous,\nL'équipe Yes I Do";
async function relever(code, operateur, force, reg) {
  const m = await mariageDe(code);
  const p = Object.assign({}, m.parametres || {});
  const out = { releve: false, lots: [], messages: 0, detail: "", reste: 0 };
  if (!m.boite_email) { out.detail = "Aucune boîte renseignée."; return out; }
  if (!graph.enabled()) { out.detail = "Microsoft non configuré."; return out; }
  const derniere = p.boite && p.boite.relevee_le ? Date.parse(p.boite.relevee_le) : 0;
  if (!force && Date.now() - derniere < 5 * 60 * 1000) { out.detail = "Relevée il y a moins de cinq minutes."; return out; }
  let messages;
  try { messages = await graph.mailboxMessages(m.boite_email); }
  catch (e) { out.detail = "Boîte non lue : " + e.message; p.boite = Object.assign({}, p.boite || {}, { ok: false, detail: out.detail, verifiee_le: new Date().toISOString() }); await db.query("UPDATE mariage SET parametres = $2 WHERE id = $1", [m.id, p]); return out; }
  out.releve = true; out.messages = messages.length;
  const PAQUET = 3; let traites = 0;
  for (const msg of messages) {
    if (traites >= PAQUET) { out.reste++; continue; }
    traites++;
    const deja = await db.query("SELECT 1 FROM lot WHERE mariage_id = $1 AND email_id = $2", [m.id, msg.id]);
    if (deja.length) { await graph.mailboxMarkRead(m.boite_email, msg.id).catch(() => {}); continue; }
    let pieces = [];
    try { pieces = await graph.mailboxAttachments(m.boite_email, msg.id); } catch (e) { out.detail += " Pièces jointes non lues : " + e.message; continue; }
    const estContacts = (a) => /\.(vcf|vcard|csv|xlsx)$/i.test(a.name || "") || /vcard|csv/i.test(a.contentType || "");
    const fichiers = pieces.filter(a => a.contentBytes && estContacts(a)).map(a => ({ name: /\.(vcf|vcard|csv|xlsx)$/i.test(a.name || "") ? a.name : (a.name || "contacts") + (/csv/i.test(a.contentType || "") ? ".csv" : ".vcf"), buffer: Buffer.from(a.contentBytes, "base64") }));
    const expNom = msg.from && msg.from.emailAddress ? (msg.from.emailAddress.name || "") : "", adresse = msg.from && msg.from.emailAddress ? msg.from.emailAddress.address : "";
    if (!fichiers.length) { out.detail += ` Message « ${msg.subject || "(sans objet)"} » de ${expNom || adresse} : ${pieces.length ? pieces.map(a => (a.name || "?") + (a.contentBytes ? "" : " (contenu non joint)")).join(", ") : "aucune pièce jointe"} ; attendu un .vcf, .csv ou .xlsx.`; continue; }
    try {
      const accuse = await importer(code, { source: "", cote: null, proche: null, origine: "email", email_id: msg.id, expediteur: adresse, expediteur_nom: expNom, objet: msg.subject || "" }, fichiers, "boîte " + m.boite_email);
      out.lots.push(accuse);
      await graph.mailboxMarkRead(m.boite_email, msg.id).catch(() => {});
      const actif = (p.accuse !== "Non") && (!reg || reg.accuse_actif !== "Non");
      if (m.statut !== "Test" && adresse && actif) {
        const texte = modeleAccuse(reg).replace(/\{prenoms\}/g, m.prenoms).replace(/\{fichiers\}/g, fichiers.map(f => f.name).join(", ")).replace(/\{lus\}/g, accuse.lus).replace(/\{ajoutes\}/g, accuse.ajoutes).replace(/\{connus\}/g, accuse.connus).replace(/\{a_voir\}/g, accuse.a_voir);
        try { await graph.mailboxReply(m.boite_email, msg.id, texte); await store.journal(m.id, "Accusé de réception envoyé", adresse + " · " + texte.slice(0, 200).replace(/\n+/g, " "), null, null, "boîte " + m.boite_email); } catch (e) { out.detail += " Accusé non envoyé : " + e.message; }
      } else if (adresse) await store.journal(m.id, "Accusé de réception non envoyé", adresse + (m.statut === "Test" ? " · mariage en statut Test" : " · envoi désactivé"), null, null, "boîte " + m.boite_email);
    } catch (e) { out.detail += ` ${fichiers.map(f => f.name).join(", ")} : ${e.message}.`; await store.journal(m.id, "Fichier reçu illisible", `${expNom || adresse} · ${fichiers.map(f => f.name).join(", ")} · ${e.message}`, null, null, "boîte " + m.boite_email); }
  }
  const fresh = await store.mariageFresh(code);
  const pp = Object.assign({}, fresh.parametres || {});
  pp.boite = Object.assign({}, pp.boite || {}, { ok: true, detail: `Boîte ${m.boite_email} lue, ${messages.length} message(s) non lu(s) avec pièce jointe.`, verifiee_le: new Date().toISOString(), relevee_le: new Date().toISOString() });
  await db.query("UPDATE mariage SET parametres = $2, boite_verifiee_le = now() WHERE id = $1", [m.id, pp]);
  await store.mariageFresh(code);
  if (out.lots.length) await store.journal(m.id, "Boîte relevée", `${out.lots.length} lot(s) importé(s) depuis la boîte`, null, null, operateur);
  return out;
}

/* ---------- export : la liste propre, en classeur ---------- */
function feuillesExport(m, j) {
  const r = j.regles;
  const headers = ["Clé", "Nom dans le téléphone", "Téléphone", "Deuxième numéro", "Côté", "Invitation", "Lien avec vous", "Précision", "Besoin d'assistance", "Nombre d'enfants"].concat(r.hebergement !== "aucun" ? ["Hébergement"] : []).concat(r.periodes.length ? ["Présence"] : []).concat(["Nom", "Prénom", "Source", "État", "Mentions", "Annotations"]);
  const ligne = (c) => [c.cle || "", c.nom_repertoire, c.numero || c.numero_brut || "", c.numero_2 || "", c.cote || "", c.invitation || "", c.lien || "", c.precision || "", c.assistance ? "Oui" : "", Number.isInteger(c.nb_enfants) ? c.nb_enfants : ""].concat(r.hebergement !== "aucun" ? [c.hebergement || ""] : []).concat(r.periodes.length ? [presences(c).length === r.periodes.length ? "Tous les moments" : presences(c).join(" ; ")] : []).concat([c.nom || "", c.prenom || "", c.source || "", c.etat + (c.motifs ? " : " + (c.anomalies || []).map(a => a.libelle || a.type).join(" ; ") : (c.manque && c.manque.length ? " : " + c.manque.join(", ") : "")), (c.mentions || []).map(x => x.texte).join(" ; "), (c.corrections || []).map(x => x.texte).concat(c.note ? [c.note] : []).concat(c.motif_desactivation ? [c.motif_desactivation] : []).join(" ; ")]);
  const propres = j.contacts.filter(c => !c.desactive && c.etat !== "à voir"), aVoir = j.contacts.filter(c => !c.desactive && c.etat === "à voir"), des = j.contacts.filter(c => c.desactive);
  return [
    { name: "Liste", table: "Liste", headers, rows: propres.map(ligne) },
    { name: "À voir avec YID", table: "AVoir", headers, rows: aVoir.map(ligne) },
    { name: "Désactivés", table: "Desactives", headers, rows: des.map(ligne) },
    { name: "Lots reçus", table: "Lots", headers: ["Reçu le", "Provenance", "Côté", "Proche", "Fichier", "Lus", "Ajoutés", "Déjà connus", "Origine", "Déduction"], rows: j.lots.map(l => [String(l.recu_le).replace("T", " ").slice(0, 16), l.source, l.cote || "à préciser", l.proche || "", l.fichier || "", l.lus, l.ajoutes, l.connus, l.origine, l.deduction || ""]) }
  ];
}
async function exporter(code) {
  const m = await mariageDe(code), j = await liste(code);
  return { nom: `Collect ${safe(m.prenoms)}.xlsx`, buffer: require("./collect").generer(m, j) };
}
/* l'archive d'une remise à zéro, pour un administrateur */
async function archive(code) {
  const m = await mariageDe(code);
  return db.query("SELECT id, nom_repertoire, numero, numero_2, cote, invitation, lien, precision, source, archive_le, desactive FROM contact_recu WHERE mariage_id = $1 AND archive ORDER BY archive_le DESC, id", [m.id]);
}

/* ---------- miroirs SharePoint : Reçus et Anomalies (classeur Contacts reçus), Base invités (classeur Pilotage) ---------- */
async function miroirs(m, lotId, batch, source, cote) {
  const classeur = `${m.dossier}/Contacts reçus ${safe(m.prenoms)}.xlsx`;
  const recu = new Date().toISOString().replace("T", " ").slice(0, 16);
  const rows = (batch || []).map(r => [recu, r.source || source, r.cote || cote || "à préciser", r.nom, r.numeros.map(t => t.numero || t.brut).join(" ; "), r.brut]);
  if (rows.length) { try { await graph.addRows(classeur, "Recus", rows); } catch (e) { await store.queueExcel(m.code, classeur, "Recus", rows, e.message); } }
  const an = await db.query("SELECT a.*, c.nom_repertoire AS nom FROM anomalie a LEFT JOIN contact_recu c ON c.id = a.contact_id WHERE a.mariage_id = $1 AND a.contact_id IS NOT NULL ORDER BY a.id", [m.id]);
  const arows = an.map(a => [String(a.detectee_le).replace("T", " ").slice(0, 16), (a.detail && a.detail.libelle) || a.type, a.nom || "", (a.detail && a.detail.numero) || "", a.etat, a.decision || "", a.tranchee_par || "", a.tranchee_le ? String(a.tranchee_le).replace("T", " ").slice(0, 16) : ""]);
  try { await graph.rewriteTable(classeur, "Anomalies", arows); } catch (e) { await store.queueExcel(m.code, classeur, "Anomalies", arows, e.message); }
  await miroirBase(m);
}
async function miroirBase(m) {
  const j = await liste(m.code);
  const pil = `${m.dossier}/Pilotage ${safe(m.prenoms)}.xlsx`;
  const rows = j.contacts.map(c => [c.cle || "", c.nom_repertoire, c.numero || c.numero_brut || "", c.cote || "", c.invitation || "", c.lien || "", c.precision || "", c.assistance ? "Oui" : "", Number.isInteger(c.nb_enfants) ? c.nb_enfants : "", c.nom || "", c.prenom || "", c.desactive ? "Oui" : "", c.numero_2 || "", c.source || "", c.etat, "", "", c.email || "", ""]);
  try { await graph.rewriteTable(pil, "BaseInvites", rows); } catch (e) { await store.queueExcel(m.code, pil, "BaseInvites", rows, e.message); }
}

module.exports = { PRECISION_OBLIGATOIRE, qualifierGroupe, presences, liste, importer, qualifier, trancher, desactiver, changerCote, nommer, appliquerNumero, corrigerLot, vider, relever, exporter, archive, feuillesExport, miroirBase, poserCles, regles, manque, lireCollect, deduire, MOTIFS, COTES, INVITATIONS, LIENS, ACCUSE_DEFAUT };
