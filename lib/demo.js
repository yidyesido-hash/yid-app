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
const MOMENTS = ["Cérémonie laïque dans le parc du château", "Cocktail sur la terrasse", "Dîner et soirée dans l'Orangerie", "Brunch du dimanche"];
const SANS_BRUNCH = MOMENTS.slice(0, 3);

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
  { t: "Sarah Taf", tel: "+33639980662", cote: "Épouse", inv: "Invitation unique", lien: "Collègue", nom: "Cohen", prenom: "Sarah", per: SANS_BRUNCH, sc: "collegue" },
  { t: "Marc boulot", tel: "+33639980779", cote: "Époux", inv: "Invitation pour deux", lien: "Collègue", nom: "Petit", prenom: "Marc", acc: "Nadia Petit", per: SANS_BRUNCH, sc: "regret" },
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
    volume_estime: 55, multi_periodes: "Oui", periodes: MOMENTS.join(" ; "), regie: "Oui",
    prenoms: "Awa et Kevin", prenom_epoux: "Kevin", prenom_epouse: "Awa", lieu: "Château de Saint-Martin-du-Tertre, Val-d'Oise", initiales: "AK", pays: "France",
    regime_enfants: "Mixte", consigne_enfants: "Les enfants de la famille proche", proches: "Mariam (sœur de l'épouse) ; Thomas (témoin de l'époux)", listes_attendues: "Mariam", quotas: "Mariam = 4",
    date_remise: checklist.dateRemiseProposee(dm), support: "Non", telephone_epoux: "iPhone", telephone_epouse: "iPhone", registre: "Par le prénom",
    moments: MOMENTS.join(" ; "), repas_table: "Oui", plats: "Filet de bœuf, jus corsé ; Bar de ligne, beurre blanc", cuisson: "Non", age_menu_enfant: 12, audience_maitrisee: "Oui",
    hebergement_offert: "Oui", nuits: "la nuit du samedi 19 au dimanche 20 juin", acces_anticipe: "Oui", arrivees: "Oui", trajets: "", engagement_horaires: "Non",
    date_reponse: "2027-03-15", date_modification: "2027-04-30", langues_formulaire: "fr ; pt",
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
    acc: { choix: null }, nbAcc: null, accs: {}, nbEnf: null, enf: {}, tous: "oui", mom: {}, absent: {}, seulMoment: {}, v: {}, heb: {}, dep: {}, table: { plat: { inv: p1 }, regime: "non" }, fin: { concierge: "non" }, ack: {} };
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
  const places = (n) => { if (nav && S.dep.trajets[nav.id]) S.dep.places[nav.id] = String(n); };
  switch (f.sc) {
    case "parents_awa": S.table.regime = "oui"; S.table.qui = { inv: true, acc: true }; S.table.reg = { inv: { halal: true }, acc: { halal: true } }; S.table.plat = { inv: p2, acc: p1 }; places(2); S.fin.mot = "Ma fille, que ce jour soit à ton image : lumineux et entouré d'amour."; break;
    case "parents_kevin": S.table.regime = "oui"; S.table.qui = { acc: true }; S.table.reg = { acc: { coque: true } }; S.table.severe = { acc: "oui" }; places(2); S.heb.precision = "Une chambre au calme si possible, Sylvie a le sommeil léger."; break;
    case "soeur": S.nbEnf = "2"; S.enf = { e1: { prenom: "Inès", nom: "Benali", age: "6" }, e2: { prenom: "Adam", nom: "Benali", age: "0", poussette: "oui" } }; places(3); S.table.precision = "Inès adore les pâtes, sans sauce."; break;
    case "temoin": S.acc = { choix: "oui", civ: "Madame", prenom: "Julie", nom: "Mercier" }; S.table.plat.acc = p2; S.v.aller = { mode: "train", lieu: "Gare du Nord", numero: "TGV 7148", date: jv, heure: { h: "18", m: "05" } }; S.v.retour = { mode: "train", lieu: "Gare du Nord", numero: "TGV 7183", date: jd, heure: { h: "17", m: "40" } }; places(2); S.heb.heure = { h: "10", m: "00" }; S.fin.mot = "On sera là dès le vendredi pour tout préparer."; break;
    case "dakar": S.v.aller = { mode: "avion", lieu: "Paris Charles de Gaulle", numero: "AF 719", date: jv, heure: { h: "06", m: "15" } }; S.v.retour = { mode: "avion", lieu: "Paris Charles de Gaulle", numero: "AF 718", date: plus(jd, 1) === plus(jd, 1) ? jd : jd, heureInconnue: true }; S.fin.concierge = "partie"; S.fin.pour = { aller: true, retour: true }; break;
    case "lusophone": S.tous = "non"; S.mom = { acc: { m1: false, m2: false } }; S.v.aller = { mode: "avion", lieu: "Paris Orly", numero: "TP 432", date: jv, heure: { h: "16", m: "50" } }; S.v.retour = { mode: "avion", lieu: "Paris Orly", numero: "TP 437", date: jd, heure: { h: "19", m: "25" } }; places(2); S.fin.mot = "Muitas felicidades aos noivos!"; break;
    case "grand_mere": S.fin.concierge = "tout"; S.fin.attention = "Se déplace en fauteuil roulant, une place proche de la sortie lui serait précieuse."; S.v.aller = { mode: "taxi", date: j0, heure: { h: "12", m: "00" } }; S.v.retour = { mode: "taxi", date: jd, heure: { h: "12", m: "00" } }; S.heb.precision = "Une chambre de plain pied."; S.table.plat.inv = p2; break;
    case "libre_vege": S.acc = { choix: "oui", civ: "Madame", prenom: "Chloé", nom: "Martin" }; S.table.plat.acc = p2; S.table.regime = "oui"; S.table.qui = { acc: true }; S.table.reg = { acc: { veg: true } }; break;
    case "collegue": S.table.regime = "oui"; S.table.reg = { inv: { casher: true } }; S.table.plat.inv = p2; break;
    case "regret": return { presence: "non", motNon: "Nous serons malheureusement à l'étranger ce week end là. Tous nos vœux de bonheur à vous deux.", coord: { prenom: F.prenom, nom: F.nom } };
    case "regret_pt": return { presence: "non", motNon: "Infelizmente não poderemos estar presentes. Desejamos-vos muitas felicidades!", coord: { prenom: F.prenom, nom: F.nom } };
    case "hesite": return { presence: "inconnu", coord: { prenom: F.prenom, nom: F.nom } };
    case "famille_ndiaye": S.nbEnf = "2"; S.enf = { e1: { prenom: "Moussa", nom: "Ndiaye", age: "8" }, e2: { prenom: "Khady", nom: "Ndiaye", age: "14" } }; S.table.plat.e2 = p1; S.table.regime = "oui"; S.table.qui = { e1: true }; S.table.reg = { e1: { arachide: true } }; S.table.severe = { e1: "non" }; places(4); break;
    case "remplacant": S.acc = { choix: "autre", civ: "Madame", prenom: "Pauline", nom: "Girard" }; S.table.plat.acc = p2; places(2); break;
    case "bande": S.nbAcc = "2"; S.accs = { p1: { civ: "Monsieur", prenom: "Maxime", nom: "Leroy" }, p2: { plusTard: true } }; S.table.plat.p1 = p1; S.table.plat.p2 = p2; places(3); S.dep.retour[cfg.trajets[0].id] = cfg.trajets[0].retours[cfg.trajets[0].retours.length - 1]; break;
    case "decline_heb": S.heb = { sejour: "non" }; S.dep.trajets = { aucun: true }; delete S.dep.places; delete S.dep.retour; break;
    case "kadi": S.v.aller = { mode: "voiture", date: j0, heureInconnue: true }; S.table.plat.inv = p2; break;
    case "elodie": S.nbEnf = "1"; S.enf = { e1: { prenom: "Jules", nom: "Fournier", age: "4" } }; S.tous = "non"; S.mom = { inv: { m4: false }, acc: { m4: false }, e1: { m4: false } }; break;
    case "allergie_poisson": S.table.regime = "oui"; S.table.reg = { inv: { mer: true } }; S.table.severe = { inv: "oui" }; S.table.plat.inv = p1; break;
    case "marchal": S.coord.civ = "Madame"; S.tous = "non"; S.mom = { acc: { m4: false } }; S.table.plat.acc = p1; break;
    case "train": S.v.aller = { mode: "train", lieu: "Gare du Nord", numero: "TER 47712", date: j0, heure: { h: "11", m: "20" } }; S.v.retour = { mode: "train", lieu: "Gare du Nord", date: jd, heureInconnue: true }; S.fin.concierge = "partie"; S.fin.pour = { aller: true }; break;
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
    const part = require("./partenaires"), rep = await db.query("SELECT id, nom FROM partenaire");
    const cherche = { [JDP]: /Auberge du Jeu de Paume$/, [MAF]: /Maffliers/, [VAN]: /Vanneaux/, [ICM]: /Mont Royal/ };
    const tarifs = { [JDP]: "Offert par les mariés", [MAF]: "Offert par les mariés", [VAN]: "Offert par les mariés", [ICM]: "Offert par les mariés" };
    const ids = HOTELS.map(h => (rep.find(p => cherche[h].test(p.nom)) || {}).id).filter(Boolean);
    if (ids.length) await part.agir(code, "ajouter", { ids }, u);
    for (const [i, h] of HOTELS.entries()) { const p = rep.find(x => cherche[h].test(x.nom)); if (p) await part.agir(code, "regler", { partenaire: p.id, statut: "accord", publie: true, accord: { chambres: [6, 5, 5, 4][i], tarif: tarifs[h], butoir: "2027-04-30", conditions: "Bloc de chambres au nom du mariage, rooming list transmise par Yes I Do", interlocuteur: "Réception" } }, u); }
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
    const cfg = formulaire.config(m), F = formulaire.foyer(c, m), S = etat(cfg, F, f);
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
  const ou = { parents_awa: "honneur", parents_kevin: "honneur", soeur: "honneur", temoin: "honneur", grand_mere: "pivoine", dakar: "pivoine", lusophone: "pivoine", famille_ndiaye: "magnolia", decline_heb: "magnolia", marchal: "magnolia", remplacant: "jasmin", bande: "jasmin", libre_vege: "jasmin", kadi: "camelia", collegue: "camelia", elodie: "camelia", allergie_poisson: "gardenia", simple: "gardenia", train: "gardenia" };
  const pres = await db.query("SELECT id, nom_repertoire FROM contact_recu WHERE mariage_id = $1 AND NOT desactive AND NOT archive AND reponse_le IS NOT NULL", [m.id]);
  for (const c of pres) { const f = FOYERS.find(x => x.t === c.nom_repertoire); if (f && ou[f.sc]) await plan.agir(code, "placer", { contact: c.id, table: ou[f.sc] }, u); }
  await etapes([6]);
  /* l'espace mariés, la feuille de route, et le message « programme » préparé (jamais envoyé : mariage Test) */
  await require("./espace").gerer(code, "creer", null, op);
  const mm = await store.mariageFresh(code), pp = Object.assign({}, mm.parametres || {}); pp.feuille_route = { le: new Date().toISOString(), par: op };
  await db.query("UPDATE mariage SET parametres = $2 WHERE id = $1", [mm.id, pp]);
  try { await require("./emails").agir(code, "creer", { modele: "programme" }, u); } catch (e) { /* le sas d'envoi reste disponible à la main */ }
  await store.journal(mm.id, "Mariage test", `Awa et Kevin ${exist ? "recréé" : "créé"} de bout en bout : ${FOYERS.length} foyers, ${bilan.present} présents (${bilan.personnes} personnes), ${bilan.absent} absents, ${bilan.hesite} hésitant, ${bilan.silence} sans réponse`, null, null, op);
  return { code, recree: !!exist, foyers: FOYERS.length, bilan };
}

module.exports = { awaKevin, FOYERS, fiche, collect, etat };
