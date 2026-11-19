/* =====================================================================
   LE FIL CONDUCTEUR · la prochaine action de chaque mariage
   Une seule ligne par mariage : ce qui reste à faire sur l'étape en
   cours, le bouton qui y mène, et, quand tout est fait, la proposition
   de terminer l'étape et d'ouvrir la suivante. Calculé sur les données
   vivantes, jamais saisi.
   ===================================================================== */
const { ETAPES } = require("./checklist");

const present = (c) => c.reponse_le && !/regret/.test((c.reponse || {}).presence || "");
const pl = (n, un, des) => n + " " + (n > 1 ? des : un);

function calculer(m, j) {
  const p = m.parametres || {}, base = "#/m/" + m.code, n = Math.max(1, Math.min(7, m.etape || 1)), faites = m.etapes || {};
  const act = j ? j.contacts.filter(c => !c.desactive) : [], vertes = act.filter(c => c.etat === "complète"), pres = act.filter(present);
  const suite = n < 7 ? { n: n + 1, l: ETAPES[n] } : null;
  const out = (texte, bouton, lien, extra) => Object.assign({ etape: n, libelle: ETAPES[n - 1], texte, bouton, lien, terminer: null, suite }, extra || {});
  const fini = (texte) => out(texte, "Terminer l'étape " + n, null, { terminer: n });
  if (m.statut === "Clos" || faites[7]) return { etape: 7, libelle: ETAPES[6], texte: "Ce mariage est clos. Rien à faire.", bouton: null, lien: null, terminer: null, suite: null, clos: true };
  if (n === 1) {
    if (!require("./formulaire").actif(m)) return out("Complétez la fiche : le programme de la journée et la date de réponse ouvrent le formulaire des invités.", "Ouvrir la fiche", base + "/1");
    if (!p.feuille_route) return out("Envoyez la feuille de route au couple, puis épinglez la dans le groupe du mariage.", "Voir la feuille de route", base + "/1", { ancre: "froute" });
    return fini("La fiche est complète et la feuille de route est envoyée.");
  }
  if (n === 2) {
    if (!act.length) return out("Importez la liste du couple : son collect ou ses contacts.", "Ouvrir la liste", base + "/2");
    const reste = act.length - vertes.length;
    if (reste) return out(pl(reste, "fiche reste", "fiches restent") + " à compléter avant de valider la liste.", "Compléter la liste", base + "/2");
    return out("Toutes les fiches sont vertes. Validez la liste pour ouvrir le premier contact.", "Valider la liste", base + "/2", { ancre: "finir" });
  }
  if (n === 3) {
    if (p.appel) return out("Un appel guidé est en cours avec le couple.", "Reprendre l'appel", base + "/appel");
    if (!(p.appels || []).length) return out("Menez l'appel guidé avec le couple : il qualifie la liste et règle le rythme des relances.", "Lancer l'appel guidé", base + "/appel");
    const acces = vertes.filter(c => (c.premier_contact || {}).etat === "a répondu").length;
    if (acces) return out(pl(acces, "invité a répondu : son accès personnel est", "invités ont répondu : leur accès personnel est") + " à envoyer.", "Ouvrir le premier contact", base + "/contact");
    const reste = vertes.filter(c => !(c.premier_contact || {}).etat && !c.reponse_le).length;
    if (reste) return out(pl(reste, "invité", "invités") + " à contacter par WhatsApp.", "Ouvrir le premier contact", base + "/contact");
    return fini("Tous les invités ont été contactés.");
  }
  if (n === 4) {
    const dem = require("./espace").demandes(m, j);
    const aTransmettre = dem.filter(d => d.decision && !d.transmise).length, enAttente = dem.filter(d => !d.decision).length;
    if (aTransmettre) return out(pl(aTransmettre, "décision des mariés est", "décisions des mariés sont") + " à transmettre à l'invité.", "Voir les points à traiter", base + "/4", { ancre: "sig-zone" });
    const sans = vertes.filter(c => !c.reponse_le).length;
    if (sans) return out(pl(sans, "invité n'a", "invités n'ont") + " pas encore répondu : préparez la relance." + (enAttente ? " " + pl(enAttente, "demande attend", "demandes attendent") + " la décision des mariés dans leur espace." : ""), "Préparer la relance", base + "/4", { ancre: "em-zone" });
    if (enAttente) return out(pl(enAttente, "demande attend", "demandes attendent") + " la décision des mariés dans leur espace. Rappelez le leur si besoin.", "Voir l'espace mariés", base + "/espace");
    return fini("Toutes les réponses sont arrivées.");
  }
  if (n === 5) {
    const resa = pres.filter(c => (c.reponse || {}).reservation && !(c.reponse.reservation.confirmee)).length;
    return fini("Vérifiez la rooming list, les navettes et les arrivées" + (resa ? ", et confirmez " + pl(resa, "réservation d'hôtel demandée", "réservations d'hôtel demandées") : "") + ". Tout est en ordre ?");
  }
  if (n === 6) {
    const P = p.plan || {}, tables = P.tables || [];
    if (!tables.length) return out("Créez les tables du plan, puis placez les foyers présents.", "Ouvrir le plan de table", base + "/6");
    const reste = pres.filter(c => !(P.placements || {})[c.id]).length;
    if (reste) return out(pl(reste, "foyer reste", "foyers restent") + " à placer.", "Ouvrir le plan de table", base + "/6");
    if (!P.valide_couple) return Object.assign(fini("Le plan est complet. Il attend la validation des mariés dans leur espace."), { attente_couple: true });
    return fini("Le plan est validé par les mariés. L'étape se termine après le jour J.");
  }
  return out("Dernière étape : le bilan, le rendez vous de clôture et la suppression des données des invités.", "Ouvrir la clôture", base + "/7");
}

async function pour(m) {
  let j = null; try { j = await require("./liste").liste(m.code); } catch (e) { j = null; }
  try { return calculer(m, j); } catch (e) { return null; }
}

module.exports = { pour, calculer };
