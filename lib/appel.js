/* =====================================================================
   L'APPEL GUIDÉ (R8) · qualification de la liste avec le couple
   L'application guide l'appelant étape par étape. Une étape ne se valide
   que si ce qu'elle exige est fait ; on ne passe pas à la suivante sans
   l'avoir validée ; on peut revenir en arrière et rouvrir une étape.
   L'appel interrompu reprend là où il s'est arrêté. À 100 %, il se clôt
   et s'inscrit au journal avec sa durée, l'appelant et son bilan.
   État : mariage.parametres.appel (en cours) et .appels (historique).
   ===================================================================== */
const db = require("./db");
const store = require("./store");
const liste = require("./liste");

const MODES = [
  { n: 1, l: "Un message avec le lien" },
  { n: 2, l: "Deux messages enchaînés" },
  { n: 3, l: "Un message sans lien, puis le lien dès que l'invité répond" }
];
const RYTHMES = ["Tous les trois jours", "Une fois par semaine", "Deux fois avant la date limite", "Pas de relance automatique"];
const QUI = ["Régis", "Cécilia", "Régis et Cécilia"];

const ETAPES = [
  { n: 1, titre: "Accueil et cadre de l'appel", script: "« Merci de prendre ce moment. Nous allons revoir ensemble votre liste, une vingtaine de minutes, puis décider de la façon d'écrire à vos invités. »", aide: "Annoncez la durée, puis choisissez avec le couple la façon de s'adresser à leurs invités." },
  { n: 2, titre: "Les invités à préciser", script: "« Il nous reste quelques invités sur lesquels nous avons besoin de vous. Je vous les cite un par un. »", aide: "Chaque fiche rouge se complète avec le couple, ou part en « à demander à l'invité ». On ne passe pas à l'invité suivant tant que la fiche est rouge." },
  { n: 3, titre: "Les proches à accompagner", script: "« Parmi vos invités, qui aimeriez vous que nous appelions personnellement, pour faire le parcours ensemble ? »", aide: "Grands parents, invités peu à l'aise avec le numérique, proches venus de loin. Puis qui les appelle, et à quel moment." },
  { n: 4, titre: "La façon d'écrire aux invités", script: "« Nous écrirons à vos invités sur WhatsApp. Je vous propose un premier message sans lien, puis leur accès personnel dès qu'ils répondent. »", aide: "Choisissez le mode d'envoi, et confirmez que le couple prévient ses invités qu'un message de Yes I Do va arriver." },
  { n: 5, titre: "Le calendrier des relances", script: "« Quelle date limite de réponse souhaitez vous, et à quel rythme voulez vous que nous relancions ? »", aide: "Une date limite et un rythme de relance." },
  { n: 6, titre: "Récapitulatif et clôture", script: "« Je vous résume ce que nous avons décidé, et je vous envoie ce récapitulatif dans l'heure. »", aide: "Relisez le bilan avec le couple, puis closez l'appel." }
];

const ANNONCE = (prenoms) => `Nous avons confié l'accueil de nos invités à Yes I Do. Vous allez recevoir un message de leur part sur WhatsApp, au nom de notre mariage : merci de leur réserver le meilleur accueil. ${prenoms || ""}`.trim();

function etat(m) { const p = m.parametres || {}; return { p, a: p.appel || null }; }
async function sauver(m, p) { await db.query("UPDATE mariage SET parametres = $2, modifie_le = now() WHERE id = $1", [m.id, p]); }

/* Ce que chaque étape exige, calculé sur les données vivantes du mariage.
   facultatif : signalé, ne bloque pas. */
