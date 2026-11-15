/* =====================================================================
   LA FILE DE PREMIER CONTACT (R3 à R7, section 4 du cadrage)
   Les invités complets se présentent un par un. WhatsApp s'ouvre avec le
   message déjà rédigé ; un humain appuie toujours sur Envoyer. L'issue se
   note en un geste, horodatée et signée au journal.
   Mode d'envoi (choisi pendant l'appel guidé, 3 par défaut) :
     1 un message avec le lien ; 2 deux messages enchaînés ;
     3 un message sans lien, puis le lien dès que l'invité répond.
   Garde fous : plafond quotidien et délai minimum entre deux envois,
   réglables par un administrateur ; formulations en rotation ; lien
   jamais raccourci.
   ===================================================================== */
const db = require("./db");
const store = require("./store");
const accueil = require("./accueil");
const liste = require("./liste");
const invite = require("./invite");
const mariages = require("./mariage");

const ISSUES = ["envoyé", "a répondu", "lien envoyé", "joint", "messagerie", "à rappeler", "numéro faux"];
const ISSUES_PROCHE = ["envoyé", "a répondu", "rendez-vous proposé", "rendez-vous fixé", "parcours fait", "messagerie", "à rappeler", "numéro faux"];   /* R7 : le parcours de vive voix */
const ENVOIS = ["envoyé", "lien envoyé"];   /* ce qui compte dans le plafond du jour */
const propre = (s) => String(s == null ? "" : s).trim();

