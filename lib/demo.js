/* =====================================================================
   LE MARIAGE TEST AWA ET KEVIN (demande du 17 novembre 2026)
   Un mariage fictif, complet sur l'outil, pour tout montrer et tout
   éprouver sans jamais écrire à personne : statut Test, aucune boîte,
   numéros de la plage réservée à la fiction par l'ARCEP (06 39 98 xx xx).
   Château de Saint-Martin-du-Tertre ; les invités logés sont reçus dans
   quatre maisons : Auberge du Jeu de Paume, Domaine de Maffliers, Domaine
   des Vanneaux, InterContinental Chantilly Château Mont Royal.
   Chaque étape passe par les fonctions de l'outil (fiche, collect, liste,
   premier contact, formulaire v2 relu par le moteur, logistique,
   partenaires, plan de table, espace mariés, emails, feuille de route).
   Relancer recrée la liste : l'ancienne part en archive.
   ===================================================================== */
const db = require("./db");
const store = require("./store");
const checklist = require("./checklist");
const MOTEUR = require("../public/formulaire/moteur.js");

const HOTELS = ["Auberge du Jeu de Paume", "Domaine de Maffliers", "Domaine des Vanneaux", "InterContinental Chantilly Château Mont Royal"];
const [JDP, MAF, VAN, ICM] = HOTELS;
const MOMENTS = ["Cérémonie laïque dans le parc du château", "Cocktail sur la terrasse", "Dîner et soirée dans l'Orangerie"];
const SANS_DINER = MOMENTS.slice(0, 2);

/* Le collect : un foyer par ligne, tel que le couple l'aurait rempli. sc = le scénario de réponse. */
const FOYERS = [
  { t: "Maman", tel: "+33639980000", cote: "Épouse", inv: "Invitation pour deux", lien: "Père / Mère", nom: "Diallo", prenom: "Fatou", acc: "Ibrahima Diallo", heb: JDP, sc: "parents_awa" },
  { t: "Papa", tel: "+33639980117", cote: "Époux", inv: "Invitation pour deux", lien: "Père / Mère", nom: "Laurent", prenom: "Jean-Marc", acc: "Sylvie Laurent", heb: VAN, sc: "parents_kevin" },
  { t: "Mariam ❤️", tel: "+33639980224", cote: "Épouse", inv: "Invitation pour deux", lien: "Frère / Sœur", nom: "Diallo", prenom: "Mariam", acc: "Youssef Benali", enf: 2, heb: JDP, sc: "soeur" },
  { t: "Thomas témoin", tel: "+33639980331", cote: "Époux", inv: "Invitation pour deux", lien: "Témoin", nom: "Mercier", prenom: "Thomas", heb: VAN, sc: "temoin" },
  { t: "Tonton Moussa", tel: "+221771234567", cote: "Épouse", inv: "Invitation unique", lien: "Oncle / Tante", nom: "Diallo", prenom: "Moussa", heb: MAF, sc: "dakar" },
  { t: "Tia Graça", tel: "+351912345678", cote: "Épouse", inv: "Invitation pour deux", lien: "Famille élargie", nom: "Mendes", prenom: "Graça", acc: "Rui Mendes", heb: MAF, langue: "pt", sc: "lusophone" },
  { t: "Mamie", tel: "+33639980448", cote: "Épouse", inv: "Invitation unique", lien: "Grand-parent", nom: "Sow", prenom: "Aminata", heb: JDP, assist: true, sc: "grand_mere" },
  { t: "Lucas Bdx", tel: "+33639980555", cote: "Époux", inv: "Ne sait pas encore", lien: "Ami(e) proche", nom: "Fabre", prenom: "Lucas", sc: "libre_vege" },
  { t: "Sarah Taf", tel: "+33639980662", cote: "Épouse", inv: "Invitation unique", lien: "Collègue", nom: "Cohen", prenom: "Sarah", per: SANS_DINER, sc: "collegue" },
  { t: "Marc boulot", tel: "+33639980779", cote: "Époux", inv: "Invitation pour deux", lien: "Collègue", nom: "Petit", prenom: "Marc", acc: "Nadia Petit", per: SANS_DINER, sc: "regret" },
  { t: "Camille R", tel: "+33639980886", cote: "Épouse", inv: "Invitation pour deux", lien: "Ami(e)", nom: "Roux", prenom: "Camille", acc: "Hugo Blanc", sc: "hesite" },
  { t: "Cheikh cousin", tel: "+33639980993", cote: "Épouse", inv: "Invitation pour deux", lien: "Cousin / Cousine", nom: "Ndiaye", prenom: "Cheikh", acc: "Aïssatou Ndiaye", enf: 3, heb: MAF, sc: "famille_ndiaye" },
  { t: "Antoine golf", tel: "+33639981301", cote: "Époux", inv: "Invitation pour deux", lien: "Ami(e) proche", nom: "Girard", prenom: "Antoine", acc: "Léa Girard", heb: ICM, sc: "remplacant" },
  { t: "Julien", tel: "+33639981418", cote: "Époux", inv: "Invitation pour deux", lien: "Ami(e)", nom: "Moreau", prenom: "Julien", nacc: 3, heb: ICM, sc: "bande" },
  { t: "Tonton Pierre", tel: "+33639981525", cote: "Époux", inv: "Invitation pour deux", lien: "Oncle / Tante", nom: "Laurent", prenom: "Pierre", acc: "Martine Laurent", heb: VAN, sc: "decline_heb" },
  { t: "Kadi", tel: "+33639981632", cote: "Épouse", inv: "Invitation unique", lien: "Ami(e) proche", nom: "Barry", prenom: "Kadiatou", heb: ICM, sc: "kadi" },
  { t: "Romain D", tel: "+33639981749", cote: "Époux", inv: "Ne sait pas encore", lien: "Ami(e)", nom: "Dubois", prenom: "Romain", sc: "silence" },
  { t: "Élodie", tel: "+33639981856", cote: "Épouse", inv: "Invitation pour deux", lien: "Ami(e)", nom: "Fournier", prenom: "Élodie", acc: "Nicolas Fournier", enf: 1, sc: "elodie" },
  { t: "Parrain Bruno", tel: "+33639981963", cote: "Époux", inv: "Invitation unique", lien: "Famille élargie", nom: "Lefèvre", prenom: "Bruno", sc: "allergie_poisson" },
  { t: "Leïla", tel: "+33639981070", cote: "Épouse", inv: "Invitation unique", lien: "Invité(e) d'un proche", prec: "Mariam", nom: "Haddad", prenom: "Leïla", sc: "simple" },
  { t: "João Costa", tel: "+351913456789", cote: "Épouse", inv: "Invitation pour deux", lien: "Invité(e) des parents", nom: "Costa", prenom: "João", acc: "Ana Costa", langue: "pt", sc: "regret_pt" },
  { t: "Mme Marchal", tel: "+33639981187", cote: "Époux", inv: "Invitation pour deux", lien: "Invité(e) des parents", nom: "Marchal", prenom: "Hélène", acc: "Bernard Marchal", sc: "marchal" },
  { t: "Yanis", tel: "+33639981294", cote: "Époux", inv: "Invitation unique", lien: "Ami(e)", nom: "Belkacem", prenom: "Yanis", sc: "silence_envoye" },
  { t: "Emma London", tel: "+447700900461", cote: "Époux", inv: "Invitation pour deux", lien: "Ami(e) proche", nom: "Clarke", prenom: "Emma", acc: "James Clarke", heb: ICM, langue: "en", sc: "anglaise" },
  { t: "Ousmane", tel: "+33639982602", cote: "Épouse", inv: "Invitation unique", lien: "Cousin / Cousine", nom: "Fall", prenom: "Ousmane", sc: "train" }
];

