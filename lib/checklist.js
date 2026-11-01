/* =====================================================================
   LA CHECKLIST DU CALL 1 · étape Cadrage
   Les mêmes champs et formats que l'outil d'import Excel de Cécilia :
   partie A, vérifications devis (repris du devis) ; partie B, découverte
   (posé au couple) ; partie C, propre à l'application.
   Chaque champ : clé, libellé, type, aide (« comment remplir »), et la
   question à poser telle qu'elle se dit au téléphone.
   ===================================================================== */
const PAYS = [["FR", "France"], ["BE", "Belgique"], ["LU", "Luxembourg"], ["CH", "Suisse"], ["GB", "Royaume Uni"], ["US", "États Unis"], ["NL", "Pays Bas"], ["DE", "Allemagne"], ["ES", "Espagne"], ["IT", "Italie"], ["PT", "Portugal"], ["MA", "Maroc"], ["CD", "République démocratique du Congo"], ["CG", "République du Congo"], ["CI", "Côte d'Ivoire"], ["SN", "Sénégal"], ["CM", "Cameroun"], ["AE", "Émirats arabes unis"], ["CA", "Canada"], ["AU", "Australie"]];
const ETAPES = ["Cadrage", "Contacts reçus", "Liste d'invités", "Premier contact et invitations", "Confirmations et suivi", "Séjour et logistique", "Plan de table et jour J", "Clôture"];

