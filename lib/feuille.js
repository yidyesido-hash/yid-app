/* =====================================================================
   LA FEUILLE DE ROUTE DU MARIAGE (demande du 18 novembre 2026)
   Envoyée au couple après le premier rendez vous (étape 1), dans le
   groupe du mariage, puis épinglée : le fil rouge de chacun jusqu'au jour J.
   Elle se compose de la fiche seule : les dates de remise, de réponse, de
   modification et de clôture, et ce qui se passe à chaque temps. Mise en
   forme WhatsApp (astérisques pour le gras), sans tiret, sans lien.
   ===================================================================== */
const accueil = require("./accueil");
const checklist = require("./checklist");

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
function d(iso) { return iso ? new Date(String(iso).slice(0, 10) + "T12:00:00Z") : null; }
function L(iso, jour) { const x = d(iso); if (!x) return ""; const n = x.getUTCDate(); return (jour ? JOURS[x.getUTCDay()] + " " : "") + (n === 1 ? "1er" : n) + " " + MIOS(x); }
function MIOS(x) { return MOIS[x.getUTCMonth()] + (x.getUTCFullYear() !== new Date().getUTCFullYear() ? " " + x.getUTCFullYear() : ""); }
function plus(iso, j) { const x = d(iso); if (!x) return null; x.setUTCDate(x.getUTCDate() + j); return x.toISOString().slice(0, 10); }

function composer(m) {
  const p = m.parametres || {}, ck = p.checklist || {}, f = p.formulaire || {};
  const couple = accueil.maries(m).couple || m.prenoms, dm = m.date_mariage;
  const lieu = String(m.lieu || ck.lieu || "").split(",")[0].trim();
  const arret = m.date_arret || (dm && ck.delai_arret_jours ? plus(dm, -Number(ck.delai_arret_jours)) : null);
  const purge = dm ? plus(dm, 30) : null, pass = dm ? plus(dm, -3) : null;
  const listes = (ck.listes_attendues || []).filter(Boolean);
  const heb = ck.hebergement && ck.hebergement !== "Non géré par Yes I Do";
  const sig = ck.conciergerie === "Oui";
  const B = [];
  B.push(`*Feuille de route · Mariage ${/^[aeiouyéèêâîôh]/i.test(couple) ? "d'" : "de "}${couple}*`);
  B.push(`${L(dm, true).charAt(0).toUpperCase() + L(dm, true).slice(1)}${lieu ? ", " + lieu : ""}`);
  B.push("");
  B.push(`Voici le fil de notre accompagnement, du premier rendez vous jusqu'au lendemain de votre mariage. Nous l'épinglons ici : chacun pourra s'y reporter à tout moment.`);
  B.push("");
  B.push(`*1. Votre fiche du mariage* ✓`);
  B.push(`Faite ensemble lors de notre premier rendez vous. Elle réunit vos choix : le programme, ${heb ? "l'hébergement, " : ""}la table et le ton de vos invitations.`);
  B.push("");
  B.push(`*2. Votre liste d'invités*, avant le ${L(m.date_remise || ck.date_remise)}`);
  B.push(`Vous nous transmettez vos contacts${listes.length ? ", ainsi que " + (listes.length > 1 ? listes.slice(0, -1).join(", ") + " et " + listes[listes.length - 1] : listes[0]) + (listes.length > 1 ? " pour leurs propres invités" : " pour ses propres invités") : ""}. Nous les mettons en forme et ne revenons vers vous que pour ce qui demande votre avis.${ck.support === "Oui" ? " Nous la complétons ensemble lors d'un rendez vous dédié." : ""}`);
  B.push("");
  B.push(`*3. Le premier contact avec vos invités*, dès la liste validée`);
  B.push(`Chaque foyer est contacté personnellement, puis reçoit son lien pour répondre.`);
  B.push("");
  B.push(`*4. Les réponses*, jusqu'au ${L(f.date_reponse)}`);
  B.push(`Vos invités confirment leur venue et nous disent ce qui compte pour eux. Leurs réponses restent modifiables jusqu'au ${L(f.date_modification)}. Vous suivez tout en direct depuis votre espace.`);
  B.push("");
  B.push(`*5. Le séjour et la logistique*`);
  B.push([heb ? "L'hébergement de vos invités" : null, (p.logistique && (p.logistique.navettes || []).length) || (f.trajets || []).length ? "les navettes" : null, f.arrivees === "Oui" ? "leurs arrivées" : null, sig ? "notre conciergerie pour ceux qui le souhaitent" : null].filter(Boolean).join(", ").replace(/^./, c => c.toUpperCase()) + (heb || sig ? ". Nous orchestrons, vous validez." : "Nous orchestrons le reste du séjour, vous validez."));
  B.push("");
  B.push(`*6. La clôture de la liste*, le ${L(arret)}`);
  B.push(`Le nombre final est arrêté et transmis au lieu et au traiteur.`);
  B.push("");
  B.push(`*7. Le plan de table et les pass*`);
  B.push(`Nous composons le plan avec vous. Chaque foyer reçoit son pass personnel le ${L(pass, true)}, trois jours avant le mariage.`);
  B.push("");
  B.push(`*8. Le jour J*, ${L(dm, true)}`);
  B.push(ck.regie === "Oui" ? `Notre équipe accueille vos invités et les accompagne jusqu'à leur table.` : `Vos invités sont attendus, leur place est prête.`);
  B.push("");
  B.push(`*9. Après le mariage*`);
  B.push(`Un mot de remerciement à vos invités, notre bilan ensemble, puis la suppression des données de vos invités avant le ${L(purge)}.`);
  B.push("");
  B.push(`Nous restons à votre écoute à chaque étape.`);
  B.push(`Régis et Cécilia · Yes I Do`);
  return B.join("\n");
}

module.exports = { composer };