function samedi(apresJours) {
  const d = new Date(); d.setUTCDate(d.getUTCDate() + apresJours);
  while (d.getUTCDay() !== 6) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
const plus = (iso, j) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + j); return d.toISOString().slice(0, 10); };

function fiche() {
  const dm = "2027-06-19";
  return {
    pack: "Signature", prevu_contrat: 60, seuil: 70, date_mariage: dm, delai_arret_jours: 45, conciergerie: "Oui", hebergement: "Une partie des invités", lieux_hebergement: HOTELS.join(" ; "),
    volume_estime: 55, regie: "Oui",
    prenoms: "Awa et Kevin", prenom_epoux: "Kevin", prenom_epouse: "Awa", lieu: "Château de Saint-Martin-du-Tertre, Val-d'Oise", initiales: "AK", pays: "France",
    regime_enfants: "Mixte", consigne_enfants: "Les enfants de la famille proche", proches: "Mariam (sœur de l'épouse) ; Thomas (témoin de l'époux)", listes_attendues: "Mariam", quotas: "Mariam = 4",
    date_remise: checklist.dateRemiseProposee(dm), support: "Non", telephone_epoux: "iPhone", telephone_epouse: "iPhone", registre: "Par le prénom",
    programme: [
      { heure: "15:30", libelle: MOMENTS[0], lieu: "Le parc du château", acces: "Tous les invités", service: "Rien n'est servi" },
      { heure: "17:00", libelle: MOMENTS[1], lieu: "La terrasse", acces: "Tous les invités", service: "Cocktail ou vin d'honneur" },
      { heure: "20:00", libelle: MOMENTS[2], lieu: "L'Orangerie", acces: "Sur invitation", service: "Repas servi à table" }],
    plats: "Filet de bœuf, jus corsé ; Bar de ligne, beurre blanc", cuisson: "Non", age_menu_enfant: "Jusqu'à 10 ans", protection_liste: "Oui", pass: "Pass de contrôle, avec QR",
    hebergement_offert: "Oui", nuits: "la nuit du samedi 19 au dimanche 20 juin", acces_anticipe: "Oui", arrivees: "Oui", engagement_horaires: "Non",
    date_reponse: "2027-03-15", date_modification: "2027-04-30", langues_formulaire: "fr ; en ; pt", traductions_en: "Cérémonie laïque dans le parc du château = Ceremony in the château gardens ; Cocktail sur la terrasse = Drinks on the terrace ; Dîner et soirée dans l'Orangerie = Dinner and dancing in the Orangery ; Filet de bœuf, jus corsé = Fillet of beef, rich jus ; Bar de ligne, beurre blanc = Line caught sea bass, beurre blanc ; la nuit du samedi 19 au dimanche 20 juin = the night of Saturday 19 to Sunday 20 June", traductions_pt: "Filet de bœuf, jus corsé = Lombo de vaca ; Bar de ligne, beurre blanc = Robalo, molho beurre blanc",
    statut: "Test", langue_defaut: "fr", boite_email: "", site: ""
  };
}

/* Le collect v4, avec les trois colonnes du moteur v2 (Langue, Nom de l'accompagnant, Accompagnants autorisés). */
function collect() {
  const H = ["Nom dans votre téléphone", "Téléphone", "Côté", "Invitation", "Lien avec vous", "Précision", "Besoin d'assistance", "Nombre d'enfants", "Hébergement", "Nom (facultatif)", "Prénom (facultatif)", "Désactiver cet invité", "Deuxième numéro trouvé", "Source", "Contrôle", "Langue", "Nom de l'accompagnant", "Accompagnants autorisés"];
  const rows = FOYERS.map(f => [f.t, f.tel, f.cote, f.inv, f.lien, f.prec || "", f.assist ? "Oui" : "", f.enf || 0, f.heb || "", f.nom, f.prenom, "", "", "Collect Awa et Kevin", "", f.langue || "fr", f.acc || "", f.nacc != null ? f.nacc : ""]);
  return require("./xlsx").build([{ name: "Liste invités", table: "ListeInvites", headers: H, rows }]);
}

