/* =====================================================================
   LES EMAILS AUX INVITÉS (section 3 du cadrage : le sas d'envoi)
   Après la confirmation, l'information de masse part par email, depuis
   la boîte du mariage, en quatre temps obligatoires :
     1 aperçu foyer par foyer ; 2 contrôle automatique (sans adresse,
     doublons, déclinés, déjà servis, fiches non vertes) ; 3 email test à
     la personne qui valide ; 4 confirmation du nombre exact, puis envoi
     par lots de 50, suivi lot par lot, suspendable entre deux lots.
   Un envoi préparé par un employé attend un administrateur. Un mariage
   en statut Test n'envoie jamais aux invités (seul l'email test part).
   Un même message ne part jamais deux fois au même invité.
   État : mariage.parametres.emails (les campagnes).
   ===================================================================== */
const db = require("./db");
const store = require("./store");
const graph = require("./graph");
const liste = require("./liste");
const accueil = require("./accueil");
const invite = require("./invite");

const LOT = 50;
/* Les destinataires : par réponse, puis par typologie de foyer (invitation, séjour, enfants, conciergerie, langue). */
const vient = (c) => c.reponse_le && !/regret/.test((c.reponse || {}).presence || "");
const etatR = (c) => ((c.reponse || {}).etat) || {};
const loge = (c) => { const h = etatR(c).heb || {}; return h.sejour === "oui" || h.sejour === "partiel" || (!!(c.reponse || {}).hebergement && (c.reponse || {}).hebergement !== "Par leurs propres moyens"); };
const langueDe = (c) => String(c.langue || (c.reponse || {}).langue || "fr").toLowerCase();
const AUDIENCES = {
  presents: { l: "Les invités qui ont confirmé leur présence", f: vient },
  repondu: { l: "Tous les invités qui ont répondu", f: (c) => !!c.reponse_le },
  sans_reponse: { l: "Les invités contactés qui n'ont pas encore répondu", f: (c) => !c.reponse_le && !!(c.premier_contact && c.premier_contact.etat) },
  pres_deux: { l: "Présents · invitation pour deux", f: (c) => vient(c) && c.invitation === "Invitation pour deux" },
  pres_unique: { l: "Présents · invitation unique", f: (c) => vient(c) && c.invitation === "Invitation unique" },
  pres_libre: { l: "Présents · accompagnant au libre choix", f: (c) => vient(c) && c.invitation === "Ne sait pas encore" },
  pres_loges: { l: "Présents · logés sur place", f: (c) => vient(c) && loge(c) },
  pres_non_loges: { l: "Présents · non logés", f: (c) => vient(c) && !loge(c) },
  pres_enfants: { l: "Présents · avec enfants", f: (c) => vient(c) && Array.isArray((c.reponse || {}).enfants) && c.reponse.enfants.length > 0 },
  pres_concierge: { l: "Présents · aide de la conciergerie demandée", f: (c) => vient(c) && ["tout", "partie"].includes((etatR(c).fin || {}).concierge) },
  pres_hotel: { l: "Présents · réservation d'hôtel demandée", f: (c) => vient(c) && !!(etatR(c).resa || {}).maison && (etatR(c).resa || {}).maison !== "non" && (etatR(c).resa || {}).maison !== "inconnu" },
  pres_fr: { l: "Présents · francophones", f: (c) => vient(c) && langueDe(c) === "fr" },
  pres_en: { l: "Présents · anglophones", f: (c) => vient(c) && langueDe(c) === "en" },
  pres_pt: { l: "Présents · lusophones", f: (c) => vient(c) && langueDe(c) === "pt" },
  sans_reponse_en: { l: "Sans réponse · anglophones", f: (c) => !c.reponse_le && !!(c.premier_contact && c.premier_contact.etat) && langueDe(c) === "en" },
  sans_reponse_pt: { l: "Sans réponse · lusophones", f: (c) => !c.reponse_le && !!(c.premier_contact && c.premier_contact.etat) && langueDe(c) === "pt" }
};
const MODELES = [
  { cle: "programme", nom: "Programme et informations pratiques", audience: "presents", objet: "{couple} · votre venue le {date}",
    corps: "{salutation}\n\nNous nous réjouissons de vous accueillir au mariage de {couple}, le {date}{lieu_phrase}.\n\nVous trouverez dans votre accès personnel le programme de la journée, les informations pratiques et les adresses utiles. Il se tient à jour jusqu'au jour J.\n\nPour toute question, il vous suffit de répondre à ce message : nous restons à votre disposition.\n\nAvec nos sentiments les meilleurs,\nL'équipe Yes I Do, pour {couple}" },
  { cle: "relance", nom: "Relance douce des invités sans réponse", audience: "sans_reponse", objet: "{couple} · votre réponse",
    corps: "{salutation}\n\n{couple} préparent avec soin l'accueil de chacun de leurs invités pour leur mariage du {date}. Votre réponse nous aiderait à tout prévoir pour vous.\n\nQuelques instants suffisent, depuis votre accès personnel.\n\nAvec nos sentiments les meilleurs,\nL'équipe Yes I Do, pour {couple}" },
  { cle: "pass", nom: "Le pass, trois jours avant le mariage", audience: "presents", objet: "{couple} · votre pass", pass: true,
    corps: "{salutation}\n\nLe mariage de {couple} approche : nous serons heureux de vous accueillir le {date}{lieu_phrase}.\n\nVoici votre pass. Il vous sera demandé à votre arrivée et vous est personnellement destiné : nous vous remercions de ne pas le transférer.\n\nAvec nos sentiments les meilleurs,\nL'équipe Yes I Do, pour {couple}" },
  { cle: "loges", nom: "Informations pour les invités logés", audience: "pres_loges", objet: "{couple} · votre séjour",
    corps: "{salutation}\n\nNous serons heureux de vous accueillir pour le mariage de {couple}, le {date}{lieu_phrase}.\n\nVotre chambre vous attend. Notre équipe vous accueillera à votre arrivée, à l'heure que vous nous avez indiquée ; si elle devait changer, il vous suffit de nous le dire depuis votre accès personnel.\n\nAvec nos sentiments les meilleurs,\nL'équipe Yes I Do, pour {couple}" },
  { cle: "enfants", nom: "Pour les familles avec enfants", audience: "pres_enfants", objet: "{couple} · l'accueil de vos enfants",
    corps: "{salutation}\n\nNous préparons avec soin l'accueil de vos enfants pour le mariage de {couple}, le {date}.\n\nSi un détail compte pour eux, une habitude, un horaire, une attention particulière, il vous suffit de nous l'indiquer depuis votre accès personnel.\n\nAvec nos sentiments les meilleurs,\nL'équipe Yes I Do, pour {couple}" },
  { cle: "remerciement", nom: "Remerciement après le mariage", audience: "presents", objet: "{couple} · merci",
    corps: "{salutation}\n\nAu nom de {couple}, merci d'avoir été présent à leurs côtés le {date}. Votre présence a compté pour eux, et ce fut un plaisir de vous accueillir.\n\nSi vous souhaitez partager un souvenir ou un mot avec les mariés, il vous suffit de répondre à ce message : nous le leur transmettrons.\n\nAvec nos sentiments les meilleurs,\nL'équipe Yes I Do, pour {couple}" }
];

