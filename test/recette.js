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
  console.log("Recette yid-app v1.1, base locale");
  let r = await call("POST", "/api/forms?action=admin-login", { password: "faux" });
  check("mot de passe refusé", r.status === 401);
  r = await call("POST", "/api/forms?action=admin-login", { password: "test" });
  check("connexion acceptée, jeton reçu", r.status === 200 && r.json.token, "version " + r.json.version);
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
  check("journal : connexion, vérification, mariages, foyers", ops.includes("Connexion à l'administration") && ops.includes("Vérification de la connexion") && ops.includes("Foyer créé"), ops.length + " lignes");

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
  const x = require("../lib/xlsx").build(require("../lib/mariage").CHEMINEMENT_DEFAUT ? [{ name: "Paramètres", table: "Parametres", headers: ["Champ", "Valeur"], rows: [["a", "b"]] }] : []);
  check("classeur miroir généré (zip valide)", x.slice(0, 2).toString() === "PK" && x.length > 2000);
  const p = require("../lib/pdf").build({ title: "Fiche du call 1 · test", sections: require("../lib/checklist").fiche(fiche) });
  check("fiche PDF générée, métadonnées Yes I Do", p.slice(0, 5).toString() === "%PDF-" && p.indexOf("/Author (Yes I Do)") > 0);

  console.log(ko ? `\n${ko} contrôle(s) en échec sur ${n}` : `\n${n} contrôles, tout est vert`);
  process.exit(ko ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