/* Une réponse complète, puis les nuances de chaque scénario. */
function etat(cfg, F, f) {
  const j0 = cfg.jours[1].v, jv = cfg.jours[0].v, jd = cfg.jours[2].v, p1 = cfg.plats[0].v, p2 = cfg.plats[1].v;
  const S = { step: "recap", presence: "oui", coord: { civ: "", titre: "", titreAutre: "", nom: F.nom, prenom: F.prenom, ind: F.ind, tel: F.tel, email: (F.prenom + "." + F.nom).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z.]/g, "") + "@exemple.fr" },
    acc: { choix: null }, nbAcc: null, accs: {}, nbEnf: null, enf: {}, tous: "oui", mom: {}, absent: {}, seulMoment: {}, v: {}, heb: {}, dep: {}, table: { plat: { inv: p1 }, regime: "non" }, fin: { concierge: "non" }, ack: {}, resa: { maison: "non" } };
  const femmes = ["Fatou", "Mariam", "Graça", "Aminata", "Sarah", "Camille", "Kadiatou", "Élodie", "Leïla", "Hélène", "Sylvie", "Julie", "Aïssatou", "Léa", "Chloé", "Martine", "Ana", "Nadia", "Pauline"];
  S.coord.civ = femmes.includes(F.prenom) ? "Madame" : "Monsieur";
  const deux = (prenom, nom, civ, plat) => { S.acc = { choix: "oui", civ, prenom, nom }; S.table.plat.acc = plat || p2; };
  if (F.type === "deux" && F.accNom) { const [pr, ...n] = F.accNom.split(" "); deux(pr, n.join(" "), femmes.includes(pr) ? "Madame" : "Monsieur"); }
  if (F.type === "libre") S.acc = { choix: "seul" };
  if (F.type === "plusieurs") S.nbAcc = "0";
  if (F.enfants) S.nbEnf = "0";
  if (F.loge) { S.heb.sejour = "oui"; S.heb.heure = { h: "14", m: "30" }; }
  S.v.aller = { mode: "voiture", date: j0, heure: { h: "13", m: "30" } }; S.v.retour = { mode: "voiture", date: jd, heure: { h: "15", m: "00" } };
  const nav = cfg.trajets[0];
  if (nav) { if (F.loge) { S.dep.trajets = { [nav.id]: true }; S.dep.places = { [nav.id]: "1" }; S.dep.retour = { [nav.id]: nav.retours[0] }; } else S.dep.trajets = { aucun: true }; }
  const maison = (re) => ((cfg.maisons || []).find(x => re.test(x.nom)) || { nom: "non" }).nom;
  const places = (n) => { if (nav && S.dep.trajets[nav.id]) S.dep.places[nav.id] = String(n); };
  const chansons = { temoin: "September, Earth, Wind & Fire", soeur: "Yékéké, Mory Kanté", bande: "Get Lucky, Daft Punk", kadi: "Love on Top, Beyoncé", anglaise: "Dancing Queen, ABBA", lusophone: "Sodade, Cesária Évora" };
  if (chansons[f.sc]) S.extra = { cdemo2: { v: chansons[f.sc] } };
  switch (f.sc) {
    case "parents_awa": S.table.regime = "oui"; S.table.qui = { inv: true, acc: true }; S.table.reg = { inv: { halal: true }, acc: { halal: true } }; S.table.plat = { inv: p2, acc: p1 }; places(2); S.fin.mot = "Ma fille, que ce jour soit à ton image : lumineux et entouré d'amour."; break;
    case "parents_kevin": S.table.regime = "oui"; S.table.qui = { acc: true }; S.table.reg = { acc: { coque: true } }; S.table.severe = { acc: "oui" }; places(2); S.heb.precision = "Une chambre au calme si possible, Sylvie a le sommeil léger."; break;
    case "soeur": S.nbEnf = "2"; S.enf = { e1: { prenom: "Inès", nom: "Benali", age: "6" }, e2: { prenom: "Adam", nom: "Benali", age: "0", poussette: "oui" } }; places(3); S.table.precision = "Inès adore les pâtes, sans sauce."; break;
    case "temoin": S.acc = { choix: "oui", civ: "Madame", prenom: "Julie", nom: "Mercier" }; S.table.plat.acc = p2; S.v.aller = { mode: "train", lieu: "Gare du Nord", numero: "TGV 7148", date: jv, heure: { h: "18", m: "05" } }; S.v.retour = { mode: "train", lieu: "Gare du Nord", numero: "TGV 7183", date: jd, heure: { h: "17", m: "40" } }; places(2); S.heb.heure = { h: "10", m: "00" }; S.fin.mot = "On sera là dès le vendredi pour tout préparer."; break;
    case "dakar": S.v.aller = { mode: "avion", lieu: "Paris Charles de Gaulle", numero: "AF 719", date: jv, heure: { h: "06", m: "15" } }; S.v.retour = { mode: "avion", lieu: "Paris Charles de Gaulle", numero: "AF 718", date: plus(jd, 1) === plus(jd, 1) ? jd : jd, heureInconnue: true }; S.fin.concierge = "partie"; S.fin.pour = { aller: true, retour: true }; break;
    case "lusophone": S.tous = "non"; S.mom = { acc: { m1: false, m2: false } }; S.v.aller = { mode: "avion", lieu: "Paris Orly", numero: "TP 432", date: jv, heure: { h: "16", m: "50" } }; S.v.retour = { mode: "avion", lieu: "Paris Orly", numero: "TP 437", date: jd, heure: { h: "19", m: "25" } }; places(2); S.fin.mot = "Muitas felicidades aos noivos!"; break;
    case "grand_mere": S.fin.concierge = "tout"; S.fin.attention = "Se déplace en fauteuil roulant, une place proche de la sortie lui serait précieuse."; S.v.aller = { mode: "taxi", date: j0, heure: { h: "12", m: "00" } }; S.v.retour = { mode: "taxi", date: jd, heure: { h: "12", m: "00" } }; S.heb.precision = "Une chambre de plain pied."; S.table.plat.inv = p2; break;
    case "libre_vege": S.acc = { choix: "oui", civ: "Madame", prenom: "Chloé", nom: "Martin" }; S.table.plat.acc = p2; S.table.regime = "oui"; S.table.qui = { acc: true }; S.table.reg = { acc: { veg: true } }; break;
    case "collegue": S.resa = { maison: maison(/Maffliers/), chambres: "1" }; S.table.regime = "oui"; S.table.reg = { inv: { casher: true } }; S.table.plat.inv = p2; break;
    case "regret": return { presence: "non", motNon: "Nous serons malheureusement à l'étranger ce week end là. Tous nos vœux de bonheur à vous deux.", coord: { prenom: F.prenom, nom: F.nom } };
    case "regret_pt": return { presence: "non", motNon: "Infelizmente não poderemos estar presentes. Desejamos-vos muitas felicidades!", coord: { prenom: F.prenom, nom: F.nom } };
    case "hesite": return { presence: "inconnu", coord: { prenom: F.prenom, nom: F.nom } };
    case "famille_ndiaye": S.nbEnf = "2"; S.enf = { e1: { prenom: "Moussa", nom: "Ndiaye", age: "8" }, e2: { prenom: "Khady", nom: "Ndiaye", age: "14" } }; S.table.plat.e2 = p1; S.table.regime = "oui"; S.table.qui = { e1: true }; S.table.reg = { e1: { arachide: true } }; S.table.severe = { e1: "non" }; places(4); break;
    case "remplacant": S.acc = { choix: "autre", civ: "Madame", prenom: "Pauline", nom: "Girard" }; S.table.plat.acc = p2; places(2); break;
    case "bande": S.nbAcc = "2"; S.accs = { p1: { civ: "Monsieur", prenom: "Maxime", nom: "Leroy" }, p2: { plusTard: true } }; S.table.plat.p1 = p1; S.table.plat.p2 = p2; places(3); S.dep.retour[cfg.trajets[0].id] = cfg.trajets[0].retours[cfg.trajets[0].retours.length - 1]; break;
    case "decline_heb": S.heb = { sejour: "non" }; S.dep.trajets = { aucun: true }; delete S.dep.places; delete S.dep.retour; break;
    case "kadi": S.v.aller = { mode: "voiture", date: j0, heureInconnue: true }; S.table.plat.inv = p2; break;
    case "elodie": S.nbEnf = "1"; S.enf = { e1: { prenom: "Jules", nom: "Fournier", age: "4" } }; break;
    case "allergie_poisson": S.table.regime = "oui"; S.table.reg = { inv: { mer: true } }; S.table.severe = { inv: "oui" }; S.table.plat.inv = p1; break;
    case "marchal": S.coord.civ = "Madame"; S.tous = "non"; S.mom = { acc: { m1: false } }; S.table.plat.acc = p1; break;
    case "anglaise": S.coord.civ = "Madame"; S.v.aller = { mode: "avion", lieu: "London Heathrow, Paris Charles de Gaulle", numero: "BA 304", date: jv, heure: { h: "14", m: "20" } }; S.v.retour = { mode: "avion", lieu: "Paris Charles de Gaulle", numero: "BA 309", date: jd, heure: { h: "18", m: "45" } }; places(2); S.fin.mot = "Congratulations to you both, we cannot wait!"; break;
    case "train": S.resa = { maison: maison(/Jeu de Paume/), chambres: "1" }; S.v.aller = { mode: "train", lieu: "Gare du Nord", numero: "TER 47712", date: j0, heure: { h: "11", m: "20" } }; S.v.retour = { mode: "train", lieu: "Gare du Nord", date: jd, heureInconnue: true }; S.fin.concierge = "partie"; S.fin.pour = { aller: true }; break;
    default: break;
  }
  return S;
}

