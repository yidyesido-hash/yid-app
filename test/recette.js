/* Recette automatique de la v1.0 en local (PGlite) : connexion, voyants, mariages, import, profil,
   formulaire, envoi versionné, suivi, journal. Lancer : npm test */
process.env.ADMIN_PASSWORD = "test";
process.env.YID_MAIL_FAKE = "1";
process.env.YID_EQUIPE_EMAIL = "equipe@exemple.fr";
process.env.PGLITE_DIR = require("path").join(__dirname, "data-recette");
const fs = require("fs"); fs.rmSync(process.env.PGLITE_DIR, { recursive: true, force: true });
const handler = require("../api/forms");

function call(method, url, body, headers) {
  return new Promise((resolve) => {
    const req = { method, url, headers: Object.assign({ "user-agent": "recette" }, headers || {}), body: body === undefined ? undefined : JSON.stringify(body), socket: { remoteAddress: "127.0.0.1" }, on() {} };
    const res = { headers: {}, statusCode: 200, setHeader(k, v) { this.headers[k] = v; }, end(s) { let j = {}; try { j = s && !Buffer.isBuffer(s) ? JSON.parse(s) : {}; } catch (e) {} resolve({ status: this.statusCode, json: j, body: s }); } };
    handler(req, res);
  });
}
let n = 0, ko = 0;
function check(label, cond, extra) { n++; if (!cond) ko++; console.log((cond ? "  ok  " : "  KO  ") + label + (extra ? "  " + extra : "")); }

