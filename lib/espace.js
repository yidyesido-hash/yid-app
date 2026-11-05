/* =====================================================================
   ESPACE MARIÉS · la face visible de l'application pour le couple
   Même base que l'équipe : ce que YID remplit s'affiche chez le couple,
   ce que le couple complète s'affiche chez YID, tout est au journal
   « Le couple · Prénoms ». Entrée par un lien personnel avec clé.
   Jamais montré : lots, anomalies et leurs motifs, sources, notes,
   journal, séjour et logistique, réglages.
   ===================================================================== */
const crypto = require("crypto");
const db = require("./db");
const store = require("./store");
const liste = require("./liste");

/* le parcours vu par le couple : les étapes de l'équipe sauf Séjour et logistique */
const PARCOURS = [
  { n: 1, t: "Le cadre de votre mariage", d: "Date, lieu, nombre d'invités, enfants, hébergement : les fondations posées ensemble." },
  { n: 2, t: "Votre liste d'invités", d: "Vos contacts deviennent une liste claire, invité par invité, jusqu'à ce que tout soit vert." },
  { n: 3, t: "Premier contact et invitations", d: "Nous prenons contact avec chacun de vos invités et leur remettons leur invitation." },
  { n: 4, t: "Confirmations", d: "Les réponses arrivent, nous relançons avec tact, vous suivez tout ici." },
  { n: 6, t: "Plan de table et jour J", d: "Le placement de vos invités, puis l'accueil le jour J." },
  { n: 7, t: "Après le mariage", d: "Les derniers remerciements et la clôture du dossier." }
];
const REGLES_OR = [
  "Complétez chaque invité affiché en rouge : dès qu'il passe au vert, tout y est, passez au suivant.",
  "Un couple invité = une seule fiche, désignée Invitation pour deux.",
  "Ne supprimez jamais une ligne : retirez l'invité, il reste visible en gris et peut revenir.",
  "Un oubli, un ajout, un doute ? Renvoyez nous les contacts : notre outil gère les doublons."
];
const CHAMPS_COUPLE = ["cote", "invitation", "lien", "precision", "nb_enfants", "hebergement", "assistance", "nom", "prenom", "periodes"];
const RETIRE = "Retiré par le couple";

const jetonValide = (j) => /^[A-Za-z0-9_-]{24,64}$/.test(String(j || ""));
async function parJeton(j) {
  if (!jetonValide(j)) return null;
  const m = (await db.query("SELECT * FROM mariage WHERE espace_jeton = $1 AND NOT desactive", [String(j)]))[0];
  return m || null;
}
const qui = (m) => "Le couple · " + m.prenoms;

/* ---------- côté équipe : créer, renouveler, couper le lien ; choisir le parcours ---------- */
async function gerer(code, op, valeur, operateur) {
  const m = await store.mariageFresh(code); if (!m) throw new Error("mariage inconnu");
  if (op === "creer" || op === "renouveler") {
    const j = crypto.randomBytes(24).toString("base64url");
    await db.query("UPDATE mariage SET espace_jeton = $2, espace_le = now(), modifie_le = now() WHERE id = $1", [m.id, j]);
    await store.journal(m.id, op === "creer" ? "Espace mariés ouvert" : "Lien de l'espace mariés renouvelé", op === "creer" ? "lien personnel créé" : "l'ancien lien ne fonctionne plus", null, null, operateur);
  } else if (op === "couper") {
    await db.query("UPDATE mariage SET espace_jeton = NULL, modifie_le = now() WHERE id = $1", [m.id]);
    await store.journal(m.id, "Espace mariés fermé", "le lien ne fonctionne plus", null, null, operateur);
  } else if (op === "modifiable") {
    const v = !!valeur;
    await db.query("UPDATE mariage SET espace_modifiable = $2, modifie_le = now() WHERE id = $1", [m.id, v]);
    await store.journal(m.id, "Parcours de l'espace mariés", v ? "le couple complète sa liste" : "Yes I Do complète, le couple consulte", { modifiable: m.espace_modifiable }, { modifiable: v }, operateur);
  } else throw new Error("opération inconnue");
  const f = await store.mariageFresh(code);
  return { jeton: f.espace_jeton || null, modifiable: f.espace_modifiable !== false, le: f.espace_le || null };
}

