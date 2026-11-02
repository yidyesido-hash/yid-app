/* =====================================================================
   CONTACTS REÇUS · étape 2 d'un mariage (doctrine collect v2)
   Un lot = un fichier (ou plusieurs) reçu d'une source, pour un côté,
   parfois d'un proche contributeur. La machine lit, normalise, dédoublonne,
   détecte ; l'équipe décide. Rien n'est supprimé : un contact se désactive,
   une anomalie se tranche. Tout est journalisé et reflété dans le classeur
   « Contacts reçus » du mariage sur SharePoint.
   ===================================================================== */
const db = require("./db");
const store = require("./store");
const graph = require("./graph");
const vcf = require("./vcf");
const tel = require("./telephone");
const pays = require("./pays");
const checklist = require("./checklist");

const MOTIFS = ["sans numéro", "invalide", "format à vérifier", "fixe probable", "doublon probable avec", "même numéro que", "présent dans les deux répertoires", "deux numéros sans marquage"];
const COTES = ["Épouse", "Époux"];
const normNom = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const safe = (s) => String(s || "").replace(/[\\/:*?"<>|#%]/g, " ").replace(/\s+/g, " ").trim();
const prenomDe = (s) => String(s || "").split("(")[0].trim();

async function mariageDe(code) { const m = await store.mariageFresh(code); if (!m) throw new Error("mariage inconnu : " + code); return m; }
function codePays(m) { const p = pays.parNom(m.pays) || pays.parCode(m.pays); return p ? p.code : "FR"; }

/* ---------- lecture ---------- */
async function contactsDe(mariageId, tous) {
  return db.query(`SELECT c.*, l.source AS lot_source, l.cote AS lot_cote, l.proche AS lot_proche, l.origine,
      (SELECT string_agg(a.type || CASE WHEN a.detail->>'autre' IS NOT NULL THEN ' ' || (a.detail->>'autre') ELSE '' END, ' ; ' ORDER BY a.id) FROM anomalie a WHERE a.contact_id = c.id AND a.etat = 'ouverte') AS motifs
    FROM contact_recu c LEFT JOIN lot l ON l.id = c.lot_id WHERE c.mariage_id = $1 ${tous ? "" : "AND NOT c.desactive"} ORDER BY c.id`, [mariageId]);
}
function trier(list) {
  const rang = (c) => (c.motifs ? 2 : 0) + (c.desactive ? 4 : 0);
  const cote = (c) => (c.cote === "Épouse" ? 0 : c.cote === "Époux" ? 1 : 2);
  return list.slice().sort((a, b) => rang(a) - rang(b) || cote(a) - cote(b) || normNom(a.nom_repertoire).localeCompare(normNom(b.nom_repertoire)));
}
async function liste(code) {
  const m = await mariageDe(code);
  const [contacts, lots, anomalies] = await Promise.all([
    contactsDe(m.id, true),
    db.query("SELECT * FROM lot WHERE mariage_id = $1 ORDER BY id DESC", [m.id]),
    db.query("SELECT a.*, c.nom_repertoire AS nom, c.numero FROM anomalie a LEFT JOIN contact_recu c ON c.id = a.contact_id WHERE a.mariage_id = $1 AND a.contact_id IS NOT NULL ORDER BY a.etat DESC, a.id DESC", [m.id])
  ]);
  const actifs = contacts.filter(c => !c.desactive);
  const kpis = { recus: contacts.length, actifs: actifs.length, propres: actifs.filter(c => !c.motifs).length, a_voir: actifs.filter(c => !!c.motifs).length, desactives: contacts.length - actifs.length, epouse: actifs.filter(c => c.cote === "Épouse").length, epoux: actifs.filter(c => c.cote === "Époux").length, a_preciser: actifs.filter(c => !c.cote).length };
  const p = m.parametres || {};
  const quotas = (p.listes_attendues || []).map(pr => { const q = (p.quotas || {})[prenomDe(pr)] || (p.quotas || {})[pr] || null; const n = actifs.filter(c => c.proche && normNom(c.proche) === normNom(prenomDe(pr))).length; return { proche: pr, quota: q, recus: n, depassement: q !== null && n > q }; });
  const proches = [...new Set((p.listes_attendues || []).concat(p.proches || []).map(prenomDe).filter(Boolean))];
  return { contacts: trier(contacts), lots, anomalies, kpis, quotas, proches, motifs: MOTIFS, cotes: COTES, boite: p.boite || null, date_arret: m.date_arret };
}

/* ---------- import d'un lot ---------- */
async function importer(code, lot, fichiers, operateur) {
  const m = await mariageDe(code);
  const paysCode = codePays(m);
  const source = String(lot.source || "").trim().slice(0, 80) || (lot.origine === "email" ? "Email" : "Export");
  const cote = COTES.includes(lot.cote) ? lot.cote : null;
  const proche = String(lot.proche || "").trim().slice(0, 60) || null;
  const avertissements = [];

  /* lecture des fichiers */
  let cards = [];
  for (const f of fichiers) {
    const lus = vcf.lire(f.buffer, f.name, source);
    cards = cards.concat(lus);
  }
  if (!cards.length) throw new Error("Aucun contact lisible dans " + fichiers.map(f => f.name).join(", ") + ".");

  const existants = await contactsDe(m.id, false);
  const r = await db.query("INSERT INTO lot (mariage_id, source, cote, proche, fichier, origine, email_id, expediteur, operateur) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id", [m.id, source, cote, proche, fichiers.map(f => f.name).join(" ; ").slice(0, 300), lot.origine || "dépôt", lot.email_id || null, lot.expediteur || null, operateur]);
  const lotId = r[0].id;

  const batch = [], anomalies = [], mentions = [];  /* anomalies : { ref, type, autreRef, autreNom, numero } ; ref = { batch: i } ou { id } */
  let connus = 0;
  const ajouterAnomalie = (ref, type, autre, numero) => {
    const autreNom = autre ? (autre.nom_repertoire || autre.nom) : null;
    anomalies.push({ ref, type, autreRef: autre ? (autre.id ? { id: autre.id } : { batch: autre.batch }) : null, autreNom, numero: numero || null });
  };
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const nom = String(card.nom || "").trim().slice(0, 200) || "(sans nom)";
    const lus = card.telephones.map(t => Object.assign(tel.normaliser(t.brut, paysCode), { pref: t.pref }));
    const valides = []; for (const t of lus) if (t.numero && !valides.some(v => v.numero === t.numero)) valides.push(t);
    const principal = valides.find(t => t.pref) || valides[0] || null;
    const numero2 = valides.find(t => t !== principal) || null;
    const statut = principal ? principal.statut : (lus.length ? "invalide" : "sans numéro");
    const row = { batch: i, nom, nomn: normNom(nom), numero: principal ? principal.numero : null, numero_2: numero2 ? numero2.numero : null, brut: lus.map(t => t.brut).join(" ; ").slice(0, 200), statut, numeros: lus, cote, source, proche, lien: proche ? "Invité(e) d'un proche" : null, precision: proche || null };
    const propres = [];   /* anomalies de la fiche elle même, retenues seulement si la fiche est ajoutée */
    if (statut !== "ok") propres.push([statut, row.numero || row.brut]);
    if (valides.length >= 2 && !valides.some(t => t.pref)) propres.push(["deux numéros sans marquage", valides.map(v => v.numero).join(" et ")]);

    /* contre l'existant */
    const memeNumero = row.numero ? existants.find(e => e.numero === row.numero || (e.numero_2 && e.numero_2 === row.numero) || (row.numero_2 && e.numero === row.numero_2)) : null;
    if (memeNumero && normNom(memeNumero.nom_repertoire) === row.nomn) {
      connus++;
      const ms = Array.isArray(memeNumero.mentions) ? memeNumero.mentions : [];
      if (memeNumero.source !== source && !ms.some(x => x.texte === "aussi proposé par " + source)) mentions.push({ id: memeNumero.id, texte: "aussi proposé par " + source });
      if (cote && memeNumero.cote && memeNumero.cote !== cote) {
        const deja = await db.query("SELECT 1 FROM anomalie WHERE contact_id = $1 AND type = 'présent dans les deux répertoires' AND etat = 'ouverte'", [memeNumero.id]);
        if (!deja.length) ajouterAnomalie({ id: memeNumero.id }, "présent dans les deux répertoires", null, row.numero);
        if (!ms.some(x => x.texte === "présent dans les deux répertoires")) mentions.push({ id: memeNumero.id, texte: "présent dans les deux répertoires" });
      }
      continue;
    }
    for (const [type, numero] of propres) ajouterAnomalie({ batch: i }, type, null, numero);
    if (memeNumero) { ajouterAnomalie({ batch: i }, "même numéro que", memeNumero, row.numero); ajouterAnomalie({ id: memeNumero.id }, "même numéro que", row, row.numero); }
    else {
      const homonyme = existants.find(e => normNom(e.nom_repertoire) === row.nomn && row.nomn);
      const quasi = row.numero ? existants.find(e => tel.quasiIdentiques(e.numero, row.numero)) : null;
      const d = homonyme || quasi;
      if (d) { ajouterAnomalie({ batch: i }, "doublon probable avec", d, row.numero); ajouterAnomalie({ id: d.id }, "doublon probable avec", row, d.numero); }
    }
    /* dans le lot lui même */
    for (const b of batch) {
      if (row.numero && (b.numero === row.numero || (b.numero_2 && b.numero_2 === row.numero))) { ajouterAnomalie({ batch: i }, "même numéro que", b, row.numero); ajouterAnomalie({ batch: b.batch }, "même numéro que", row, row.numero); }
      else if ((row.nomn && b.nomn === row.nomn) || (row.numero && tel.quasiIdentiques(b.numero, row.numero))) { ajouterAnomalie({ batch: i }, "doublon probable avec", b, row.numero); ajouterAnomalie({ batch: b.batch }, "doublon probable avec", row, b.numero); }
    }
    batch.push(row);
  }

  /* écriture : contacts, puis anomalies et mentions */
  const ids = {};
  for (const row of batch) {
    const ins = await db.query("INSERT INTO contact_recu (mariage_id, lot_id, nom_repertoire, numeros, source, cote, fichier, brut, numero, numero_2, numero_brut, statut_numero, lien, precision, proche) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id",
      [m.id, lotId, row.nom, row.numeros.map(t => ({ brut: t.brut, numero: t.numero, statut: t.statut, pref: !!t.pref })), source, cote, fichiers[0] ? fichiers[0].name : null, { nom: row.nom, telephones: row.numeros.map(t => t.brut) }, row.numero, row.numero_2, row.brut, row.statut, row.lien, row.precision, row.proche]);
    ids[row.batch] = ins[0].id; row.id = ins[0].id;
  }
  const idDe = (ref) => (ref.id !== undefined ? ref.id : ids[ref.batch]);
  const touches = new Set();
  for (const a of anomalies) {
    const cid = idDe(a.ref), autreId = a.autreRef ? idDe(a.autreRef) : null;
    const dup = await db.query("SELECT 1 FROM anomalie WHERE contact_id = $1 AND type = $2 AND etat = 'ouverte' AND coalesce(autre_contact_id, 0) = coalesce($3, 0)", [cid, a.type, autreId]);
    if (dup.length) continue;
    await db.query("INSERT INTO anomalie (mariage_id, contact_id, autre_contact_id, type, detail) VALUES ($1,$2,$3,$4,$5)", [m.id, cid, autreId, a.type, { autre: a.autreNom, numero: a.numero, lot: lotId }]);
    touches.add(cid);
  }
  for (const mt of mentions) {
    await db.query("UPDATE contact_recu SET mentions = mentions || $2::jsonb, modifie_le = now() WHERE id = $1", [mt.id, JSON.stringify([{ texte: mt.texte, lot: lotId, le: new Date().toISOString() }])]);
  }
  if (touches.size) await db.query(`UPDATE contact_recu SET etat = 'anomalie', modifie_le = now() WHERE id = ANY($1::int[])`, ["{" + [...touches].join(",") + "}"]);

  /* quotas, proche non déclaré, clôture */
  const p = Object.assign({}, m.parametres || {});
  let quota = null;
  if (proche) {
    const declares = (p.listes_attendues || []).map(prenomDe), ancres = (p.proches || []).map(prenomDe);
    if (!declares.some(x => normNom(x) === normNom(proche))) {
      avertissements.push(ancres.some(x => normNom(x) === normNom(proche)) ? `${proche} est un proche de rattachement (B7) mais n'était pas déclaré comme contributeur (B8) : ajouté à la liste des proches qui transmettent une liste.` : `${proche} n'était pas déclaré au cadrage : ajouté à la liste des proches qui transmettent une liste. À confirmer avec le couple.`);
      p.listes_attendues = (p.listes_attendues || []).concat([proche]);
      if (p.checklist) p.checklist.listes_attendues = p.listes_attendues;
      await db.query("UPDATE mariage SET parametres = $2, modifie_le = now() WHERE id = $1", [m.id, p]);
      await store.journal(m.id, "Proche contributeur ajouté", proche + " (à l'import de sa liste)", null, { listes_attendues: p.listes_attendues }, operateur);
    }
    const q = (p.quotas || {})[proche] || (p.quotas || {})[Object.keys(p.quotas || {}).find(k => normNom(k) === normNom(proche)) || ""] || null;
    const n = Number((await db.query("SELECT count(*) AS n FROM contact_recu WHERE mariage_id = $1 AND NOT desactive AND lower(proche) = lower($2)", [m.id, proche]))[0].n);
    quota = { proche, quota: q, recus: n, depassement: q !== null && n > q };
    if (quota.depassement) avertissements.push(`Quota ${proche} : ${n} personnes pour ${q} prévues, dépassement à arbitrer avec le couple.`);
  }
  const today = new Date().toISOString().slice(0, 10);
  if (m.date_arret && today > m.date_arret) avertissements.push(`La base est arrêtée depuis le ${m.date_arret} : ajout tardif, à valider.`);
  if (!cote) avertissements.push("Côté non précisé pour ce lot : à renseigner dans la liste des lots (Corriger la source).");

  const aVoir = Number((await db.query("SELECT count(DISTINCT contact_id) AS n FROM anomalie WHERE mariage_id = $1 AND etat = 'ouverte' AND contact_id IS NOT NULL", [m.id]))[0].n);
  const accuse = { lus: cards.length, ajoutes: batch.length, connus, a_voir: aVoir, quota, avertissements, lot: lotId, source, cote, proche };

  /* archive et miroir SharePoint, non bloquants */
  const sp = { archives: [], erreurs: [] };
  if (graph.enabled() && m.dossier) {
    const stamp = new Date().toISOString().slice(0, 10);
    fichiers.forEach((f, k) => { const ext = (f.name.match(/\.[A-Za-z0-9]+$/) || [".vcf"])[0]; sp.archives.push({ f, path: `${m.dossier}/Contacts/${safe(m.prenoms)} - ${safe(source)} - ${stamp}${fichiers.length > 1 ? " - " + (k + 1) : ""}${ext}` }); });
    for (const a of sp.archives) { try { await graph.putFile(a.path, a.f.buffer, "application/octet-stream"); } catch (e) { sp.erreurs.push("Archive : " + e.message); } }
    await miroir(m, lotId, batch, source, cote).catch(e => sp.erreurs.push("Classeur : " + e.message));
    if (sp.archives.length) await db.query("UPDATE lot SET archive = $2 WHERE id = $1", [lotId, sp.archives.map(a => a.path).join(" ; ")]);
  }
  await db.query("UPDATE lot SET lus = $2, ajoutes = $3, connus = $4, a_voir = $5, detail = $6 WHERE id = $1", [lotId, accuse.lus, accuse.ajoutes, accuse.connus, aVoir, { avertissements, quota, sharepoint: sp }]);
  await store.journal(m.id, "Contacts reçus", `${source}${cote ? " · " + cote : ""}${proche ? " · liste de " + proche : ""} · ${accuse.lus} lu(s), ${accuse.ajoutes} ajouté(s), ${connus} déjà connu(s), ${aVoir} à voir` + (avertissements.length ? " · " + avertissements.join(" ") : ""), null, null, operateur);
  return Object.assign(accuse, { sharepoint: sp });
}

/* ---------- miroir : onglet Reçus (ajout) et Anomalies (réécrit) du classeur Contacts reçus ---------- */
async function miroir(m, lotId, batch, source, cote) {
  const classeur = `${m.dossier}/Contacts reçus ${safe(m.prenoms)}.xlsx`;
  const recu = new Date().toISOString().replace("T", " ").slice(0, 16);
  const rows = batch.map(r => [recu, source, cote || "à préciser", r.nom, r.numeros.map(t => t.numero || t.brut).join(" ; "), r.brut]);
  if (rows.length) { try { await graph.addRows(classeur, "Recus", rows); } catch (e) { await store.queueExcel(m.code, classeur, "Recus", rows, e.message); } }
  const an = await db.query("SELECT a.*, c.nom_repertoire AS nom FROM anomalie a LEFT JOIN contact_recu c ON c.id = a.contact_id WHERE a.mariage_id = $1 AND a.contact_id IS NOT NULL ORDER BY a.id", [m.id]);
  const arows = an.map(a => [String(a.detectee_le).replace("T", " ").slice(0, 16), a.type + (a.detail && a.detail.autre ? " " + a.detail.autre : ""), a.nom || "", (a.detail && a.detail.numero) || "", a.etat, a.decision || "", a.tranchee_par || "", a.tranchee_le ? String(a.tranchee_le).replace("T", " ").slice(0, 16) : ""]);
  try { await graph.rewriteTable(classeur, "Anomalies", arows); } catch (e) { await store.queueExcel(m.code, classeur, "Anomalies", arows, e.message); }
}

/* ---------- décisions humaines ---------- */
async function trancher(code, anomalieId, decision, operateur) {
  const m = await mariageDe(code);
  const a = (await db.query("SELECT * FROM anomalie WHERE id = $1 AND mariage_id = $2", [anomalieId, m.id]))[0];
  if (!a) throw new Error("anomalie inconnue");
  if (!String(decision || "").trim()) throw new Error("La décision doit être écrite : elle reste dans le journal.");
  await db.query("UPDATE anomalie SET etat = 'tranchée', decision = $2, tranchee_par = $3, tranchee_le = now() WHERE id = $1", [anomalieId, String(decision).slice(0, 400), operateur]);
  await recalculerEtat(a.contact_id);
  await store.journal(m.id, "Anomalie tranchée", `${a.type}${a.detail && a.detail.autre ? " " + a.detail.autre : ""} · ${decision}`, { etat: "ouverte" }, { etat: "tranchée", decision: String(decision).slice(0, 400) }, operateur);
  if (graph.enabled() && m.dossier) await miroir(m, null, [], null, null).catch(() => {});
  return { ok: true };
}
async function recalculerEtat(contactId) {
  if (!contactId) return;
  const n = Number((await db.query("SELECT count(*) AS n FROM anomalie WHERE contact_id = $1 AND etat = 'ouverte'", [contactId]))[0].n);
  await db.query("UPDATE contact_recu SET etat = $2, modifie_le = now() WHERE id = $1", [contactId, n ? "anomalie" : "propre"]);
}
async function desactiver(code, contactId, desactive, motif, operateur) {
  const m = await mariageDe(code);
  const c = (await db.query("SELECT * FROM contact_recu WHERE id = $1 AND mariage_id = $2", [contactId, m.id]))[0];
  if (!c) throw new Error("contact inconnu");
  await db.query("UPDATE contact_recu SET desactive = $2, modifie_le = now() WHERE id = $1", [contactId, !!desactive]);
  await store.journal(m.id, desactive ? "Contact désactivé" : "Contact réactivé", `${c.nom_repertoire} (${c.numero || "sans numéro"})` + (motif ? " · " + motif : ""), { desactive: !!c.desactive }, { desactive: !!desactive }, operateur);
  return { ok: true };
}
async function corrigerLot(code, lotId, input, operateur) {
  const m = await mariageDe(code);
  const l = (await db.query("SELECT * FROM lot WHERE id = $1 AND mariage_id = $2", [lotId, m.id]))[0];
  if (!l) throw new Error("lot inconnu");
  const source = input.source !== undefined ? String(input.source).trim().slice(0, 80) || l.source : l.source;
  const cote = input.cote !== undefined ? (COTES.includes(input.cote) ? input.cote : null) : l.cote;
  const proche = input.proche !== undefined ? (String(input.proche).trim().slice(0, 60) || null) : l.proche;
  await db.query("UPDATE lot SET source = $2, cote = $3, proche = $4 WHERE id = $1", [lotId, source, cote, proche]);
  await db.query("UPDATE contact_recu SET source = $2, cote = $3, proche = $4, lien = CASE WHEN $4::text IS NULL THEN lien ELSE 'Invité(e) d''un proche' END, precision = coalesce($4, precision), modifie_le = now() WHERE lot_id = $1", [lotId, source, cote, proche]);
  await store.journal(m.id, "Source corrigée", `lot ${lotId}`, { source: l.source, cote: l.cote, proche: l.proche }, { source, cote, proche }, operateur);
  return { ok: true };
}

/* ---------- la boîte du mariage : relever les fichiers reçus par email ---------- */
async function relever(code, operateur, force) {
  const m = await mariageDe(code);
  const p = Object.assign({}, m.parametres || {});
  const out = { releve: false, lots: [], messages: 0, detail: "" };
  if (!m.boite_email) { out.detail = "Aucune boîte renseignée."; return out; }
  if (!graph.enabled()) { out.detail = "Microsoft non configuré."; return out; }
  const derniere = p.boite && p.boite.relevee_le ? Date.parse(p.boite.relevee_le) : 0;
  if (!force && Date.now() - derniere < 5 * 60 * 1000) { out.detail = "Relevée il y a moins de cinq minutes."; return out; }
  let messages;
  try { messages = await graph.mailboxMessages(m.boite_email); }
  catch (e) { out.detail = "Boîte non lue : " + e.message; p.boite = Object.assign({}, p.boite || {}, { ok: false, detail: out.detail, verifiee_le: new Date().toISOString() }); await db.query("UPDATE mariage SET parametres = $2 WHERE id = $1", [m.id, p]); return out; }
  out.releve = true; out.messages = messages.length;
  for (const msg of messages) {
    const deja = await db.query("SELECT 1 FROM lot WHERE mariage_id = $1 AND email_id = $2", [m.id, msg.id]);
    if (deja.length) { await graph.mailboxMarkRead(m.boite_email, msg.id).catch(() => {}); continue; }
    let pieces = [];
    try { pieces = await graph.mailboxAttachments(m.boite_email, msg.id); } catch (e) { out.detail += " Pièces jointes non lues : " + e.message; continue; }
    const fichiers = pieces.filter(a => /\.(vcf|vcard|csv)$/i.test(a.name || "")).map(a => ({ name: a.name, buffer: Buffer.from(a.contentBytes || "", "base64") }));
    const expediteur = msg.from && msg.from.emailAddress ? (msg.from.emailAddress.name || msg.from.emailAddress.address) : "";
    const adresse = msg.from && msg.from.emailAddress ? msg.from.emailAddress.address : "";
    if (!fichiers.length) { await graph.mailboxMarkRead(m.boite_email, msg.id).catch(() => {}); continue; }
    try {
      const accuse = await importer(code, { source: "Email de " + (expediteur || "inconnu"), cote: null, proche: null, origine: "email", email_id: msg.id, expediteur: adresse }, fichiers, "boîte " + m.boite_email);
      out.lots.push(accuse);
      await graph.mailboxMarkRead(m.boite_email, msg.id).catch(() => {});
      if (m.statut !== "Test" && adresse) {
        const texte = `Bonjour,\n\nNous avons bien reçu votre fichier de contacts${fichiers.length > 1 ? "s" : ""} (${fichiers.map(f => f.name).join(", ")}).\n${accuse.lus} contact(s) lu(s), ${accuse.ajoutes} ajouté(s) à la liste, ${accuse.connus} déjà connu(s)${accuse.a_voir ? `, ${accuse.a_voir} à vérifier avec vous` : ""}.\n\nNous revenons vers vous pour la suite.\n\nYes I Do`;
        try { await graph.mailboxReply(m.boite_email, msg.id, texte); await store.journal(m.id, "Accusé de réception envoyé", adresse, null, null, "boîte " + m.boite_email); } catch (e) { out.detail += " Accusé non envoyé : " + e.message; }
      }
    } catch (e) { out.detail += ` ${fichiers.map(f => f.name).join(", ")} : ${e.message}.`; await store.journal(m.id, "Fichier reçu illisible", `${expediteur} · ${fichiers.map(f => f.name).join(", ")} · ${e.message}`, null, null, "boîte " + m.boite_email); }
  }
  const fresh = await store.mariageFresh(code);
  const pp = Object.assign({}, fresh.parametres || {});
  pp.boite = Object.assign({}, pp.boite || {}, { ok: true, detail: `Boîte ${m.boite_email} lue, ${messages.length} message(s) non lu(s) avec pièce jointe traité(s).`, verifiee_le: new Date().toISOString(), relevee_le: new Date().toISOString() });
  await db.query("UPDATE mariage SET parametres = $2, boite_verifiee_le = now() WHERE id = $1", [m.id, pp]);
  await store.mariageFresh(code);
  if (out.lots.length) await store.journal(m.id, "Boîte relevée", `${out.lots.length} lot(s) importé(s) depuis la boîte`, null, null, operateur);
  return out;
}

module.exports = { liste, importer, trancher, desactiver, corrigerLot, relever, MOTIFS, COTES };