function dateLongue(d) { if (!d) return ""; const x = new Date(String(d).slice(0, 10) + "T12:00:00Z"); return x.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" }); }
function heureParis() { return Number(new Date().toLocaleString("en-GB", { hour: "2-digit", hour12: false, timeZone: "Europe/Paris" })); }
function fin(prenom) { const h = heureParis(); return (h >= 18 || h < 5 ? "Belle soirée" : "Belle journée") + ",\n" + prenom; }
function wa(numero, texte) { const n = propre(numero).replace(/[^\d+]/g, "").replace(/^00/, "+").replace(/^\+/, ""); return n.length >= 8 ? "https://wa.me/" + n + "?text=" + encodeURIComponent(texte) : null; }

/* Trois formulations en rotation, toujours au prénom de l'appelant, jamais plus de quelques lignes (R4, R5). */
function messageAccueil(c, m, moi, mode) {
  const sal = accueil.salutation(c, m), mm = accueil.maries(m).couple || m.prenoms, date = dateLongue(m.date_mariage), lien = mode === 1 ? invite.lien(m, c.jeton) : null;
  if (c.assistance) return `${sal}\nJe suis ${moi}, de Yes I Do. ${mm} nous ont confié l'accueil de leurs invités pour leur mariage du ${date}. Ils souhaitaient que nous prenions un moment ensemble, de vive voix : quand seriez vous disponible pour un court appel ?\n${fin(moi)}`;
  const suite = lien ? `Voici votre accès personnel, tout y est préparé pour vous :\n${lien}` : "Je vous adresse votre accès personnel dès votre réponse, et reste joignable ici si vous préférez en parler de vive voix.";
  const v = [
    `${sal}\nJe suis ${moi}, de Yes I Do. ${mm} nous ont confié l'accueil de leurs invités pour leur mariage du ${date}. ${suite}\n${fin(moi)}`,
    `${sal}\n${moi}, de Yes I Do. Nous accompagnons ${mm} pour l'accueil de leurs invités, en vue de leur mariage du ${date}. ${suite}\n${fin(moi)}`,
    `${sal}\nJe me présente, ${moi}, de Yes I Do. ${mm} nous ont demandé de veiller à l'accueil de chacun de leurs invités pour leur mariage du ${date}. ${suite}\n${fin(moi)}`
  ];
  return v[c.id % v.length];
}
function messageLien(c, m, moi) {
  const sal = accueil.salutation(c, m), lien = invite.lien(m, c.jeton);
  if (!lien) return null;
  return `${sal}\nMerci pour votre retour. Voici votre accès personnel au mariage de ${accueil.maries(m).couple || m.prenoms}, tout y est préparé pour vous :\n${lien}\n${fin(moi)}`;
}

function etatDe(c) { return (c.premier_contact && c.premier_contact.etat) || "à contacter"; }
function aujourdhui() { return new Date().toLocaleDateString("fr-CA", { timeZone: "Europe/Paris" }); }

async function cadence(m) {
  const plafond = Math.max(1, Number(await mariages.reglage("plafond_whatsapp")) || 20), delai = Math.max(0, Number(await mariages.reglage("delai_whatsapp")) || 90);
  const rows = await db.query("SELECT premier_contact FROM contact_recu WHERE mariage_id = $1 AND premier_contact IS NOT NULL", [m.id]);
  const jour = aujourdhui(); let n = 0, dernier = 0;
  for (const r of rows) for (const h of (r.premier_contact.historique || [])) {
    if (!ENVOIS.includes(h.etat)) continue;
    if (new Date(h.le).toLocaleDateString("fr-CA", { timeZone: "Europe/Paris" }) === jour) n++;
    dernier = Math.max(dernier, new Date(h.le).getTime());
  }
  const attente = Math.max(0, Math.ceil((dernier + delai * 1000 - Date.now()) / 1000));
  return { plafond, delai, envoyes_jour: n, reste: Math.max(0, plafond - n), attente };
}

/* L'ordre de la file : d'abord ceux qui ont répondu (le lien est attendu), puis à rappeler, puis les nouveaux ; les contacts aboutis à la fin. */
const RANG = { "rendez-vous fixé": 0, "rendez-vous proposé": 2, "parcours fait": 8, "a répondu": 0, "à rappeler": 1, "messagerie": 2, "à contacter": 3, "envoyé": 4, "numéro faux": 5, "joint": 6, "lien envoyé": 7 };

/* Le message est signé du prénom de la personne connectée ; un compte technique signe au nom de Régis. */
function signataire(nom) { const n = propre(nom); return /^[A-ZÀ-Ý][a-zà-ÿ]+(?:[ -][A-ZÀ-Ý][a-zà-ÿ]+)?$/.test(n) ? n : "Régis"; }

async function file(code, moi) {
  moi = signataire(moi);
  const m = await store.mariageFresh(code); if (!m) throw new Error("mariage inconnu");
  await invite.assurer(m.id);
  const j = await liste.liste(code), mode = Number(((m.parametres || {}).envoi || {}).mode) || 3;
  const prets = j.contacts.filter(c => !c.desactive && c.etat === "complète");
  const rows = prets.map(c => {
    const etat = etatDe(c), lienAttendu = !c.assistance && (etat === "a répondu" || (mode === 2 && etat === "envoyé"));
    const texte = lienAttendu ? messageLien(c, m, moi) : messageAccueil(c, m, moi, mode);
    return { id: c.id, nom: c.nom_repertoire, numero: c.numero, cote: c.cote, lien_couple: c.lien, assistance: !!c.assistance, etat,
      historique: ((c.premier_contact || {}).historique || []).slice(-4).reverse(), reponse_le: c.reponse_le, rdv: (c.premier_contact || {}).rdv || null, issues: c.assistance ? ISSUES_PROCHE : ISSUES,
      etape: lienAttendu ? "lien" : "accueil", texte, wa: texte ? wa(c.numero, texte) : null, tel: propre(c.numero) ? "tel:" + propre(c.numero).replace(/[^\d+]/g, "") : null };
  }).sort((a, b) => (RANG[a.etat] - RANG[b.etat]) || a.nom.localeCompare(b.nom, "fr"));
  const compte = {}; for (const r of rows) compte[r.etat] = (compte[r.etat] || 0) + 1;
  return { mode, site: m.site || "", rouges: j.contacts.filter(c => !c.desactive && c.etat !== "complète").length, file: rows, compte, issues: ISSUES, cadence: await cadence(m) };
}

async function noter(code, id, etat, operateur, quand) {
  if (!ISSUES.includes(etat) && !ISSUES_PROCHE.includes(etat)) throw new Error("issue inconnue");
  const m = await store.mariageFresh(code); if (!m) throw new Error("mariage inconnu");
  const c = (await db.query("SELECT id, nom_repertoire, premier_contact, qualification FROM contact_recu WHERE id = $1 AND mariage_id = $2 AND NOT desactive", [Number(id), m.id]))[0];
  if (!c) throw new Error("fiche introuvable");
  if (ENVOIS.includes(etat)) {
    const cd = await cadence(m);
    if (cd.reste <= 0) throw new Error(`Plafond du jour atteint (${cd.plafond} envois) : reprenez demain, pour protéger le numéro.`);
    if (cd.attente > 0) throw new Error(`Laissez ${cd.attente} s entre deux envois, pour protéger le numéro.`);
  }
  let rdv = null;
  if (etat === "rendez-vous fixé") { rdv = new Date(quand || ""); if (isNaN(rdv)) throw new Error("Indiquez la date et l'heure du rendez vous."); }
  const pc = Object.assign({ historique: [] }, c.premier_contact || {}), avant = pc.etat || "à contacter";
  pc.etat = etat; if (rdv) pc.rdv = rdv.toISOString(); pc.historique = (pc.historique || []).concat([{ etat, le: new Date().toISOString(), par: operateur }]).slice(-30);
  await db.query("UPDATE contact_recu SET premier_contact = $2, modifie_le = now() WHERE id = $1", [c.id, pc]);
  await store.journal(m.id, "Premier contact", `${c.nom_repertoire} : ${etat}${rdv ? " le " + rdv.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris" }) : ""}`, { etat: avant }, { etat }, operateur);
}

module.exports = { ISSUES, file, noter, messageAccueil, messageLien, wa };
