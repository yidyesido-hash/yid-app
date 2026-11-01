/* =====================================================================
   PDF MINIMAL · sans dépendance
   Pages A4 paysage, Helvetica, logo Yes I Do en JPEG, titres et tableau
   question / réponse. Sert à archiver la fiche du call 1.
   Usage : build({ title, subtitle, meta, sections:[{ heading, rows:[[question, reponse], ...] }] }) -> Buffer
   ===================================================================== */
const fs = require("fs"), path = require("path");
const LOGO = fs.readFileSync(path.join(__dirname, "assets", "logo.jpg"));
const LOGO_W = 600, LOGO_H = 507;
const W = 842, H = 595, M = 40;

function latin(s) {
  return String(s == null ? "" : s).replace(/œ/g, "oe").replace(/Œ/g, "OE").replace(/€/g, "EUR").replace(/’/g, "'").replace(/[–—]/g, "-").replace(/…/g, "...").replace(/[^\u0000-ÿ]/g, "?");
}
function escapePdf(s) { return latin(s).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)"); }
/* largeur approximative Helvetica : 0.5 em par caractère en moyenne, suffisant pour couper les lignes */
function wrap(text, size, width) {
  const words = latin(text).split(/\s+/).filter(Boolean), lines = []; let cur = "";
  const w = (s) => s.length * size * 0.52;
  for (const word of words) { const t = cur ? cur + " " + word : word; if (w(t) > width && cur) { lines.push(cur); cur = word; } else cur = t; }
  if (cur) lines.push(cur); return lines.length ? lines : [""];
}

function build(doc) {
  const pages = []; let ops = [], y = H - M;
  const newPage = () => { if (ops.length) pages.push(ops); ops = []; y = H - M; header(); };
  const text = (x, yy, size, str, bold) => ops.push(`BT /${bold ? "F2" : "F1"} ${size} Tf ${x.toFixed(1)} ${yy.toFixed(1)} Td (${escapePdf(str)}) Tj ET`);
  const line = (x1, y1, x2, y2, g) => ops.push(`${g} G 0.6 w ${x1.toFixed(1)} ${y1.toFixed(1)} m ${x2.toFixed(1)} ${y2.toFixed(1)} l S`);
  const header = () => {
    const lh = 44, lw = lh * LOGO_W / LOGO_H;
    ops.push(`q ${lw.toFixed(1)} 0 0 ${lh.toFixed(1)} ${M} ${(H - M - lh + 6).toFixed(1)} cm /Im1 Do Q`);
    text(M + lw + 16, H - M - 14, 16, doc.title || "", true);
    if (doc.subtitle) text(M + lw + 16, H - M - 32, 10, doc.subtitle, false);
    if (doc.meta) { ops.push("0.45 g"); text(W - M - doc.meta.length * 5.2, H - M - 14, 9, doc.meta, false); ops.push("0 g"); }
    line(M, H - M - lh - 2, W - M, H - M - lh - 2, 0.72);
    y = H - M - lh - 22;
  };
  header();
  const colQ = M, colA = M + 300, widthQ = 288, widthA = W - M - colA;
  for (const sec of doc.sections || []) {
    if (y < M + 60) newPage();
    ops.push("0.72 0.58 0.42 rg"); text(colQ, y, 12, sec.heading || "", true); ops.push("0 g"); y -= 18;
    for (const [q, a] of sec.rows || []) {
      const lq = wrap(q, 9.5, widthQ), la = wrap(a === undefined || a === null || a === "" ? "-" : a, 9.5, widthA);
      const n = Math.max(lq.length, la.length), hgt = n * 12 + 6;
      if (y - hgt < M + 20) newPage();
      lq.forEach((l, i) => text(colQ, y - i * 12, 9.5, l, false));
      la.forEach((l, i) => text(colA, y - i * 12, 9.5, l, true));
      y -= hgt; line(M, y + 4, W - M, y + 4, 0.88);
    }
    y -= 10;
  }
  pages.push(ops);

  /* ---------- assemblage ---------- */
  const objs = [];
  const add = (s) => { objs.push(s); return objs.length; };
  const fontN = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const fontB = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  const img = add(Buffer.concat([Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${LOGO_W} /Height ${LOGO_H} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${LOGO.length} >>\nstream\n`), LOGO, Buffer.from("\nendstream")]));
  const pagesIdx = objs.length + 1 + pages.length * 2; /* l'objet Pages vient après les pages et leurs contenus */
  const pageIds = [];
  for (const p of pages) {
    const content = Buffer.from(p.join("\n"), "latin1");
    const c = add(Buffer.concat([Buffer.from(`<< /Length ${content.length} >>\nstream\n`), content, Buffer.from("\nendstream")]));
    pageIds.push(add(`<< /Type /Page /Parent ${pagesIdx} 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 ${fontN} 0 R /F2 ${fontB} 0 R >> /XObject << /Im1 ${img} 0 R >> >> /Contents ${c} 0 R >>`));
  }
  const pagesId = add(`<< /Type /Pages /Kids [${pageIds.map(i => i + " 0 R").join(" ")}] /Count ${pageIds.length} >>`);
  const catalog = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  const d = new Date(), stamp = d.toISOString().replace(/[-:T]/g, "").slice(0, 14);
  const info = add(`<< /Title (${escapePdf(doc.title || "")}) /Author (Yes I Do) /Creator (Yes I Do) /Producer (Yes I Do) /CreationDate (D:${stamp}Z) >>`);
  let out = [Buffer.from("%PDF-1.4\n%âãÏÓ\n", "latin1")], offsets = [], pos = out[0].length;
  objs.forEach((o, i) => { offsets.push(pos); const b = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`), Buffer.isBuffer(o) ? o : Buffer.from(o, "latin1"), Buffer.from("\nendobj\n")]); out.push(b); pos += b.length; });
  const xref = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map(o => String(o).padStart(10, "0") + " 00000 n \n").join("")}trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${pos}\n%%EOF\n`;
  out.push(Buffer.from(xref, "latin1"));
  return Buffer.concat(out);
}

module.exports = { build };