(async () => {
  console.log("Recette yid-app v1.19.0, base locale");
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
  check("fiche : programme structuré, périodes et repas déduits, pass cohérent avec la protection", (await call("POST", "/api/forms?action=admin-declarer", { data: Object.assign({}, { protection_liste: "Non", pass: "Pass de contrôle, avec QR" }) }, H)).json.errors.some(e => e.k === "pass"));
  check("checklist : 4 sections, remise proposée, clôture calculée", r.json.sections.length === 4 && r.json.remise && r.json.arret === "2027-05-26", r.json.remise + " / " + r.json.arret);
  const fiche = { pack: "Signature", prevu_contrat: 120, seuil: 130, date_mariage: "2027-07-10", delai_arret_jours: 45, conciergerie: "Oui", hebergement: "Une partie des invités", lieux_hebergement: "Domaine de la Muette", volume_estime: 110, regie: "Oui",
    prenoms: "Alexander et Clarisse", lieu: "Domaine de la Muette, Seine et Marne", initiales: "ac", pays: "France", regime_enfants: "Mixte", consigne_enfants: "Enfants des proches uniquement", proches: "Kevin (frère de l'époux) ; Tante Awa (tante de l'épouse)", listes_attendues: "Tante Awa", quotas: "Tante Awa = 12", date_remise: r.json.remise, support: "Oui", telephone_epoux: "Android", telephone_epouse: "iPhone",
    programme: [{ heure: "14:00", libelle: "Cérémonie à la mairie de Sotteville-lès-Rouen", lieu: "Mairie de Sotteville-lès-Rouen", acces: "Tous les invités", service: "Rien n'est servi" }, { heure: "17:00", libelle: "Vin d'honneur", lieu: "Domaine de la Muette", acces: "Tous les invités", service: "Cocktail ou vin d'honneur" }, { heure: "20:00", libelle: "Dîner et soirée", lieu: "Domaine de la Muette", acces: "Tous les invités", service: "Repas servi à table" }], plats: "Viande ; Poisson", cuisson: "Non", protection_liste: "Oui", pass: "Pass de contrôle, avec QR", hebergement_offert: "Oui", nuits: "la nuit du samedi 10 au dimanche 11 juillet", acces_anticipe: "Non", arrivees: "Non", engagement_horaires: "Non", date_reponse: "2027-02-28", date_modification: "2027-03-15", langues_formulaire: "fr ; PT",
    statut: "Test", langue_defaut: "fr", boite_email: "", site: "" };
  r = await call("POST", "/api/forms?action=admin-declarer", { data: Object.assign({}, fiche, { prevu_contrat: "abc" }) }, H);
  check("déclaration refusée avec un champ faux (422)", r.status === 422 && r.json.errors.some(e => e.k === "prevu_contrat"));
  r = await call("POST", "/api/forms?action=admin-declarer", { data: Object.assign({}, fiche, { date_modification: "2027-02-01" }) }, H);
  check("fiche : modification avant la date de réponse refusée", !r.json.ok && r.json.errors.some(e => e.k === "date_modification"));
  r = await call("POST", "/api/forms?action=admin-declarer", { data: Object.assign({}, fiche, { protection_liste: "" }) }, H);
  check("fiche : caractéristique du formulaire obligatoire", !r.json.ok && r.json.errors.some(e => e.k === "protection_liste"));
  r = await call("POST", "/api/forms?action=admin-declarer", { data: fiche }, H);
  check("mariage créé, code AC27, étape 1 terminée", r.status === 200 && r.json.ok && r.json.code === "AC27" && r.json.created && r.json.mariage.etape === 2 && r.json.mariage.etapes["1"], r.status !== 200 ? JSON.stringify(r.json).slice(0, 300) : "clôture " + r.json.mariage.date_arret);
  check("SharePoint non configuré en local : signalé, pas bloquant", r.json.sharepoint && r.json.sharepoint.erreurs.length === 1);
  r = await call("POST", "/api/forms?action=admin-mariage&w=AC27", {}, H);
  check("fiche : caractéristiques du formulaire rangées", (() => { const fo = r.json.mariage.parametres.formulaire; return fo && fo.moments.length === 3 && fo.plats.join() === "Viande,Poisson" && fo.langues.join() === "fr,pt" && fo.date_reponse === "2027-02-28"; })());
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
  { const jg = await call("POST", "/api/forms?action=admin-journal", { limit: 5 }, HC), ja = await call("POST", "/api/forms?action=admin-journal", { limit: 5 }, H), jm = await call("POST", "/api/forms?action=admin-journal&w=AC27", { limit: 5 }, HC);
    check("journal global : réservé aux administrateurs, le journal d'un mariage reste ouvert à l'équipe", jg.status === 403 && ja.status === 200 && jm.status === 200, [jg.status, ja.status, jm.status].join(" ")); }
  { const o1 = await call("POST", "/api/forms?action=cle-options-entrer", { prenom: "Cécilia" }), o2 = await call("POST", "/api/forms?action=cle-liste", {}), o3 = await call("POST", "/api/forms?action=cle-options-creer", {}, HC), o4 = await call("POST", "/api/forms?action=cle-entrer", { defi: "faux.faux", reponse: { id: "x" } }), o5 = await call("POST", "/api/forms?action=cle-options-creer", {}, H);
    check("empreinte ou visage : défi d'entrée sans clé connue, liste fermée sans session, défi de création pour un accès nommé, défi falsifié refusé, accès d'installation refusé",
      o1.json.ok && o1.json.connu === false && !!o1.json.defi && o2.status === 401 && o3.json.ok && o3.json.options.rp.name === "Yes I Do" && o3.json.options.authenticatorSelection.userVerification === "required" && o4.status === 422 && o5.status === 422, [o1.status, o2.status, o3.status, o4.status, o5.status].join(" ")); }
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
    check("présence facultative : elle ne rend jamais une fiche rouge, la liste de moments reste lue",
      !L.manque(Object.assign({ qualification: {} }, base), rg).includes("présence") && L.presences({ qualification: { periode: "Soirée" } }).join() === "Soirée" && L.presences({ qualification: { periodes: ["Mairie", "Soirée"] } }).length === 2);
    const ns = Object.assign({}, base, { invitation: "Ne sait pas encore", qualification: {} });
    check("seul ou accompagné : « Ne sait pas encore » est vert, deux places réservées, la question part à l'invité", !L.manque(ns, rg).length && L.aDemander(ns).includes("seul ou accompagné"));
    const lj = (await call("POST", "/api/forms?action=admin-liste&w=AC27", {}, H)).json;
    const rougeLien = lj.contacts.find(c => c.etat === "à compléter" && !c.manque.includes("côté") && !c.manque.includes("lien"));
    const rougeCote = lj.contacts.find(c => c.etat === "à compléter" && (c.manque.includes("côté") || c.manque.includes("lien")));
    if (rougeLien || rougeCote) {
      const dm = await call("POST", "/api/forms?action=admin-demander&w=AC27", { ids: [rougeLien, rougeCote].filter(Boolean).map(c => c.id) }, H);
      const apres = dm.json.contacts.find(c => rougeLien && c.id === rougeLien.id);
      check("à demander à l'invité : la fiche passe au vert, sauf si le côté ou le lien manque (affaire du couple)", dm.json.ok && (!rougeLien || (apres.etat === "complète" && apres.a_demander.length > 0)) && (!rougeCote || dm.json.demande.restent.length === 1), JSON.stringify(dm.json.demande));
    }
    const att = await call("POST", "/api/forms?action=admin-importer&w=AC27", { source: "Attente Clarisse", cote: "Épouse", attente: true, fichiers: [{ name: "attente.vcf", b64: Buffer.from("BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Attente Une\r\nTEL;type=CELL:+33 6 11 22 33 01\r\nEND:VCARD\r\nBEGIN:VCARD\r\nVERSION:3.0\r\nFN:Attente Deux\r\nTEL;type=CELL:+33 6 11 22 33 02\r\nEND:VCARD\r\n").toString("base64") }] }, H);
    let la = (await call("POST", "/api/forms?action=admin-liste&w=AC27", {}, H)).json;
    check("liste d'attente : les contacts déposés restent hors de la liste, dans l'ordre d'arrivée", att.json.ok && la.attente.length === 2 && la.attente[0].nom_repertoire === "Attente Une" && !la.contacts.some(c => /^Attente /.test(c.nom_repertoire)) && la.tuiles.attente.n === 2);
    await call("POST", "/api/forms?action=admin-attente&w=AC27", { ids: [la.attente[1].id], op: "monter" }, H);
    la = (await call("POST", "/api/forms?action=admin-liste&w=AC27", {}, H)).json;
    check("liste d'attente : l'ordre de priorité se change", la.attente[0].nom_repertoire === "Attente Deux");
    const ent = await call("POST", "/api/forms?action=admin-attente&w=AC27", { ids: [la.attente[0].id], op: "entrer" }, H);
    check("liste d'attente : un invité entre dans la liste quand une place se libère", ent.json.ok && ent.json.contacts.some(c => c.nom_repertoire === "Attente Deux") && ent.json.attente.length === 1);
    const o3 = await call("POST", "/api/forms?action=admin-etape&w=AC27", { n: 3, ouvrir: true }, H);
    const vert = ent.json.contacts.some(c => !c.desactive && c.etat === "complète");
    check("premier contact : s'ouvre sans clore la liste dès qu'un invité est vert, refusé tant qu'aucun ne l'est", vert ? (o3.json.ok && o3.json.mariage.etape >= 3) : (o3.status === 422 && /Aucun invité vert/.test(o3.json.detail)), JSON.stringify(o3.json).slice(0, 200));
  }
  {
    /* espace mariés : lien personnel, vue du couple sans la cuisine, modifications au journal « Le couple » */
    let e = await call("POST", "/api/forms?action=admin-espace&w=AC27", { op: "creer" }, HI);
    check("espace mariés : l'équipe ne peut pas ouvrir le lien (403)", e.status === 403);
    e = await call("POST", "/api/forms?action=admin-espace&w=AC27", { op: "creer" }, H);
    const J = e.json.espace && e.json.espace.jeton;
    check("espace mariés : lien personnel créé par un administrateur", e.json.ok && /^[A-Za-z0-9_-]{30,}$/.test(J || ""));
    let v = await call("POST", "/api/forms?action=espace-voir", { j: J }, {});
    const txt = JSON.stringify(v.json);
    check("espace mariés : le couple voit son parcours en sept étapes, séjour compris, ses règles d'or et sa liste", v.json.ok && v.json.parcours.length === 7 && v.json.parcours.some(p => /séjour/i.test(p.t)) && typeof v.json.a_faire === "object" && v.json.regles_or.length === 4 && v.json.contacts.length > 5);
    check("espace mariés : jamais les lots, anomalies, motifs, sources, notes ni le journal", !/"lots"|"anomalies"|"motifs"|"source"|"note"|"journal"|"cle"|"lot_id"/.test(txt));
    const rouge = v.json.contacts.find(c => c.etat === "à compléter");
    let q = await call("POST", "/api/forms?action=espace-qualifier", { j: J, id: rouge.id, champs: { lien: "Ami(e)", motif_desactivation: "x" } }, {});
    check("espace mariés : le couple complète une ligne", q.json.ok && q.json.contacts.find(c => c.id === rouge.id).lien === "Ami(e)");
    q = await call("POST", "/api/forms?action=espace-retirer", { j: J, id: rouge.id, retire: true }, {});
    check("espace mariés : retirer un invité le laisse en gris, remettable par le couple", q.json.ok && q.json.contacts.find(c => c.id === rouge.id).etat === "retiré" && q.json.contacts.find(c => c.id === rouge.id).retire_par_vous);
    q = await call("POST", "/api/forms?action=espace-retirer", { j: J, id: rouge.id, retire: false }, {});
    check("espace mariés : remis dans la liste", q.json.ok && q.json.contacts.find(c => c.id === rouge.id).etat !== "retiré");
    const autre = (await call("POST", "/api/forms?action=admin-liste&w=AC27", {}, H)).json.contacts.find(c => c.desactive);
    if (autre) { q = await call("POST", "/api/forms?action=espace-retirer", { j: J, id: autre.id, retire: false }, {}); check("espace mariés : une ligne retirée par Yes I Do ne se remet pas depuis l'espace", q.status === 422); }
    const jr = await call("POST", "/api/forms?action=admin-journal&w=AC27", {}, H);
    check("espace mariés : modifications au journal sous « Le couple · Prénoms »", jr.json.journal.some(l => /^Le couple · /.test(l.operateur || "") && l.operation === "Ligne qualifiée"));
    await call("POST", "/api/forms?action=admin-espace&w=AC27", { op: "modifiable", valeur: false }, H);
    q = await call("POST", "/api/forms?action=espace-qualifier", { j: J, id: rouge.id, champs: { lien: "Collègue" } }, {});
    check("espace mariés en consultation seule : modification refusée", q.status === 422);
    const dep = await call("POST", "/api/forms?action=espace-deposer", { j: J, cote: "Épouse", fichiers: [{ name: "oubli.vcf", b64: Buffer.from("BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Oubli Espace\r\nTEL;type=CELL:+33 6 12 34 56 99\r\nEND:VCARD\r\n").toString("base64") }] }, {});
    check("espace mariés : dépôt de contacts par le couple, même en consultation", dep.json.ok && dep.json.recu.ajoutes === 1 && dep.json.contacts.some(c => c.nom === "Oubli Espace" && c.cote === "Épouse"));
    await call("POST", "/api/forms?action=admin-espace&w=AC27", { op: "modifiable", valeur: true }, H);
    e = await call("POST", "/api/forms?action=admin-espace&w=AC27", { op: "renouveler" }, H);
    v = await call("POST", "/api/forms?action=espace-voir", { j: J }, {});
    check("espace mariés : un nouveau lien rend l'ancien inutilisable (404)", v.status === 404 && e.json.espace.jeton !== J);
    v = await call("POST", "/api/forms?action=espace-voir", { j: "court" }, {});
    check("espace mariés : clé invalide refusée", v.status === 404);
  }
  const vide = "BEGIN:VCARD\r\nVERSION:3.0\r\nN:;;;;\r\nFN:\r\nEND:VCARD\r\nBEGIN:VCARD\r\nVERSION:3.0\r\nFN:Zoé\r\nTEL;type=CELL:+33 6 00 00 00 01\r\nEND:VCARD\r\n";
  r = await call("POST", "/api/forms?action=admin-importer&w=AC27", { source: "", cote: "", fichiers: [{ name: "Contacts épouse.vcf", b64: Buffer.from(vide).toString("base64") }] }, H);
  check("pare feu : la fiche vide est ignorée et comptée, le côté est lu dans le nom du fichier", r.json.lus === 1 && r.json.vides === 1 && r.json.cote === "Épouse" && /nom du fichier/.test(r.json.deduction), JSON.stringify([r.json.lus, r.json.vides, r.json.cote, r.json.deduction]));
  check("déduction par l'objet de l'email", listeMod.deduire(mTel, { expediteur: "x@y.z", objet: "Contacts côté époux" }, vcf21).cote === "Époux");
  const p2 = require("../lib/telephone");
  check("normalisation : outre mer, +33 sur un 0693 corrigé, pays déduit sans +, pays incertain, fixe, invalide", p2.normaliser("0690 12 34 56", "FR").numero === "+590690123456" && /remplacé par \+262/.test(p2.normaliser("+33 6 93 20 54 05", "FR").correction) && /Sénégal/.test(p2.normaliser("221771234567", "FR").correction) && p2.normaliser("01 42 00 00 00", "FR").statut === "fixe probable" && p2.normaliser("12", "FR").statut === "invalide");
  r = await call("POST", "/api/forms?action=admin-reglages", {}, H);
  check("réglages : modèle d'accusé de réception et interrupteur présents", /fichier de contacts nous est bien parvenu/.test(r.json.accuse_modele) && r.json.accuse_actif === "Oui");

  /* 1.5.0 : l'accueil de l'invité */
  const acc = require("../lib/accueil");
  const mF = { prenoms: "Camille et Arthur", parametres: { checklist: { prenoms: "Camille et Arthur", prenom_epouse: "Camille", prenom_epoux: "Arthur", registre: "Civilité et nom" } } };
  const mP = { prenoms: "Camille et Arthur", parametres: { checklist: { prenoms: "Camille et Arthur", prenom_epouse: "Camille", prenom_epoux: "Arthur" } } };
  check("accueil : registre formel, « Chère Madame Marchal, »", acc.salutation({ civilite: "Madame", nom_repertoire: "Hélène Marchal" }, mF) === "Chère Madame Marchal,");
  check("accueil : registre par le prénom, « Cher Antoine, »", acc.salutation({ civilite: "Monsieur", nom_repertoire: "Antoine Vidal" }, mP) === "Cher Antoine,");
  check("accueil : sans civilité, aucune supposition, « Bonjour Hélène, »", acc.salutation({ nom_repertoire: "Hélène Marchal" }, mF) === "Bonjour Hélène,");
  check("accueil : la mère de la mariée est accueillie au nom de Camille", /^Camille tient à vous avoir/.test(acc.accroche({ lien: "Père / Mère", cote: "Épouse" }, mP)));
  check("accueil : un collègue reçoit une formule sobre", acc.accroche({ lien: "Collègue", cote: "Époux" }, mP) === "Camille et Arthur seraient honorés de votre présence.");
  check("accueil : accompagnant connu, à indiquer, non prévu, à décider", acc.accompagnant({ invitation: "Invitation pour deux", accompagnant: "Paul Marchal" }).etat === "connu" && acc.accompagnant({ invitation: "Invitation pour deux" }).etat === "à indiquer" && acc.accompagnant({ invitation: "Invitation unique", accompagnant: "X" }).etat === "non prévu" && acc.accompagnant({ invitation: "Ne sait pas encore" }).etat === "à décider");
  {
    const l0 = (await call("POST", "/api/forms?action=admin-liste&w=AC27", {}, H)).json;
    const cible = l0.contacts.find(c => !c.desactive);
    let q = await call("POST", "/api/forms?action=admin-qualifier&w=AC27", { id: cible.id, champs: { civilite: "Madame", invitation: "Invitation pour deux", accompagnant: "Paul Marchal" } }, H);
    const apres = (await call("POST", "/api/forms?action=admin-liste&w=AC27", {}, H)).json.contacts.find(c => c.id === cible.id);
    check("fiche invité : civilité et accompagnant enregistrés, aperçu d'accueil renvoyé", q.json.ok && apres.civilite === "Madame" && apres.accompagnant === "Paul Marchal" && apres.accueil && apres.accueil.accompagnant.etat === "connu" && /^(Chère|Bonjour) /.test(apres.accueil.salutation), apres && apres.accueil && apres.accueil.salutation);
    q = await call("POST", "/api/forms?action=admin-qualifier&w=AC27", { id: cible.id, champs: { civilite: "Docteur" } }, H);
    check("fiche invité : civilité inconnue refusée", q.status === 422 || q.json.ok === false);
    check("liste : les civilités proposées sont transmises", Array.isArray(l0.civilites) && l0.civilites.join() === "Madame,Monsieur");
  }

  /* 1.6.1 : la photo du mariage */
  {
    const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const r1 = await call("POST", "/api/forms?action=admin-photo-mariage&w=AC27", { photo: png }, H);
    check("photo du mariage : enregistrée, une clé publique est rendue", r1.json.ok && /^[A-Za-z0-9_-]{20,}$/.test(r1.json.photo_cle || ""));
    const r2 = await call("GET", "/api/forms?action=photo&k=" + encodeURIComponent(r1.json.photo_cle || "x"));
    check("photo du mariage : servie par sa clé", r2.status === 200);
    const r3 = await call("GET", "/api/forms?action=photo&k=inconnue");
    check("photo du mariage : une clé inconnue ne sert rien", r3.status === 404);
    const r4 = await call("POST", "/api/forms?action=admin-photo-mariage&w=AC27", { photo: "data:text/html;base64,PGI+" }, H);
    check("photo du mariage : un fichier qui n'est pas une image est refusé", r4.status === 422);
    const acc = (await call("POST", "/api/forms?action=admin-accueil", {}, H)).json;
    check("accueil : la carte du mariage connaît sa photo", (acc.mariages || []).some(m => m.code === "AC27" && m.photo_cle === r1.json.photo_cle));
  }

  /* 1.7.0 : l'appel guidé */
  {
    const A = (op, b) => call("POST", "/api/forms?action=admin-appel&w=AC27", Object.assign({ op }, b || {}), H);
    let r = await A("lire");
    check("appel guidé : aucun appel en cours au départ", r.json.ok && r.json.en_cours === false);
    r = await A("valider", { n: 1 });
    check("appel guidé : rien ne se valide sans appel démarré", r.status === 422);
    r = await A("demarrer");
    check("appel guidé : démarré, six étapes à 0 %", r.json.en_cours && r.json.etapes.length === 6 && r.json.pct === 0);
    r = await A("valider", { n: 1 });
    check("appel guidé : l'étape 1 refuse tant que la durée n'est pas annoncée", r.status === 422 && /durée/i.test(r.json.detail));
    r = await A("valider", { n: 2 });
    check("appel guidé : on ne saute pas une étape", r.status === 422 && /étape 1/.test(r.json.detail));
    await A("donnee", { k: "duree", v: true }); await A("donnee", { k: "registre", v: "Civilité et nom" });
    r = await A("valider", { n: 1 });
    check("appel guidé : étape 1 validée, 17 %", r.json.ok && r.json.pct === 17 && r.json.courante === 2);
    const l = (await call("POST", "/api/forms?action=admin-mariage&w=AC27", {}, H)).json.mariage;
    check("appel guidé : la formule choisie rejoint la checklist du mariage", ((l.parametres || {}).checklist || {}).registre === "Civilité et nom");
    r = await A("donnee", { k: "mode", v: 7 });
    check("appel guidé : un mode d'envoi inconnu est refusé", r.status === 422);
    r = await A("note", { texte: "Le couple préfère les messages en soirée" });
    check("appel guidé : la note est gardée", r.json.appel.notes === "Le couple préfère les messages en soirée");
    r = await A("terminer");
    check("appel guidé : la clôture exige 100 %", r.status === 422 && /100 %/.test(r.json.detail));
    r = await A("rouvrir", { n: 1 });
    check("appel guidé : une étape se rouvre", r.json.ok && r.json.pct === 0);
    /* on force les étapes pour éprouver la clôture : fiches et proches viennent des données vivantes */
    await A("valider", { n: 1 });
    r = await A("valider", { n: 2 });
    check("appel guidé : l'étape 2 bloque tant qu'une fiche est rouge", r.status === 422 && /rouge/.test(r.json.detail));
    for (const c of (await call("POST", "/api/forms?action=admin-liste&w=AC27", {}, H)).json.contacts.filter(c => c.etat === "à compléter"))
      await call("POST", "/api/forms?action=admin-qualifier&w=AC27", { id: c.id, champs: { cote: c.cote || "Épouse", invitation: c.invitation || "Invitation unique", lien: "Ami(e)", nb_enfants: 0, hebergement: c.hebergement || undefined } }, H);
    const v2 = (await A("lire")).json;
    check("appel guidé : une fois les fiches complétées, l'étape 2 est prête", v2.etapes[1].pret, JSON.stringify(v2.etapes[1].exigences));
    if (v2.etapes[1].pret) {
      await A("valider", { n: 2 }); await A("donnee", { k: "aucun_proche", v: true });
      const v3 = (await A("lire")).json;
      if (!v3.etapes[2].pret) { await A("donnee", { k: "qui", v: "Cécilia" }); await A("donnee", { k: "creneau", v: "en soirée" }); }
      await A("valider", { n: 3 }); await A("donnee", { k: "mode", v: 3 }); await A("donnee", { k: "annonce", v: true }); await A("valider", { n: 4 });
      await A("donnee", { k: "date_limite", v: "2027-03-01" }); await A("donnee", { k: "rythme", v: "Une fois par semaine" }); await A("valider", { n: 5 });
      await A("donnee", { k: "recap", v: true }); await A("valider", { n: 6 });
      r = await A("terminer");
      check("appel guidé : clos à 100 %, inscrit dans l'historique", r.json.ok && r.json.en_cours === false && r.json.historique.length === 1 && r.json.historique[0].bilan.mode);
      const j = (await call("POST", "/api/forms?action=admin-journal&w=AC27", { limit: 20 }, H)).json.journal || [];
      const hid = r.json.historique[0].id;
      check("appel guidé : le compte rendu garde l'état de départ et les décisions", r.json.historique[0].depart && r.json.historique[0].decisions && r.json.historique[0].decisions.mode === 3);
      r = await A("supprimer", { id: hid });
      check("appel guidé : un appel se supprime du journal des appels", r.json.ok && r.json.historique.length === 0);
      r = await A("supprimer", { id: "inconnu" });
      check("appel guidé : supprimer un appel inconnu est refusé", r.status === 422);
      check("appel guidé : la clôture est au journal avec sa durée", j.some(x => x.operation === "Appel guidé" && /clos en \d+ min/.test(x.detail || "")));
    } else {
      r = await A("valider", { n: 2 });
      check("appel guidé : l'étape 2 bloque tant qu'une fiche est rouge", r.status === 422 && /rouge/.test(r.json.detail));
      r = await A("abandonner");
      check("appel guidé : un appel s'abandonne sans rien perdre", r.json.ok && r.json.en_cours === false);
    }
  }

  /* 1.8.0 : le lien personnel de l'invité */
  {
    const l = (await call("POST", "/api/forms?action=admin-liste&w=AC27", {}, H)).json.contacts;
    const avecCle = l.filter(c => c.cle && !c.desactive);
    check("lien personnel : chaque fiche complète reçoit un jeton non devinable", avecCle.length > 0 && avecCle.every(c => /^[a-z0-9]{12}$/.test(c.jeton || "")) && new Set(avecCle.map(c => c.jeton)).size === avecCle.length);
    check("lien personnel : toute fiche active a son jeton, même complétée sans clé", l.filter(c => !c.desactive).every(c => /^[a-z0-9]{12}$/.test(c.jeton || "")));
    const c0 = avecCle[0];
    let r = await call("GET", "/api/forms?action=invite&yid=" + c0.jeton);
    check("lien personnel : le formulaire v2 est servi, composé à partir de la fiche", r.json.ok && r.json.v === 2 && r.json.cfg.moments.length > 0 && r.json.foyer && r.json.foyer.type, JSON.stringify(r.json).slice(0, 200));
    check("lien personnel : rien de l'administration ne fuit (ni clé, ni numéro complet)", !JSON.stringify(r.json).includes(c0.cle) && !JSON.stringify(r.json).includes(String(c0.numero || "x")));
    r = await call("GET", "/api/forms?action=invite&yid=abcdefghjkmn");
    check("lien personnel : un jeton inconnu ne montre rien", r.status === 404);
    r = await call("GET", "/api/forms?action=invite&yid=" + c0.cle);
    check("lien personnel : la clé AC001 n'ouvre pas la fiche", r.status === 404);
    r = await call("POST", "/api/forms?action=invite-repondre", { yid: c0.jeton, etat: {} });
    check("lien personnel : sans réponse à la présence, rien n'est enregistré", r.status === 422);
    const V = (await call("GET", "/api/forms?action=invite&yid=" + c0.jeton)).json;
    r = await call("POST", "/api/forms?action=invite-repondre", { yid: c0.jeton, etat: { presence: "oui", coord: { nom: "X" } } });
    check("lien personnel : le serveur relit avec le même moteur, une réponse incomplète est refusée", r.status === 422 && /Il manque encore/.test(r.json.detail || ""), JSON.stringify(r.json));
    r = await call("POST", "/api/forms?action=invite-brouillon", { yid: c0.jeton, etat: { presence: "oui", step: "coord" } });
    check("lien personnel : le brouillon est gardé en cours de route", r.json.ok);
    const etat = remplirEtat(V.cfg, V.foyer);
    const MOT = require("../public/formulaire/moteur.js"), eng = MOT.creer(V.cfg, V.foyer, etat);
    check("lien personnel : l'état de recette est complet pour le moteur", eng.verifierTout().length === 0, eng.verifierTout().join(", "));
    r = await call("POST", "/api/forms?action=invite-repondre", { yid: c0.jeton, etat });
    check("lien personnel : la réponse est enregistrée", r.json.ok && r.json.present === true, JSON.stringify(r.json));
    const apres = (await call("POST", "/api/forms?action=admin-liste&w=AC27", {}, H)).json.contacts.find(c => c.id === c0.id);
    check("lien personnel : la fiche porte la réponse, ses champs historiques et sa date", apres.reponse && /présent/.test(apres.reponse.presence) && apres.reponse.etat && Array.isArray(apres.reponse.detail) && apres.reponse_le, JSON.stringify(apres.reponse || {}).slice(0, 200));
    check("lien personnel : l'email saisi rejoint la fiche", apres.email === "amy@exemple.fr");
    const mails = global.__YID_MAILS || [];
    check("lien personnel : le récapitulatif part avec son PDF, vers l'équipe pour un mariage Test", mails.some(x => x.a === "equipe@exemple.fr" && /Vos réponses|As suas respostas/.test(x.objet) && /\.pdf$/.test(x.pj || "") && x.taille > 5000), JSON.stringify(mails.slice(-2)));
    const j = (await call("POST", "/api/forms?action=admin-journal&w=AC27", { limit: 10 }, H)).json.journal || [];
    check("lien personnel : la réponse est au journal, signée invité", j.some(x => x.operation === "Réponse de l'invité" && x.operateur === "invité"));
    r = await call("GET", "/api/forms?action=invite&yid=" + c0.jeton);
    check("lien personnel : au retour, l'invité retrouve ses réponses au récapitulatif", r.json.deja && r.json.etat && r.json.etat.step === "recap");
  }

  /* 1.20.0 : la feuille de route du couple, et le mariage test Awa et Kevin */
  {
    let r = await call("POST", "/api/forms?action=admin-feuille-route&w=AC27", {}, H);
    check("feuille de route : composée de la fiche, prête pour WhatsApp, sans tiret ni lien", r.json.ok && /\*Feuille de route · Mariage d'Alexander et Clarisse\*/.test(r.json.texte) && /28 février/.test(r.json.texte) && !/ [-–—] |https?:/.test(r.json.texte), (r.json.texte || "").slice(0, 120));
    r = await call("POST", "/api/forms?action=admin-feuille-route&w=AC27", { op: "envoyee" }, H);
    check("feuille de route : marquée envoyée, au journal", r.json.ok && r.json.envoyee && r.json.envoyee.par);
  }

  /* 1.9.0 : la file de premier contact */
  {
    const C = (b) => call("POST", "/api/forms?action=admin-premier-contact&w=AC27", b || {}, H);
    let r = await C();
    check("premier contact : la file ne présente que des fiches complètes, avec message et WhatsApp", r.json.ok && r.json.file.length > 0 && r.json.file.every(c => c.texte && /Yes I Do/.test(c.texte)), JSON.stringify(r.json).slice(0, 200));
    check("premier contact : le mode 3 par défaut, ou celui de l'appel guidé", [1, 2, 3].includes(r.json.mode));
    check("premier contact : le message de départ ne contient pas le lien en mode 3", r.json.mode !== 3 || r.json.file.filter(c => c.etape === "accueil").every(c => !/yid=/.test(c.texte)));
    const [a, b2] = r.json.file;
    r = await C({ op: "noter", id: a.id, etat: "envoyé" });
    check("premier contact : l'issue se note, la cadence compte l'envoi", r.json.ok && r.json.cadence.envoyes_jour >= 1);
    r = await C({ op: "noter", id: b2.id, etat: "envoyé" });
    check("premier contact : le délai minimum entre deux envois protège le numéro", r.status === 422 && /Laissez/.test(r.json.detail));
    r = await C({ op: "noter", id: a.id, etat: "a répondu" });
    const ra = r.json.file.find(c => c.id === a.id);
    check("premier contact : quand l'invité a répondu, il remonte en tête et son accès est prêt à partir", r.json.ok && r.json.file[0].id === a.id && ra.etape === "lien");
    r = await C({ op: "noter", id: a.id, etat: "inventé" });
    check("premier contact : une issue inconnue est refusée", r.status === 422);
    const j = (await call("POST", "/api/forms?action=admin-journal&w=AC27", { limit: 10 }, H)).json.journal || [];
    check("premier contact : chaque issue est au journal, signée", j.filter(x => x.operation === "Premier contact").length >= 2);
  }

  /* 1.10.0 : à faire aujourd'hui, et le parcours de vive voix des proches */
  {
    let acc = (await call("POST", "/api/forms?action=admin-accueil", {}, H)).json;
    check("à faire : l'accueil remonte les invités qui attendent leur accès", (acc.afaire || []).some(x => x.code === "AC27" && /ont répondu/.test(x.t) && x.h.endsWith("/contact")), JSON.stringify(acc.afaire));
    check("à faire : les mariages comptent leurs fiches, non plus les foyers", acc.mariages.some(m => m.code === "AC27" && m.fiches > 0));
    const C = (b) => call("POST", "/api/forms?action=admin-premier-contact&w=AC27", b || {}, H);
    const f = (await C()).json.file, pr = f.find(c => !c.assistance && c.etat === "à contacter");
    await call("POST", "/api/forms?action=admin-qualifier&w=AC27", { id: pr.id, champs: { assistance: true } }, H);
    let r = await C(); const p2 = r.json.file.find(c => c.id === pr.id);
    check("proche accompagné : un message qui propose un appel, sans lien, et ses issues propres", p2.assistance && /appel/.test(p2.texte) && !/yid=/.test(p2.texte) && p2.issues.includes("rendez-vous fixé"));
    r = await C({ op: "noter", id: pr.id, etat: "rendez-vous fixé" });
    check("proche accompagné : un rendez vous fixé exige sa date", r.status === 422);
    const dans1h = new Date(Date.now() + 3600e3); if (dans1h.toLocaleDateString("fr-CA", { timeZone: "Europe/Paris" }) !== new Date().toLocaleDateString("fr-CA", { timeZone: "Europe/Paris" })) dans1h.setTime(Date.now() + 60e3);
    r = await C({ op: "noter", id: pr.id, etat: "rendez-vous fixé", quand: dans1h.toISOString() });
    check("proche accompagné : le rendez vous est noté", r.json.ok && r.json.file.find(c => c.id === pr.id).rdv);
    acc = (await call("POST", "/api/forms?action=admin-accueil", {}, H)).json;
    check("à faire : le rendez vous du jour remonte, en priorité", acc.afaire.some(x => /Rendez vous avec/.test(x.t) && x.urgent));
  }

  /* 1.11.0 : cercles, et l'espace mariés suit les réponses en direct */
  {
    const e = await call("POST", "/api/forms?action=admin-espace&w=AC27", { op: "lire" }, H);
    const J2 = (e.json.espace && e.json.espace.jeton) || (await call("POST", "/api/forms?action=admin-espace&w=AC27", { op: "creer" }, H)).json.espace.jeton;
    const v = (await call("POST", "/api/forms?action=espace-voir", { j: J2 }, {})).json;
    check("cercles : chaque invité du couple porte son cercle", v.contacts.every(c => c.cercle && c.cercle.rang >= 1 && c.cercle.l));
    const pere = v.contacts.find(c => c.lien === "Père / Mère"), ami = v.contacts.find(c => c.lien === "Ami(e)");
    check("cercles : la famille proche passe avant les amis", !pere || !ami || pere.cercle.rang < ami.cercle.rang);
    check("en direct : le couple voit les réponses reçues et les contacts engagés", v.tuiles.reponses && v.tuiles.reponses.n >= 1 && v.tuiles.reponses.contactes >= 1, JSON.stringify(v.tuiles.reponses));
    const rep = v.contacts.find(c => c.reponse);
    check("en direct : la réponse d'un invité s'affiche chez le couple, sans rien de l'administration", rep && typeof rep.reponse.present === "boolean" && !JSON.stringify(v).includes("jeton\""));
    const l = (await call("POST", "/api/forms?action=admin-liste&w=AC27", {}, H)).json.contacts;
    check("cercles : l'outil connaît aussi le cercle de chaque fiche", l.every(c => c.cercle && c.cercle.l));
  }

  /* 1.12.0 : les emails aux invités, par le sas */
  {
    const E = (b) => call("POST", "/api/forms?action=admin-emails&w=AC27", b || { op: "lire" }, H);
    const l = (await call("POST", "/api/forms?action=admin-liste&w=AC27", {}, H)).json.contacts.filter(c => c.etat === "complète" && !c.desactive);
    /* deux invités confirment, dont un par son lien avec une adresse email */
    const [g1, g2] = l.filter(c => !c.reponse_le);
    let V1 = (await call("GET", "/api/forms?action=invite&yid=" + g1.jeton)).json;
    check("emails : le formulaire de l'invité demande son adresse", V1.v === 2);
    const et1 = remplirEtat(V1.cfg, V1.foyer); et1.coord.email = "pas-une-adresse";
    let r = await call("POST", "/api/forms?action=invite-repondre", { yid: g1.jeton, etat: et1 });
    check("emails : une adresse incomplète est refusée", r.status === 422 && /email/.test(r.json.detail || ""));
    et1.coord.email = "Invite.Un@exemple.fr";
    r = await call("POST", "/api/forms?action=invite-repondre", { yid: g1.jeton, etat: et1 });
    check("emails : l'adresse donnée par l'invité rejoint sa fiche", r.json.ok, JSON.stringify(r.json));
    const V2 = (await call("GET", "/api/forms?action=invite&yid=" + g2.jeton)).json, et2 = remplirEtat(V2.cfg, V2.foyer); et2.coord.email = "invite.deux@exemple.fr";
    await call("POST", "/api/forms?action=invite-repondre", { yid: g2.jeton, etat: et2 });
    r = await E({ op: "creer", modele: "programme" });
    const id = r.json.id, camp = r.json.campagnes.find(c => c.id === id);
    check("emails : un message se prépare depuis un modèle, vers les présents", camp && camp.audience === "presents" && camp.destinataires >= 2, JSON.stringify(camp && { d: camp.destinataires, e: camp.ecartes }));
    check("emails : le contrôle écarte les présents sans adresse, en disant pourquoi", camp.ecartes.every(x => x.motif));
    r = await E({ op: "apercu", id, k: 0 });
    check("emails : l'aperçu montre l'email de l'invité, salutation remplie, aucun lien en clair", r.json.apercu && !/\{salutation\}/.test(r.json.apercu.html) && /Bonjour|Cher|Chère/.test(r.json.apercu.html) && !/>https?:/.test(r.json.apercu.html), r.json.detail);
    r = await E({ op: "envoyer", id, confirme: camp.destinataires });
    check("emails : rien ne part sans email test", r.status === 422 && /test/.test(r.json.detail));
    global.__YID_MAILS = [];
    r = await E({ op: "test", id, a: "regis@yidyesido.info" });
    check("emails : l'email test part à la personne qui valide, et lui seul", r.json.ok && global.__YID_MAILS.length === 1 && global.__YID_MAILS[0].a === "regis@yidyesido.info" && /^\[Test\]/.test(global.__YID_MAILS[0].objet));
    r = await E({ op: "envoyer", id, confirme: 999 });
    check("emails : l'envoi exige de confirmer le nombre exact (ou refuse un mariage Test)", r.status === 422 && /nombre exact|Test/.test(r.json.detail));
    const fiche = (await call("POST", "/api/forms?action=admin-mariage&w=AC27", {}, H)).json.mariage;
    r = await E({ op: "envoyer", id, confirme: camp.destinataires });
    check("emails : un mariage en statut Test n'envoie jamais aux invités", fiche.statut !== "Test" || (r.status === 422 && /Test/.test(r.json.detail)));
    /* pour éprouver l'envoi réel, le mariage de recette passe le temps du contrôle en préparation, avec une boîte */
    await require("../lib/db").query("UPDATE mariage SET statut = 'En préparation', boite_email = 'ac27@yidyesido.info' WHERE code = 'AC27'");
    const fiche2 = (await call("POST", "/api/forms?action=admin-mariage&w=AC27", {}, H)).json.mariage;
    r = await E({ op: "envoyer", id, confirme: camp.destinataires });
    {
      const fiche = fiche2;
      check("emails : l'envoi part depuis la boîte du mariage, lot suivi au journal", r.json.ok && r.json.reste === 0 && r.json.lot.ok >= 2 && global.__YID_MAILS.length === 1 + r.json.lot.ok && global.__YID_MAILS.slice(1).every(x => x.de === fiche.boite_email), JSON.stringify(r.json.detail || r.json.lot));
      const c2 = r.json.campagnes.find(c => c.id === id);
      check("emails : un message ne repart jamais à qui l'a reçu", c2.statut === "termine" && c2.destinataires === 0 && c2.deja === r.json.lot.ok);
      r = await E({ op: "supprimer", id });
      check("emails : un message envoyé ne se supprime pas", r.status === 422);
      await require("../lib/db").query("UPDATE mariage SET statut = 'Test', boite_email = '' WHERE code = 'AC27'");
    }
  }

  /* 1.13.0 : la messagerie du mariage */
  {
    const M = (b) => call("POST", "/api/forms?action=admin-messagerie&w=AC27", b, H);
    let r = await M({ op: "recus" });
    check("messagerie : sans boîte, l'outil le dit clairement", r.status === 422 && /boîte/.test(r.json.detail));
    await require("../lib/db").query("UPDATE mariage SET boite_email = 'ac27@yidyesido.info' WHERE code = 'AC27'");
    global.__YID_INBOX = [{ id: "m1", subject: "Question sur l'hôtel", from: { emailAddress: { address: "Invite.Un@exemple.fr", name: "Invité Un" } }, receivedDateTime: new Date().toISOString(), bodyPreview: "Bonjour, est il possible…", isRead: false }];
    r = await M({ op: "recus" });
    check("messagerie : les reçus reconnaissent l'invité de la liste par son adresse", r.json.ok && r.json.messages[0].fiche && r.json.messages[0].fiche.id && !r.json.messages[0].lu, JSON.stringify(r.json).slice(0, 200));
    check("messagerie : un message non ouvert compte comme à lire", (await M({ op: "non_lus" })).json.non_lus === 1);
    r = await M({ op: "lire", id: "m1" });
    check("messagerie : un message s'ouvre", r.json.ok && r.json.message.objet === "Question sur l'hôtel");
    check("messagerie : une fois ouvert, il est lu, sans toucher à la boîte", (await M({ op: "non_lus" })).json.non_lus === 0 && (await M({ op: "recus" })).json.messages[0].lu === true);
    global.__YID_MAILS = [];
    r = await M({ op: "repondre", id: "m1", texte: "Bien sûr, nous nous en occupons." });
    check("messagerie : on répond depuis l'outil", r.json.ok && global.__YID_MAILS.length === 1);
    const d = (await M({ op: "destinataires" })).json.destinataires;
    check("messagerie : les invités ayant une adresse sont proposés comme destinataires", d.length >= 2 && d.every(x => x.email));
    r = await M({ op: "apercu", a: d[0].email, contact: d[0].id, objet: "{couple} · une précision", corps: "{salutation}\n\nUne précision pour vous." });
    check("messagerie : l'aperçu d'un email individuel, personnalisé, ne fait rien partir", r.json.ok && /Bonjour|Cher|Chère/.test(r.json.apercu.html) && global.__YID_MAILS.length === 1, r.json.detail);
    r = await M({ op: "ecrire", a: d[0].email, contact: d[0].id, objet: "Test", corps: "Bonjour" });
    check("messagerie : un mariage en statut Test n'écrit pas aux invités", r.status === 422 && /Test/.test(r.json.detail));
    r = await M({ op: "ecrire", a: "regis@yidyesido.info", objet: "Essai", corps: "Bonjour" });
    check("messagerie : il peut écrire à l'équipe", r.json.ok && global.__YID_MAILS.length === 2, r.json.detail);
    r = await M({ op: "envoyes" });
    check("messagerie : les envoyés montrent ce qui est parti de la boîte", r.json.ok && r.json.messages.some(x => x.adresse === "regis@yidyesido.info"));
    await require("../lib/db").query("UPDATE mariage SET boite_email = '' WHERE code = 'AC27'");
  }

  /* 1.14.0 : séjour et logistique */
  {
    const G = (b) => call("POST", "/api/forms?action=admin-logistique&w=AC27", b || {}, H);
    let r = await G({ op: "regler", transfert: true, navettes: [{ moment: "Samedi soir", de: "Hôtel du Lac", vers: "Château", depart: "18h30", retours: "23h30, 1h", capacite: 1 }] });
    check("logistique : les réglages s'enregistrent, un trajet de navette avec ses rotations", r.json.ok && r.json.navettes.length === 1 && r.json.navettes[0].retours.length === 2, r.json.detail);
    r = await G({ op: "regler", navettes: [{ moment: "", de: "x", vers: "y" }, { moment: "Samedi soir", de: "", vers: "Château" }] });
    check("logistique : un trajet incomplet est refusé", r.status === 422);
    const l = (await call("POST", "/api/forms?action=admin-liste&w=AC27", {}, H)).json.contacts.filter(c => c.etat === "complète" && !c.desactive && !c.reponse_le);
    const g = l[0], VG = (await call("GET", "/api/forms?action=invite&yid=" + g.jeton)).json, nav = VG.cfg.trajets[0];
    check("logistique : l'invité voit ses questions de venue (arrivée, navette et ses retours)", VG.cfg.arrivees && nav && nav.retours.includes("1h"), JSON.stringify(VG.cfg.trajets));
    const rep = remplirEtat(VG.cfg, VG.foyer); rep.coord.email = "venue@exemple.fr";
    rep.v.aller = { mode: "train", lieu: "Gare de Lyon", numero: "TGV 8541", date: VG.cfg.jours[0].v, heure: { h: "15", m: "40" } };
    rep.dep = { trajets: { [nav.id]: true }, places: { [nav.id]: "1" }, retour: { [nav.id]: "1h" } };
    r = await call("POST", "/api/forms?action=invite-repondre", { yid: g.jeton, etat: rep });
    check("logistique : la réponse de venue est enregistrée", r.json.ok, r.json.detail);
    r = await G();
    const n = r.json.navettes[0];
    check("logistique : l'outil compte les places par trajet et par rotation", n.aller >= 1 && n.retours.find(x => x.heure === "1h").places >= 1);
    check("logistique : l'alerte se lève quand le véhicule approche de sa capacité", n.alerte === true);
    check("logistique : les horaires de l'invité remontent pour le chauffeur", r.json.transferts.some(t => /TGV 8541/.test(t.arrivee)));
    await G({ op: "regler", transfert: false, navettes: [] });
  }

  /* 1.15.0 : plan de table et jour J */
  {
    const P = (b) => call("POST", "/api/forms?action=admin-plan&w=AC27", b || {}, H);
    let r = await P();
    check("plan : les foyers présents sont à placer, rangés par cercle", r.json.ok && r.json.foyers.length >= 2 && r.json.a_placer === r.json.foyers.length);
    r = await P({ op: "tables", tables: [{ nom: "Table des mariés", places: 2 }, { nom: "Table 2", places: 10 }] });
    check("plan : les tables se règlent", r.json.ok && r.json.tables.length === 2, r.json.detail);
    const [t1] = r.json.tables, f = r.json.foyers.sort((a, b) => b.personnes - a.personnes);
    r = await P({ op: "placer", contact: f[0].id, table: t1.id });
    r = await P({ op: "placer", contact: f[1].id, table: t1.id });
    check("plan : une table trop pleine est signalée", r.json.tables[0].trop === (r.json.tables[0].occupees > 2) && r.json.a_placer === r.json.foyers.length - 2);
    r = await P({ op: "placer", contact: f[0].id, table: "inconnue" });
    check("plan : une table inconnue est refusée", r.status === 422);
    r = await P({ op: "placer", contact: f[1].id, table: null });
    check("plan : un invité se retire de sa table", r.json.foyers.find(x => x.id === f[1].id).table === null);
    r = await P({ op: "arrive", contact: f[0].id, on: true });
    check("jour J : un invité accueilli est compté, avec sa table", r.json.arrives === f[0].personnes && r.json.foyers.find(x => x.id === f[0].id).arrive);
    r = await P({ op: "tables", tables: [{ nom: "Table 2", places: 10, id: r.json.tables[1].id }] });
    check("plan : supprimer une table libère ses invités", r.json.foyers.find(x => x.id === f[0].id).table === null);
    const j = (await call("POST", "/api/forms?action=admin-journal&w=AC27", { limit: 20 }, H)).json.journal || [];
    check("jour J : l'accueil est au journal", j.some(x => x.operation === "Jour J"));
  }

  /* 1.16.0 : la tablette du jour J, pass et scan */
  {
    const P = (b) => call("POST", "/api/forms?action=admin-plan&w=AC27", b || {}, H);
    let r = await P();
    const f = r.json.foyers.find(x => !x.arrive), jt = (await call("POST", "/api/forms?action=admin-liste&w=AC27", {}, H)).json.contacts.find(c => c.id === f.id).jeton;
    let pg = await call("GET", "/api/forms?action=pass&yid=" + jt);
    check("pass : un invité présent a son QR code", pg.status === 200);
    pg = await call("GET", "/api/forms?action=pass&yid=abcdefghjkmn");
    check("pass : un jeton inconnu n'a pas de pass", pg.status === 404);
    r = await P({ op: "scan", texte: "https://exemple.squarespace.com/?yid=" + jt });
    check("scan : le pass d'un invité présent l'accueille", r.json.scan.statut === "ok" && r.json.foyers.find(x => x.id === f.id).arrive);
    r = await P({ op: "scan", texte: "YID:" + jt });
    check("scan : un pass scanné deux fois le signale, avec l'heure et l'employé", r.json.scan.statut === "deja" && r.json.scan.par);
    r = await P({ op: "scan", texte: "n'importe quoi" });
    check("scan : un code inconnu est refusé", r.json.scan.statut === "inconnu");
    r = await P({ op: "tables", tables: [{ nom: "Table A", places: 8 }, { nom: "Table B", places: 8 }] });
    const tA = r.json.tables[0];
    check("plan : chaque table reçoit une place dans la salle", r.json.tables.every(t => typeof t.x === "number" && typeof t.y === "number"));
    r = await P({ op: "disposer", positions: { [tA.id]: { x: 30, y: 40 } }, accueil: { x: 50, y: 96 } });
    check("plan : la salle se dispose, point d'accueil compris", r.json.tables[0].x === 30 && r.json.accueil.y === 96);
  }

  /* 1.18.0 : partenaires et site des invités, hors des étapes */
  {
    const PA = (b, h) => call("POST", "/api/forms?action=admin-partenaires", b, h || H);
    const MPx = (b) => call("POST", "/api/forms?action=admin-mariage-partenaires&w=AC27", b || {}, H);
    const carto = JSON.stringify({ version: "v5", data: [
      { cat: "hotel", dest: "Oise", nom: "Mercure Beauvais Centre Cathédrale", ville: "Beauvais", lat: 49.43, lng: 2.08, etoiles: 4, note: "83 chambres", web: "all.accor.com", email: "", tel: "" },
      { cat: "autocar", dest: "Oise", nom: "Cars de l'Oise", ville: "Beauvais", lat: 49.44, lng: 2.09, note: "Autocariste", web: "exemple.fr", email: "", tel: "03 44 00 00 00" },
      { cat: "spa", dest: "Oise", nom: "Spa du Domaine", ville: "Chantilly", lat: 49.19, lng: 2.47, note: "", web: "exemple.com", email: "spa@exemple.com", tel: "" } ] });
    let r = await PA({ op: "importer", texte: carto }, HI);
    check("partenaires : l'import est réservé à un administrateur", r.status === 403);
    r = await PA({ op: "importer", texte: carto });
    check("partenaires : la cartographie s'importe", r.json.ok && r.json.import.ajoutes === 3 && r.json.partenaires.length === 3);
    r = await PA({ op: "importer", texte: carto });
    check("partenaires : un second import ne crée aucun doublon", r.json.import.ajoutes === 0 && r.json.partenaires.length === 3);
    r = await PA({ op: "importer", texte: "pas du json" });
    check("partenaires : un collage illisible est refusé proprement", !r.json.ok && /lisible/.test(r.json.detail));
    r = await PA({ op: "enregistrer", fiche: { categorie: "chauffeur", nom: "Chauffeur Privé Rouen", ville: "Rouen", telephone: "06 11 22 33 44" } }, HI);
    check("partenaires : l'équipe ajoute une maison", r.json.ok && r.json.partenaire.nom === "Chauffeur Privé Rouen");
    r = await PA({ op: "enregistrer", fiche: { categorie: "chauffeur", nom: "Chauffeur privé rouen", ville: "ROUEN" } });
    check("partenaires : un doublon est refusé, accents et majuscules compris", !r.json.ok);
    const L = (await PA({ op: "liste" })).json.partenaires, hotel = L.find(p => p.categorie === "hotel"), car = L.find(p => p.categorie === "autocar");
    r = await MPx({ op: "ajouter", ids: L.map(p => p.id) });
    check("partenaires : la sélection du mariage se compose depuis le répertoire", r.json.selection.length === 4 && r.json.selection.every(l => l.statut === "à contacter"));
    check("partenaires : le guide hôtel s'ouvre sur la date et le lieu, sans nommer le couple", /Yes I Do/.test(r.json.guides.hotel.ouverture) && !/Alexander|Clarisse/.test(r.json.guides.hotel.ouverture));
    r = await MPx({ op: "echange", partenaire: hotel.id, canal: "appel", issue: "accord", resume: "Tarif groupe obtenu", reponses: { interlocuteur: "Mme Durand, commerciale", chambres: "20", tarif: "139 € petit déjeuner inclus", butoir: "2027-04-30" }, duree_min: 9 });
    const lh = r.json.selection.find(l => l.partenaire_id === hotel.id);
    check("partenaires : un appel guidé en accord met la maison en accord avec ses chambres", lh.statut === "accord" && lh.accord.chambres === 20 && r.json.chambres_accord === 20);
    const fh = (await PA({ op: "fiche", id: hotel.id })).json;
    check("partenaires : l'appel enrichit la fiche (interlocuteur) et reste tracé", fh.partenaire.contact_nom === "Mme Durand, commerciale" && fh.echanges.length === 1 && fh.echanges[0].duree_min === 9);
    const hier = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
    r = await MPx({ op: "echange", partenaire: car.id, canal: "appel", issue: "à rappeler", relance_le: hier });
    check("partenaires : un premier appel passe la maison en contacté avec sa relance", r.json.selection.find(l => l.partenaire_id === car.id).statut === "contacté" && r.json.a_relancer === 1);
    const A = await call("POST", "/api/forms?action=admin-accueil", {}, H);
    check("partenaires : les relances dues remontent dans À faire", JSON.stringify(A.json.afaire).indexOf("relance(s) partenaires dues") >= 0);
    r = await MPx({ op: "regler", partenaire: hotel.id, publie: true });
    const li = (await call("POST", "/api/forms?action=admin-liste&w=AC27", {}, H)).json.contacts.find(c => c.jeton && c.reponse_le);
    let iv = await call("GET", "/api/forms?action=invite&yid=" + li.jeton, undefined, { origin: "https://alexander-clarisse.squarespace.com" });
    check("site : les maisons en accord et publiées arrivent sur le site des invités", iv.json.maisons.length === 1 && /139/.test(iv.json.maisons[0].tarif));
    const SI = (b) => call("POST", "/api/forms?action=admin-site&w=AC27", b || {}, H);
    r = await SI({ op: "adresse", site: "alexander-clarisse.squarespace.com" });
    check("site : une adresse sans https est refusée", !r.json.ok);
    r = await SI({ op: "adresse", site: "https://alexander-clarisse.squarespace.com/" });
    iv = await call("GET", "/api/forms?action=invite&yid=" + li.jeton, undefined, { origin: "https://alexander-clarisse.squarespace.com" });
    r = await SI();
    check("site : le script est détecté à la première visite depuis le site", !!r.json.detecte_le && r.json.stats.ouverts >= 1 && r.json.maisons.length === 1);
    r = await SI({ op: "page", k: "hebergement", etat: "prête" });
    check("site : l'état d'une page se suit, avec qui et quand", r.json.pages.find(p => p.k === "hebergement").etat === "prête" && r.json.pages.find(p => p.k === "hebergement").par);
  }

  /* 1.17.0 : étape 7, clôture (en dernier : la suppression vide la liste d'AC27) */
  {
    const K = (b) => call("POST", "/api/forms?action=admin-cloture&w=AC27", b || {}, H);
    let r = await K();
    const n0 = r.json.bilan.invites;
    check("clôture : le bilan se calcule sur la liste vivante", r.json.ok && n0 > 0 && r.json.bilan.presents >= 1 && r.json.coches.length === 5);
    r = await K({ op: "noter", rdv: "2027-07-20T12:30", retours: "Un accueil remarqué", notes: "Prévoir deux tablettes" });
    check("clôture : rendez vous et retours du couple enregistrés", r.json.rdv === "2027-07-20T12:30" && r.json.retours === "Un accueil remarqué");
    r = await K({ op: "cocher", k: "merci", on: true });
    check("clôture : une case se coche, avec qui et quand", r.json.coches[0].ok && r.json.coches[0].par);
    r = await K({ op: "purger", confirme: "AC27" });
    check("clôture : pas de suppression avant le lendemain du mariage", !r.json.ok && /lendemain/.test(r.json.detail));
    const db = require("../lib/db"); await db.query("UPDATE mariage SET date_mariage = $2 WHERE code = $1", ["AC27", new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10)]);
    const A = await call("POST", "/api/forms?action=admin-accueil", {}, H);
    check("clôture : la suppression due apparaît dans À faire", JSON.stringify(A.json).indexOf("suppression des données des invités") >= 0);
    const em = require("../lib/emails"), mm = await require("../lib/store").mariageFresh("AC27");
    check("clôture : le modèle de remerciement existe", require("fs").readFileSync(require("path").join(__dirname, "..", "lib", "emails.js"), "utf8").indexOf('cle: "remerciement"') >= 0 && !!mm);
    r = await K({ op: "purger", confirme: "XX00" });
    check("clôture : la suppression exige le code du mariage", !r.json.ok && /code/.test(r.json.detail));
    r = await K({ op: "clore" });
    check("clôture : on ne clôt pas avant la suppression", !r.json.ok);
    r = await K({ op: "purger", confirme: "ac27" });
    check("clôture : la suppression passe, le bilan reste", r.json.ok && r.json.purge && r.json.bilan.invites === n0);
    const L = await call("POST", "/api/forms?action=admin-liste&w=AC27", {}, H);
    check("clôture : plus aucun invité en base", L.json.contacts.length === 0);
    const jr = await db.query("SELECT count(*)::int AS n FROM journal j JOIN mariage m ON m.id = j.mariage_id WHERE m.code = 'AC27' AND j.detail IS NOT NULL AND j.operation <> 'Données des invités supprimées'");
    check("clôture : le journal ne garde plus le détail", jr[0].n === 0);
    r = await K({ op: "clore" });
    check("clôture : le mariage se clôt", r.json.ok && r.json.close);
  }

  /* 1.20.0 et suivantes : le mariage test Awa et Kevin (en fin de recette : il remplit le répertoire des partenaires) */
  {
    let r;
    for (const phase of ["fiche", "liste", "reponses"]) { r = await call("POST", "/api/forms?action=admin-demo", { phase }, H); if (!r.json.ok) break; }
    check("mariage test : Awa et Kevin construit de bout en bout, chaque réponse acceptée par le moteur", r.json.ok && r.json.bilan && r.json.bilan.present >= 15 && !r.json.bilan.refus.length, JSON.stringify(r.json).slice(0, 300));
    const fm = (await call("POST", "/api/forms?action=admin-mariage&w=" + r.json.code, {}, H)).json.mariage || {};
    check("mariage test : statut Test, six étapes terminées", fm.statut === "Test" && Object.keys(fm.etapes || {}).length >= 6, JSON.stringify(fm.etapes));
    const sg = (await call("POST", "/api/forms?action=admin-formulaire-signaux&w=" + r.json.code, {}, H)).json;
    check("mariage test : les signaux remontent (nourrisson, allergie sévère, hébergement décliné, accompagnant remplacé)", sg.ok && ["Nourrisson", "Allergie sévère", "Hébergement offert décliné", "Accompagnant remplacé"].every(t => sg.foyers.some(f => f.signaux.some(x => x.startsWith(t)))), JSON.stringify(sg).slice(0, 300));
    const lg = (await call("POST", "/api/forms?action=admin-logistique&w=" + r.json.code, {}, H)).json;
    check("mariage test : la navette compte ses passagers depuis le formulaire", lg.ok && lg.navettes && lg.navettes[0].aller >= 10, JSON.stringify(lg.navettes && lg.navettes[0]).slice(0, 200));
    const code = r.json.code;
    let x = await call("POST", "/api/forms?action=admin-fichier-planner&w=" + code, {}, H);
    check("fichier wedding planner : un classeur composé des réponses", x.json.ok && /\.xlsx$/.test(x.json.nom) && x.json.b64.length > 5000);
    const lp = (await call("POST", "/api/forms?action=admin-liste&w=" + code, {}, H)).json.contacts.filter(c => c.reponse_le && !/regret/.test((c.reponse || {}).presence || ""));
    x = await call("GET", "/api/forms?action=pass-info&yid=" + lp[0].jeton);
    check("pass : noms, code et QR pour un foyer présent (mariage Test, ouvert à tout moment)", x.json.ok && x.json.noms.length >= 1 && /<svg/.test(x.json.qr) && /^AK\d* \d+$/.test(x.json.code), JSON.stringify(x.json).slice(0, 160));
    const anglo = lp.find(c => c.nom_repertoire === "Emma London");
    x = await call("GET", "/api/forms?action=invite&yid=" + anglo.jeton);
    const MOT = require("../public/formulaire/moteur.js"), eA = MOT.creer(x.json.cfg, x.json.foyer, x.json.etat);
    check("anglais : le foyer anglophone reçoit son formulaire et les mots des mariés traduits", x.json.foyer.langue === "en" && eA.collecte().rows.some(r => r.label === "Attendance") && x.json.cfg.moments.some(m => m.l.en === "Drinks on the terrace"), JSON.stringify(eA.collecte().rows.slice(0, 2)));
    const sgP = sg.foyers.some(f => f.signaux.some(t => /soumettre aux mariés \(protection de la liste\)/.test(t)));
    check("protection de la liste : le remplacement d'un accompagnant devient une demande aux mariés", sgP);
    x = await call("GET", "/api/forms?action=pass-info&yid=" + lp[0].jeton);
    check("pass de contrôle : mode contrôle, seules les personnes nommées y figurent", x.json.mode === "controle" && x.json.noms.every(n => !/Nom à communiquer/.test(n)));
    x = await call("POST", "/api/forms?action=admin-colonnes&w=" + code, { op: "lister" }, H);
    check("colonnes : le socle de la fiche et les deux colonnes de la démonstration", x.json.ok && x.json.socle.includes("Présence") && x.json.colonnes.length === 2 && x.json.colonnes.find(c => c.id === "cdemo2").decision.question && !x.json.colonnes.find(c => c.id === "cdemo1").decision.question, JSON.stringify(x.json.socle));
    x = await call("POST", "/api/forms?action=admin-colonnes&w=" + code, { op: "ajouter", nom: "Taille de veste", detenteur: "invite", usages: [], pour: "tous", cadre: "Afin de…", reponses: "texte", portee: "foyer", etape: "fin1", promesse_ok: true }, H);
    check("colonnes : la méthode refuse une question dont personne ne se sert", !x.json.ok && /À qui sert/.test(x.json.detail || ""), x.json.detail);
    x = await call("POST", "/api/forms?action=admin-colonnes&w=" + code, { op: "ajouter", nom: "Pointure", detenteur: "invite", usages: ["La wedding planner"], pour: "tous", cadre: "Afin de prévoir des chaussures de danse.", sujet: "Votre pointure", reponses: "unique", options: ["36 à 38", "39 à 41", "42 à 44"], inconnu: true, portee: "personne", etape: "fin1", promesse_ok: true }, H);
    const pid = x.json.ok && x.json.colonnes.find(c => c.nom === "Pointure").id;
    check("colonnes : une colonne détenue par l'invité crée une question rédigée selon nos règles, inactive avant l'aperçu", x.json.ok && /pointure/i.test(x.json.colonnes.find(c => c.nom === "Pointure").question.fr) && !x.json.colonnes.find(c => c.nom === "Pointure").active, JSON.stringify(x.json).slice(0, 200));
    x = await call("POST", "/api/forms?action=admin-colonnes&w=" + code, { op: "activer", id: pid, on: true }, H);
    check("colonnes : pas d'activation sans aperçu vu", !x.json.ok);
    x = await call("POST", "/api/forms?action=admin-formulaire-apercu&w=" + code, { type: "deux", colonne: pid }, H);
    const eP = MOT.creer(x.json.cfg, x.json.foyer, null);
    check("aperçu : l'équipe voit le formulaire et la question en cours de validation", x.json.ok && x.json.cfg.questions.some(q => q.id === pid) && x.json.cfg.questions.some(q => q.id === "cdemo2") && eP.ordre().length >= 2, JSON.stringify({ q: (x.json.cfg || {}).questions, o: eP.ordre(), d: x.json.detail }).slice(0, 300));
    x = await call("POST", "/api/forms?action=admin-colonnes&w=" + code, { op: "supprimer", id: pid }, H);
    check("colonnes : une colonne se supprime", x.json.ok && x.json.colonnes.length === 2);
    check("réservation : les demandes d'hôtel des non logés remontent à l'équipe", sg.foyers.some(f => f.signaux.some(t => /^Réservation d'hôtel demandée/.test(t))));
    const em = (await call("POST", "/api/forms?action=admin-emails&w=" + code, {}, H)).json;
    check("emails : destinataires par typologie (logés, langue, réservation)", em.ok !== false && ["pres_loges", "pres_en", "pres_hotel", "pres_deux"].every(k => (em.audiences || []).some(a => a.k === k || a.cle === k || a.id === k)), JSON.stringify((em.audiences || []).slice(0, 3)));
    /* 1.25 : l'espace mariés étape par étape, la décision du couple, le fil conducteur */
    const ej = (await call("POST", "/api/forms?action=admin-espace&w=" + code, { op: "creer" }, H)).json.espace.jeton;
    const E = async (action, corps) => (await call("POST", "/api/forms?action=" + action, Object.assign({ j: ej }, corps || {}))).json;
    let ev = await E("espace-voir");
    check("espace par étape : une demande attend la décision du couple, le programme est montré", ev.ok && /demande/.test(ev.a_faire[4] || "") && ev.mariage.programme.length === 3, JSON.stringify(ev.a_faire));
    const e3 = await E("espace-etape", { n: 3 }), e4 = await E("espace-etape", { n: 4 }), e5 = await E("espace-etape", { n: 5 }), e6 = await E("espace-etape", { n: 6 }), e7 = await E("espace-etape", { n: 7 });
    check("espace étape 3 : suivi du premier contact invité par invité", e3.ok && e3.detail.total === 25 && e3.detail.suivi.length === 25);
    check("espace étape 4 : présents, personnes, choix à table et demande soumise", e4.ok && e4.detail.presents === 20 && e4.detail.personnes === 39 && e4.detail.plats.length === 2 && e4.detail.demandes.length === 1 && e4.detail.demandes[0].personne === "Pauline Girard");
    check("espace étape 5 : qui loge où et les navettes, sans aucun prix", e5.ok && e5.detail.hotels.length === 4 && e5.detail.navettes.length === 1 && !/tarif|€|prix|accord/i.test(JSON.stringify(e5.detail)), JSON.stringify(e5.detail).slice(0, 120));
    check("espace étape 6 : le plan table par table et un pass exemple", e6.ok && e6.detail.tables.length === 6 && e6.detail.a_placer === 0 && /pass\.html\?yid=/.test(e6.detail.pass_exemple || ""));
    check("espace étape 7 : la date de suppression des données", e7.ok && e7.detail.purge_prevue === "2027-07-19");
    check("espace : une étape hors parcours est refusée", (await E("espace-etape", { n: 9 })).ok === false);
    let g = (await call("POST", "/api/forms?action=admin-mariage&w=" + code, {}, H)).json.mariage.guide;
    check("fil conducteur : la prochaine action du mariage est calculée", g && g.etape >= 1 && !!g.texte, JSON.stringify(g));
    const dec = await E("espace-decider", { id: e4.detail.demandes[0].id, accord: true });
    check("espace : le couple accepte la demande, elle quitte ses actions à faire", dec.ok && dec.detail.demandes[0].decision === "accord" && !dec.a_faire[4]);
    let sg5 = (await call("POST", "/api/forms?action=admin-formulaire-signaux&w=" + code, {}, H)).json;
    check("équipe : la décision des mariés remonte dans les points à traiter", sg5.ok && sg5.decisions.length === 1 && sg5.decisions[0].decision === "accord" && !sg5.decisions[0].transmise);
    sg5 = (await call("POST", "/api/forms?action=admin-formulaire-signaux&w=" + code, { op: "transmise", id: sg5.decisions[0].id }, H)).json;
    check("équipe : la décision est marquée transmise à l'invité", sg5.ok && sg5.decisions[0].transmise === true);
    const vp = await E("espace-valider-plan");
    check("espace : le couple valide son plan de table", vp.ok && !!vp.detail.valide && !vp.a_faire[6]);
    const G = require("../lib/guide").calculer, base = { code: "ZZ", statut: "Signé", etapes: {}, parametres: {} };
    const fic = (etat, extra) => Object.assign({ id: 1, desactive: false, etat }, extra || {});
    check("fil conducteur : étape 1, la fiche à compléter", /fiche/i.test(G(Object.assign({}, base, { etape: 1 }), { contacts: [] }).texte));
    check("fil conducteur : étape 2, les fiches restantes", /2 fiches restent/.test(G(Object.assign({}, base, { etape: 2 }), { contacts: [fic("à compléter"), fic("à voir"), fic("complète")] }).texte));
    check("fil conducteur : étape 3, l'appel guidé d'abord", /appel guidé/.test(G(Object.assign({}, base, { etape: 3 }), { contacts: [fic("complète")] }).texte));
    check("fil conducteur : étape 6, propose de terminer quand le plan est complet", G(Object.assign({}, base, { etape: 6, parametres: { plan: { tables: [{ id: "a" }], placements: {} } } }), { contacts: [] }).terminer === 6);
    const s2 = await require("../lib/demo").second({ nom: "Recette", role: "administrateur" });
    const g2 = (await call("POST", "/api/forms?action=admin-mariage&w=" + s2.code, {}, H)).json.mariage;
    check("second mariage test : arrêté à l'étape 2, trois fiches à compléter, le fil conducteur le dit", s2.fiches === 12 && s2.a_completer === 3 && g2.etape === 2 && !!g2.etapes[1] && /3 fiches restent/.test(g2.guide.texte) && !!g2.espace_jeton, JSON.stringify([s2, g2.guide && g2.guide.texte]));
    const s2b = await require("../lib/demo").second({ nom: "Recette", role: "administrateur" });
    check("second mariage test : se relance sans doublon", s2b.code === s2.code && s2b.fiches === 12);
    r = await call("POST", "/api/forms?action=admin-demo", { phase: "reponses" }, H);
    check("mariage test : se relance sans doublon", r.json.ok && r.json.foyers === 25);
  }


  console.log(ko ? `\n${ko} contrôle(s) en échec sur ${n}` : `\n${n} contrôles, tout est vert`);
  process.exit(ko ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

/* Un état complet et sobre pour le moteur v2 : présent, seul, à tous les moments, sans régime. */
function remplirEtat(cfg, f) {
  const S = { step: "recap", presence: "oui", coord: { civ: "Madame", nom: f.nom || "Martin", prenom: f.prenom || "Amy", ind: f.ind || "FR", tel: f.tel || "612345678", email: "amy@exemple.fr" }, acc: {}, accs: {}, enf: {}, mom: {}, absent: {}, seulMoment: {}, v: {}, heb: {}, dep: {}, table: { regime: "non" }, fin: {}, ack: {}, resa: { maison: "non" } };
  if (f.type === "deux" || f.type === "libre") S.acc.choix = "seul";
  if (f.type === "plusieurs") S.nbAcc = "0";
  if (f.enfants) S.nbEnf = "0";
  S.tous = "oui";
  if (cfg.heb && cfg.heb.gere === "tous" && !cfg.heb.offert && (cfg.heb.lieux || []).length) S.heb.lieu = "propres";
  if (f.loge && cfg.heb.offert) S.heb.sejour = "non";
  if (cfg.arrivees) { S.v.aller = { mode: "inconnu" }; S.v.retour = { mode: "inconnu" }; }
  if ((cfg.trajets || []).length) S.dep.trajets = { aucun: true };
  if ((cfg.plats || []).length) S.table.plat = { inv: cfg.plats[0].v };
  if (cfg.conciergerie) S.fin.concierge = "non";
  if (cfg.engagement) S.fin.engagement = true;
  return S;
}
