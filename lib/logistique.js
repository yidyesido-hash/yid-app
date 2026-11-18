/* =====================================================================
   ÉTAPE 5 · SÉJOUR ET LOGISTIQUE (sections 5.3 à 5.5 du cadrage)
   Ce que les invités confirmés indiquent sur leur lien personnel :
   où ils dorment, leurs horaires d'arrivée et de départ quand un
   transfert est prévu, et leurs places dans les navettes, trajet par
   trajet, avec la rotation de retour souhaitée.
   L'outil compte par hôtel, par trajet et par rotation, alerte quand un
   véhicule approche de sa capacité, et prépare la liste de chaque
   prestataire (hôtel, chauffeur, transporteur).
   Réglages : mariage.parametres.logistique ; réponses : contact_recu.reponse.
   ===================================================================== */
const db = require("./db");
const store = require("./store");
const liste = require("./liste");

const propre = (s) => String(s == null ? "" : s).trim();
const SANS_NAV = "Pas de navette";

function config(m) {
  const L = ((m.parametres || {}).logistique) || {};
  return { chambres: L.chambres || {}, transfert: !!L.transfert, transfert_offert: L.transfert_offert !== false, navettes: Array.isArray(L.navettes) ? L.navettes : [] };
}

/* Les questions de la venue, ajoutées au formulaire de l'invité présent. */
function questions(c, m, regles) {
  const L = config(m), r = c.reponse || {}, out = [], hotels = (regles && regles.lieux) || [];
  /* l'hébergement suit le régime du mariage : tous logés (choix), une partie (seuls les invités désignés), aucun (rien) */
  const regime = (regles && regles.hebergement) || "aucun";
  if (hotels.length && regime !== "aucun") {
    if (c.hebergement && hotels.includes(c.hebergement) && c.hebergement !== "Par leurs propres moyens") out.push({ k: "hebergement", type: "fixe", l: "Votre hébergement", v: c.hebergement, si: "presence:0" });
    else if (regime === "tous") out.push({ k: "hebergement", type: "choix", l: "Où séjournerez vous ?", o: hotels.filter(h => h !== "Par leurs propres moyens").concat(["Par mes propres moyens"]), v: r.hebergement || null, requis: true, si: "presence:0" });
  }
  if (L.transfert) {
    out.push({ k: "arrivee", type: "texte", l: L.transfert_offert ? "Votre arrivée : train ou vol, numéro, date et heure" : "Votre arrivée, si vous souhaitez un chauffeur à votre charge : train ou vol, numéro, date et heure", aide: "Par exemple : TGV 8541, vendredi 9 juillet, 15 h 42, gare de Bordeaux.", v: r.arrivee || "", si: "presence:0" });
    out.push({ k: "depart", type: "texte", l: "Votre départ : train ou vol, numéro, date et heure", v: r.depart || "", si: "presence:0" });
  }
  for (const n of L.navettes) {
    const places = ["Non merci"].concat(Array.from({ length: 6 }, (_, i) => String(i + 1)));
    out.push({ k: "nav_" + n.id + "_aller", type: "choix", l: `Navette ${n.moment} : ${n.de} vers ${n.vers}${n.depart ? ", départ " + n.depart : ""}. Combien de places ?`, o: places, v: r["nav_" + n.id + "_aller"] || null, si: "presence:0" });
    if ((n.retours || []).length) out.push({ k: "nav_" + n.id + "_retour", type: "choix", l: `Retour vers ${n.de} : à quelle heure ?`, o: n.retours.concat([SANS_NAV]), v: r["nav_" + n.id + "_retour"] || null, si: "presence:0" });
  }
  return out;
}

const personnes = (c) => { const r = c.reponse || {}; if (Number.isInteger(r.personnes)) return r.personnes; return 1 + (r.accompagnant || (c.invitation === "Invitation pour deux" && r.vient_accompagne !== "Non, je viendrai seul(e)") ? 1 : 0) + (Array.isArray(r.enfants) ? r.enfants.length : (Number(c.nb_enfants) || 0)); };
const present = (c) => c.reponse_le && !/regret/.test((c.reponse || {}).presence || "");