const SECTIONS = [
  { id: "A", titre: "A. Vérifications devis", aide: "Repris du devis signé, inscrit par Yes I Do avant l'appel.", champs: [
    { k: "pack", n: "A1", l: "Pack", t: "select", o: ["Élégance", "Signature"], req: true, q: "Quel pack figure au devis ?", h: "Le pack du devis." },
    { k: "prevu_contrat", n: "A2", l: "Nombre d'invités prévu au contrat", t: "int", req: true, min: 1, max: 2000, q: "Combien d'invités le contrat prévoit il ?", h: "Article 1 du devis, en personnes." },
    { k: "seuil", n: "A3", l: "Seuil avant supplément", t: "int", min: 1, max: 2000, q: "À partir de combien d'invités le supplément s'applique t il ?", h: "Article 2 du devis. Vide si le devis n'en prévoit pas." },
    { k: "date_mariage", n: "A4", l: "Date du mariage", t: "date", req: true, future: true, q: "Quelle est la date de la réception ?", h: "La date principale ; les autres jours se déclarent en A11." },
    { k: "delai_arret_jours", n: "A5", l: "Clôture de la liste, en jours avant le mariage", t: "int", req: true, min: 1, max: 365, q: "Le devis fixe la clôture de la liste à combien de jours avant le mariage ?", h: "Article 4 du devis, par exemple 45. La date de clôture se calcule." },
    { k: "conciergerie", n: "A6", l: "Conciergerie Pack Signature", t: "ouinon", req: true, q: "La conciergerie invités fait elle partie de la prestation ?", h: "Service invités via la plateforme (hôtels, transports aux prix YID). Ne crée aucune colonne." },
    { k: "hebergement", n: "A7", l: "Hébergement sur place géré par Yes I Do", t: "select", o: ["Non géré par Yes I Do", "Tous les invités", "Une partie des invités"], req: true, q: "Yes I Do gère t il l'hébergement sur place, pour tous les invités ou pour une partie ?", h: "Seul créateur de colonne dans la liste : tous = colonne obligatoire à choix de lieux ; une partie = colonne facultative Oui ou vide." },
    { k: "lieux_hebergement", n: "A8", l: "Lieux d'hébergement, mot pour mot", t: "liste", si: { k: "hebergement", ne: "Non géré par Yes I Do" }, q: "Quels sont les lieux d'hébergement, exactement comme ils doivent apparaître ?", h: "Séparés par des points virgules. « Par leurs propres moyens » s'ajoute seul." },
    { k: "volume_estime", n: "A9", l: "Volume d'invités estimé", t: "int", min: 1, max: 2000, q: "Combien d'invités pensez vous recevoir au total ?", h: "L'estimation du couple, indépendante du contrat." },
    { k: "multi_periodes", n: "A10", l: "Invitations sur plusieurs périodes", t: "ouinon", req: true, q: "Tous les invités sont ils conviés aux mêmes moments ?", h: "Oui si certains foyers ne viennent qu'à une partie des festivités." },
    { k: "periodes", n: "A11", l: "Libellés exacts des périodes", t: "liste", si: { k: "multi_periodes", eq: "Oui" }, q: "Comment nommer chaque période, mot pour mot ?", h: "Séparés par des points virgules, par exemple « Vendredi 26 juin au lundi 29 juin ; Dimanche 28 au lundi 29 »." },
    { k: "regie", n: "A12", l: "Régie jour J", t: "ouinon", req: true, q: "La présence de Yes I Do sur place le jour J est elle au devis ?", h: "N'a aucun effet sur la liste." }
  ] },
  { id: "B", titre: "B. Découverte", aide: "Posé au couple pendant l'appel, dans cet ordre.", champs: [
    { k: "prenoms", n: "B1", l: "Prénoms des mariés", t: "text", req: true, q: "Comment écrit on vos deux prénoms ?", h: "Tels qu'ils apparaîtront partout : « Alexander et Clarisse »." },
    { k: "lieu", n: "B2", l: "Lieu du mariage", t: "text", req: true, q: "Où se déroule la réception ?", h: "Nom du lieu et ville." },
    { k: "initiales", n: "B3", l: "Initiales du mariage", t: "text", req: true, pattern: "^[A-Za-z]{2,3}$", q: "", h: "Deux ou trois lettres, par exemple AC. Elles forment le code du mariage et les clés des foyers, elles ne changent plus." },
    { k: "pays", n: "B4", l: "Pays de résidence du couple", t: "select", o: PAYS.map(p => p[1]), req: true, q: "Dans quel pays vivez vous ?", h: "Sert à lire les numéros de téléphone sans indicatif." },
    { k: "regime_enfants", n: "B5", l: "Enfants", t: "select", o: ["Avec enfants", "Sans enfants", "Mixte"], req: true, q: "Les enfants sont ils invités ? Tous, aucun, ou selon les familles ? Nous parlons des enfants de moins de 13 ans, sans téléphone.", h: "Avec : la colonne Enfants est obligatoire. Sans : elle est neutralisée. Mixte : la consigne B6 s'affiche aux mariés." },
    { k: "consigne_enfants", n: "B6", l: "Consigne pour les enfants, si mixte", t: "text", si: { k: "regime_enfants", eq: "Mixte" }, q: "Quelle règle appliquer ?", h: "Une phrase, affichée sur la colonne Enfants de la liste." },
    { k: "proches", n: "B7", l: "Proches de rattachement", t: "liste", q: "Quels proches auront des invités rattachés à eux ? Prénom et lien, par exemple Kevin, frère de l'époux.", h: "Séparés par des points virgules : « Kevin (frère de l'époux) ; Tante Awa (tante de l'épouse) ». Alimente le menu Précision et le plan de table." },
    { k: "listes_attendues", n: "B8", l: "Proches qui transmettront leur propre liste", t: "liste", q: "Qui, parmi vos proches, vous enverra sa propre liste d'invités ?", h: "Séparés par des points virgules. Seuls ces proches peuvent transmettre une liste ; toute autre liste revient aux mariés." },
    { k: "quotas", n: "B9", l: "Quotas par proche, en personnes", t: "liste", si: { k: "listes_attendues", filled: true }, q: "Combien de personnes chacun peut il inviter ?", h: "« Tante Awa = 12 ; Kevin = 6 ». Un couple compte pour deux." },
    { k: "date_remise", n: "B10", l: "Date de remise de la liste", t: "date", req: true, future: true, q: "Nous vous proposons de nous remettre votre liste complète pour le … , cela vous convient il ?", h: "Proposée par le barème selon la date du mariage, confirmée à voix haute. Affichée en évidence aux mariés." },
    { k: "support", n: "B11", l: "Remplissage ensemble", t: "ouinon", req: true, q: "Disposez vous d'un ordinateur pour compléter la liste, ou préférez vous que nous la complétions ensemble ?", h: "Oui = un rendez vous pour remplir ensemble sera programmé. Jamais présenté comme un problème." },
    { k: "telephone_epoux", n: "B12", l: "Téléphone de l'époux", t: "select", o: ["iPhone", "Android"], req: true, q: "Quel téléphone utilisez vous ?", h: "Oriente la méthode d'export des contacts." },
    { k: "telephone_epouse", n: "B13", l: "Téléphone de l'épouse", t: "select", o: ["iPhone", "Android"], req: true, q: "Et vous ?", h: "Idem." }
  ] },
  { id: "C", titre: "C. Dans l'application", aide: "Propre à l'outil, inscrit par Yes I Do.", champs: [
    { k: "statut", n: "C1", l: "Statut du mariage", t: "select", o: ["Signé", "En préparation", "Prospect", "Test"], req: true, h: "Prospect = déclaration légère avant signature. Test = jamais d'envoi réel." },
    { k: "langue_defaut", n: "C2", l: "Langue par défaut des invités", t: "select", o: ["fr", "en", "nl"], req: true, h: "Chaque foyer peut en avoir une autre." },
    { k: "boite_email", n: "C3", l: "Boîte email du mariage", t: "text", h: "Boîte partagée créée dans l'administration Microsoft 365, par exemple alexander.clarisse@yidyesido.onmicrosoft.com. L'application la vérifie, elle ne la crée pas." },
    { k: "site", n: "C4", l: "Adresse de la plateforme invités", t: "text", h: "L'adresse Squarespace, sans barre finale. Peut rester vide jusqu'à l'étape 4." }
  ] }
];

