/* Recette automatique de la v1.0 en local (PGlite) : connexion, voyants, mariages, import, profil,
   formulaire, envoi versionné, suivi, journal. Lancer : npm test */
process.env.ADMIN_PASSWORD = "test";
process.env.PGLITE_DIR = require("path").join(__dirname, "data-recette");
const fs = require("fs"); fs.rmSync(process.env.PGLITE_DIR, { recursive: true, force: true });
const handler = require("../api/forms");

function call(method, url, body, headers) {
  return new Promise((resolve) => {
    const req = { method, url, headers: Object.assign({ "user-agent": "recette" }, headers || {}), body: body === undefined ? undefined : JSON.stringify(body), socket: { remoteAddress: "127.0.0.1" }, on() {} };
    const res = { headers: {}, statusCode: 200, setHeader(k, v) { this.headers[k] = v; }, end(s) { resolve({ status: this.statusCode, json: s ? JSON.parse(s) : {} }); } };
    handler(req, res);
  });
}
let n = 0, ko = 0;
function check(label, cond, extra) { n++; if (!cond) ko++; console.log((cond ? "  ok  " : "  KO  ") + label + (extra ? "  " + extra : "")); }

(async () => {
  console.log("Recette yid-app v1.3, base locale");
  let r = await call("POST", "/api/forms?action=admin-login", { password: "faux" });
  check("mot de passe refusé", r.status === 401);
  r = await call("POST", "/api/forms?action=admin-login", { password: "test" });
  check("connexion acceptée avec le mot de passe d'installation, au nom administrateur", r.status === 200 && r.json.token && r.json.nom === "administrateur" && r.json.equipe === 0, "version " + r.json.version);
  const H = { "x-admin-token": r.json.token };

  r = await call("POST", "/api/forms?action=admin-check", {}, H);
  check("voyant base vert", r.json.base && r.json.base.ok, r.json.base && r.json.base.detail);
  check("voyant SharePoint non configuré en local", r.json.sharepoint && r.json.sharepoint.ok === false);
  check("voyant boîte non configuré en local", r.json.boite && r.json.boite.ok === false);

  r = await call("POST", "/api/forms?action=admin-mariages", {}, H);
  check("mariages AK00 et AM27 créés depuis la configuration", r.json.mariages && r.json.mariages.length === 2, r.json.mariages && r.json.mariages.map(m => m.code + " " + m.statut).join(", "));

  const csv = "foyer;membres;enfants;proches;email;telephone;langue;accompagnant\nFamille Miller;Sarah Miller / James Miller;Léo Miller (8);oui;sarah@example.com;+1 555 0100;en;non\nFamille De Vries;Anna de Vries;;non;anna@example.nl;+31 6 1234;nl;oui\nDjoco Mabiala;Djoco Mabiala;;non;;+33 6 00 00 00 00;fr;non";
  r = await call("POST", "/api/forms?action=admin-import&w=AK00", { csv }, H);
  check("import de 3 foyers", r.json.count === 3 && r.json.created === 3, r.json.detail);
  const lines = r.json.csv.split("\r\n"); const key = lines[1].split(";")[1];
  r = await call("POST", "/api/forms?action=admin-import&w=AK00", { csv }, H);
  check("réimport : clés conservées, 0 nouveau", r.json.count === 3 && r.json.created === 0 && r.json.csv.split("\r\n")[1].split(";")[1] === key);

  r = await call("GET", "/api/forms?action=profile&w=AK00&k=" + key);
  check("profil du foyer reconnu, cercle des proches", r.json.matched === true && r.json.inner === true, "accueil : " + r.json.greeting);
  r = await call("GET", "/api/forms?action=profile&w=AK00&k=inconnue");
  check("clé inconnue non reconnue", r.json.matched === false);

  r = await call("GET", "/api/forms?action=form&w=AK00&k=" + key + "&f=confirm&lang=fr");
  check("formulaire de confirmation construit en français", r.status === 200 && r.json.ok && r.json.ui && r.json.ui.send === "Envoyer");
  const schema = r.json; const steps = schema.steps || [];
  const fields = []; steps.forEach(s => (s.fields || []).forEach(f => fields.push(f)));
  const data = {};
  fields.forEach(f => { if (f.type === "people") data[f.name] = f.options.map(o => o.v); if (f.type === "radio" && f.required && !f.showIf) data[f.name] = f.options[0].v; if (f.type === "fixed") data[f.name] = f.value; });
  fields.filter(f => f.type === "radio" && f.required && f.showIf && f.showIf.has).forEach(f => { data[f.name] = f.options[0].v; });
  Object.assign(data, { full_name: "Sarah Miller", email: "sarah@example.com", phone: "+1 555 0100", arr_known: "later", dep_known: "later" });
  r = await call("POST", "/api/forms?action=submit&w=AK00", { k: key, f: "confirm", lang: "fr", data });
  check("envoi de la confirmation enregistré (version 1)", r.status === 200 && r.json.ok && r.json.version === 1, r.status !== 200 ? JSON.stringify(r.json).slice(0, 300) : "");
  r = await call("POST", "/api/forms?action=submit&w=AK00", { k: key, f: "confirm", lang: "fr", data });
  check("second envoi : version 2, rien d'écrasé", r.json.version === 2);

  r = await call("POST", "/api/forms?action=admin-list&w=AK00", {}, H);
  const miller = (r.json.households || []).find(h => h.foyer === "Famille Miller");
  check("suivi : confirmation reçue pour Miller, statut Confirmé", miller && miller.confirmation === "reçue" && miller.statut === "Confirmé", miller && JSON.stringify(miller).slice(0, 200));
  check("suivi : De Vries en attente", (r.json.households || []).some(h => h.foyer === "Famille De Vries" && h.confirmation === "en attente"));

  r = await call("POST", "/api/forms?action=admin-export&w=AK00", { kind: "invites" }, H);
  check("export Invités et menus", r.json.ok && r.json.csv.split("\r\n").length >= 2);

  r = await call("POST", "/api/forms?action=admin-journal", {}, H);
  const ops = (r.json.journal || []).map(j => j.operation);
  check("journal : connexion, vérification, mariages, foyers", ops.includes("Connexion") && ops.includes("Vérification de la connexion") && ops.includes("Foyer créé"), ops.length + " lignes");

  r = await call("POST", "/api/forms?action=admin-list&w=AK00", {}, { "x-admin-token": "faux.jeton" });
  check("jeton falsifié refusé", r.status === 401);

  /* ---------- v1.1 : accueil, cadrage, réglages ---------- */
  r = await call("POST", "/api/forms?action=admin-accueil", {}, H);
  check("accueil : mariages, cheminement, journal", r.json.ok && r.json.mariages.length === 2 && r.json.reglages.cheminement.indexOf("1. Fiche du mariage") === 0 && r.json.journal.length > 0);
  r = await call("POST", "/api/forms?action=admin-checklist", { date_mariage: "2027-07-10", delai_arret_jours: 45 }, H);
  check("checklist : 3 sections, remise proposée, clôture calculée", r.json.sections.length === 3 && r.json.remise && r.json.arret === "2027-05-26", r.json.remise + " / " + r.json.arret);
  const fiche = { pack: "Signature", prevu_contrat: 120, seuil: 130, date_mariage: "2027-07-10", delai_arret_jours: 45, conciergerie: "Oui", hebergement: "Une partie des invités", lieux_hebergement: "Domaine de la Muette", volume_estime: 110, multi_periodes: "Non", regie: "Oui",
    prenoms: "Alexander et Clarisse", lieu: "Domaine de la Muette, Seine et Marne", initiales: "ac", pays: "France", regime_enfants: "Mixte", consigne_enfants: "Enfants des proches uniquement", proches: "Kevin (frère de l'époux) ; Tante Awa (tante de l'épouse)", listes_attendues: "Tante Awa", quotas: "Tante Awa = 12", date_remise: r.json.remise, support: "Oui", telephone_epoux: "Android", telephone_epouse: "iPhone",
    statut: "Test", langue_defaut: "fr", boite_email: "", site: "" };
  r = await call("POST", "/api/forms?action=admin-declarer", { data: Object.assign({}, fiche, { prevu_contrat: "abc" }) }, H);
  check("déclaration refusée avec un champ faux (422)", r.status === 422 && r.json.errors.some(e => e.k === "prevu_contrat"));
  r = await call("POST", "/api/forms?action=admin-declarer", { data: fiche }, H);
  check("mariage créé, code AC27, étape 1 terminée", r.status === 200 && r.json.ok && r.json.code === "AC27" && r.json.created && r.json.mariage.etape === 2 && r.json.mariage.etapes["1"], r.status !== 200 ? JSON.stringify(r.json).slice(0, 300) : "clôture " + r.json.mariage.date_arret);
  check("SharePoint non configuré en local : signalé, pas bloquant", r.json.sharepoint && r.json.sharepoint.erreurs.length === 1);
  r = await call("POST", "/api/forms?action=admin-mariage&w=AC27", {}, H);
  check("fiche du mariage : checklist conservée, quotas lus", r.json.mariage.checklist.quotas_map["Tante Awa"] === 12 && r.json.mariage.parametres.regime_enfants === "Mixte");
  r = await call("POST", "/api/forms?action=admin-declarer&w=AC27", { data: Object.assign({}, fiche, { prevu_contrat: 130 }) }, H);
  check("mise à jour : fiche version 2, code inchangé", r.json.ok && !r.json.created && r.json.version === 2 && r.json.code === "AC27");
  r = await call("POST", "/api/forms?action=admin-declarer", { data: Object.assign({}, fiche, { prenoms: "Autre Couple" }) }, H);
  check("mêmes initiales et année : code AC272 attribué, jamais réutilisé", r.json.code === "AC272");
  r = await call("POST", "/api/forms?action=admin-accueil", {}, H);
  const ac = r.json.mariages.find(m => m.code === "AC27");
  check("accueil : jauge à 14 % (1 étape sur 7), liste attendue et clôture affichées", ac && ac.progression === 14 && ac.date_arret === "2027-05-26" && ac.date_remise);
  r = await call("POST", "/api/forms?action=admin-reglages", { cle: "cheminement", valeur: "1. Fiche du mariage. Texte modifié.\n2. Suite." }, H);
  check("réglage cheminement modifié et journalisé", r.json.cheminement.indexOf("Texte modifié") > 0);
  const feuilles = require("../lib/mariage").feuillesPilotage(fiche, "Alexander et Clarisse");
  const x = require("../lib/xlsx").build(feuilles);
  check("classeur Pilotage : onglet Lisez moi en tête, puis Paramètres", feuilles[0].name === "Lisez moi" && feuilles[0].rows.length === 7 && feuilles[1].name === "Paramètres" && x.slice(0, 2).toString() === "PK" && x.length > 2000);
  const p = require("../lib/pdf").build({ title: "Fiche du call 1 · test", sections: require("../lib/checklist").fiche(fiche) });
  check("fiche PDF générée, métadonnées Yes I Do, sans trait entre les lignes", p.slice(0, 5).toString() === "%PDF-" && p.indexOf("/Author (Yes I Do)") > 0 && p.toString("latin1").indexOf("0.88 G") < 0);

  /* ---------- v1.1.1 : journal champ par champ, équipe nommée, boîte, réglages ---------- */
  r = await call("POST", "/api/forms?action=admin-journal&w=AC27", {}, H);
  const modif = (r.json.journal || []).find(l => l.operation === "Fiche du mariage modifiée");
  check("journal du mariage : la modification du cadrage donne avant 120, après 130, champ nommé", modif && modif.avant.prevu_contrat === "120" && modif.apres.prevu_contrat === "130" && /Prévu au contrat|prevu/i.test(modif.detail) && r.json.libelles.prevu_contrat, modif && modif.detail);
  check("journal du mariage : seules les lignes d'AC27", (r.json.journal || []).every(l => l.mariage_code === "AC27"));
  r = await call("POST", "/api/forms?action=admin-journal", { limit: 500 }, H);
  check("journal maître : tous les mariages, code du mariage sur chaque ligne", r.json.journal.some(l => l.mariage_code === "AC27") && r.json.journal.some(l => l.mariage_code === "AK00") && r.json.journal.some(l => !l.mariage_code));
  r = await call("POST", "/api/forms?action=admin-utilisateur", { nom: "Cécilia", role: "équipe", password: "court" }, H);
  check("accès refusé si le mot de passe est trop court", r.status === 422);
  r = await call("POST", "/api/forms?action=admin-utilisateur", { nom: "Cécilia", role: "équipe", password: "motdepasse-cecilia" }, H);
  check("accès Cécilia créé", r.status === 200 && r.json.utilisateurs.some(u => u.nom === "Cécilia" && u.role === "équipe"));
  r = await call("POST", "/api/forms?action=admin-login", { prenom: "cécilia", password: "motdepasse-cecilia" });
  check("connexion de Cécilia par son prénom", r.status === 200 && r.json.nom === "Cécilia" && r.json.role === "équipe");
  const HC = { "x-admin-token": r.json.token };
  r = await call("POST", "/api/forms?action=admin-login", { prenom: "Cécilia", password: "faux" });
  check("mauvais mot de passe de Cécilia refusé", r.status === 401);
  r = await call("POST", "/api/forms?action=admin-utilisateurs", {}, HC);
  check("l'équipe ne gère pas les accès (403)", r.status === 403);
  r = await call("POST", "/api/forms?action=admin-reglages", { cle: "ressources_equipe", valeur: "Plan | https://example.org | test" }, HC);
  check("l'équipe ne modifie aucun réglage (403)", r.status === 403);
  r = await call("POST", "/api/forms?action=admin-reglages", {}, HC);
  check("l'équipe lit les réglages communs, pas ceux de direction", r.json.ressources_equipe && r.json.ressources_direction === undefined && r.json.accuse_modele === undefined);
  r = await call("POST", "/api/forms?action=admin-reglages", { cle: "ressources_equipe", valeur: "Plan | https://example.org | test" }, H);
  check("réglage ressources de l'équipe enregistré par l'administrateur", r.json.ressources_equipe.indexOf("example.org") > 0);
  r = await call("POST", "/api/forms?action=admin-reglages", { cle: "theme_defaut", valeur: "sombre" }, H);
  check("thème par défaut sombre enregistré par l'administrateur, ressources de direction lues", r.json.theme_defaut === "sombre" && r.json.ressources_direction.indexOf("Plan de construction") === 0);
  r = await call("POST", "/api/forms?action=admin-login", { password: "test" }, { "x-forwarded-for": "10.0.0.2" });
  check("la connexion annonce le thème par défaut", r.json.theme === "sombre");
  r = await call("POST", "/api/forms?action=admin-journal", {}, H);
  check("le journal dit qui : Cécilia sur sa connexion, administrateur sur la création de l'accès", r.json.journal.some(l => l.operation === "Connexion" && l.operateur === "Cécilia") && r.json.journal.some(l => l.operation === "Accès créé" && l.operateur === "administrateur"));
  r = await call("POST", "/api/forms?action=admin-utilisateur", { nom: "Cécilia", role: "équipe", desactive: true }, H);
  check("accès désactivé, jamais supprimé", r.json.utilisateurs.some(u => u.nom === "Cécilia" && u.desactive));
  r = await call("POST", "/api/forms?action=admin-login", { prenom: "Cécilia", password: "motdepasse-cecilia" }, { "x-forwarded-for": "10.0.0.3" });
  check("un accès désactivé ne se connecte plus", r.status === 401);
  r = await call("POST", "/api/forms?action=admin-boite&w=AC27", {}, H);
  check("revérifier la boîte : état mémorisé sur le mariage, non bloquant sans Microsoft", r.json.ok && r.json.boite.ok === false && r.json.mariage.boite && r.json.mariage.boite.verifiee_le);

  /* ---------- v1.3 : liste d'invités (étapes 2 et 3 fusionnées) sur le corpus reconstitué ---------- */
  const corpus = (f) => ({ name: f, b64: fs.readFileSync(require("path").join(__dirname, "corpus", f)).toString("base64") });
  r = await call("POST", "/api/forms?action=admin-mariage&w=AC27", {}, H);
  check("sept étapes : AC27 à l'étape 2 Liste d'invités, jauge sur sept", r.json.mariage.etapes_libelles.length === 7 && r.json.mariage.etapes_libelles[1] === "Liste d'invités" && r.json.mariage.etape === 2);
  r = await call("POST", "/api/forms?action=admin-importer&w=AC27", { source: "Export Épouse", cote: "Épouse", fichiers: [corpus("Test_Yid_iPhone.vcf")] }, H);
  check("test 1 iPhone : 13 lus, 13 ajoutés, 0 connu, 6 à voir", r.status === 200 && r.json.lus === 13 && r.json.ajoutes === 13 && r.json.connus === 0 && r.json.a_voir === 6, JSON.stringify([r.json.lus, r.json.ajoutes, r.json.connus, r.json.a_voir, r.json.detail]));
  r = await call("POST", "/api/forms?action=admin-liste&w=AC27", {}, H);
  const byNom = (n) => r.json.contacts.filter(c => c.nom_repertoire === n);
  check("Miezi-Lisa : numéro préféré en principal, 2e numéro trouvé, à compléter (pas de motif)", byNom("Miezi-Lisa")[0].numero === "+33644556677" && byNom("Miezi-Lisa")[0].numero_2 === "+33750212558" && byNom("Miezi-Lisa")[0].etat === "à compléter");
  check("les six à voir, libellés état puis action", /Sans numéro : à compléter/.test(byNom("Bernard")[0].anomalies[0].libelle) && /Numéro invalide/.test(byNom("Crevette")[0].anomalies[0].libelle) && byNom("Cess").every(c => /Doublon probable avec Cess : une ou deux personnes/.test(c.anomalies[0].libelle)) && /Même numéro que Monsieur mon Mari : une seule personne/.test(byNom("Regis 1")[0].anomalies[0].libelle), r.json.contacts.filter(c => c.motifs).map(c => c.nom_repertoire + ": " + c.anomalies.map(a => a.libelle).join("|")).join(" || "));
  check("tri : lignes propres par côté puis alphabétique, à voir en bas", r.json.contacts[0].nom_repertoire === "Amy Djitte" && r.json.contacts[6].etat !== "à voir" && r.json.contacts[7].etat === "à voir");
  r = await call("POST", "/api/forms?action=admin-importer&w=AC27", { source: "Export Époux", cote: "Époux", fichiers: [corpus("Samsung_Regis.vcf")] }, H);
  check("test 2 Samsung : 6 lus, 5 ajoutés, 1 connu, 7 à voir", r.json.lus === 6 && r.json.ajoutes === 5 && r.json.connus === 1 && r.json.a_voir === 7, JSON.stringify([r.json.lus, r.json.ajoutes, r.json.connus, r.json.a_voir]));
  r = await call("POST", "/api/forms?action=admin-liste&w=AC27", {}, H);
  const djo = r.json.contacts.find(c => c.nom_repertoire === "Djoco Mabiala");
  check("Djo : mention « aussi proposé par Export Époux » et motif deux répertoires", djo.mentions.some(x => x.texte === "aussi proposé par Export Époux") && /deux répertoires/.test(djo.motifs));
  check("tuiles : 11 fiches propres (6 Épouse, 5 Époux), 7 à voir", r.json.tuiles.recues.n === 11 && r.json.tuiles.a_voir.n === 7 && r.json.tuiles.recues.cotes.epouse === 6 && r.json.contacts.filter(c => !c.desactive && c.cote === "Époux").length === 5, JSON.stringify(r.json.tuiles.recues) + " " + JSON.stringify(r.json.tuiles.a_voir));
  r = await call("POST", "/api/forms?action=admin-importer&w=AC27", { source: "Export Époux", cote: "Époux", fichiers: [corpus("Samsung_Regis.vcf")] }, H);
  check("test 3 idempotence : 6 lus, 0 ajouté, 6 connus, toujours 7 à voir", r.json.lus === 6 && r.json.ajoutes === 0 && r.json.connus === 6 && r.json.a_voir === 7, JSON.stringify([r.json.lus, r.json.ajoutes, r.json.connus, r.json.a_voir]));
  r = await call("POST", "/api/forms?action=admin-importer&w=AC27", { source: "Liste Tante Awa", cote: "Épouse", proche: "Tante Awa", fichiers: [corpus("Google_export.csv")] }, H);
  check("liste d'un proche (CSV) : 2 lus, 1 ajouté, 1 connu, quota 1 sur 12, préremplissage", r.json.lus === 2 && r.json.ajoutes === 1 && r.json.connus === 1 && r.json.quota && r.json.quota.quota === 12 && r.json.quota.recus === 1, JSON.stringify(r.json.quota) + " " + (r.json.avertissements || []).join(" "));
  r = await call("POST", "/api/forms?action=admin-liste&w=AC27", {}, H);
  const lina = r.json.contacts.find(c => c.nom_repertoire === "Lina Planner");
  check("Lina : Lien « Invité(e) d'un proche », Précision Tante Awa, fixe en 2e numéro", lina.lien === "Invité(e) d'un proche" && lina.precision === "Tante Awa" && lina.numero_2 === "+33142001122");
  /* collect v4 : reprise avec qualification, note, désactivé, contrôle, outre mer */
  r = await call("POST", "/api/forms?action=admin-importer&w=AC27", { source: "Collect v4", fichiers: [corpus("Collect_Fictif.xlsx")] }, H);
  check("collect v4 : 9 lus, 4 ajoutés, 5 déjà connus complétés par le collect", r.json.lus === 9 && r.json.ajoutes === 4 && r.json.connus === 5 && /5 ligne\(s\) déjà connue/.test(r.json.avertissements.join(" ")), JSON.stringify([r.json.lus, r.json.ajoutes, r.json.connus, r.json.avertissements]));
  r = await call("POST", "/api/forms?action=admin-liste&w=AC27", {}, H);
  { const lc = r.json.lots.find(l => l.collect); check("lot collect : nommé « les deux côtés », répartition par côté", lc && / · les deux côtés · /.test(lc.libelle) && lc.repartition && (lc.repartition.epouse + lc.repartition.epoux + lc.repartition.sans) > 0, JSON.stringify(lc && [lc.libelle, lc.repartition])); }
  const fab = r.json.contacts.find(c => c.nom_repertoire === "Fabrice Lauret"), papa = r.json.contacts.find(c => c.nom_repertoire === "Papa"), celine = r.json.contacts.find(c => /Tata Celine/.test(c.nom_repertoire)), kev = r.json.contacts.find(c => c.nom_repertoire === "Kevin Frère");
  check("Fabrice : +262 gardé, côté et qualification du collect, note de cellule conservée, complet avec clé AC…", fab.numero === "+262693205405" && fab.cote === "Épouse" && fab.invitation === "Invitation pour deux" && fab.nb_enfants === 2 && /Indicatif corrigé/.test(fab.note) && fab.etat === "complète" && /^AC\d{3}$/.test(fab.cle), JSON.stringify([fab.etat, fab.cle, fab.manque]));
  check("Papa : désactivé dans le collect, désactivé ici, sans clé", papa.desactive && !papa.cle);
  check("Tata Celine : sans numéro mais numéro dans le nom, proposition +33667079264, motif du collect repris", celine.anomalies.some(a => a.type === "numéro dans le nom" && a.propositions && a.propositions[0] === "+33667079264") && celine.anomalies.some(a => a.type === "repris du collect"), JSON.stringify(celine.anomalies));
  check("Kevin Frère (connu de l'export Samsung) : lien Frère / Sœur repris du collect, à compléter (invitation, enfants), pas de clé", kev.lien === "Frère / Sœur" && kev.etat === "à compléter" && kev.manque.includes("invitation") && kev.manque.includes("enfants") && !kev.cle, JSON.stringify([kev.lien, kev.manque]));
  /* qualification */
  r = await call("POST", "/api/forms?action=admin-qualifier&w=AC27", { id: kev.id, champs: { invitation: "Invitation unique", nb_enfants: 0, hebergement: "Oui" } }, H);
  r = await call("POST", "/api/forms?action=admin-liste&w=AC27", {}, H);
  const kev2 = r.json.contacts.find(c => c.id === kev.id);
  check("Kevin qualifié : complet, clé posée, journal Ligne qualifiée", kev2.etat === "complète" && /^AC\d{3}$/.test(kev2.cle) && kev2.cle !== fab.cle);
  r = await call("POST", "/api/forms?action=admin-qualifier&w=AC27", { id: kev.id, champs: { lien: "Autre", precision: "" } }, H);
  r = await call("POST", "/api/forms?action=admin-liste&w=AC27", {}, H);
  check("Lien Autre sans précision : redevient à compléter, la clé reste", r.json.contacts.find(c => c.id === kev.id).etat === "à compléter" && r.json.contacts.find(c => c.id === kev.id).cle === kev2.cle);
  r = await call("POST", "/api/forms?action=admin-qualifier&w=AC27", { id: kev.id, champs: { nb_enfants: 9 } }, H);
  check("enfants hors bornes refusé", r.status === 422);
  /* décisions groupées */
  r = await call("POST", "/api/forms?action=admin-liste&w=AC27", {}, H);
  const cessIds = r.json.contacts.filter(c => c.nom_repertoire === "Cess").map(c => c.anomalies[0].id);
  r = await call("POST", "/api/forms?action=admin-anomalie&w=AC27", { ids: cessIds, decision: "" }, H);
  check("trancher sans décision écrite : refusé", r.status === 422);
  r = await call("POST", "/api/forms?action=admin-anomalie&w=AC27", { ids: cessIds, decision: "Même personne, le second numéro est faux" }, H);
  check("deux anomalies tranchées d'un coup", r.json.ok && r.json.contacts.filter(c => c.nom_repertoire === "Cess").every(c => c.etat !== "à voir"));
  const cess2 = r.json.contacts.filter(c => c.nom_repertoire === "Cess")[1];
  r = await call("POST", "/api/forms?action=admin-contact&w=AC27", { ids: [cess2.id], desactive: true, motif: "" }, H);
  check("désactiver sans motif : refusé", r.status === 422);
  r = await call("POST", "/api/forms?action=admin-contact&w=AC27", { ids: [cess2.id], desactive: true, motif: "faux numéro" }, H);
  check("ligne désactivée avec motif, jamais supprimée", r.json.contacts.some(c => c.id === cess2.id && c.desactive && c.motif_desactivation === "faux numéro"));
  r = await call("POST", "/api/forms?action=admin-nommer&w=AC27", { id: celine.id, nom: "Tata Céline" }, H);
  r = await call("POST", "/api/forms?action=admin-numero&w=AC27", { id: celine.id, numero: "0667079264" }, H);
  r = await call("POST", "/api/forms?action=admin-liste&w=AC27", {}, H);
  const cel2 = r.json.contacts.find(c => c.id === celine.id);
  check("Tata Céline nommée et numéro appliqué : +33667079264, plus d'anomalie, correction annotée", cel2.nom_repertoire === "Tata Céline" && cel2.numero === "+33667079264" && cel2.etat !== "à voir" && cel2.corrections.length >= 2, JSON.stringify([cel2.etat, cel2.motifs]));
  const lotEmail = r.json.lots.find(l => l.source === "Liste Tante Awa");
  r = await call("POST", "/api/forms?action=admin-lot&w=AC27", { id: lotEmail.id, cote: "Époux" }, H);
  check("source corrigée : côté reporté sur les lignes du lot", r.json.lots.find(l => l.id === lotEmail.id).cote === "Époux" && r.json.contacts.filter(c => c.lot_id === lotEmail.id).every(c => c.cote === "Époux"));
  r = await call("POST", "/api/forms?action=admin-etape&w=AC27", { n: 2 }, H);
  check("terminer l'étape 2 avec des lignes rouges ou orange : refusé avec le compte", r.status === 422 && /ligne\(s\) ne sont pas encore vertes/.test(r.json.detail), r.json.detail);
  r = await call("POST", "/api/forms?action=admin-export-liste&w=AC27", {}, H);
  check("export du collect dans la matrice v4", r.json.ok && /^Collect Alexander et Clarisse/.test(r.json.nom) && Buffer.from(r.json.b64, "base64").slice(0, 2).toString() === "PK");
  /* déduction du côté d'un lot arrivé par email */
  const listeMod = require("../lib/liste");
  const mAC = await require("../lib/store").mariageFresh("AC27");
  const vcf3 = require("../lib/vcf").lire(fs.readFileSync(require("path").join(__dirname, "corpus", "Test_Yid_iPhone.vcf")), "x.vcf", "");
  const vcf21 = require("../lib/vcf").lire(fs.readFileSync(require("path").join(__dirname, "corpus", "Samsung_Regis.vcf")), "x.vcf", "");
  const mTel = Object.assign({}, mAC, { parametres: Object.assign({}, mAC.parametres, { checklist: Object.assign({}, mAC.parametres.checklist, { email_epoux: "alex@example.com", email_epouse: "clarisse@example.com", telephone_epoux: "iPhone", telephone_epouse: "Android" }) }) });
  check("côté déduit de l'expéditeur (C5, C6)", listeMod.deduire(mTel, { expediteur: "Clarisse@Example.com" }, vcf3).cote === "Épouse" && listeMod.deduire(mTel, { expediteur: "alex@example.com" }, vcf21).cote === "Époux");
  check("côté déduit du format du fichier croisé avec les téléphones déclarés", listeMod.deduire(mTel, { expediteur: "inconnu@example.com" }, vcf3).cote === "Époux" && listeMod.deduire(mTel, { expediteur: "inconnu@example.com" }, vcf21).cote === "Épouse");
  check("expéditeur reconnu comme proche déclaré", listeMod.deduire(mTel, { expediteur: "tante.awa@example.com", expediteur_nom: "Tante Awa" }, vcf3).proche === "Tante Awa");
  /* rôles et remise à zéro */
  r = await call("POST", "/api/forms?action=admin-utilisateur", { nom: "Inès", role: "équipe", password: "motdepasse-ines" }, H);
  r = await call("POST", "/api/forms?action=admin-login", { prenom: "Inès", password: "motdepasse-ines" }, { "x-forwarded-for": "10.0.0.4" });
  const HI = { "x-admin-token": r.json.token };
  r = await call("POST", "/api/forms?action=admin-declarer&w=AC27", { data: fiche }, HI);
  check("équipe : le cadrage ne se modifie pas (403)", r.status === 403);
  r = await call("POST", "/api/forms?action=admin-reglages", { cle: "cheminement", valeur: "x" }, HI);
  check("équipe : aucun réglage ne se modifie (403)", r.status === 403);
  r = await call("POST", "/api/forms?action=admin-vider&w=AC27", { confirmation: "AC27" }, HI);
  check("équipe : pas de remise à zéro (403)", r.status === 403);
  r = await call("POST", "/api/forms?action=admin-qualifier&w=AC27", { id: kev.id, champs: { lien: "Ami(e)" } }, HI);
  check("équipe : qualifie une ligne, à son nom au journal", r.json.ok);
  r = await call("POST", "/api/forms?action=admin-vider&w=AC27", { confirmation: "faux" }, H);
  check("remise à zéro sans le code du mariage : refusée", r.status === 422);
  r = await call("POST", "/api/forms?action=admin-vider&w=AC27", { confirmation: "AC27" }, H);
  check("remise à zéro : liste vide, rien parmi les désactivées, aucun lot visible", r.json.ok && r.json.contacts.length === 0 && r.json.lots.length === 0 && r.json.tuiles.a_voir.n === 0 && r.json.tuiles.desactives.n === 0);
  r = await call("POST", "/api/forms?action=admin-importer&w=AC27", { source: "Export Épouse", cote: "Épouse", fichiers: [corpus("Test_Yid_iPhone.vcf")] }, H);
  check("après remise à zéro, le même export s'importe comme neuf : 13 ajoutés", r.json.ajoutes === 13 && r.json.connus === 0);
  r = await call("POST", "/api/forms?action=admin-journal&w=AC27", {}, H);
  check("journal : Contacts reçus, Collect v4 repris, Ligne qualifiée, Anomalie tranchée, Ligne désactivée, Fiche nommée, Numéro appliqué, Source corrigée, Liste exportée, Liste remise à zéro", ["Contacts reçus", "Collect v4 repris", "Ligne qualifiée", "Anomalie tranchée", "Ligne désactivée", "Fiche nommée", "Numéro appliqué", "Source corrigée", "Collect exporté", "Liste remise à zéro"].every(o => r.json.journal.some(l => l.operation === o)) && r.json.journal.some(l => l.operation === "Ligne qualifiée" && l.operateur === "Inès"));
  r = await call("POST", "/api/forms?action=admin-archive&w=AC27", {}, H);
  check("archive de la remise à zéro consultable par un administrateur, invisible ailleurs", r.json.ok && r.json.archive.length > 20);
  r = await call("POST", "/api/forms?action=admin-archive&w=AC27", {}, HI);
  check("archive refusée à l'équipe (403)", r.status === 403);
  r = await call("POST", "/api/forms?action=admin-liste&w=AC27", {}, H);
  check("lots numérotés et nommés, familles doublon et numéro distinguées", /^Lot \d+ · Épouse · /.test(r.json.lots[0].libelle) && r.json.tuiles.doublons.n === 4 && r.json.tuiles.numeros.n === 2 && r.json.contacts.find(c => c.nom_repertoire === "Cess").famille === "doublon" && r.json.contacts.find(c => c.nom_repertoire === "Crevette").famille === "numéro", JSON.stringify([r.json.lots[0].libelle, r.json.tuiles.doublons, r.json.tuiles.numeros]));
  {
    const ids3 = r.json.contacts.filter(c => !c.desactive).slice(0, 3).map(c => c.id);
    let g = await call("POST", "/api/forms?action=admin-qualifier-groupe&w=AC27", { ids: ids3, champs: { invitation: "Invitation pour deux" } }, H);
    check("qualification groupée : la même invitation sur 3 lignes cochées", g.json.ok && ids3.every(id => g.json.contacts.find(c => c.id === id).invitation === "Invitation pour deux"));
    g = await call("POST", "/api/forms?action=admin-qualifier-groupe&w=AC27", { ids: ids3, champs: { cote: "Époux" } }, H);
    check("qualification groupée : un champ hors liste est refusé", g.status === 422);
    const L = require("../lib/liste"), rg = { periodes: ["Mairie", "Vin d'honneur", "Soirée"], enfants: "sans", hebergement: "aucun", lieux: [] }, base = { cote: "Épouse", invitation: "Invitation unique", lien: "Ami(e)" };
    check("présence à plusieurs moments : une liste suffit, l'ancienne présence unique reste lue, aucune présence = il manque",
      !L.manque(Object.assign({ qualification: { periodes: ["Mairie", "Soirée"] } }, base), rg).includes("présence") && !L.manque(Object.assign({ qualification: { periode: "Soirée" } }, base), rg).includes("présence") && L.manque(Object.assign({ qualification: {} }, base), rg).includes("présence"));
  }
  const vide = "BEGIN:VCARD\r\nVERSION:3.0\r\nN:;;;;\r\nFN:\r\nEND:VCARD\r\nBEGIN:VCARD\r\nVERSION:3.0\r\nFN:Zoé\r\nTEL;type=CELL:+33 6 00 00 00 01\r\nEND:VCARD\r\n";
  r = await call("POST", "/api/forms?action=admin-importer&w=AC27", { source: "", cote: "", fichiers: [{ name: "Contacts épouse.vcf", b64: Buffer.from(vide).toString("base64") }] }, H);
  check("pare feu : la fiche vide est ignorée et comptée, le côté est lu dans le nom du fichier", r.json.lus === 1 && r.json.vides === 1 && r.json.cote === "Épouse" && /nom du fichier/.test(r.json.deduction), JSON.stringify([r.json.lus, r.json.vides, r.json.cote, r.json.deduction]));
  check("déduction par l'objet de l'email", listeMod.deduire(mTel, { expediteur: "x@y.z", objet: "Contacts côté époux" }, vcf21).cote === "Époux");
  const p2 = require("../lib/telephone");
  check("normalisation : outre mer, +33 sur un 0693 corrigé, pays déduit sans +, pays incertain, fixe, invalide", p2.normaliser("0690 12 34 56", "FR").numero === "+590690123456" && /remplacé par \+262/.test(p2.normaliser("+33 6 93 20 54 05", "FR").correction) && /Sénégal/.test(p2.normaliser("221771234567", "FR").correction) && p2.normaliser("01 42 00 00 00", "FR").statut === "fixe probable" && p2.normaliser("12", "FR").statut === "invalide");
  r = await call("POST", "/api/forms?action=admin-reglages", {}, H);
  check("réglages : modèle d'accusé de réception et interrupteur présents", /fichier de contacts nous est bien parvenu/.test(r.json.accuse_modele) && r.json.accuse_actif === "Oui");

  console.log(ko ? `\n${ko} contrôle(s) en échec sur ${n}` : `\n${n} contrôles, tout est vert`);
  process.exit(ko ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
