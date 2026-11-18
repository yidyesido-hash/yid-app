/* =====================================================================
   LE RÉCAPITULATIF ENVOYÉ À L'INVITÉ
   Après sa réponse, l'invité reçoit un email sobre, depuis la boîte du
   mariage, avec ses réponses en pièce jointe (PDF à la charte Yes I Do :
   ivoire, Cormorant, Jost, filets or). Aucune adresse en clair : le lien
   personnel passe par un bouton. Un mariage Test n'écrit qu'à l'équipe.
   ===================================================================== */
const path = require("path");
const accueil = require("./accueil");
const A = path.join(__dirname, "assets");
const F = (n) => path.join(A, "fonts", n + ".ttf");
const C = { ivoire: "#FAF7F2", encre: "#141210", or: "#B8956A", doux: "#6B655E", filet: "#E6E1DA" };
const de = (n) => (/^[aeiouyéèêâîôh]/i.test(String(n)) ? "d'" : "de ") + n;
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function pdf(cfg, e, rep, prenom) {
  const PDFDocument = require("pdfkit");
  const L = e.langue(), tt = (fr, pt) => (L === "pt" ? pt : fr), tr = (o) => (typeof o === "string" ? o : (o && (o[L] || o.fr)) || "");
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margins: { top: 64, bottom: 64, left: 64, right: 64 }, info: { Title: tt("Vos réponses", "As suas respostas") + " · " + cfg.maries, Author: "Yes I Do" } });
    const parts = []; doc.on("data", (b) => parts.push(b)); doc.on("end", () => resolve(Buffer.concat(parts))); doc.on("error", reject);
    doc.registerFont("titre", F("cormorant-garamond-latin-400-normal")); doc.registerFont("titreI", F("cormorant-garamond-latin-400-italic"));
    doc.registerFont("corps", F("jost-latin-300-normal")); doc.registerFont("corpsM", F("jost-latin-400-normal")); doc.registerFont("cap", F("jost-latin-500-normal"));
    const fond = () => { doc.save().rect(0, 0, doc.page.width, doc.page.height).fill(C.ivoire).restore(); };
    fond(); doc.on("pageAdded", fond);
    const W = doc.page.width - 128;
    try { doc.image(path.join(A, "logo_or.png"), doc.page.width / 2 - 22, 52, { width: 44 }); } catch (x) { /* le logo n'est pas indispensable */ }
    doc.y = 118;
    doc.font("cap").fontSize(8).fillColor(C.or).text((L === "pt" ? "CASAMENTO DE " + cfg.maries : "MARIAGE " + de(cfg.maries)).toUpperCase(), { align: "center", characterSpacing: 2.4 });
    doc.moveDown(0.6).font("titre").fontSize(30).fillColor(C.encre).text(tt("Vos réponses", "As suas respostas"), { align: "center" });
    doc.moveDown(0.2).font("titreI").fontSize(14).fillColor(C.doux).text(tr(cfg.quand), { align: "center" });
    doc.moveDown(1.2);
    const filet = () => { const y = doc.y; doc.save().moveTo(64, y).lineTo(64 + W, y).lineWidth(0.5).strokeColor(C.filet).stroke().restore(); };
    doc.font("corps").fontSize(10.5).fillColor(C.encre).text(tt("Merci " + prenom + ", voici le récapitulatif de ce que vous nous avez transmis.", prenom + ", eis o resumo do que nos transmitiu."), { align: "center" });
    const ac = rep.a_confirmer || [];
    if (ac.length) { doc.moveDown(0.6).font("titreI").fontSize(12).fillColor(C.or).text(tt("Reste à confirmer : ", "Falta confirmar: ") + ac.join(", ") + ".", { align: "center" }); }
    doc.moveDown(1.4);
    const secs = e.collecte();
    secs.secs.forEach((s) => {
      const rs = secs.rows.filter((r) => r.section === s.k); if (!rs.length) return;
      if (doc.y > doc.page.height - 150) doc.addPage();
      doc.font("cap").fontSize(8).fillColor(C.or).text(String(s.t).toUpperCase(), 64, doc.y, { characterSpacing: 2 }); doc.moveDown(0.4); filet(); doc.moveDown(0.5);
      rs.forEach((r) => {
        if (doc.y > doc.page.height - 90) doc.addPage();
        const y = doc.y;
        doc.font("corps").fontSize(9.5).fillColor(C.doux).text(r.label, 64, y, { width: W * 0.42 });
        const h1 = doc.y;
        doc.font("corpsM").fontSize(9.5).fillColor(C.encre).text(String(r.val) + (r.attente ? tt("  · à confirmer", "  · a confirmar") : ""), 64 + W * 0.46, y, { width: W * 0.54 });
        doc.y = Math.max(h1, doc.y) + 5;
      });
      doc.moveDown(1);
    });
    if (doc.y > doc.page.height - 140) doc.addPage();
    doc.moveDown(0.6); filet(); doc.moveDown(1);
    doc.font("titreI").fontSize(12.5).fillColor(C.encre).text(tt("Vos réponses restent modifiables jusqu'au " + tr(cfg.modifJusqu) + ", depuis votre lien personnel.", "As suas respostas podem ser alteradas até " + tr(cfg.modifJusqu) + ", através do seu link pessoal."), 64, doc.y, { width: W, align: "center" });
    doc.moveDown(0.6).font("cap").fontSize(7.5).fillColor(C.or).text("YES I DO", { align: "center", characterSpacing: 3 });
    doc.end();
  });
}