async function awaKevin(u, phase) {
  const liste = require("./liste"), mariage = require("./mariage"), invite = require("./invite"), formulaire = require("./formulaire");
  const op = u.nom || "Yes I Do";
  /* 1. la fiche */
  const exist = (await db.query("SELECT code FROM mariage WHERE prenoms = 'Awa et Kevin' AND statut = 'Test' ORDER BY id LIMIT 1"))[0];
  const r1 = (phase === "liste" || phase === "reponses") && exist ? { ok: true, code: exist.code } : await mariage.declarer(fiche(), op, exist ? exist.code : undefined);
  if (!r1.ok) throw new Error("Fiche refusée : " + r1.errors.map(e => e.k + " " + e.msg).join(" ; "));
  const code = r1.code;
  if (phase === "fiche") return { code, phase: "fiche", recree: !!exist };
  const etapes = async (ns) => { const m = await store.mariageFresh(code), e = Object.assign({}, m.etapes || {}); ns.forEach(n => { if (!e[n]) e[n] = new Date().toISOString(); }); await db.query("UPDATE mariage SET etapes = $2, etape = $3, modifie_le = now() WHERE id = $1", [m.id, e, Math.min(7, Math.max(...ns) + 1)]); await store.journal(m.id, "Étape terminée", ns.map(n => n + ". " + checklist.ETAPES[n - 1]).join(", ") + " (mariage test)", null, null, op); };
  if (phase !== "reponses") {
  /* 2. la liste : le collect, puis la validation de l'étape */
    if (exist) await liste.vider(code, op);
    const lot = { source: "Collect v4" };
    await liste.importer(code, lot, [{ name: "Collect Awa et Kevin.xlsx", buffer: collect() }], op);
    let L = (await liste.liste(code)).contacts.filter(c => !c.desactive);
    for (const f of FOYERS) {
      const c = L.find(x => x.nom_repertoire === f.t); if (!c) continue;
      const ch = {}; if (f.per) ch.periodes = f.per; else ch.periodes = ["tous"];
      if (f.nacc != null) ch.nb_accompagnants = f.nacc;
      await liste.qualifier(code, c.id, ch, op);
    }
    L = (await liste.liste(code)).contacts.filter(c => !c.desactive);
    const rouges = L.filter(c => c.etat !== "complète");
    if (rouges.length) throw new Error("Liste incomplète : " + rouges.map(c => c.nom_repertoire + " (" + (c.manque || []).join(", ") + c.etat + ")").join(" ; "));
    await etapes([2]);
    /* 5 (avant les réponses) : logistique et maisons partenaires, pour que le formulaire les propose */
    await require("./logistique").regler(code, { transfert: true, transfert_offert: true, chambres: { [JDP]: 6, [MAF]: 5, [VAN]: 5, [ICM]: 4 },
      navettes: [{ id: "nav1", moment: "Samedi après midi", de: "Les maisons partenaires", vers: "Château de Saint-Martin-du-Tertre", depart: "15h15", retours: "0h30, 2h30", capacite: 40 }] }, u);
    const part = require("./partenaires"); await part.repertoire();
  /* les quatre maisons de la démonstration existent toujours au répertoire, quel que soit son état */
  {
    const tous = await db.query("SELECT nom FROM partenaire"), manque = Object.values({ a: /Auberge du Jeu de Paume$/, b: /Maffliers/, c: /Vanneaux/, d: /Mont Royal/ }).filter(re => !tous.some(p => re.test(p.nom)));
    if (manque.length) { const carto = JSON.parse(require("fs").readFileSync(require("path").join(__dirname, "cartographie-v6.json"), "utf8")); const data = (carto.data || carto).filter(p => manque.some(re => re.test(p.nom))); if (data.length) await part.importer(JSON.stringify({ version: carto.version || "cartographie", data }), { nom: op }); }
  }
  const rep = await db.query("SELECT id, nom FROM partenaire");
    const cherche = { [JDP]: /Auberge du Jeu de Paume$/, [MAF]: /Maffliers/, [VAN]: /Vanneaux/, [ICM]: /Mont Royal/ };
    const tarifs = { [JDP]: "Tarif négocié : 240 € la nuit", [MAF]: "Tarif négocié : 195 € la nuit", [VAN]: "Tarif négocié : 170 € la nuit", [ICM]: "Tarif négocié : 310 € la nuit" };
    const ids = HOTELS.map(h => (rep.find(p => cherche[h].test(p.nom)) || {}).id).filter(Boolean);
    if (ids.length) await part.agir(code, "ajouter", { ids }, u);
    for (const [i, h] of HOTELS.entries()) { const p = rep.find(x => cherche[h].test(x.nom)); if (p) await part.agir(code, "regler", { partenaire: p.id, statut: "accord", publie: true, accord: { chambres: [6, 5, 5, 4][i], tarif: tarifs[h], butoir: "2027-04-30", conditions: "Chambres des invités logés offertes par les mariés ; autres invités au tarif négocié, réglé par eux ; rooming list transmise par Yes I Do", interlocuteur: "Réception" } }, u); }
    /* les colonnes du mariage : une colonne renseignée par les mariés, une colonne qui crée une question (méthode passée, aperçu vu) */
  {
    const mm = await store.mariageFresh(code), pp = Object.assign({}, mm.parametres || {});
    pp.colonnes = [
      { id: "cdemo1", nom: "Coffret de bienvenue", detenteur: "maries", usages: ["La wedding planner"], options: ["Coffret famille", "Coffret amis"], reponses: "unique", collect: true, active: false, cree_le: new Date().toISOString(), par: op },
      { id: "cdemo2", nom: "La chanson qui vous fera danser", detenteur: "invite", usages: ["La wedding planner"], pour: "tous", cadre: "Afin de la transmettre au DJ de la soirée.", sujet: "La chanson qui vous fera danser", reponses: "texte", options: [], inconnu: false, portee: "foyer", precision: false, facultatif: true, etape: "fin1", promesse_ok: true,
        question: { fr: "La chanson qui vous fera danser ?", en: "The song that will get you dancing?", pt: "A música que o vai pôr a dançar?", aide: "Afin de la transmettre au DJ de la soirée." }, active: true, active_le: new Date().toISOString(), cree_le: new Date().toISOString(), par: op }];
    await db.query("UPDATE mariage SET parametres = $2 WHERE id = $1", [mm.id, pp]);
    const famille = ["Maman", "Papa", "Mariam ❤️", "Tonton Moussa", "Tia Graça", "Mamie", "Cheikh cousin", "Tonton Pierre", "Parrain Bruno", "Ousmane"];
    for (const c of (await liste.liste(code)).contacts.filter(x => !x.desactive)) { const q = Object.assign({}, c.qualification || {}); q.colonnes = { cdemo1: famille.includes(c.nom_repertoire) ? "Coffret famille" : "Coffret amis" }; await db.query("UPDATE contact_recu SET qualification = $2 WHERE id = $1", [c.id, q]); }
  }
  /* 3. le premier contact : jetons, puis les issues */
    await invite.assurer((await store.mariageFresh(code)).id);
    L = (await liste.liste(code)).contacts.filter(c => !c.desactive);
    const hist = (etats) => ({ etat: etats[etats.length - 1], historique: etats.map((e, k) => ({ etat: e, le: new Date(Date.now() - (etats.length - k) * 3600e3).toISOString(), par: op })) });
    for (const c of L) {
      const f = FOYERS.find(x => x.t === c.nom_repertoire);
      const pc = f.sc === "silence_envoye" ? hist(["envoyé"]) : f.sc === "silence" ? hist(["envoyé", "a répondu", "lien envoyé"]) : f.assist ? hist(["envoyé", "a répondu", "lien envoyé"]) : hist(["envoyé", "a répondu", "lien envoyé"]);
      await db.query("UPDATE contact_recu SET premier_contact = $2 WHERE id = $1", [c.id, pc]);
    }
    await etapes([3]);
  if (phase === "liste") return { code, phase: "liste" };
  }
  /* 4. les réponses, relues par le moteur comme si chaque invité avait rempli son lien */
  const m = await store.mariageFresh(code);
  const bilan = { present: 0, absent: 0, hesite: 0, silence: 0, personnes: 0, refus: [] };
  for (const f of FOYERS) {
    const c = (await db.query("SELECT * FROM contact_recu WHERE mariage_id = $1 AND nom_repertoire = $2 AND NOT desactive AND NOT archive", [m.id, f.t]))[0];
    if (!c) continue;
    if (/^silence/.test(f.sc)) { bilan.silence++; continue; }
    const cfg = await formulaire.configComplete(m), F = formulaire.foyer(c, m), S = etat(cfg, F, f);
    const e = MOTEUR.creer(cfg, F, S);
    if (S.presence === "oui") { const mq = e.verifierTout(); if (mq.length) { bilan.refus.push(f.t + " : " + mq.join(", ")); continue; } }
    const x = await formulaire.repondre(c, m, S);
    if (x.presence === "oui") { bilan.present++; bilan.personnes += e.compat().personnes || 0; } else if (x.presence === "non") bilan.absent++; else bilan.hesite++;
  }
  if (bilan.refus.length) throw new Error("Réponses refusées par le moteur : " + bilan.refus.join(" ; "));
  await etapes([4]);
  await etapes([5]);
  /* 6. le plan de table : six tables nommées, chaque foyer présent placé avec les siens */
  const plan = require("./plan");
  const TABLES = [["honneur", "Table d'honneur", 10], ["pivoine", "Pivoine", 10], ["magnolia", "Magnolia", 10], ["jasmin", "Jasmin", 10], ["camelia", "Camélia", 10], ["gardenia", "Gardénia", 10]];
  await plan.agir(code, "tables", { tables: TABLES.map(([id, nom, places]) => ({ id, nom, places })) }, u);
  const ou = { parents_awa: "honneur", parents_kevin: "honneur", soeur: "honneur", temoin: "honneur", grand_mere: "pivoine", dakar: "pivoine", lusophone: "pivoine", famille_ndiaye: "magnolia", decline_heb: "magnolia", marchal: "magnolia", remplacant: "jasmin", bande: "jasmin", libre_vege: "jasmin", kadi: "camelia", collegue: "camelia", elodie: "camelia", allergie_poisson: "gardenia", simple: "gardenia", train: "gardenia", anglaise: "jasmin" };
  const pres = await db.query("SELECT id, nom_repertoire FROM contact_recu WHERE mariage_id = $1 AND NOT desactive AND NOT archive AND reponse_le IS NOT NULL", [m.id]);
  for (const c of pres) { const f = FOYERS.find(x => x.t === c.nom_repertoire); if (f && ou[f.sc]) await plan.agir(code, "placer", { contact: c.id, table: ou[f.sc] }, u); }
  await etapes([6]);
  /* l'espace mariés, la feuille de route, et le message « programme » préparé (jamais envoyé : mariage Test) */
  await require("./espace").gerer(code, "creer", null, op);
  const mm = await store.mariageFresh(code), pp = Object.assign({}, mm.parametres || {}); pp.feuille_route = { le: new Date().toISOString(), par: op };
  await db.query("UPDATE mariage SET parametres = $2 WHERE id = $1", [mm.id, pp]);
  await store.journal(mm.id, "Mariage test", `Awa et Kevin ${exist ? "recréé" : "créé"} de bout en bout : ${FOYERS.length} foyers, ${bilan.present} présents (${bilan.personnes} personnes), ${bilan.absent} absents, ${bilan.hesite} hésitant, ${bilan.silence} sans réponse`, null, null, op);
  return { code, recree: !!exist, foyers: FOYERS.length, bilan };
}