function exigences(n, a, j, m) {
  const d = a.donnees || {}, ck = ((m.parametres || {}).checklist) || {}, actifs = j.contacts.filter(c => !c.desactive);
  if (n === 1) return [
    { l: "Durée de l'appel annoncée au couple", ok: !!d.duree, k: "duree" },
    { l: "Façon de s'adresser aux invités choisie", ok: !!ck.registre, k: "registre" }];
  if (n === 2) { const r = actifs.filter(c => c.etat === "à compléter").length, ind = actifs.filter(c => !c.invitation || c.invitation === "Ne sait pas encore").length; return [
    { l: r ? r + " fiche(s) encore rouge(s)" : "Toutes les fiches sont complètes ou demandées aux invités", ok: r === 0 },
    { l: ind ? ind + " invitation(s) encore à décider" : "Chaque invitation est décidée", ok: ind === 0, facultatif: true }]; }
  if (n === 3) { const nb = actifs.filter(c => c.assistance).length; return nb ? [
    { l: nb + " proche(s) désigné(s)", ok: true },
    { l: "Qui les appelle", ok: !!d.qui, k: "qui" },
    { l: "Moment préféré pour les appeler", ok: !!String(d.creneau || "").trim(), k: "creneau" }] : [{ l: "Désigner des proches, ou confirmer qu'il n'y en a pas", ok: !!d.aucun_proche, k: "aucun_proche" }]; }
  if (n === 4) return [
    { l: "Mode d'envoi choisi", ok: [1, 2, 3].includes(Number(d.mode)), k: "mode" },
    { l: "Le couple prévient ses invités", ok: !!d.annonce, k: "annonce" }];
  if (n === 5) return [
    { l: "Date limite de réponse", ok: /^\d{4}-\d{2}-\d{2}$/.test(d.date_limite || ""), k: "date_limite" },
    { l: "Rythme des relances", ok: RYTHMES.includes(d.rythme), k: "rythme" }];
  if (n === 6) return [{ l: "Récapitulatif relu avec le couple", ok: !!d.recap, k: "recap" }];
  return [];
}

function bilan(a, j, m) {
  const d = a.donnees || {}, actifs = j.contacts.filter(c => !c.desactive);
  const mode = MODES.find(x => x.n === Number(d.mode));
  return {
    completes: actifs.filter(c => c.etat === "complète").length,
    total: actifs.length,
    a_demander: actifs.filter(c => (c.a_demander || []).length || ((c.qualification || {}).a_demander || []).length).length,
    proches: actifs.filter(c => c.assistance).map(c => c.nom_repertoire),
    qui: d.qui || null, creneau: d.creneau || null,
    mode: mode ? mode.l : null, date_limite: d.date_limite || null, rythme: d.rythme || null,
    registre: (((m.parametres || {}).checklist) || {}).registre || "Par le prénom"
  };
}

async function vue(code) {
  const m = await store.mariageFresh(code); if (!m) throw new Error("mariage inconnu");
  const { p, a } = etat(m);
  const historique = (p.appels || []).slice(-5).reverse();
  if (!a) return { en_cours: false, historique, modes: MODES, rythmes: RYTHMES, qui: QUI };
  const j = await liste.liste(code);
  const etapes = ETAPES.map(e => { const ex = exigences(e.n, a, j, m); return Object.assign({}, e, { exigences: ex, pret: ex.every(x => x.ok || x.facultatif), valide: !!(a.etapes || {})[e.n] }); });
  const faites = etapes.filter(e => e.valide).length;
  const courante = (etapes.find(e => !e.valide) || etapes[etapes.length - 1]).n;
  const actifs = j.contacts.filter(c => !c.desactive);
  return {
    en_cours: true, appel: a, etapes, courante, pct: Math.round(faites / ETAPES.length * 100), historique,
    modes: MODES, rythmes: RYTHMES, qui: QUI, annonce: ANNONCE(m.prenoms), registres: ["Par le prénom", "Civilité et nom"],
    registre: (((m.parametres || {}).checklist) || {}).registre || "",
    rouges: actifs.filter(c => c.etat === "à compléter").map(c => ({ id: c.id, nom: c.nom_repertoire, numero: c.numero, cote: c.cote, lien: c.lien, invitation: c.invitation, manque: c.manque, accueil: c.accueil })),
    proches: actifs.map(c => ({ id: c.id, nom: c.nom_repertoire, assistance: !!c.assistance, cote: c.cote, lien: c.lien })),
    cotes: j.cotes, liens: j.liens, invitations: j.invitations, lieux: j.regles.lieux,
    bilan: bilan(a, j, m)
  };
}

