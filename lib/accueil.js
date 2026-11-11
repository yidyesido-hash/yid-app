/* =====================================================================
   L'ACCUEIL DE L'INVITÉ
   Ce que le lien personnel dira à chaque invité, à partir de sa fiche :
   la formule d'appel (prénom ou civilité et nom, selon le registre choisi
   avec le couple), une phrase d'accroche selon son lien avec les mariés,
   et l'état de son accompagnant (connu, à indiquer, non prévu).
   Aucune supposition : sans civilité, pas de « Cher » ni de « Chère ».
   ===================================================================== */
const CIVILITES = ["Madame", "Monsieur"];
const REGISTRES = ["Par le prénom", "Civilité et nom"];

/* Le profil regroupe les liens de la fiche en six familles d'attention. */
const PROFILS = {
  parents: ["Père / Mère"],
  fratrie: ["Frère / Sœur"],
  temoins: ["Témoin", "Demoiselle ou Garçon d'honneur"],
  famille: ["Grand-parent", "Oncle / Tante", "Cousin / Cousine", "Neveu / Nièce", "Famille élargie"],
  amis: ["Ami(e) proche", "Ami(e)", "Invité(e) des parents", "Invité(e) d'un proche", "Autre"],
  collegues: ["Collègue"]
};
const LIBELLES_PROFIL = { parents: "Parents", fratrie: "Frères et sœurs", temoins: "Témoins", famille: "Famille", amis: "Amis", collegues: "Collègues" };
function profil(lien) { for (const k of Object.keys(PROFILS)) if (PROFILS[k].includes(lien)) return k; return null; }

const propre = (s) => String(s || "").trim();
/* Le prénom de l'invité : celui de la fiche, sinon le premier mot du nom de répertoire. */
function prenomInvite(c) { return propre(c.prenom) || propre(c.nom_repertoire).split(/\s+/)[0] || ""; }
function nomInvite(c) {
  if (propre(c.nom)) return propre(c.nom);
  const mots = propre(c.nom_repertoire).split(/\s+/);
  return mots.length > 1 ? mots.slice(1).join(" ") : "";
}

/* Les mariés : le prénom du côté de l'invité, et le couple pour les formules communes. */
function maries(m) {
  const ck = ((m && m.parametres) || {}).checklist || {};
  const couple = propre(ck.prenoms || (m && m.prenoms));
  const morceaux = couple.split(/\s+(?:et|&)\s+/i);
  return { epoux: propre(ck.prenom_epoux), epouse: propre(ck.prenom_epouse), couple, pluriel: morceaux.length > 1 };
}
function registre(m) { const r = ((((m && m.parametres) || {}).checklist) || {}).registre; return r === "Civilité et nom" ? "civilite" : "prenom"; }

/* « Chère Madame Marchal, » ou « Chère Hélène, » ; sans civilité connue : « Bonjour Hélène, ». */
function salutation(c, m) {
  const civ = CIVILITES.includes(c.civilite) ? c.civilite : null;
  const cher = civ === "Madame" ? "Chère" : civ === "Monsieur" ? "Cher" : null;
  const nom = nomInvite(c), prenom = prenomInvite(c);
  if (registre(m) === "civilite" && civ && nom) return `${cher} ${civ} ${nom},`;
  if (cher && prenom) return `${cher} ${prenom},`;
  return prenom ? `Bonjour ${prenom},` : "Bonjour,";
}

/* Une phrase, jamais familière, qui montre que nous savons qui est l'invité. */
function accroche(c, m) {
  const p = profil(c.lien), mm = maries(m);
  const lui = c.cote === "Épouse" ? mm.epouse : c.cote === "Époux" ? mm.epoux : "";
  const couple = mm.couple || "Les mariés";
  const verbe = mm.pluriel ? "seraient" : "serait";
  if (p === "parents" && lui) return `${lui} tient à vous avoir à ses côtés, dès les premiers instants.`;
  if (p === "fratrie" && lui) return `${lui} compte sur votre présence, à ses côtés, tout au long de la journée.`;
  if (p === "temoins" && lui) return `${lui} compte sur vous à ses côtés ; nous veillerons à ce que rien ne vous manque.`;
  if (p === "famille") return `${couple} ${verbe} heureux de vous compter parmi leurs proches ce jour là.`;
  if (p === "collegues") return `${couple} ${verbe} honorés de votre présence.`;
  return `${couple} ${verbe} heureux de vous compter parmi leurs invités.`;
}

/* L'accompagnant : connu (on le nomme), à indiquer par l'invité, non prévu, ou encore à décider avec le couple. */
function accompagnant(c) {
  if (c.invitation === "Invitation unique") return { etat: "non prévu", libelle: "Invitation nominative" };
  if (c.invitation === "Invitation pour deux") return propre(c.accompagnant) ? { etat: "connu", libelle: propre(c.accompagnant) } : { etat: "à indiquer", libelle: "L'invité indiquera qui l'accompagne" };
  return { etat: "à décider", libelle: "À décider avec le couple" };
}

function apercu(c, m) {
  return { salutation: salutation(c, m), accroche: accroche(c, m), accompagnant: accompagnant(c), profil: profil(c.lien), registre: registre(m) };
}

module.exports = { CIVILITES, REGISTRES, PROFILS, LIBELLES_PROFIL, profil, salutation, accroche, accompagnant, apercu, maries, registre };
