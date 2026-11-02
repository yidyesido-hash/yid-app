/* =====================================================================
   LECTEUR XLSX MINIMAL · sans dépendance
   Lit un classeur (zip de XML) : feuilles, cellules (texte partagé, texte
   en ligne, nombres, formules avec leur valeur calculée), notes de cellule.
   Sert à lire un collect v4 de l'outil d'import. Usage :
     lire(buffer) -> { feuilles: [{ nom, cellules: { A1: valeur }, notes: { B31: texte }, max: { r, c } }] }
   ===================================================================== */
const zlib = require("zlib");

/* ---------- zip ---------- */
function entries(buf) {
  const out = {};
  let p = buf.length - 22;
  while (p >= 0 && buf.readUInt32LE(p) !== 0x06054b50) p--;
  if (p < 0) throw new Error("Classeur illisible : pas un fichier zip.");
  const n = buf.readUInt16LE(p + 10), cd = buf.readUInt32LE(p + 16);
  let q = cd;
  for (let i = 0; i < n; i++) {
    if (buf.readUInt32LE(q) !== 0x02014b50) break;
    const method = buf.readUInt16LE(q + 10), csize = buf.readUInt32LE(q + 20), usize = buf.readUInt32LE(q + 24), nl = buf.readUInt16LE(q + 28), el = buf.readUInt16LE(q + 30), cl = buf.readUInt16LE(q + 32), off = buf.readUInt32LE(q + 42);
    const name = buf.slice(q + 46, q + 46 + nl).toString("utf8");
    const lnl = buf.readUInt16LE(off + 26), lel = buf.readUInt16LE(off + 28), start = off + 30 + lnl + lel;
    const data = buf.slice(start, start + csize);
    out[name] = method === 8 ? zlib.inflateRawSync(data) : method === 0 ? data : null;
    if (out[name] && usize && out[name].length !== usize) { /* tolérant */ }
    q += 46 + nl + el + cl;
  }
  return out;
}

/* ---------- xml ---------- */
const unesc = (s) => String(s).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(+d)).replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&amp;/g, "&");
const texteDe = (xml) => unesc((xml.match(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g) || []).map(t => t.replace(/<t(?:\s[^>]*)?>|<\/t>/g, "")).join("")).replace(/_x000D_/g, "");

function lire(buffer) {
  const z = entries(buffer);
  const get = (n) => (z[n] ? z[n].toString("utf8") : null);
  const shared = [];
  const ss = get("xl/sharedStrings.xml");
  if (ss) for (const si of ss.match(/<si>[\s\S]*?<\/si>/g) || []) shared.push(texteDe(si));
  const wb = get("xl/workbook.xml") || "", rels = get("xl/_rels/workbook.xml.rels") || "";
  const relMap = {}; for (const r of rels.match(/<Relationship [^>]*\/>/g) || []) { const id = (r.match(/Id="([^"]+)"/) || [])[1], t = (r.match(/Target="([^"]+)"/) || [])[1]; if (id && t) relMap[id] = t.replace(/^\/?xl\//, "").replace(/^\//, ""); }
  const feuilles = [];
  for (const sh of wb.match(/<sheet [^>]*\/>/g) || []) {
    const nom = unesc((sh.match(/name="([^"]+)"/) || [])[1] || ""), rid = (sh.match(/r:id="([^"]+)"/) || [])[1];
    const path = "xl/" + (relMap[rid] || "");
    const xml = get(path); if (!xml) continue;
    const cellules = {}; let maxR = 0, maxC = 0;
    for (const c of xml.match(/<c [^>]*?(?:\/>|>[\s\S]*?<\/c>)/g) || []) {
      const ref = (c.match(/ r="([A-Z]+\d+)"/) || [])[1]; if (!ref) continue;
      const t = (c.match(/ t="([^"]+)"/) || [])[1] || "";
      let v = null;
      if (t === "s") { const i = (c.match(/<v>(\d+)<\/v>/) || [])[1]; v = i !== undefined ? shared[+i] : null; }
      else if (t === "inlineStr") v = texteDe(c);
      else if (t === "str" || t === "e") v = unesc((c.match(/<v>([\s\S]*?)<\/v>/) || [])[1] || "");
      else if (t === "b") v = (c.match(/<v>(\d)<\/v>/) || [])[1] === "1";
      else { const raw = (c.match(/<v>([\s\S]*?)<\/v>/) || [])[1]; v = raw === undefined ? null : (isFinite(Number(raw)) ? Number(raw) : unesc(raw)); }
      if (v === null || v === "") continue;
      cellules[ref] = v;
      const col = ref.match(/^[A-Z]+/)[0], row = +ref.match(/\d+$/)[0];
      maxR = Math.max(maxR, row); maxC = Math.max(maxC, colIndex(col));
    }
    /* notes de cellule */
    const notes = {};
    const sheetRels = get(path.replace(/worksheets\//, "worksheets/_rels/") + ".rels") || "";
    const cm = sheetRels.match(/Target="([^"]*comments[^"]*)"/);
    if (cm) { const cx = get("xl/" + cm[1].replace(/^\.\.\//, "").replace(/^\/xl\//, "")); if (cx) for (const c of cx.match(/<comment [^>]*>[\s\S]*?<\/comment>/g) || []) { const ref = (c.match(/ref="([A-Z]+\d+)"/) || [])[1]; if (ref) notes[ref] = texteDe(c).replace(/^\s*[^:]{0,40}:\s*/, (m) => (/^(Auteur|Author|YID|Yes I Do)/i.test(m) ? "" : m)).trim(); } }
    feuilles.push({ nom, cellules, notes, max: { r: maxR, c: maxC } });
  }
  return { feuilles };
}
function colIndex(col) { let n = 0; for (const ch of col) n = n * 26 + (ch.charCodeAt(0) - 64); return n; }
function colName(n) { let s = ""; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
/* Une feuille sous forme de lignes : [[A, B, C…], …] à partir de la ligne 1. */
function lignes(feuille) {
  const out = [];
  for (let r = 1; r <= feuille.max.r; r++) { const row = []; for (let c = 1; c <= feuille.max.c; c++) row.push(feuille.cellules[colName(c) + r] === undefined ? null : feuille.cellules[colName(c) + r]); out.push(row); }
  return out;
}
/* Convertit un numéro de série Excel en date ISO. */
function dateExcel(n) { if (typeof n !== "number") return null; const d = new Date(Math.round((n - 25569) * 86400000)); return isNaN(d) ? null : d.toISOString().slice(0, 10); }

module.exports = { lire, lignes, colName, colIndex, dateExcel };