/* Ce qui rend la démonstration parlante écran par écran : l'appel guidé tenu avec le couple, les messages
   préparés et partis (simulés : un mariage Test n'écrit à personne), et un jour J en cours d'accueil. */
async function extras(u) {
  const code = (await db.query("SELECT code FROM mariage WHERE prenoms = 'Awa et Kevin' AND statut = 'Test' ORDER BY id LIMIT 1"))[0];
  if (!code) throw new Error("mariage test absent");
  const m = await store.mariageFresh(code.code), p = Object.assign({}, m.parametres || {}), op = u.nom || "Yes I Do";
  const L = (await require("./liste").liste(m.code)).contacts.filter(c => !c.desactive);
  const il = (h) => new Date(Date.now() - h * 3600e3).toISOString();
  /* un calendrier vraisemblable : premier contact il y a trois à quatre semaines, réponses étalées depuis */
  for (const [i, c] of L.entries()) {
    const pc = c.premier_contact; if (pc && pc.historique) { pc.historique = pc.historique.map((h, k) => Object.assign({}, h, { le: il(24 * (28 - (i % 5)) - k * 20) })); await db.query("UPDATE contact_recu SET premier_contact = $2 WHERE id = $1", [c.id, pc]); }
    if (c.reponse_le) await db.query("UPDATE contact_recu SET reponse_le = $2 WHERE id = $1", [c.id, il(24 * (25 - (i * 7) % 23))]);
  }
  /* l'appel guidé de qualification, tenu il y a dix jours */
  p.appels = [{ id: "demo1", debut: il(24 * 32 + 0.6), fin: il(24 * 32 + 0.2), duree_min: 24, par: "Cécilia", cloture_par: "Cécilia", depart: { completes: L.length - 6, rouges: 6 },
    decisions: { duree: true, qui: "Cécilia", creneau: "En fin de matinée, avant midi", mode: 3, annonce: true, date_limite: "2027-03-15", rythme: "Une fois par semaine", recap: true },
    bilan: { completes: L.length, total: L.length, a_demander: 2, proches: L.filter(c => c.assistance).map(c => c.nom_repertoire), qui: "Cécilia", creneau: "En fin de matinée, avant midi", mode: "Un message sans lien, puis le lien dès que l'invité répond", date_limite: "2027-03-15", rythme: "Une fois par semaine", registre: "Par le prénom" },
    notes: "Awa préfère que Mamie soit appelée par Cécilia, jamais par message. Kevin confirme que Thomas, son témoin, arrive dès le vendredi. Les collègues ne sont conviés qu'à la cérémonie et au cocktail. Mariam transmet la liste de ses invités cette semaine." }];
  delete p.appel;
  p.envoi = { mode: 3, rythme: "Une fois par semaine", qui_accompagne: "Cécilia", creneau: "En fin de matinée, avant midi" };
  p.date_limite_reponse = "2027-03-15";
  /* la messagerie : le programme parti aux présents, la relance prête, le pass en attente de la date */
  const E = require("./emails"), M = E.MODELES || [];
  const camp = (cle, statut, extra) => { const mod = M.find(x => x.cle === cle) || { nom: cle, objet: "", corps: "", audience: "presents" }; return Object.assign({ id: "demo-" + cle, modele: cle, pass: !!mod.pass, nom: mod.nom, objet: mod.objet, corps: mod.corps, audience: mod.audience, statut, cree_par: "Régis", cree_le: il(150), envoyes: {}, lots: [] }, extra || {}); };
  const presents = L.filter(c => c.reponse_le && !/regret/.test((c.reponse || {}).presence || ""));
  const envoyes = {}; presents.forEach((c, i) => { envoyes[c.id] = { le: il(120 - i * 0.02), a: (c.reponse || {}).email || c.email || "", simulation: true }; });
  p.emails = [camp("programme", "termine", { envoyes, test: { a: "equipe@yidyesido.info", le: il(122), par: "Régis" }, lots: [{ le: il(120), par: "Régis", n: presents.length, simulation: true }] }), camp("relance", "pret", { test: { a: "equipe@yidyesido.info", le: il(30), par: "Cécilia" } }), camp("pass", "brouillon")];
  /* le jour J en cours : la moitié des foyers placés déjà accueillis à l'entrée */
  const P = Object.assign({ tables: [], placements: {}, arrives: {} }, p.plan || {}); P.arrives = {};
  Object.keys(P.placements || {}).slice(0, Math.ceil(Object.keys(P.placements).length / 2)).forEach((id, i) => { P.arrives[id] = { le: il(0.6 - i * 0.03), par: i % 2 ? "Cécilia" : "Régis", scan: i % 3 !== 2, simulation: true }; });
  p.plan = P;
  /* la clôture préparée : le rendez vous de bilan est calé, rien n'est supprimé avant le lendemain du mariage */
  p.cloture = Object.assign({ coches: {} }, p.cloture || {}, { rdv: "2027-06-24T18:30", notes: "Bilan prévu avec Awa et Kevin le jeudi suivant le mariage, en visio." });
  p.demo = { version: DEMO_VERSION, phase: "fait", le: new Date().toISOString() };
  await db.query("UPDATE mariage SET parametres = $2, modifie_le = now() WHERE id = $1", [m.id, p]);
  await store.journal(m.id, "Mariage test", "Démonstration complétée : appel guidé, messages, jour J simulé, clôture préparée", null, null, op);
  return { code: m.code };
}

