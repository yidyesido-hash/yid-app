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
  console.log("Recette yid-app v1.2, base locale");
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
  check("accueil : mariages, cheminement, journal", r.json.ok && r.json.mariages.length === 2 && r.json.reglages.cheminement.indexOf("1. Cadrage") === 0 && r.json.journal.length > 0);
  r = await call("POST", "/api/forms?action=admin-checklist", { date_mariage: "2027-07-10", delai_arret_jours: 45 }, H);
  check("checklist : 3 sections, remise proposée, clôture calculée", r.json.sections.length === 3 && r.json.remise && r.json.arret === "2027-05-26", r.json.remise + " / " + r.json.arret);
  const fiche = { pack: "Signature", prevu_contrat: 120, seuil: 130, date_mariage: "2027-07-10", delai_arret_jours: 45, conciergerie: "Oui", hebergement: "Une partie des invités", lieux_hebergement: "Domaine de la Muette", volume_estime: 110, multi_periodes: "Non", regie: "Oui",
    prenoms: "Alexander et Clarisse", lieu: "Domaine de la Muette, Seine et Marne", initiales: "ac", pays: "France", regime_enfants: "Mixte", consigne_enfants: "Enfants des proches uniquement", proches: "Kevin (frère de l'époux) ; Tante Awa (tante de l'épouse)", listes_attendues: "Tante Awa", quotas: "Tante Awa = 12", date_remise: r.json.remise, support: "Oui", telephone_epoux: "Android", telephone_epouse: "iPhone",
    statut: "Test", langue_defaut: "fr", boite_email: "", site: "" };
  r = await call("POST", "/api/forms?action=admin-declarer", { data: Object.assign({}, fiche, { prevu_contrat: "abc" }) }, H);
  check("déclaration refusée avec un champ faux (422)", r.status === 422 && r.json.errors.some(e => e.k === "prevu_contrat"));
  r = await call("POST", "/api/forms?action=admin-declarer", { data: fiche }, H);
  check("mariage déclaré, code AC27, étape 1 franchie", r.status === 200 && r.json.ok && r.json.code === "AC27" && r.json.created && r.json.mariage.etape === 2 && r.json.mariage.etapes["1"], r.status !== 200 ? JSON.stringify(r.json).slice(0, 300) : "clôture " + r.json.mariage.date_arret);
  check("SharePoint non configuré en local : signalé, pas bloquant", r.json.sharepoint && r.json.sharepoint.erreurs.length === 1);
  r = await call("POST", "/api/forms?action=admin-mariage&w=AC27", {}, H);
  check("fiche du mariage : checklist conservée, quotas lus", r.json.mariage.checklist.quotas_map["Tante Awa"] === 12 && r.json.mariage.parametres.regime_enfants === "Mixte");
  r = await call("POST", "/api/forms?action=admin-declarer&w=AC27", { data: Object.assign({}, fiche, { prevu_contrat: 130 }) }, H);
  check("mise à jour : fiche version 2, code inchangé", r.json.ok && !r.json.created && r.json.version === 2 && r.json.code === "AC27");
  r = await call("POST", "/api/forms?action=admin-declarer", { data: Object.assign({}, fiche, { prenoms: "Autre Couple" }) }, H);
  check("mêmes initiales et année : code AC272 attribué, jamais réutilisé", r.json.code === "AC272");
  r = await call("POST", "/api/forms?action=admin-accueil", {}, H);
  const ac = r.json.mariages.find(m => m.code === "AC27");
  check("accueil : jauge à 13 % (1 étape sur 8), liste attendue et clôture affichées", ac && ac.progression === 13 && ac.date_arret === "2027-05-26" && ac.date_remise);
  r = await call("POST", "/api/forms?action=admin-reglages", { cle: "cheminement", valeur: "1. Cadrage. Texte modifié.\n2. Suite." }, H);
  check("réglage cheminement modifié et journalisé", r.json.cheminement.indexOf("Texte modifié") > 0);
  const feuilles = require("../lib/mariage").feuillesPilotage(fiche, "Alexander et Clarisse");
  const x = require("../lib/xlsx").build(feuilles);
  check("classeur Pilotage : onglet Lisez moi en tête, puis Paramètres", feuilles[0].name === "Lisez moi" && feuilles[0].rows.length === 7 && feuilles[1].name === "Paramètres" && x.slice(0, 2).toString() === "PK" && x.length > 2000);
  const p = require("../lib/pdf").build({ title: "Fiche du call 1 · test", sections: require("../lib/checklist").fiche(fiche) });
  check("fiche PDF générée, métadonnées Yes I Do, sans trait entre les lignes", p.slice(0, 5).toString() === "%PDF-" && p.indexOf("/Author (Yes I Do)") > 0 && p.toString("latin1").indexOf("0.88 G") < 0);

  /* ---------- v1.1.1 : journal champ par champ, équipe nommée, boîte, réglages ---------- */
  r = await call("POST", "/api/forms?action=admin-journal&w=AC27", {}, H);
  const modif = (r.json.journal || []).find(l => l.operation === "Cadrage modifié");
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
  check("réglage ressources de l'équipe enregistré par Cécilia, ressources de direction invisibles pour elle", r.json.ressources_equipe.indexOf("example.org") > 0 && r.json.ressources_direction === undefined);
  r = await call("POST", "/api/forms?action=admin-reglages", { cle: "ressources_direction", valeur: "x" }, HC);
  check("l'équipe ne modifie pas les ressources de direction (403)", r.status === 403);
  r = await call("POST", "/api/forms?action=admin-reglages", { cle: "theme_defaut", valeur: "sombre" }, H);
  check("thème par défaut sombre enregistré par l'administrateur, ressources de direction lues", r.json.theme_defaut === "sombre" && r.json.ressources_direction.indexOf("Plan de construction") === 0);
  r = await call("POST", "/api/forms?action=admin-login", { password: "test" }, { "x-forwarded-for": "10.0.0.2" });
  check("la connexion annonce le thème par défaut", r.json.theme === "sombre");
  r = await call("POST", "/api/forms?action=admin-journal", {}, H);
  check("le journal dit qui : Cécilia sur le réglage, administrateur sur la création de l'accès", r.json.journal.some(l => l.operation === "Réglage modifié" && l.operateur === "Cécilia") && r.json.journal.some(l => l.operation === "Accès créé" && l.operateur === "administrateur"));
  r = await call("POST", "/api/forms?action=admin-utilisateur", { nom: "Cécilia", role: "équipe", desactive: true }, H);
  check("accès désactivé, jamais supprimé", r.json.utilisateurs.some(u => u.nom === "Cécilia" && u.desactive));
  r = await call("POST", "/api/forms?action=admin-login", { prenom: "Cécilia", password: "motdepasse-cecilia" }, { "x-forwarded-for": "10.0.0.3" });
  check("un accès désactivé ne se connecte plus", r.status === 401);
  r = await call("POST", "/api/forms?action=admin-boite&w=AC27", {}, H);
  check("revérifier la boîte : état mémorisé sur le mariage, non bloquant sans Microsoft", r.json.ok && r.json.boite.ok === false && r.json.mariage.boite && r.json.mariage.boite.verifiee_le);

  /* ---------- v1.2 : contacts reçus sur le corpus reconstitué ---------- */
  const corpus = (f) => ({ name: f, b64: fs.readFileSync(require("path").join(__dirname, "corpus", f)).toString("base64") });
  r = await call("POST", "/api/forms?action=admin-importer&w=AC27", { source: "Export Épouse", cote: "Épouse", fichiers: [corpus("Test_Yid_iPhone.vcf")] }, H);
  check("test 1 iPhone : 13 lus, 13 ajoutés, 0 connu, 6 à voir", r.status === 200 && r.json.lus === 13 && r.json.ajoutes === 13 && r.json.connus === 0 && r.json.a_voir === 6, JSON.stringify([r.json.lus, r.json.ajoutes, r.json.connus, r.json.a_voir, r.json.detail]));
  r = await call("POST", "/api/forms?action=admin-contacts&w=AC27", {}, H);
  const byNom = (n) => r.json.contacts.filter(c => c.nom_repertoire === n);
  check("Miezi-Lisa : numéro préféré en principal, 2e numéro trouvé, propre", byNom("Miezi-Lisa")[0].numero === "+33644556677" && byNom("Miezi-Lisa")[0].numero_2 === "+33750212558" && !byNom("Miezi-Lisa")[0].motifs);
  check("les six à voir : Bernard sans numéro, Crevette invalide, Cess x2 doublon probable, Regis 1 et Monsieur mon Mari même numéro", /sans numéro/.test(byNom("Bernard")[0].motifs) && /invalide/.test(byNom("Crevette")[0].motifs) && byNom("Cess").every(c => /doublon probable avec Cess/.test(c.motifs)) && /même numéro que Monsieur mon Mari/.test(byNom("Regis 1")[0].motifs) && /même numéro que Regis 1/.test(byNom("Monsieur mon Mari")[0].motifs), r.json.contacts.filter(c => c.motifs).map(c => c.nom_repertoire + ": " + c.motifs).join(" | "));
  check("tri : propres par côté puis alphabétique, anomalies en bas", r.json.contacts[0].nom_repertoire === "Amy Djitte" && !r.json.contacts[6].motifs && !!r.json.contacts[7].motifs);
  r = await call("POST", "/api/forms?action=admin-importer&w=AC27", { source: "Export Époux", cote: "Époux", fichiers: [corpus("Samsung_Regis.vcf")] }, H);
  check("test 2 Samsung : 6 lus, 5 ajoutés, 1 connu, 7 à voir", r.json.lus === 6 && r.json.ajoutes === 5 && r.json.connus === 1 && r.json.a_voir === 7, JSON.stringify([r.json.lus, r.json.ajoutes, r.json.connus, r.json.a_voir]));
  r = await call("POST", "/api/forms?action=admin-contacts&w=AC27", {}, H);
  const djo = r.json.contacts.find(c => c.nom_repertoire === "Djoco Mabiala");
  check("Djo : mention « aussi proposé par Export Époux » et motif présent dans les deux répertoires", djo.mentions.some(x => x.texte === "aussi proposé par Export Époux") && /deux répertoires/.test(djo.motifs));
  check("Raquel à émojis sur une seule ligne, Patrick fixe secondaire signalé, numéros Samsung dupliqués fusionnés", r.json.contacts.filter(c => /^Raquel/.test(c.nom_repertoire)).length === 1 && r.json.contacts.find(c => c.nom_repertoire === "Patrick").numero === "+41791234567" && r.json.contacts.find(c => c.nom_repertoire === "Donna C").numero_2 === null);
  check("kpis : 18 actifs, 11 propres, 7 à voir, côté Épouse 13, Époux 5", r.json.kpis.actifs === 18 && r.json.kpis.propres === 11 && r.json.kpis.a_voir === 7 && r.json.kpis.epouse === 13 && r.json.kpis.epoux === 5, JSON.stringify(r.json.kpis));
  r = await call("POST", "/api/forms?action=admin-importer&w=AC27", { source: "Export Époux", cote: "Époux", fichiers: [corpus("Samsung_Regis.vcf")] }, H);
  check("test 3 idempotence : 6 lus, 0 ajouté, 6 connus, toujours 7 à voir", r.json.lus === 6 && r.json.ajoutes === 0 && r.json.connus === 6 && r.json.a_voir === 7, JSON.stringify([r.json.lus, r.json.ajoutes, r.json.connus, r.json.a_voir]));
  r = await call("POST", "/api/forms?action=admin-importer&w=AC27", { source: "Liste Tante Awa", cote: "Épouse", proche: "Tante Awa", fichiers: [corpus("Google_export.csv")] }, H);
  check("liste d'un proche (CSV Google) : 2 lus, 1 ajouté, 1 connu, quota 1 sur 12, préremplissage", r.json.lus === 2 && r.json.ajoutes === 1 && r.json.connus === 1 && r.json.quota && r.json.quota.quota === 12 && r.json.quota.recus === 1 && !r.json.quota.depassement, JSON.stringify(r.json.quota) + " " + (r.json.avertissements || []).join(" "));
  r = await call("POST", "/api/forms?action=admin-contacts&w=AC27", {}, H);
  const lina = r.json.contacts.find(c => c.nom_repertoire === "Lina Planner");
  check("Lina : Lien « Invité(e) d'un proche », Précision Tante Awa, fixe en 2e numéro", lina.lien === "Invité(e) d'un proche" && lina.precision === "Tante Awa" && lina.numero_2 === "+33142001122");
  r = await call("POST", "/api/forms?action=admin-importer&w=AC27", { source: "Liste Kevin", cote: "Époux", proche: "Kevin", fichiers: [corpus("Google_export.csv")] }, H);
  check("proche non déclaré : avertissement et ajout aux contributeurs", r.status === 200 && (r.json.avertissements || []).some(a => /Kevin/.test(a) && /ajouté/.test(a)), JSON.stringify(r.json).slice(0, 300));
  r = await call("POST", "/api/forms?action=admin-contacts&w=AC27", {}, H);
  const bernard = r.json.anomalies.find(a => a.type === "sans numéro" && a.etat === "ouverte");
  r = await call("POST", "/api/forms?action=admin-anomalie&w=AC27", { id: bernard.id, decision: "" }, H);
  check("trancher sans décision écrite : refusé", r.status === 422);
  r = await call("POST", "/api/forms?action=admin-anomalie&w=AC27", { id: bernard.id, decision: "Numéro demandé au couple" }, H);
  const b2 = r.json.contacts.find(c => c.nom_repertoire === "Bernard");
  check("anomalie tranchée : Bernard redevient propre, décision gardée (8 à voir : Lina et Tamara aussi proposées côté Époux)", r.json.ok && !b2.motifs && r.json.anomalies.find(a => a.id === bernard.id).etat === "tranchée" && r.json.kpis.a_voir === 8, JSON.stringify([b2 && b2.motifs, r.json.kpis]));
  const cess2 = r.json.contacts.filter(c => c.nom_repertoire === "Cess")[1];
  r = await call("POST", "/api/forms?action=admin-contact&w=AC27", { id: cess2.id, desactive: true, motif: "même personne, faux numéro" }, H);
  check("contact désactivé, jamais supprimé", r.json.kpis.desactives === 1 && r.json.contacts.some(c => c.id === cess2.id && c.desactive));
  const lotEmail = r.json.lots.find(l => l.source === "Liste Kevin");
  r = await call("POST", "/api/forms?action=admin-lot&w=AC27", { id: lotEmail.id, cote: "Épouse", source: "Liste Kevin (corrigée)" }, H);
  check("source corrigée sur le lot et ses contacts", r.json.lots.find(l => l.id === lotEmail.id).cote === "Épouse" && r.json.contacts.filter(c => c.lot_id === lotEmail.id).every(c => c.cote === "Épouse" && c.source === "Liste Kevin (corrigée)"));
  r = await call("POST", "/api/forms?action=admin-etape&w=AC272", { n: 2 }, H);
  check("terminer l'étape 2 sans contact : refusé", r.status === 422);
  r = await call("POST", "/api/forms?action=admin-etape&w=AC27", { n: 2 }, H);
  check("étape 2 terminée sur AC27 : étape 3 en cours, jauge 25 %", r.json.ok && r.json.mariage.etape === 3 && r.json.mariage.etapes["2"] && r.json.mariage.terminees === 2);
  r = await call("POST", "/api/forms?action=admin-journal&w=AC27", {}, H);
  check("journal : Contacts reçus, Anomalie tranchée, Contact désactivé, Source corrigée, Étape terminée", ["Contacts reçus", "Anomalie tranchée", "Contact désactivé", "Source corrigée", "Étape terminée", "Proche contributeur ajouté"].every(o => r.json.journal.some(l => l.operation === o)));
  const p2 = require("../lib/telephone");
  check("normalisation : DOM 0690 vers +590, +33 (0)6, 00 33, numéro nu local, fixe signalé", p2.normaliser("0690 12 34 56", "FR").numero === "+590690123456" && p2.normaliser("+33 (0)6 12 34 56 78", "FR").numero === "+33612345678" && p2.normaliser("0033612345678", "FR").numero === "+33612345678" && p2.normaliser("612345678", "FR").numero === "+33612345678" && p2.normaliser("01 42 00 00 00", "FR").statut === "fixe probable" && p2.normaliser("12", "FR").statut === "invalide");

  console.log(ko ? `\n${ko} contrôle(s) en échec sur ${n}` : `\n${n} contrôles, tout est vert`);
  process.exit(ko ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
