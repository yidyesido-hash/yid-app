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
const accueil = require("./accueil");

/* le parcours vu par le couple : les sept étapes de l'équipe, chacune avec sa page.
   Le séjour est montré sans aucun prix, sans fournisseur négocié, sans détail de santé. */
const PARCOURS = [
  { n: 1, c: "Le cadre", t: "Le cadre de votre mariage", d: "Date, lieu, programme de la journée, enfants, hébergement : les fondations posées ensemble." },
  { n: 2, c: "Votre liste", t: "Votre liste d'invités", d: "Vos contacts deviennent une liste claire, invité par invité, jusqu'à ce que tout soit vert." },
  { n: 3, c: "Premier contact", t: "Premier contact et invitations", d: "Nous prenons contact avec chacun de vos invités et leur remettons leur accès personnel." },
  { n: 4, c: "Confirmations", t: "Confirmations", d: "Les réponses arrivent, nous relançons avec tact, et nous vous soumettons ce qui demande votre accord." },
  { n: 5, c: "Le séjour", t: "Le séjour de vos invités", d: "Qui loge où, les arrivées et les navettes." },
  { n: 6, c: "Table et jour J", t: "Plan de table et jour J", d: "Le placement de vos invités, puis leur accueil le jour J." },
  { n: 7, c: "Après", t: "Après le mariage", d: "Le bilan, les remerciements et la suppression des données de vos invités." }
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
    periodes: liste.presences(c), a_demander: c.desactive ? [] : (c.a_demander || []), etat: c.desactive ? "retiré" : (ETAT_COUPLE[c.etat] || c.etat), manque: c.desactive || c.etat === "à voir" ? [] : (c.manque || []),
    retire_par_vous: !!(c.desactive && String(c.motif_desactivation || "").indexOf(RETIRE) === 0),
    proche: c.proche || "", cercle: accueil.cercle(c.lien), accueil: c.accueil && !c.desactive ? c.accueil.salutation + " " + c.accueil.accroche : null,
    /* le suivi en direct : où en est l'invité, sans rien de l'administration */
    contact: c.desactive ? null : ({ "envoyé": "message envoyé", "a répondu": "a répondu à notre message", "lien envoyé": "a reçu son accès personnel", "joint": "joint par téléphone", "rendez-vous proposé": "rendez vous proposé", "rendez-vous fixé": "rendez vous fixé", "parcours fait": "parcours fait ensemble" })[(c.premier_contact || {}).etat] || null,
    reponse: c.reponse_le ? { present: !/regret/.test((c.reponse || {}).presence || ""), accompagnant: (c.reponse || {}).accompagnant || null, enfants: Array.isArray((c.reponse || {}).enfants) ? c.reponse.enfants.length : 0, le: c.reponse_le } : null
  };
}
/* Le bouton de contact du couple : les photos de Cécilia et Régis, leurs lignes YID directes (réglages). */
async function equipe() {
  const rows = await db.query("SELECT cle, valeur FROM reglage WHERE cle IN ('tel_cecilia', 'tel_regis', 'tel_ligne')");
  const v = {}; for (const r of rows) v[r.cle] = String(r.valeur || "").trim();
  const wa = (t) => t ? "https://wa.me/" + t.replace(/[^0-9]/g, "") : "";
  const tel = (t) => t ? "tel:" + t.replace(/[^0-9+]/g, "") : "";
  const ph = {}; for (const r of await db.query("SELECT nom, photo FROM utilisateur WHERE photo IS NOT NULL AND NOT desactive")) ph[String(r.nom).toLowerCase()] = r.photo;
  const photo = (n, d) => ph[n] || d;
  return [{ prenom: "Cécilia", photo: photo("cécilia", photo("cecilia", photo("cess", "/img/cess.jpg"))), tel: tel(v.tel_cecilia || v.tel_ligne), whatsapp: wa(v.tel_cecilia || v.tel_ligne) }, { prenom: "Régis", photo: photo("régis", photo("regis", "/img/regis.jpg")), tel: tel(v.tel_regis || v.tel_ligne), whatsapp: wa(v.tel_regis || v.tel_ligne) }];
}
async function voir(m) {
  const j = await liste.liste(m.code), r = j.regles, t = j.tuiles, p = m.parametres || {}, c = p.checklist || {};
  const lignes = j.contacts.map(ligne);
  return {
    mariage: {
      prenoms: m.prenoms, photo: m.photo_cle ? "/api/forms?action=photo&k=" + m.photo_cle : null, date: m.date_mariage, lieu: m.lieu || "", etape: m.etape || 1, etapes: m.etapes || {},
      prevu: m.prevu_contrat || null, plafond: m.seuil || null, remise: m.date_remise || null, arret: m.date_arret || null,
      enfants: r.enfants, consigne_enfants: r.consigne_enfants || "", hebergement: r.hebergement, lieux: r.lieux, periodes: r.periodes,
      email_epoux: c.email_epoux ? true : false, boite: m.boite_email || null, modifiable: m.espace_modifiable !== false,
      site: m.site ? (/^https?:/.test(m.site) ? m.site : "https://" + m.site) : null, formulaire: require("./formulaire").actif(m),
      feuille_route: ((m.parametres || {}).feuille_route) ? require("./feuille").composer(m) : null,
      programme: (((p.formulaire || {}).programme) || []).map(x => ({ heure: x.heure || "", libelle: x.libelle || "", lieu: x.lieu || "", invitation: /invitation/i.test(x.acces || "") })),
      test: m.statut === "Test"
    },
    a_faire: aFaire(m, j, lignes),
    parcours: PARCOURS, regles_or: REGLES_OR, equipe: await equipe(),
    tuiles: {
      recues: t.recues, completees: t.completees, attendus: t.attendus, estimation_haute: t.estimation_haute, a_confirmer: t.a_confirmer,
      enfants: t.enfants, convives: t.convives, plafond: t.plafond, prevu: t.prevu, loges: t.loges, desactives: t.desactives,
      avec_yid: { n: lignes.filter(l => l.etat === "avec Yes I Do").length },
      reponses: { n: lignes.filter(l => l.reponse).length, presents: lignes.filter(l => l.reponse && l.reponse.present).length, absents: lignes.filter(l => l.reponse && !l.reponse.present).length, contactes: lignes.filter(l => l.contact).length }, a_completer: { n: lignes.filter(l => l.etat === "à compléter").length }
    },
    quotas: j.quotas,
    attente: j.attente.map(a => ({ rang: a.rang, nom: a.nom_repertoire, cote: a.cote || "" })),
    contacts: lignes, cotes: j.cotes, invitations: j.invitations, liens: j.liens, precisions: r.precisions || [], precision_obligatoire: liste.PRECISION_OBLIGATOIRE,
    signature: lignes.map(l => [l.id, l.etat, l.cote, l.invitation, l.lien, l.precision, l.nb_enfants, l.hebergement, l.assistance, l.periodes.join("|"), l.prenom, l.nom_famille].join(":")).join(",").length + ":" + crypto.createHash("sha1").update(JSON.stringify(lignes)).digest("hex").slice(0, 12)
  };
}