function html(cfg, e, c, m, lien) {
  const L = e.langue(), tt = (fr, pt) => (L === "pt" ? pt : fr), tr = (o) => (typeof o === "string" ? o : (o && (o[L] || o.fr)) || "");
  const S = e.etat(), prenom = S.coord.prenom || accueil.appel(c, m);
  const corps = [
    tt("Bonjour " + prenom + ",", "Olá " + prenom + ","),
    tt("Merci d'avoir pris le temps de nous répondre. " + cfg.maries + " seront ravis de vous compter parmi eux.", "Agradecemos o tempo que dedicou a responder-nos. " + cfg.maries + " ficarão muito felizes por contar com a sua presença."),
    tt("Vous trouverez en pièce jointe le récapitulatif de vos réponses. Elles restent modifiables jusqu'au " + tr(cfg.modifJusqu) + ".", "Em anexo encontrará o resumo das suas respostas. Poderão ser alteradas até " + tr(cfg.modifJusqu) + "."),
    tt("Nous restons à votre écoute pour toute question, et reviendrons vers vous si besoin.", "Continuamos ao seu dispor para qualquer questão, e entraremos em contacto consigo se for necessário.")
  ].map((p) => `<p style="margin:0 0 16px">${esc(p)}</p>`).join("");
  const bouton = lien ? `<p style="margin:24px 0 28px"><a href="${esc(lien)}" style="display:inline-block;padding:13px 26px;border-radius:28px;background:#D4B07A;color:#141210;text-decoration:none;font:600 14px Arial,sans-serif">${esc(tt("Revoir mes réponses", "Rever as minhas respostas"))}</a></p>` : "";
  return `<!doctype html><html><body style="margin:0;background:#FAF7F2"><div style="max-width:560px;margin:0 auto;padding:36px 28px;font:16px/1.6 Georgia,'Times New Roman',serif;color:#141210">` +
    `<div style="font:600 11px Arial,sans-serif;letter-spacing:.22em;text-transform:uppercase;color:#B8956A;margin-bottom:22px">${esc(cfg.maries)}</div>` + corps + bouton +
    `<div style="border-top:1px solid #E6E1DA;margin-top:24px;padding-top:14px;font:12px Arial,sans-serif;color:#6B655E">Yes I Do · ${esc(tt("l'accueil des invités de ", "o acolhimento dos convidados de ") + cfg.maries)}</div></div></body></html>`;
}

async function envoyer(c, m, e, rep, email) {
  const cfg = require("./formulaire").config(m), L = e.langue();
  const prenom = e.etat().coord.prenom || accueil.appel(c, m);
  const fichier = await pdf(cfg, e, rep, prenom);
  const objet = (L === "pt" ? "As suas respostas · " : "Vos réponses · ") + cfg.maries;
  const contenu = html(cfg, e, c, m, require("./invite").lien(m, c.jeton));
  const nomPdf = (L === "pt" ? "As suas respostas · " : "Vos réponses · ") + cfg.maries + ".pdf";
  /* un mariage Test n'écrit jamais à l'invité : à l'équipe si une adresse est réglée, sinon rien ne part */
  const dest = m.statut === "Test" ? (process.env.YID_EQUIPE_EMAIL || null) : email;
  if (!dest) return null;
  if (process.env.YID_MAIL_FAKE) { (global.__YID_MAILS = global.__YID_MAILS || []).push({ de: m.boite_email, a: dest, objet, pj: nomPdf, taille: fichier.length, le: new Date().toISOString() }); return { a: dest }; }
  const graph = require("./graph");
  if (!graph.enabled() || !m.boite_email) throw new Error("boîte du mariage non connectée");
  await graph.call("POST", `/users/${encodeURIComponent(m.boite_email)}/sendMail`, { message: { subject: objet, body: { contentType: "HTML", content: contenu }, toRecipients: [{ emailAddress: { address: dest } }],
    attachments: [{ "@odata.type": "#microsoft.graph.fileAttachment", name: nomPdf, contentType: "application/pdf", contentBytes: fichier.toString("base64") }] }, saveToSentItems: true });
  return { a: dest };
}

module.exports = { pdf, html, envoyer };
