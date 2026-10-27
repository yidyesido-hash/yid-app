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
  console.log("Recette yid-app v1.0, base locale");
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

  console.log(ko ? `\n${ko} contrôle(s) en échec sur ${n}` : `\n${n} contrôles, tout est vert`);
  process.exit(ko ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