/* ---------- ce qui attend le couple, étape par étape : la seule chose à faire sur chaque page ---------- */
const present = (c) => c.reponse_le && !/regret/.test((c.reponse || {}).presence || "");
const personnes = (c) => { const r = c.reponse || {}; if (Number.isInteger(r.personnes)) return r.personnes; return 1 + (r.accompagnant ? 1 : 0) + (Array.isArray(r.enfants) ? r.enfants.length : 0); };
/* Les demandes soumises aux mariés : aujourd'hui, une autre personne que celle prévue quand la liste est protégée. */
function demandes(m, j) {
  const D = ((m.parametres || {}).decisions) || {};
  return j.contacts.filter(c => !c.desactive && present(c) && (((c.reponse || {}).etat || {}).acc || {}).choix === "autre" && (((m.parametres || {}).formulaire || {}).protection_liste ? !/^non/i.test(String(m.parametres.formulaire.protection_liste)) : false))
    .map(c => { const a = c.reponse.etat.acc, d = D[c.id] || null; return { id: c.id, invite: c.nom_repertoire, personne: [a.prenom, a.nom].filter(Boolean).join(" ") || null, decision: d ? (d.accord ? "accord" : "refus") : null, le: d ? d.le : null, transmise: !!(d && d.transmise) }; });
}
function aFaire(m, j, lignes) {
  const dem = demandes(m, j).filter(d => !d.decision).length, P = ((m.parametres || {}).plan) || {}, rouges = lignes.filter(l => l.etat === "à compléter").length;
  const o = {};
  if (rouges && m.espace_modifiable !== false) o[2] = rouges + (rouges > 1 ? " précisions à nous donner" : " précision à nous donner");
  if (dem) o[4] = dem + (dem > 1 ? " demandes attendent votre décision" : " demande attend votre décision");
  const pres = j.contacts.filter(c => !c.desactive && present(c));
  if ((P.tables || []).length && pres.length && pres.every(c => (P.placements || {})[c.id]) && !P.valide_couple) o[6] = "Votre plan de table attend votre validation";
  return o;
}
async function etape(m, n) {
  const code = m.code, p = m.parametres || {}, j = await liste.liste(code), act = j.contacts.filter(c => !c.desactive);
  if (n === 3) {
    const emails = require("./emails"), E = { "envoyé": "Message envoyé", "a répondu": "A répondu à notre message", "lien envoyé": "A reçu son accès personnel", "joint": "Joint par téléphone", "rendez-vous proposé": "Rendez vous proposé", "rendez-vous fixé": "Rendez vous fixé", "parcours fait": "Parcours fait ensemble", "à rappeler": "À rappeler", "messagerie": "Message vocal laissé" };
    const suivi = act.filter(c => c.etat === "complète").map(c => ({ nom: c.nom_repertoire, etat: E[(c.premier_contact || {}).etat] || "À contacter", fait: !!E[(c.premier_contact || {}).etat], acces: ["lien envoyé", "parcours fait"].includes((c.premier_contact || {}).etat) || !!c.reponse_le }));
    const envois = (p.emails || []).filter(c => Object.keys(c.envoyes || {}).length).map(c => { const ids = Object.keys(c.envoyes), ex = act.find(x => String(x.id) === ids[0]) || act[0], dates = ids.map(k => (c.envoyes[k] && c.envoyes[k].le) || c.envoyes[k]).filter(Boolean).sort();
      return { nom: c.nom, n: ids.length, le: dates[0] || null, objet: ex ? emails.remplir(c.objet, ex, m) : c.objet, texte: ex ? emails.remplir(c.corps, ex, m) : c.corps, exemple: ex ? ex.nom_repertoire : null }; }).sort((a, b) => String(b.le).localeCompare(String(a.le)));
    return { total: suivi.length, contactes: suivi.filter(s => s.fait).length, acces: suivi.filter(s => s.acces).length, suivi, envois };
  }
  if (n === 4) {
    const rep = act.filter(c => c.reponse_le), pres = act.filter(present), f = p.formulaire || {};
    const plats = {}, moments = {}; let adultes = 0, enfants = 0, menusEnfant = 0;
    for (const c of pres) for (const d of ((c.reponse || {}).detail || [])) {
      if (d.role === "enfant") enfants++; else adultes++;
      if (d.plat) plats[d.plat] = (plats[d.plat] || 0) + 1; else if (d.role === "enfant" && d.age > 0) menusEnfant++;
      for (const k of (d.moments || [])) moments[k] = (moments[k] || 0) + 1;
    }
    const prog = require("./formulaire").moments(f).map(x => ({ id: x.id, l: (x.l && x.l.fr) || x.l || "", n: moments[x.id] || 0 }));
    return { invites: act.filter(c => c.etat === "complète").length, reponses: rep.length, presents: pres.length, absents: rep.length - pres.length, attente: act.filter(c => c.etat === "complète" && !c.reponse_le).length,
      personnes: pres.reduce((s, c) => s + personnes(c), 0), adultes, enfants, plats: Object.keys(plats).map(k => ({ l: k, n: plats[k] })).sort((a, b) => b.n - a.n), menus_enfant: menusEnfant, moments: prog,
      date_reponse: f.date_reponse || p.date_limite_reponse || null, demandes: demandes(m, j),
      liste: act.filter(c => c.etat === "complète").map(c => ({ nom: c.nom_repertoire, etat: c.reponse_le ? (present(c) ? "présent" : "absent") : "en attente", personnes: present(c) ? personnes(c) : 0 })) };
  }
  if (n === 5) {
    const L = await require("./logistique").vue(code), pres = act.filter(present);
    const arr = pres.map(c => { const e = ((c.reponse || {}).etat) || {}, v = e.voyage || {}; return { nom: c.nom_repertoire, personnes: personnes(c), arrivee: (c.reponse || {}).arrivee || "", depart: (c.reponse || {}).depart || "" }; }).filter(x => x.arrivee || x.depart);
    const resa = pres.filter(c => (c.reponse || {}).reservation).map(c => { const r = c.reponse.reservation; return { nom: c.nom_repertoire, maison: r.maison || r.nom || "", chambres: r.chambres || 1 }; });
    return { hotels: L.hotels.map(h => ({ nom: h.nom, foyers: h.foyers, personnes: h.personnes, invites: h.invites.map(i => ({ nom: i.nom, personnes: i.personnes })) })),
      navettes: L.navettes.map(v => ({ moment: v.moment, de: v.de, vers: v.vers, depart: v.depart || "", places: v.aller, retours: v.retours })), arrivees: arr, reservations: resa, presents: L.presents, personnes: L.personnes };
  }
  if (n === 6) {
    const R = await require("./plan").vue(code), P = p.plan || {}, noms = {}; R.foyers.forEach(f => { noms[f.id] = f; });
    const ex = R.foyers.find(f => f.jeton) || null;
    return { tables: R.tables.map(t => ({ nom: t.nom, places: t.places, occupees: t.occupees, invites: t.foyers.map(id => ({ nom: (noms[id] || {}).nom, personnes: (noms[id] || {}).personnes })) })),
      a_placer: R.a_placer, personnes: R.personnes, arrives: R.arrives, foyers_arrives: R.foyers.filter(f => f.arrive).length, foyers: R.foyers.length,
      soumis: !!P.soumis_couple, valide: P.valide_couple || null, pass: R.pass || null, pass_exemple: ex ? "/pass.html?yid=" + ex.jeton + "&j=" + m.espace_jeton : null,
      jour_j: m.date_mariage ? String(m.date_mariage).slice(0, 10) <= new Date().toISOString().slice(0, 10) || R.arrives > 0 : false };
  }
  if (n === 7) {
    const C = await require("./cloture").vue(code), b = C.bilan || {};
    return { passe: C.passe || C.test && !!(m.etapes || {})[6], purge_prevue: C.purge_prevue, purge: C.purge ? (C.purge.le || true) : null, close: C.close,
      bilan: { invites: b.invites, reponses: b.reponses, taux_reponse: b.taux_reponse, presents: b.presents, personnes_attendues: b.personnes_attendues, personnes_accueillies: b.personnes_accueillies, delai_median_jours: b.delai_median_jours, tables: b.tables } };
  }
  return {};
}
/* Le couple tranche une demande : accord ou refus, inscrit au journal, visible de l'équipe dans les points à traiter. */
async function decider(m, id, accord) {
  const j = await liste.liste(m.code), d = demandes(m, j).find(x => x.id === Number(id));
  if (!d) throw new Error("Cette demande n'est plus en attente.");
  const p = m.parametres || {}; p.decisions = p.decisions || {};
  p.decisions[d.id] = { accord: !!accord, le: new Date().toISOString(), par: qui(m) };
  await db.query("UPDATE mariage SET parametres = $2, modifie_le = now() WHERE id = $1", [m.id, p]);
  await store.journal(m.id, "Décision des mariés", `${d.invite} : ${d.personne || "autre personne"}, ${accord ? "accord" : "refus"}`, null, { accord: !!accord }, qui(m));
}
/* côté équipe : la décision a été transmise à l'invité */
async function transmise(code, id, u) {
  const m = await store.mariageFresh(code), p = m.parametres || {}, d = (p.decisions || {})[Number(id)];
  if (!d) throw new Error("Aucune décision des mariés sur cette demande.");
  d.transmise = { le: new Date().toISOString(), par: u.nom };
  await db.query("UPDATE mariage SET parametres = $2, modifie_le = now() WHERE id = $1", [m.id, p]);
  await store.journal(m.id, "Décision des mariés", "Décision transmise à l'invité", null, null, u.nom);
}
async function validerPlan(m) {
  const p = m.parametres || {}, P = p.plan || {};
  if (!(P.tables || []).length) throw new Error("Le plan de table n'est pas encore prêt.");
  P.valide_couple = { le: new Date().toISOString(), par: qui(m) }; p.plan = P;
  await db.query("UPDATE mariage SET parametres = $2, modifie_le = now() WHERE id = $1", [m.id, p]);
  await store.journal(m.id, "Plan de table", "Plan validé par le couple", null, null, qui(m));
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
/* « Je ne sais pas, demandez lui » : ce qui manque sera demandé à l'invité au premier contact. */
async function demanderInvite(m, id) {
  if (m.espace_modifiable === false) throw new Error("Votre liste est tenue par Yes I Do : écrivez nous, nous faisons la modification pour vous.");
  await visible(m, id);
  const d = await liste.demander(m.code, [Number(id)], false, qui(m));
  if (d.restent && d.restent.length) throw new Error("Dites nous d'abord de quel côté est cet invité et son lien avec vous.");
}
async function retirer(m, id, retire) {
  if (m.espace_modifiable === false) throw new Error("Votre liste est tenue par Yes I Do : écrivez nous, nous faisons la modification pour vous.");
  const c = await visible(m, id);
  if (!retire && c.desactive && String(c.motif_desactivation || "").indexOf(RETIRE) !== 0) throw new Error("Cet invité a été retiré avec Yes I Do : parlons en ensemble avant de le remettre.");
  await liste.desactiver(m.code, [Number(id)], !!retire, retire ? RETIRE : "", qui(m));
}
async function deposer(m, fichiers, cote, attente) {
  if (!fichiers.length) throw new Error("Aucun fichier reçu.");
  const a = await liste.importer(m.code, { source: attente ? "Liste d'attente, espace mariés" : "Espace mariés", cote: ["Époux", "Épouse"].includes(cote) ? cote : "", origine: "espace mariés", attente: !!attente }, fichiers, qui(m));
  return { lus: a.lus, ajoutes: a.ajoutes, connus: a.connus, vides: a.vides || 0, attente: !!attente };
}

module.exports = { transmise, etape, decider, validerPlan, demandes, equipe, demanderInvite, PARCOURS, REGLES_OR, CHAMPS_COUPLE, gerer, parJeton, voir, qualifier, retirer, deposer, qui };