/* La démonstration se tient à jour seule : chaque appel fait l'étape suivante, jusqu'à la version courante.
   Elle ne touche qu'au mariage Test Awa et Kevin, et ne fait plus rien une fois à jour. */
const DEMO_VERSION = "2026-11-19-b";
async function auto() {
  const u = { nom: "Yes I Do", role: "administrateur" };
  const r = (await db.query("SELECT code, parametres FROM mariage WHERE prenoms = 'Awa et Kevin' AND statut = 'Test' ORDER BY id LIMIT 1"))[0];
  const d = r && (r.parametres || {}).demo || {};
  if (d.version === DEMO_VERSION && d.phase === "fait") {
    if (await secondAJour()) return { ok: true, a_jour: true, code: r.code };
    const s2 = await second(u); return { ok: true, fait: "second", code: s2.code, a_completer: s2.a_completer, reste: [] };
  }
  if (d.version === DEMO_VERSION && d.en_cours && Date.now() - new Date(d.en_cours).getTime() < 55000) return { ok: true, en_cours: d.phase || "fiche" };
  const ordre = ["fiche", "liste", "reponses", "extras"], suivante = d.version === DEMO_VERSION && ordre.includes(d.suivante) ? d.suivante : "fiche";
  const marquer = async (o) => { const x = (await db.query("SELECT id, parametres FROM mariage WHERE prenoms = 'Awa et Kevin' AND statut = 'Test' ORDER BY id LIMIT 1"))[0]; if (!x) return; const pp = Object.assign({}, x.parametres || {}); pp.demo = Object.assign({ version: DEMO_VERSION }, o); await db.query("UPDATE mariage SET parametres = $2 WHERE id = $1", [x.id, pp]); };
  if (r) await marquer({ phase: suivante, suivante, en_cours: new Date().toISOString() });
  const res = suivante === "extras" ? await extras(u) : await awaKevin(u, suivante);
  if (suivante !== "extras") await marquer({ phase: suivante, suivante: ordre[ordre.indexOf(suivante) + 1] });
  return { ok: true, fait: suivante, code: res.code, reste: ordre.slice(ordre.indexOf(suivante) + 1) };
}

