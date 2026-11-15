/* =====================================================================
   À FAIRE AUJOURD'HUI (R7 et section 4 du cadrage)
   Ce qui demande une main aujourd'hui, mariage par mariage, calculé sur
   les données vivantes : fiches à compléter, accès à envoyer, rappels,
   relances dues selon le rythme choisi pendant l'appel guidé, rendez vous
   des proches accompagnés, date limite qui approche, appel en cours.
   ===================================================================== */
const db = require("./db");
const liste = require("./liste");

const JOUR = 864e5;
const RYTHME_JOURS = { "Tous les trois jours": 3, "Une fois par semaine": 7, "Deux fois avant la date limite": null, "Pas de relance automatique": 0 };
const parisJour = (d) => new Date(d).toLocaleDateString("fr-CA", { timeZone: "Europe/Paris" });

function dernier(c, etats) { const h = ((c.premier_contact || {}).historique || []).filter(x => !etats || etats.includes(x.etat)); return h.length ? h[h.length - 1] : null; }

async function pourMariage(m) {
  const j = await liste.liste(m.code), act = j.contacts.filter(c => !c.desactive), p = m.parametres || {}, env = p.envoi || {}, out = [];
  const base = "#/m/" + m.code, contact = base + "/contact", ajd = parisJour(Date.now());
  const add = (t, n, h, ic, urgent) => { if (n) out.push({ t, n, h, ic, urgent: !!urgent, mariage: m.prenoms, code: m.code }); };
  if (p.appel) add("Appel guidé en cours, à reprendre", 1, base + "/appel", "appel", true);
  add("fiche(s) à compléter", act.filter(c => c.etat === "à compléter" || c.etat === "à voir").length, base + "/2", "liste");
  const pc = (e) => act.filter(c => ((c.premier_contact || {}).etat) === e);
  add("invité(s) ont répondu : leur accès est à envoyer", pc("a répondu").length, contact, "message", true);
  add("invité(s) à rappeler", pc("à rappeler").length + pc("messagerie").filter(c => { const d = dernier(c); return d && Date.now() - new Date(d.le) > JOUR; }).length, contact, "tel");
  /* relances dues : envoyé sans retour depuis le rythme choisi */
  let pas = RYTHME_JOURS[env.rythme];
  const limite = p.date_limite_reponse || null;
  if (pas === null && limite) pas = Math.max(2, Math.floor((new Date(limite) - Date.now()) / JOUR / 2));
  if (pas) add("relance(s) dues, sans réponse depuis " + pas + " jour(s)", act.filter(c => { const e = (c.premier_contact || {}).etat; if (e !== "envoyé" && e !== "lien envoyé") return false; if (e === "lien envoyé" && c.reponse_le) return false; const d = dernier(c, ["envoyé", "lien envoyé"]); return d && Date.now() - new Date(d.le) >= pas * JOUR; }).length, contact, "relance");
  /* proches accompagnés : rendez vous du jour, et ceux encore à proposer */
  const rdv = act.filter(c => c.assistance && (c.premier_contact || {}).rdv && parisJour(c.premier_contact.rdv) === ajd);
  rdv.forEach(c => add("Rendez vous avec " + c.nom_repertoire + " à " + new Date(c.premier_contact.rdv).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }), 1, contact, "date", true));
  add("proche(s) à accompagner sans rendez vous", act.filter(c => c.assistance && c.etat === "complète" && !["rendez-vous fixé", "parcours fait"].includes((c.premier_contact || {}).etat)).length, contact, "tel");
  if (limite) { const d = Math.round((new Date(limite + "T12:00:00") - Date.now()) / JOUR), sans = act.filter(c => c.etat === "complète" && !c.reponse_le).length;
    if (d >= 0 && d <= 7 && sans) add("sans réponse, date limite " + (d ? "dans " + d + " jour(s)" : "aujourd'hui"), sans, contact, "date", d <= 2); }
  return out;
}

async function tout() {
  const ms = await db.query("SELECT code, prenoms, parametres FROM mariage WHERE NOT desactive ORDER BY date_mariage NULLS LAST");
  let out = [];
  for (const m of ms) { try { out = out.concat(await pourMariage(m)); } catch (e) { /* un mariage sans liste ne bloque pas les autres */ } }
  return out.sort((a, b) => (b.urgent - a.urgent));
}

module.exports = { pourMariage, tout };