async function vue(code) {
  const m = await store.mariageFresh(code); if (!m) throw new Error("mariage inconnu");
  const j = await liste.liste(code), L = config(m), act = j.contacts.filter(c => !c.desactive), pres = act.filter(present);
  const hotels = (j.regles.lieux || []).filter(h => h !== "Par leurs propres moyens").map(h => {
    const qui = pres.filter(c => ((c.reponse || {}).hebergement || c.hebergement) === h);
    return { nom: h, chambres: Number(L.chambres[h]) || null, foyers: qui.length, personnes: qui.reduce((t, c) => t + personnes(c), 0), invites: qui.map(c => ({ nom: c.nom_repertoire, personnes: personnes(c), numero: c.numero })) };
  });
  const transferts = L.transfert ? pres.filter(c => propre((c.reponse || {}).arrivee) || propre((c.reponse || {}).depart)).map(c => ({ nom: c.nom_repertoire, numero: c.numero, personnes: personnes(c), arrivee: (c.reponse || {}).arrivee || "", depart: (c.reponse || {}).depart || "", hotel: (c.reponse || {}).hebergement || c.hebergement || "", enfants: Array.isArray((c.reponse || {}).enfants) ? c.reponse.enfants.length : 0 })) : [];
  const navettes = L.navettes.map(n => {
    const aller = pres.reduce((t, c) => t + (Number((c.reponse || {})["nav_" + n.id + "_aller"]) || 0), 0);
    const retours = (n.retours || []).map(h => ({ heure: h, places: pres.filter(c => (c.reponse || {})["nav_" + n.id + "_retour"] === h).reduce((t, c) => t + (Number((c.reponse || {})["nav_" + n.id + "_aller"]) || personnes(c)), 0) }));
    const cap = Number(n.capacite) || null, alerte = (x) => cap && x >= cap * 0.9;
    return Object.assign({}, n, { aller, retours, alerte: alerte(aller) || retours.some(r => alerte(r.places)),
      passagers: pres.filter(c => Number((c.reponse || {})["nav_" + n.id + "_aller"]) > 0).map(c => ({ nom: c.nom_repertoire, places: Number(c.reponse["nav_" + n.id + "_aller"]), retour: c.reponse["nav_" + n.id + "_retour"] || "", hotel: c.reponse.hebergement || c.hebergement || "" })) });
  });
  return { config: L, hotels_liste: j.regles.lieux || [], presents: pres.length, personnes: pres.reduce((t, c) => t + personnes(c), 0), hotels, transferts, navettes };
}

async function regler(code, b, u) {
  const m = await store.mariageFresh(code); if (!m) throw new Error("mariage inconnu");
  const p = m.parametres || {}, L = config(m);
  if (b.chambres && typeof b.chambres === "object") for (const [h, n] of Object.entries(b.chambres)) L.chambres[propre(h).slice(0, 120)] = Math.max(0, Math.min(999, Number(n) || 0)) || null;
  if (b.transfert != null) L.transfert = !!b.transfert;
  if (b.transfert_offert != null) L.transfert_offert = !!b.transfert_offert;
  if (Array.isArray(b.navettes)) L.navettes = b.navettes.slice(0, 20).map((n, i) => {
    const moment = propre(n.moment).slice(0, 60), de = propre(n.de).slice(0, 80), vers = propre(n.vers).slice(0, 80);
    if (!moment || !de || !vers) throw new Error(`Navette ${i + 1} : indiquez le moment, le départ et l'arrivée.`);
    return { id: propre(n.id) || Date.now().toString(36) + i, moment, de, vers, depart: propre(n.depart).slice(0, 10), retours: (Array.isArray(n.retours) ? n.retours : String(n.retours || "").split(/[,;]/)).map(propre).filter(Boolean).slice(0, 8), capacite: Math.max(0, Number(n.capacite) || 0) || null };
  });
  p.logistique = L;
  await db.query("UPDATE mariage SET parametres = $2, modifie_le = now() WHERE id = $1", [m.id, p]);
  await store.journal(m.id, "Logistique", "Réglages du séjour et de la logistique mis à jour", null, null, u.nom);
}

module.exports = { questions, vue, regler, config };