const propre = (s) => String(s == null ? "" : s).trim();
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(propre(e));
function dateLongue(d) { if (!d) return ""; return new Date(String(d).slice(0, 10) + "T12:00:00Z").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" }); }

/* Les jetons du message, remplis pour un invité. Le lien n'apparaît jamais en clair : un texte propre, en HTML. */
function remplir(texte, c, m) {
  const couple = accueil.maries(m).couple || m.prenoms, lieu = propre(m.lieu);
  return String(texte || "")
    .replace(/\{salutation\}/g, accueil.salutation(c, m)).replace(/\{prenom\}/g, accueil.appel(c, m))
    .replace(/\{couple\}/g, couple).replace(/\{date\}/g, dateLongue(m.date_mariage))
    .replace(/\{lieu\}/g, lieu).replace(/\{lieu_phrase\}/g, lieu ? ", " + lieu : "");
}
function html(corps, c, m, avecPass) {
  const lien = invite.lien(m, c.jeton), couple = accueil.maries(m).couple || m.prenoms;
  const paras = remplir(corps, c, m).split(/\n{2,}/).map(p => `<p style="margin:0 0 16px">${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
  const bouton = lien ? `<p style="margin:26px 0 30px"><a href="${esc(lien)}" style="display:inline-block;padding:14px 28px;border-radius:28px;background:#D4B07A;color:#141210;text-decoration:none;font:600 14px Arial,sans-serif">Ouvrir mon accès personnel</a></p>` : "";
  /* le pass QR de l'invité présent : c'est son invitation nominative pour le week end */
  const base = (process.env.PUBLIC_URL || "https://invites.yidyesido.info").replace(/\/+$/, "");
  /* le pass n'a de sens qu'avant le mariage : un remerciement envoyé après ne le porte plus */
  const avant = !m.date_mariage || new Date(String(m.date_mariage).slice(0, 10) + "T23:59:59Z") >= new Date();
  const vient = !!avecPass && avant && c.reponse_le && !/regret/.test((c.reponse || {}).presence || "");
  const sansQR = /sans QR/.test(((m.parametres || {}).formulaire || {}).pass || "");
  const pass = vient && c.jeton ? `<div style="margin:6px 0 26px;padding:22px;border:1px solid #E6E1DA;border-radius:18px;text-align:center"><div style="font:600 11px Arial,sans-serif;letter-spacing:.22em;text-transform:uppercase;color:#B8956A">Votre pass nominatif</div>${sansQR ? "" : `<img src="${base}/api/forms?action=pass&yid=${c.jeton}" alt="Votre pass" width="180" height="180" style="display:block;margin:12px auto 10px;width:180px;height:180px">`}<a href="${base}/pass.html?yid=${c.jeton}" style="display:inline-block;margin-top:6px;padding:11px 22px;border-radius:24px;background:#24160f;color:#f6efe4;text-decoration:none;font:600 13px Arial,sans-serif">Ouvrir mon pass</a><div style="font:13px Arial,sans-serif;color:#6B655E;margin-top:12px">Il vous sera demandé à l'accueil.</div></div>` : "";
  return `<!doctype html><html><body style="margin:0;background:#FAF7F2"><div style="max-width:560px;margin:0 auto;padding:36px 28px;font:16px/1.6 Georgia,'Times New Roman',serif;color:#141210">` +
    `<div style="font:600 11px Arial,sans-serif;letter-spacing:.22em;text-transform:uppercase;color:#B8956A;margin-bottom:22px">${esc(couple)} · ${esc(dateLongue(m.date_mariage))}</div>` +
    paras + bouton + pass + `<div style="border-top:1px solid #E6E1DA;margin-top:24px;padding-top:14px;font:12px Arial,sans-serif;color:#6B655E">Yes I Do · l'accueil des invités de ${esc(couple)}</div></div></body></html>`;
}

async function contexte(code) {
  const m = await store.mariageFresh(code); if (!m) throw new Error("mariage inconnu");
  await invite.assurer(m.id);
  const j = await liste.liste(code);
  return { m, p: m.parametres || {}, actifs: j.contacts.filter(c => !c.desactive) };
}
async function sauver(m, p) { await db.query("UPDATE mariage SET parametres = $2, modifie_le = now() WHERE id = $1", [m.id, p]); }

/* Le contrôle automatique : qui reçoit, qui est écarté et pourquoi. */
function controle(camp, actifs) {
  const aud = AUDIENCES[camp.audience] || AUDIENCES.presents, vus = new Set(), ok = [], ecartes = [];
  for (const c of actifs) {
    if (!aud.f(c)) continue;
    const e = propre(c.email).toLowerCase();
    const motif = c.etat !== "complète" ? "fiche non verte" : camp.audience !== "repondu" && c.reponse_le && /regret/.test((c.reponse || {}).presence || "") ? "a décliné" :
      !emailOk(e) ? "sans adresse email" : vus.has(e) ? "adresse en double" : (camp.envoyes || {})[c.id] ? "a déjà reçu ce message" : null;
    if (motif) ecartes.push({ id: c.id, nom: c.nom_repertoire, motif }); else { vus.add(e); ok.push(c); }
  }
  return { ok, ecartes };
}

function resume(camp, actifs) {
  const ct = controle(camp, actifs);
  return Object.assign({}, camp, { destinataires: ct.ok.length, ecartes: ct.ecartes, deja: Object.keys(camp.envoyes || {}).length, audience_l: (AUDIENCES[camp.audience] || {}).l });
}

async function vue(code) {
  const { m, p, actifs } = await contexte(code);
  return { boite: m.boite_email || null, site: m.site || null, test_mariage: m.statut === "Test", modeles: MODELES.map(x => ({ cle: x.cle, nom: x.nom })),
    audiences: Object.keys(AUDIENCES).map(k => ({ k, l: AUDIENCES[k].l, n: actifs.filter(AUDIENCES[k].f).length })),
    campagnes: (p.emails || []).map(c => resume(c, actifs)).reverse(), envoi_possible: graph.enabled() || !!process.env.YID_MAIL_FAKE };
}

async function expedier(m, a, objet, contenu) {
  if (process.env.YID_MAIL_FAKE) { (global.__YID_MAILS = global.__YID_MAILS || []).push({ de: m.boite_email, a, objet, le: new Date().toISOString() }); return; }
  if (!graph.enabled()) throw new Error("La connexion Microsoft n'est pas configurée sur ce serveur.");
  await graph.call("POST", `/users/${encodeURIComponent(m.boite_email)}/sendMail`, {
    message: { subject: objet, body: { contentType: "HTML", content: contenu }, toRecipients: [{ emailAddress: { address: a } }] }, saveToSentItems: true });
}

async function agir(code, op, b, u) {
  const { m, p, actifs } = await contexte(code);
  const camps = p.emails = p.emails || [], camp = camps.find(x => x.id === String(b.id || ""));
  const admin = u.role === "administrateur";
  if (op === "creer") {
    const mod = MODELES.find(x => x.cle === b.modele) || MODELES[0];
    const n = { id: Date.now().toString(36), modele: mod.cle, pass: !!mod.pass, nom: mod.nom, objet: mod.objet, corps: mod.corps, audience: mod.audience, statut: "brouillon", cree_par: u.nom, cree_le: new Date().toISOString(), envoyes: {}, lots: [] };
    camps.push(n); await sauver(m, p); return { id: n.id };
  }
  if (!camp) throw new Error("message introuvable");
  if (op === "modifier") {
    if (["envoi", "termine"].includes(camp.statut)) throw new Error("Ce message est déjà parti : créez en un nouveau.");
    if (b.nom != null) camp.nom = propre(b.nom).slice(0, 120) || camp.nom;
    if (b.objet != null) camp.objet = propre(b.objet).slice(0, 200);
    if (b.corps != null) camp.corps = String(b.corps).slice(0, 8000);
    if (b.audience != null) { if (!AUDIENCES[b.audience]) throw new Error("destinataires inconnus"); camp.audience = b.audience; }
    camp.test = null; camp.statut = "brouillon"; await sauver(m, p); return {};
  }
  if (op === "apercu") {
    const ct = controle(camp, actifs), k = Math.max(0, Math.min(Number(b.k) || 0, ct.ok.length - 1)), c = ct.ok[k];
    if (!c) return { apercu: null, total: 0 };
    return { apercu: { a: c.email, nom: c.nom_repertoire, objet: remplir(camp.objet, c, m), html: html(camp.corps, c, m, camp.pass) }, k, total: ct.ok.length };
  }
  if (op === "test") {
    const a = propre(b.a); if (!emailOk(a)) throw new Error("Indiquez une adresse valide pour l'email test.");
    const c = controle(camp, actifs).ok[0] || actifs.find(x => x.etat === "complète"); if (!c) throw new Error("Aucun invité pour composer l'exemple.");
    await expedier(m, a, "[Test] " + remplir(camp.objet, c, m), html(camp.corps, c, m, camp.pass));
    camp.test = { a, le: new Date().toISOString(), par: u.nom }; if (camp.statut === "brouillon") camp.statut = admin ? "pret" : "validation";
    await sauver(m, p); await store.journal(m.id, "Email", `Email test « ${camp.nom} » envoyé à ${a}`, null, null, u.nom); return {};
  }
  if (op === "envoyer") {
    if (!admin) { camp.statut = "validation"; await sauver(m, p); throw new Error("Préparé par l'équipe : un administrateur doit valider l'envoi."); }
    if (m.statut === "Test") throw new Error("Ce mariage est en statut Test : il n'envoie jamais aux invités. Seul l'email test part.");
    if (!m.boite_email) throw new Error("Ce mariage n'a pas de boîte email.");
    if (!camp.test) throw new Error("Envoyez d'abord l'email test, puis relisez le.");
    if (camp.statut === "suspendu" && !b.reprendre) throw new Error("Envoi suspendu : reprenez le explicitement.");
    const ct = controle(camp, actifs);
    if (b.confirme !== ct.ok.length && camp.statut !== "envoi") throw new Error(`Confirmez le nombre exact de destinataires (${ct.ok.length}).`);
    const lot = ct.ok.slice(0, LOT); let okN = 0; const ko = [];
    camp.statut = "envoi";
    for (const c of lot) {
      try { await expedier(m, propre(c.email), remplir(camp.objet, c, m), html(camp.corps, c, m, camp.pass)); camp.envoyes[c.id] = new Date().toISOString(); okN++; }
      catch (e) { ko.push({ nom: c.nom_repertoire, detail: e.message.slice(0, 160) }); }
    }
    const reste = ct.ok.length - okN;
    camp.lots.push({ n: camp.lots.length + 1, le: new Date().toISOString(), ok: okN, ko: ko.length, par: u.nom, erreurs: ko.slice(0, 10) });
    if (reste <= 0 || (okN === 0 && ko.length)) camp.statut = reste <= 0 ? "termine" : "suspendu";
    await sauver(m, p);
    await store.journal(m.id, "Email", `« ${camp.nom} » : lot ${camp.lots.length}, ${okN} envoyé(s)${ko.length ? ", " + ko.length + " en échec" : ""}, ${Math.max(0, reste)} restant(s)`, null, null, u.nom);
    return { lot: camp.lots[camp.lots.length - 1], reste: Math.max(0, reste) };
  }
  if (op === "suspendre") { if (camp.statut === "envoi") { camp.statut = "suspendu"; await sauver(m, p); await store.journal(m.id, "Email", `« ${camp.nom} » suspendu entre deux lots`, null, null, u.nom); } return {}; }
  if (op === "supprimer") { if (Object.keys(camp.envoyes || {}).length) throw new Error("Ce message a déjà été envoyé à des invités : il reste au journal."); p.emails = camps.filter(x => x !== camp); await sauver(m, p); return {}; }
  throw new Error("opération inconnue");
}

module.exports = { AUDIENCES, MODELES, vue, agir, controle, html, remplir };