const toDate = (s) => { const d = new Date(String(s || "") + "T12:00:00Z"); return isNaN(d) ? null : d; };
const iso = (d) => d.toISOString().slice(0, 10);
function addDays(d, n) { const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x; }
function addMonths(d, n) { const x = new Date(d); x.setUTCMonth(x.getUTCMonth() + n); return x; }

/* Barème de remise : selon le temps entre aujourd'hui (démarrage) et le mariage. */
function dateRemiseProposee(dateMariage, demarrage) {
  const m = toDate(dateMariage), d = demarrage ? toDate(demarrage) : new Date(); if (!m) return null;
  const mois = (m - d) / (30.44 * 86400000);
  const r = mois >= 9 ? addMonths(d, 3) : mois >= 6 ? addMonths(d, 2) : mois >= 3 ? addMonths(d, 1) : mois >= 1 ? addDays(d, 14) : addDays(d, 3);
  return iso(r);
}
function dateArret(dateMariage, delai) { const m = toDate(dateMariage); return m && delai ? iso(addDays(m, -Number(delai))) : null; }
function datePurge(dateMariage) { const m = toDate(dateMariage); return m ? iso(addDays(m, 30)) : null; }

const liste = (s) => String(s || "").split(";").map(x => x.trim()).filter(Boolean);
function visible(f, v) {
  if (!f.si) return true; const x = v[f.si.k];
  if (f.si.eq !== undefined) return x === f.si.eq;
  if (f.si.ne !== undefined) return x !== f.si.ne && x !== undefined && x !== "";
  if (f.si.filled) return !!(x && String(x).trim());
  return true;
}
/* Valide les réponses ; renvoie { data, errors } avec les listes découpées et les dates calculées. */
function validate(input) {
  const v = Object.assign({}, input || {}), errors = [], data = {};
  for (const s of SECTIONS) for (const f of s.champs) {
    let x = v[f.k]; if (x === undefined || x === null) x = "";
    x = typeof x === "string" ? x.trim() : x;
    if (!visible(f, v)) { data[f.k] = f.t === "liste" ? [] : ""; continue; }
    if (f.req && (x === "" || x === undefined)) { errors.push({ k: f.k, msg: f.l + " : à renseigner." }); continue; }
    if (x === "") { data[f.k] = f.t === "liste" ? [] : ""; continue; }
    if (f.t === "int") { const n = Number(x); if (!Number.isInteger(n) || (f.min !== undefined && n < f.min) || (f.max !== undefined && n > f.max)) { errors.push({ k: f.k, msg: f.l + " : nombre entier attendu" + (f.min !== undefined ? ` entre ${f.min} et ${f.max}` : "") + "." }); continue; } data[f.k] = n; }
    else if (f.t === "date") { const d = toDate(x); if (!d) { errors.push({ k: f.k, msg: f.l + " : date attendue (AAAA-MM-JJ)." }); continue; } data[f.k] = iso(d); }
    else if (f.t === "ouinon") { if (!["Oui", "Non"].includes(x)) { errors.push({ k: f.k, msg: f.l + " : Oui ou Non." }); continue; } data[f.k] = x; }
    else if (f.t === "select") { if (!f.o.includes(x)) { errors.push({ k: f.k, msg: f.l + " : choisir dans la liste." }); continue; } data[f.k] = x; }
    else if (f.t === "liste") data[f.k] = liste(x);
    else { if (f.pattern && !new RegExp(f.pattern).test(x)) { errors.push({ k: f.k, msg: f.l + " : format attendu " + f.h }); continue; } data[f.k] = String(x).slice(0, 500); }
  }
  if (data.initiales) data.initiales = data.initiales.toUpperCase();
  if (data.date_mariage && data.date_remise && data.date_remise >= data.date_mariage) errors.push({ k: "date_remise", msg: "La date de remise doit précéder le mariage." });
  if (data.date_mariage && data.delai_arret_jours) data.date_arret = dateArret(data.date_mariage, data.delai_arret_jours);
  if (data.date_mariage) data.purge_prevue = datePurge(data.date_mariage);
  if (data.quotas && data.quotas.length) {
    data.quotas_map = {}; for (const q of data.quotas) { const m = q.match(/^(.+?)\s*=\s*(\d+)\s*$/); if (!m) errors.push({ k: "quotas", msg: "Quota illisible : « " + q + " » (attendu « Prénom = nombre »)." }); else data.quotas_map[m[1].trim()] = Number(m[2]); }
  }
  return { data, errors };
}
/* La fiche call 1 : questions et réponses, dans l'ordre, pour le PDF et les miroirs. */
function fiche(data) {
  const fmt = (f, x) => Array.isArray(x) ? x.join(" ; ") : (x === "" || x === undefined || x === null) ? "" : String(x);
  return SECTIONS.map(s => ({ heading: s.titre, rows: s.champs.filter(f => visible(f, data) ).map(f => [f.n + ". " + f.l, fmt(f, data[f.k])]) }));
}
module.exports = { SECTIONS, PAYS, ETAPES, validate, visible, fiche, dateRemiseProposee, dateArret, datePurge };