/* ---------- ce que voit le couple ---------- */
const ETAT_COUPLE = { "complète": "complet", "à compléter": "à compléter", "à voir": "avec Yes I Do", "désactivée": "retiré" };
function ligne(c) {
  return {
    id: c.id, nom: c.nom_repertoire || "", numero: c.numero || "", prenom: c.prenom || "", nom_famille: c.nom || "",
    cote: c.cote || "", invitation: c.invitation || "", lien: c.lien || "", precision: c.precision || "",
    nb_enfants: c.nb_enfants == null ? null : c.nb_enfants, hebergement: c.hebergement || "", assistance: c.assistance ? "Oui" : "",
    periodes: liste.presences(c), etat: c.desactive ? "retiré" : (ETAT_COUPLE[c.etat] || c.etat), manque: c.desactive || c.etat === "à voir" ? [] : (c.manque || []),
    retire_par_vous: !!(c.desactive && String(c.motif_desactivation || "").indexOf(RETIRE) === 0),
    proche: c.proche || ""
  };
}
async function voir(m) {
  const j = await liste.liste(m.code), r = j.regles, t = j.tuiles, p = m.parametres || {}, c = p.checklist || {};
  const lignes = j.contacts.map(ligne);
  return {
    mariage: {
      prenoms: m.prenoms, date: m.date_mariage, lieu: m.lieu || "", etape: m.etape || 1, etapes: m.etapes || {},
      prevu: m.prevu_contrat || null, plafond: m.seuil || null, remise: m.date_remise || null, arret: m.date_arret || null,
      enfants: r.enfants, consigne_enfants: r.consigne_enfants || "", hebergement: r.hebergement, lieux: r.lieux, periodes: r.periodes,
      email_epoux: c.email_epoux ? true : false, boite: m.boite_email || null, modifiable: m.espace_modifiable !== false
    },
    parcours: PARCOURS, regles_or: REGLES_OR,
    tuiles: {
      recues: t.recues, completees: t.completees, attendus: t.attendus, estimation_haute: t.estimation_haute, a_confirmer: t.a_confirmer,
      enfants: t.enfants, convives: t.convives, plafond: t.plafond, prevu: t.prevu, loges: t.loges, desactives: t.desactives,
      avec_yid: { n: lignes.filter(l => l.etat === "avec Yes I Do").length }, a_completer: { n: lignes.filter(l => l.etat === "à compléter").length }
    },
    quotas: j.quotas,
    contacts: lignes, cotes: j.cotes, invitations: j.invitations, liens: j.liens, precisions: r.precisions || [], precision_obligatoire: liste.PRECISION_OBLIGATOIRE,
    signature: lignes.map(l => [l.id, l.etat, l.cote, l.invitation, l.lien, l.precision, l.nb_enfants, l.hebergement, l.assistance, l.periodes.join("|"), l.prenom, l.nom_famille].join(":")).join(",").length + ":" + crypto.createHash("sha1").update(JSON.stringify(lignes)).digest("hex").slice(0, 12)
  };
}

async function visible(m, id) {
  const c = (await db.query("SELECT id, desactive, motif_desactivation FROM contact_recu WHERE mariage_id = $1 AND id = $2 AND NOT coalesce(archive, false)", [m.id, Number(id)]))[0];
  if (!c) throw new Error("Cet invité n'est plus dans votre liste.");
  return c;
}
async function qualifier(m, id, champs) {
  if (m.espace_modifiable === false) throw new Error("Votre liste est tenue par Yes I Do : écrivez nous, nous faisons la modification pour vous.");
  await visible(m, id);
  const propres = {}; for (const k of CHAMPS_COUPLE) if (champs && champs[k] !== undefined) propres[k] = champs[k];
  if (!Object.keys(propres).length) throw new Error("Rien à enregistrer.");
  await liste.qualifier(m.code, Number(id), propres, qui(m));
}
async function retirer(m, id, retire) {
  if (m.espace_modifiable === false) throw new Error("Votre liste est tenue par Yes I Do : écrivez nous, nous faisons la modification pour vous.");
  const c = await visible(m, id);
  if (!retire && c.desactive && String(c.motif_desactivation || "").indexOf(RETIRE) !== 0) throw new Error("Cet invité a été retiré avec Yes I Do : parlons en ensemble avant de le remettre.");
  await liste.desactiver(m.code, [Number(id)], !!retire, retire ? RETIRE : "", qui(m));
}
async function deposer(m, fichiers, cote) {
  if (!fichiers.length) throw new Error("Aucun fichier reçu.");
  const a = await liste.importer(m.code, { source: "Espace mariés", cote: ["Époux", "Épouse"].includes(cote) ? cote : "", origine: "espace mariés" }, fichiers, qui(m));
  return { lus: a.lus, ajoutes: a.ajoutes, connus: a.connus, avec_yid: a.a_voir, vides: a.vides || 0 };
}

module.exports = { PARCOURS, REGLES_OR, CHAMPS_COUPLE, gerer, parJeton, voir, qualifier, retirer, deposer, qui };
