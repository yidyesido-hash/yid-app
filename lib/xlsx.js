/* =====================================================================
   CLASSEUR EXCEL MINIMAL · sans dépendance
   Construit un .xlsx (zip de XML) avec un onglet par feuille, une ligne
   d'en-tête et, pour chaque feuille, un tableau nommé (ListObject) que
   Microsoft Graph sait alimenter par « tables/{nom}/rows/add ».
   Usage : build([{ name:"Base invités", table:"BaseInvites", headers:[...], rows:[[...]] }, ...]) -> Buffer
   ===================================================================== */
const zlib = require("zlib");

/* ---------- zip ---------- */
const CRC = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
function crc32(buf) { let c = -1; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ -1) >>> 0; }
function dosTime(d) { return ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xFFFF; }
function dosDate(d) { return (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xFFFF; }
function zip(files) {
  const now = new Date(), locals = [], centrals = []; let offset = 0;
  for (const [name, content] of files) {
    const data = Buffer.from(content, "utf8"), comp = zlib.deflateRawSync(data), nameB = Buffer.from(name, "utf8"), crc = crc32(data);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(8, 8);
    lh.writeUInt16LE(dosTime(now), 10); lh.writeUInt16LE(dosDate(now), 12); lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(nameB.length, 26); lh.writeUInt16LE(0, 28);
    locals.push(lh, nameB, comp);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(8, 10);
    ch.writeUInt16LE(dosTime(now), 12); ch.writeUInt16LE(dosDate(now), 14); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(nameB.length, 28);
    ch.writeUInt16LE(0, 30); ch.writeUInt16LE(0, 32); ch.writeUInt16LE(0, 34); ch.writeUInt16LE(0, 36); ch.writeUInt32LE(0, 38); ch.writeUInt32LE(offset, 42);
    centrals.push(ch, nameB);
    offset += lh.length + nameB.length + comp.length;
  }
  const cd = Buffer.concat(centrals), eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(0, 4); eocd.writeUInt16LE(0, 6); eocd.writeUInt16LE(files.length, 8); eocd.writeUInt16LE(files.length, 10); eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(offset, 16); eocd.writeUInt16LE(0, 20);
  return Buffer.concat([...locals, cd, eocd]);
}

/* ---------- xlsx ---------- */
const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
function col(n) { let s = ""; n++; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
function cell(ref, v) {
  if (v === null || v === undefined || v === "") return "";
  if (typeof v === "number" && isFinite(v)) return `<c r="${ref}"><v>${v}</v></c>`;
  if (typeof v === "boolean") return `<c r="${ref}" t="b"><v>${v ? 1 : 0}</v></c>`;
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
}
const safeName = (s) => String(s).replace(/[\\/?*[\]:]/g, " ").slice(0, 31);
const tableName = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9_]/g, "") || "Table";

function build(sheets) {
  const files = [];
  const ws = sheets.map((s, i) => ({ ...s, idx: i + 1, sheetName: safeName(s.name), tableName: tableName(s.table || s.name) }));
  files.push(["[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>${ws.map(s => `<Override PartName="/xl/worksheets/sheet${s.idx}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/tables/table${s.idx}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml"/>`).join("")}</Types>`]);
  files.push(["_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`]);
  const now = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  files.push(["docProps/core.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:creator>Yes I Do</dc:creator><cp:lastModifiedBy>Yes I Do</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`]);
  files.push(["docProps/app.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Yes I Do</Application><Company>Yes I Do</Company></Properties>`]);
  files.push(["xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${ws.map(s => `<sheet name="${esc(s.sheetName)}" sheetId="${s.idx}" r:id="rId${s.idx}"/>`).join("")}</sheets></workbook>`]);
  files.push(["xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${ws.map(s => `<Relationship Id="rId${s.idx}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${s.idx}.xml"/>`).join("")}<Relationship Id="rId${ws.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`]);
  files.push(["xl/styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`]);
  for (const s of ws) {
    const headers = s.headers || [], rows = s.rows || [];
    const last = col(Math.max(headers.length, 1) - 1), lastRow = rows.length + 1;
    const rowXml = (r, vals, style) => `<row r="${r}">${vals.map((v, i) => { const ref = col(i) + r; return (v === null || v === undefined || v === "") ? "" : (style ? `<c r="${ref}" t="inlineStr" s="1"><is><t>${esc(v)}</t></is></c>` : cell(ref, v)); }).join("")}</row>`;
    const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><dimension ref="A1:${last}${lastRow}"/><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>${headers.map((h, i) => `<col min="${i + 1}" max="${i + 1}" width="${Math.min(60, Math.max(12, String(h).length + 4))}" customWidth="1"/>`).join("")}</cols><sheetData>${rowXml(1, headers, true)}${rows.map((r, i) => rowXml(i + 2, r, false)).join("")}</sheetData><tableParts count="1"><tablePart r:id="rId1"/></tableParts></worksheet>`;
    files.push([`xl/worksheets/sheet${s.idx}.xml`, sheetXml]);
    files.push([`xl/worksheets/_rels/sheet${s.idx}.xml.rels`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/table" Target="../tables/table${s.idx}.xml"/></Relationships>`]);
    const ref = `A1:${last}${Math.max(lastRow, 2)}`;
    files.push([`xl/tables/table${s.idx}.xml`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><table xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" id="${s.idx}" name="${esc(s.tableName)}" displayName="${esc(s.tableName)}" ref="${ref}" totalsRowShown="0"><autoFilter ref="${ref}"/><tableColumns count="${headers.length}">${headers.map((h, i) => `<tableColumn id="${i + 1}" name="${esc(h)}"/>`).join("")}</tableColumns><tableStyleInfo name="TableStyleLight1" showFirstColumn="0" showLastColumn="0" showRowStripes="1" showColumnStripes="0"/></table>`]);
  }
  return zip(files);
}

module.exports = { build, tableName };