/* Le second mariage test : Inès et Mathieu, arrêté à l'étape 2, pour montrer le fil conducteur en cours de route.
   Fiche complète, feuille de route envoyée, liste reçue dont trois fiches attendent une précision du couple. */
const DEMO2_VERSION = "2026-11-19-b", DEMO2 = "Inès et Mathieu";
async function second(u) {
  const liste = require("./liste"), mariage = require("./mariage"), op = u.nom || "Yes I Do";
  const exist = (await db.query("SELECT code FROM mariage WHERE prenoms = $1 AND statut = 'Test' ORDER BY id LIMIT 1", [DEMO2]))[0];
  const f = Object.assign(fiche(), { prenoms: DEMO2, prenom_epoux: "Mathieu", prenom_epouse: "Inès", initiales: "IM", lieu: "Domaine des Charmes, Oise",
    date_mariage: "2027-09-11", date_remise: checklist.dateRemiseProposee("2027-09-11"), date_reponse: "2027-06-15", date_modification: "2027-07-31", nuits: "la nuit du samedi 11 au dimanche 12 septembre" });
  f.traductions_en = f.traductions_en.replace("la nuit du samedi 19 au dimanche 20 juin = the night of Saturday 19 to Sunday 20 June", "la nuit du samedi 11 au dimanche 12 septembre = the night of Saturday 11 to Sunday 12 September");
  const r1 = await mariage.declarer(f, op, exist ? exist.code : undefined);
  if (!r1.ok) throw new Error("Fiche refusée : " + r1.errors.map(e => e.k + " " + e.msg).join(" ; "));
  const code = r1.code;
  if (exist) await liste.vider(code, op);
  /* douze foyers ; trois lignes arrivent sans côté, sans lien ou sans type d'invitation */
  const F = FOYERS.slice(0, 12), trous = { 4: ["lien"], 8: ["inv"], 10: ["cote", "lien"] };
  const H = ["Nom dans votre téléphone", "Téléphone", "Côté", "Invitation", "Lien avec vous", "Précision", "Besoin d'assistance", "Nombre d'enfants", "Hébergement", "Nom (facultatif)", "Prénom (facultatif)", "Désactiver cet invité", "Deuxième numéro trouvé", "Source", "Contrôle", "Langue", "Nom de l'accompagnant", "Accompagnants autorisés"];
  const rows = F.map((x, i) => { const t = trous[i] || []; return [x.t, x.tel, t.includes("cote") ? "" : x.cote, t.includes("inv") ? "" : x.inv, t.includes("lien") ? "" : x.lien, x.prec || "", x.assist ? "Oui" : "", x.enf || 0, x.heb || "", x.nom, x.prenom, "", "", "Collect Inès et Mathieu", "", x.langue || "fr", x.acc || "", x.nacc != null ? x.nacc : ""]; });
  await liste.importer(code, { source: "Collect v4" }, [{ name: "Collect Inès et Mathieu.xlsx", buffer: require("./xlsx").build([{ name: "Liste invités", table: "ListeInvites", headers: H, rows }]) }], op);
  let L = (await liste.liste(code)).contacts.filter(c => !c.desactive);
  for (const [i, x] of F.entries()) { if (trous[i]) continue; const c = L.find(y => y.nom_repertoire === x.t); if (!c) continue; const ch = { periodes: x.per || ["tous"] }; if (x.nacc != null) ch.nb_accompagnants = x.nacc; await liste.qualifier(code, c.id, ch, op); }
  L = (await liste.liste(code)).contacts.filter(c => !c.desactive);
  const m = await store.mariageFresh(code), pp = Object.assign({}, m.parametres || {}), e = Object.assign({}, m.etapes || {});
  if (!e[1]) e[1] = new Date().toISOString(); delete e[2];
  pp.feuille_route = pp.feuille_route || { le: new Date().toISOString(), par: op };
  pp.demo2 = { version: DEMO2_VERSION, le: new Date().toISOString() };
  await db.query("UPDATE mariage SET parametres = $2, etapes = $3, etape = 2, modifie_le = now() WHERE id = $1", [m.id, pp, e]);
  if (!m.espace_jeton) await require("./espace").gerer(code, "creer", null, op);
  return { code, fiches: L.length, a_completer: L.filter(c => c.etat !== "complète").length };
}
async function secondAJour() { const r = (await db.query("SELECT parametres FROM mariage WHERE prenoms = $1 AND statut = 'Test' ORDER BY id LIMIT 1", [DEMO2]))[0]; return !!r && ((r.parametres || {}).demo2 || {}).version === DEMO2_VERSION; }

module.exports = { auto, extras, second, DEMO_VERSION, DEMO2_VERSION, awaKevin, FOYERS, fiche, collect, etat };
