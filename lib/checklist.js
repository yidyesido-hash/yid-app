/* =====================================================================
   LA CHECKLIST DU CALL 1 · étape Fiche du mariage
   Les mêmes champs et formats que l'outil d'import Excel de Cécilia :
   partie A, vérifications devis (repris du devis) ; partie B, découverte
   (posé au couple) ; partie C, propre à l'application.
   Chaque champ : clé, libellé, type, aide (« comment remplir »), et la
   question à poser telle qu'elle se dit au téléphone.
   ===================================================================== */
const PAYS = [["FR", "France"], ["BE", "Belgique"], ["LU", "Luxembourg"], ["CH", "Suisse"], ["GB", "Royaume Uni"], ["US", "États Unis"], ["NL", "Pays Bas"], ["DE", "Allemagne"], ["ES", "Espagne"], ["IT", "Italie"], ["PT", "Portugal"], ["MA", "Maroc"], ["CD", "République démocratique du Congo"], ["CG", "République du Congo"], ["CI", "Côte d'Ivoire"], ["SN", "Sénégal"], ["CM", "Cameroun"], ["AE", "Émirats arabes unis"], ["CA", "Canada"], ["AU", "Australie"]];
const ETAPES = ["Fiche du mariage", "Liste d'invités", "Premier contact et invitations", "Confirmations et suivi", "Séjour et logistique", "Plan de table et jour J", "Clôture"];

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
    { k: "regie", n: "A12", l: "Régie jour J", t: "ouinon", req: true, q: "La présence de Yes I Do sur place le jour J est elle au devis ?", h: "N'a aucun effet sur la liste." }
  ] },
  { id: "B", titre: "B. Découverte", aide: "Posé au couple pendant l'appel, dans cet ordre.", champs: [
    { k: "prenoms", n: "B1", l: "Prénoms des mariés", t: "text", req: true, q: "Comment écrit on vos deux prénoms ?", h: "Tels qu'ils apparaîtront partout : « Alexander et Clarisse »." },
    { k: "prenom_epoux", n: "B1a", l: "Prénom de l'époux", t: "text", h: "Sert à reconnaître ses envois (côté Époux)." },
    { k: "prenom_epouse", n: "B1b", l: "Prénom de l'épouse", t: "text", h: "Sert à reconnaître ses envois (côté Épouse)." },
    { k: "lieu", n: "B2", l: "Lieu du mariage", t: "text", req: true, q: "Où se déroule la réception ?", h: "Nom du lieu et ville." },
    { k: "initiales", n: "B3", l: "Initiales du mariage", t: "text", req: true, pattern: "^[A-Za-z]{2,3}$", q: "", h: "Deux ou trois lettres, par exemple AC. Elles forment le code du mariage et les clés des foyers, elles ne changent plus." },
    { k: "pays", n: "B4", l: "Pays de résidence du couple", t: "select", o: require("./pays").NOMS, req: true, q: "Dans quel pays vivez vous ?", h: "Sert à lire les numéros de téléphone sans indicatif." },
    { k: "regime_enfants", n: "B5", l: "Enfants", t: "select", o: ["Avec enfants", "Sans enfants", "Mixte"], req: true, q: "Les enfants sont ils invités ? Tous, aucun, ou selon les familles ? Nous parlons des enfants de moins de 13 ans, sans téléphone.", h: "Avec : la colonne Enfants est obligatoire. Sans : elle est neutralisée. Mixte : la consigne B6 s'affiche aux mariés." },
    { k: "consigne_enfants", n: "B6", l: "Consigne pour les enfants, si mixte", t: "text", si: { k: "regime_enfants", eq: "Mixte" }, q: "Quelle règle appliquer ?", h: "Une phrase, affichée sur la colonne Enfants de la liste." },
    { k: "proches", n: "B7", l: "Proches de rattachement", t: "liste", q: "Quels proches auront des invités rattachés à eux ? Prénom et lien, par exemple Kevin, frère de l'époux.", h: "Séparés par des points virgules : « Kevin (frère de l'époux) ; Tante Awa (tante de l'épouse) ». Alimente le menu Précision et le plan de table." },
    { k: "listes_attendues", n: "B8", l: "Proches qui transmettront leur propre liste", t: "liste", q: "Qui, parmi vos proches, vous enverra sa propre liste d'invités ?", h: "Séparés par des points virgules. Seuls ces proches peuvent transmettre une liste ; toute autre liste revient aux mariés." },
    { k: "quotas", n: "B9", l: "Quotas par proche, en personnes", t: "liste", si: { k: "listes_attendues", filled: true }, q: "Combien de personnes chacun peut il inviter ?", h: "« Tante Awa = 12 ; Kevin = 6 ». Un couple compte pour deux." },
    { k: "date_remise", n: "B10", l: "Date de remise de la liste", t: "date", req: true, future: true, q: "Nous vous proposons de nous remettre votre liste complète pour le … , cela vous convient il ?", h: "Proposée par le barème selon la date du mariage, confirmée à voix haute. Affichée en évidence aux mariés." },
    { k: "support", n: "B11", l: "Remplissage ensemble", t: "ouinon", req: true, q: "Disposez vous d'un ordinateur pour compléter la liste, ou préférez vous que nous la complétions ensemble ?", h: "Oui = un rendez vous pour remplir ensemble sera programmé. Jamais présenté comme un problème." },
    { k: "telephone_epoux", n: "B12", l: "Téléphone de l'époux", t: "select", o: ["iPhone", "Android"], req: true, q: "Quel téléphone utilisez vous ?", h: "Oriente la méthode d'export des contacts." },
    { k: "telephone_epouse", n: "B13", l: "Téléphone de l'épouse", t: "select", o: ["iPhone", "Android"], req: true, q: "Et vous ?", h: "Idem." },
    { k: "registre", n: "B14", l: "Formule d'appel des invités", t: "select", o: ["Par le prénom", "Civilité et nom"], q: "Comment souhaitez vous que nous nous adressions à vos invités : par leur prénom, ou plus formellement, Madame, Monsieur ?", h: "Par le prénom : « Chère Hélène ». Civilité et nom : « Chère Madame Marchal ». Vide vaut par le prénom." }
  ] },
  { id: "D", titre: "D. Caractéristiques du formulaire", aide: "Ce qui façonne le formulaire des invités. Posé au couple ; chaque réponse ouvre, ferme ou reformule des questions (méthode YID).", champs: [
    { k: "programme", n: "D1", l: "Le programme de la journée", t: "programme", req: true, q: "Comment se déroule votre journée, moment par moment ?", h: "Un seul jour, autant de lieux que nécessaire. Pour chaque moment : l'heure, le nom tel que vos invités le liront, le lieu, s'il est ouvert à tous ou sur invitation, et ce qui y est servi. Un moment sur invitation ouvre la colonne Présence du collect." },
    { k: "plats", n: "D2", l: "Plats au choix, mot pour mot", t: "liste", q: "Quels plats vos invités pourront-ils choisir ?", h: "« Viande ; Poisson ». Seulement si un moment est un repas servi à table ; vide si le menu est unique. Le végétarien se déclare avec les régimes." },
    { k: "cuisson", n: "D3", l: "Cuisson au choix", t: "ouinon", si: { k: "plats", filled: true }, q: "Le traiteur propose-t-il la cuisson au choix ?", h: "Non par défaut ; Oui seulement si le traiteur la demande (petits comités)." },
    { k: "age_menu_enfant", n: "D4", l: "Menu enfant : jusqu'à quel âge ?", t: "select", o: ["Pas de menu enfant", "Jusqu'à 3 ans", "Jusqu'à 6 ans", "Jusqu'à 8 ans", "Jusqu'à 10 ans", "Jusqu'à 12 ans", "Jusqu'à 14 ans", "Jusqu'à 16 ans"], q: "Le traiteur sert-il un menu enfant, et jusqu'à quel âge ?", h: "Un enfant de cet âge ou moins reçoit le menu enfant, sans choix de plat ; le formulaire l'annonce. Sans menu enfant, chaque enfant choisit son plat. L'âge est toujours demandé (couchage, alcool)." },
    { k: "protection_liste", n: "D5", l: "Protection de la liste", t: "ouinon", req: true, q: "Souhaitez-vous que nous veillions à ce que seules les personnes que vous avez conviées soient présentes ?", h: "Oui : typologies et plafonds du collect strictement tenus, toute demande d'accompagnant soumise aux mariés, chaque personne nommée avant la date de réponse, pass de contrôle proposé. L'invité convié seul lit « Cette invitation vous est personnellement adressée. »" },
    { k: "pass", n: "D6", l: "Pass des invités", t: "select", o: ["Pass de contrôle, avec QR", "Pass d'accueil, avec QR", "Pass sans QR"], req: true, q: "", h: "Contrôle : le garde-fou de la protection de la liste, vérifié à l'entrée. Accueil : le QR sert à nos agents pour reconnaître et placer l'invité. Sans QR : une invitation au format pass. Envoyé trois jours avant le mariage." },
    { k: "hebergement_offert", n: "D7", l: "Hébergement offert par les mariés", t: "ouinon", si: { k: "hebergement", ne: "Non géré par Yes I Do" }, q: "L'hébergement est-il offert aux invités que vous logez ?", h: "Oui : le formulaire l'annonce et demande seulement si l'invité séjournera. Les autres invités ne voient aucune question d'hébergement." },
    { k: "nuits", n: "D8", l: "Nuits concernées, mot pour mot", t: "text", si: { k: "hebergement", ne: "Non géré par Yes I Do" }, q: "Pour quelles nuits ?", h: "« la nuit du samedi 10 au dimanche 11 juillet »." },
    { k: "acces_anticipe", n: "D9", l: "Accès anticipé au lieu d'hébergement", t: "ouinon", si: { k: "hebergement", ne: "Non géré par Yes I Do" }, q: "Vos invités logés pourront-ils accéder au lieu avant la réception ?", h: "Oui : le formulaire demande l'heure d'arrivée. Non : la question n'existe pas." },
    { k: "arrivees", n: "D10", l: "Arrivées organisées par les mariés", t: "ouinon", req: true, q: "Souhaitez-vous organiser l'arrivée de vos invités, depuis une gare ou un aéroport ?", h: "Non : aucune question de voyage, la conciergerie propose son aide à tous." },
    { k: "engagement_horaires", n: "D11", l: "Engagement sur les horaires", t: "ouinon", req: true, q: "Souhaitez-vous que vos invités s'engagent à respecter les horaires ?", h: "Non par défaut : le rappel des horaires figure dans l'email récapitulatif." },
    { k: "date_reponse", n: "D12", l: "Date limite de réponse", t: "date", req: true, future: true, q: "Avant quelle date vos invités doivent-ils répondre ?", h: "Un mois au moins avant la date demandée par le traiteur." },
    { k: "date_modification", n: "D13", l: "Réponses modifiables jusqu'au", t: "date", req: true, future: true, q: "Jusqu'à quand pourront-ils modifier leurs réponses ?", h: "Après la date limite de réponse, avant le mariage." },
    { k: "langues_formulaire", n: "D14", l: "Langues du formulaire", t: "liste", q: "Certains de vos invités préfèrent-ils une autre langue que le français ?", h: "Français (fr), anglais (en), portugais (pt). « fr ; en ; pt ». Chaque foyer reçoit sa langue, colonne Langue du collect." },
    { k: "traductions_en", n: "D15", l: "Traductions en anglais", t: "liste", si: { k: "langues_formulaire", filled: true }, q: "", h: "Les mots des mariés, traduits pour les invités anglophones : « Cérémonie laïque = Outdoor ceremony ; Viande = Meat ». Ce qui n'est pas traduit reste en français." },
    { k: "traductions_pt", n: "D16", l: "Traductions en portugais", t: "liste", si: { k: "langues_formulaire", filled: true }, q: "", h: "Même principe : « Viande = Carne ; Poisson = Peixe »." },
  ] },
  { id: "C", titre: "C. Dans l'application", aide: "Propre à l'outil, inscrit par Yes I Do.", champs: [
    { k: "statut", n: "C1", l: "Statut du mariage", t: "select", o: ["Signé", "En préparation", "Prospect", "Test"], req: true, h: "Prospect = déclaration légère avant signature. Test = jamais d'envoi réel." },
    { k: "langue_defaut", n: "C2", l: "Langue par défaut des invités", t: "select", o: ["fr", "en", "pt", "nl"], req: true, h: "Chaque foyer peut en avoir une autre. Le formulaire parle français, anglais et portugais ; un foyer néerlandophone le reçoit en anglais." },
    { k: "boite_email", n: "C3", l: "Boîte email du mariage", t: "text", h: "Boîte partagée créée dans l'administration Microsoft 365, par exemple alexander.clarisse@yidyesido.onmicrosoft.com. L'application la vérifie, elle ne la crée pas." },
    { k: "site", n: "C4", l: "Adresse de la plateforme invités", t: "text", h: "L'adresse Squarespace, sans barre finale. Peut rester vide jusqu'à l'étape 4." },
    { k: "email_epoux", n: "C5", l: "Email de l'époux", t: "text", h: "Un fichier reçu de cette adresse est rangé côté Époux sans question." },
    { k: "email_epouse", n: "C6", l: "Email de l'épouse", t: "text", h: "Idem, côté Épouse." }
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

const LANGUES = ["fr", "en", "pt"];
const ACCES = ["Tous les invités", "Sur invitation"];
const SERVICES = ["Rien n'est servi", "Cocktail ou vin d'honneur", "Repas servi à table", "Buffet"];
/* Le programme : une ligne par moment { heure, libelle, lieu, acces, service }, reçu en tableau ou en JSON. */
function programme(x) {
  let a = x; if (typeof a === "string") { try { a = JSON.parse(a); } catch (e) { a = a.split(";").map(l => ({ libelle: l })); } }
  if (!Array.isArray(a)) return { err: "programme illisible." };
  const l = [];
  for (const [i, r] of a.slice(0, 15).entries()) {
    const libelle = String((r && r.libelle) || "").trim().slice(0, 120); if (!libelle) continue;
    const heure = String(r.heure || "").trim(); if (heure && !/^([01]\d|2[0-3]):[0-5]\d$/.test(heure)) return { err: "heure du moment " + (i + 1) + " au format HH:MM." };
    const acces = ACCES.includes(r.acces) ? r.acces : ACCES[0], service = SERVICES.includes(r.service) ? r.service : SERVICES[0];
    l.push({ heure, libelle, lieu: String(r.lieu || "").trim().slice(0, 120), acces, service });
  }
  if (new Set(l.map(m => m.libelle)).size !== l.length) return { err: "deux moments portent le même nom." };
  return { l };
}
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
    if (!visible(f, v)) { data[f.k] = f.t === "liste" || f.t === "programme" ? [] : ""; continue; }
    if (f.req && (x === "" || x === undefined)) { errors.push({ k: f.k, msg: f.l + " : à renseigner." }); continue; }
    if (x === "" || (f.t === "programme" && Array.isArray(x) && !x.length && !f.req)) { data[f.k] = f.t === "liste" || f.t === "programme" ? [] : ""; continue; }
    if (f.t === "int") { const n = Number(x); if (!Number.isInteger(n) || (f.min !== undefined && n < f.min) || (f.max !== undefined && n > f.max)) { errors.push({ k: f.k, msg: f.l + " : nombre entier attendu" + (f.min !== undefined ? ` entre ${f.min} et ${f.max}` : "") + "." }); continue; } data[f.k] = n; }
    else if (f.t === "date") { const d = toDate(x); if (!d) { errors.push({ k: f.k, msg: f.l + " : date attendue (AAAA-MM-JJ)." }); continue; } data[f.k] = iso(d); }
    else if (f.t === "ouinon") { if (!["Oui", "Non"].includes(x)) { errors.push({ k: f.k, msg: f.l + " : Oui ou Non." }); continue; } data[f.k] = x; }
    else if (f.t === "select") { if (!f.o.includes(x)) { errors.push({ k: f.k, msg: f.l + " : choisir dans la liste." }); continue; } data[f.k] = x; }
    else if (f.t === "liste") data[f.k] = liste(x);
    else if (f.t === "programme") { const r = programme(x); if (r.err) { errors.push({ k: f.k, msg: f.l + " : " + r.err }); continue; } if (!r.l.length && f.req) { errors.push({ k: f.k, msg: f.l + " : à renseigner." }); continue; } data[f.k] = r.l; }
    else { if (f.pattern && !new RegExp(f.pattern).test(x)) { errors.push({ k: f.k, msg: f.l + " : format attendu " + f.h }); continue; } data[f.k] = String(x).slice(0, 500); }
  }
  if (data.initiales) data.initiales = data.initiales.toUpperCase();
  if (data.date_mariage && data.date_remise && data.date_remise >= data.date_mariage) errors.push({ k: "date_remise", msg: "La date de remise doit précéder le mariage." });
  if (data.date_mariage && data.delai_arret_jours) data.date_arret = dateArret(data.date_mariage, data.delai_arret_jours);
  if (data.date_mariage) data.purge_prevue = datePurge(data.date_mariage);
  if (data.date_reponse && data.date_modification && data.date_modification < data.date_reponse) errors.push({ k: "date_modification", msg: "La date de modification doit suivre la date limite de réponse." });
  if (data.date_mariage && data.date_modification && data.date_modification >= data.date_mariage) errors.push({ k: "date_modification", msg: "Les réponses doivent se figer avant le mariage." });
  if (data.langues_formulaire && data.langues_formulaire.length) { data.langues_formulaire = data.langues_formulaire.map(x => x.toLowerCase()); const hors = data.langues_formulaire.filter(x => !LANGUES.includes(x)); if (hors.length) errors.push({ k: "langues_formulaire", msg: "Langues du formulaire : fr, en ou pt (" + hors.join(", ") + " non disponible)." }); }
  for (const k of ["traductions_en", "traductions_pt"]) for (const t of data[k] || []) if (!/^.+?\s=\s.+$/.test(t)) errors.push({ k, msg: "Traduction illisible : « " + t + " » (attendu « texte français = traduction »)." });
  /* le programme fait les périodes (moments sur invitation) et le repas à table : plus de double saisie */
  if (Array.isArray(data.programme)) {
    data.multi_periodes = data.programme.some(m => m.acces === "Sur invitation") ? "Oui" : "Non";
    data.periodes = data.multi_periodes === "Oui" ? data.programme.map(m => m.libelle) : [];
    data.moments = data.programme.map(m => m.libelle);
    data.repas_table = data.programme.some(m => m.service === "Repas servi à table") ? "Oui" : "Non";
    if ((data.plats || []).length && data.repas_table !== "Oui") errors.push({ k: "plats", msg: "Plats au choix : aucun moment du programme n'est un repas servi à table." });
    if (data.repas_table !== "Oui") data.cuisson = "";
  }
  if (data.protection_liste === "Non" && data.pass === "Pass de contrôle, avec QR") errors.push({ k: "pass", msg: "Le pass de contrôle accompagne la protection de la liste : choisir le pass d'accueil ou le pass sans QR." });
  if (data.quotas && data.quotas.length) {
    data.quotas_map = {}; for (const q of data.quotas) { const m = q.match(/^(.+?)\s*=\s*(\d+)\s*$/); if (!m) errors.push({ k: "quotas", msg: "Quota illisible : « " + q + " » (attendu « Prénom = nombre »)." }); else data.quotas_map[m[1].trim()] = Number(m[2]); }
  }
  return { data, errors };
}
/* La fiche call 1 : questions et réponses, dans l'ordre, pour le PDF et les miroirs. */
function fiche(data) {
  const fmt = (f, x) => f.t === "programme" && Array.isArray(x) ? x.map(m => [m.heure ? m.heure.replace(":", " h ") : "", m.libelle, m.lieu, m.acces, m.service].filter(Boolean).join(", ")).join(" ; ") : Array.isArray(x) ? x.join(" ; ") : (x === "" || x === undefined || x === null) ? "" : String(x);
  return SECTIONS.map(s => ({ heading: s.titre, rows: s.champs.filter(f => visible(f, data) ).map(f => [f.n + ". " + f.l, fmt(f, data[f.k])]) }));
}
module.exports = { ACCES, SERVICES, LANGUES, programme, SECTIONS, PAYS, ETAPES, validate, visible, fiche, dateRemiseProposee, dateArret, datePurge };