async function agir(code, op, b, operateur) {
  const m = await store.mariageFresh(code); if (!m) throw new Error("mariage inconnu");
  const { p } = etat(m); let a = p.appel || null;
  if (op === "demarrer") {
    if (!a) { a = { debut: new Date().toISOString(), par: operateur, etapes: {}, donnees: {}, notes: "" }; p.appel = a; await sauver(m, p); await store.journal(m.id, "Appel guidé", "Appel de qualification démarré", null, null, operateur); }
    return;
  }
  if (!a) throw new Error("Aucun appel en cours : démarrez l'appel.");
  if (op === "donnee") {
    const k = String(b.k || ""), v = b.v;
    if (k === "registre") {
      if (!["Par le prénom", "Civilité et nom"].includes(v)) throw new Error("formule inconnue");
      p.checklist = Object.assign({}, p.checklist || {}, { registre: v });
    } else if (["duree", "aucun_proche", "annonce", "recap"].includes(k)) a.donnees[k] = !!v;
    else if (k === "qui") { if (!QUI.includes(v)) throw new Error("appelant inconnu"); a.donnees.qui = v; }
    else if (k === "creneau") a.donnees.creneau = String(v || "").slice(0, 200);
    else if (k === "mode") { if (![1, 2, 3].includes(Number(v))) throw new Error("mode inconnu"); a.donnees.mode = Number(v); }
    else if (k === "date_limite") { if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new Error("date invalide"); a.donnees.date_limite = v || null; }
    else if (k === "rythme") { if (!RYTHMES.includes(v)) throw new Error("rythme inconnu"); a.donnees.rythme = v; }
    else throw new Error("donnée inconnue");
    await sauver(m, p); return;
  }
  if (op === "note") { a.notes = String(b.texte || "").slice(0, 5000); await sauver(m, p); return; }
  if (op === "valider" || op === "rouvrir") {
    const n = Number(b.n); const e = ETAPES.find(x => x.n === n); if (!e) throw new Error("étape inconnue");
    if (op === "rouvrir") { delete a.etapes[n]; for (const k of Object.keys(a.etapes)) if (Number(k) > n) delete a.etapes[k]; await sauver(m, p); return; }
    for (let k = 1; k < n; k++) if (!a.etapes[k]) throw new Error("Validez d'abord l'étape " + k + ".");
    const j = await liste.liste(code), ex = exigences(n, a, j, m), manque = ex.filter(x => !x.ok && !x.facultatif);
    if (manque.length) throw new Error("Pour valider : " + manque.map(x => x.l.toLowerCase()).join(", ") + ".");
    a.etapes[n] = { le: new Date().toISOString(), par: operateur };
    await sauver(m, p); return;
  }
  if (op === "terminer") {
    for (const e of ETAPES) if (!a.etapes[e.n]) throw new Error("L'appel se clôt à 100 % : l'étape « " + e.titre + " » n'est pas validée.");
    const j = await liste.liste(code), bl = bilan(a, j, m), fin = new Date();
    const duree = Math.max(1, Math.round((fin - new Date(a.debut)) / 60000));
    const trace = { debut: a.debut, fin: fin.toISOString(), duree_min: duree, par: a.par, cloture_par: operateur, bilan: bl, notes: a.notes || "" };
    p.appels = (p.appels || []).concat([trace]); delete p.appel;
    if (a.donnees.date_limite) p.date_limite_reponse = a.donnees.date_limite;
    p.envoi = { mode: a.donnees.mode, rythme: a.donnees.rythme, qui_accompagne: a.donnees.qui || null, creneau: a.donnees.creneau || null };
    await sauver(m, p);
    await store.journal(m.id, "Appel guidé", `Appel de qualification clos en ${duree} min par ${operateur} : ${bl.completes} fiche(s) complète(s) sur ${bl.total}, ${bl.a_demander} à demander aux invités, ${bl.proches.length} proche(s) à accompagner`, null, trace, operateur);
    return;
  }
  if (op === "abandonner") { delete p.appel; await sauver(m, p); await store.journal(m.id, "Appel guidé", "Appel interrompu et abandonné, rien n'est perdu sur les fiches", null, null, operateur); return; }
  throw new Error("opération inconnue");
}

module.exports = { ETAPES, MODES, RYTHMES, vue, agir };
