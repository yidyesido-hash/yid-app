/* =====================================================================
   PARSEUR DE CONTACTS · vCard 2.1 (Android, quoted printable), 3.0 (iPhone),
   4.0, et CSV (exports Google, Outlook, génériques).
   Fidèle à la doctrine collect v2 : FN verbatim = nom de répertoire (N en
   appoint), numéros identiques d'une même fiche fusionnés (piège Samsung),
   numéro préféré = marqué PREF sinon le premier avec signalement, photos et
   emails ignorés, coupures douces quoted printable parasites neutralisées.
   Usage : lire(buffer, nomFichier) -> [{ nom, telephones:[{ brut, pref }], source }]
   ===================================================================== */

/* ---------- décodage ---------- */
function decoderQP(s, charset) {
  const bytes = [];
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "=" && /^[0-9A-Fa-f]{2}$/.test(s.substr(i + 1, 2))) { bytes.push(parseInt(s.substr(i + 1, 2), 16)); i += 2; }
    else bytes.push(s.charCodeAt(i) & 0xff);
  }
  const buf = Buffer.from(bytes);
  const cs = String(charset || "utf-8").toLowerCase();
  if (cs.includes("8859") || cs.includes("latin") || cs.includes("1252")) return buf.toString("latin1");
  const t = buf.toString("utf8");
  return t.includes("�") ? buf.toString("latin1") : t;
}
function texte(buffer) {
  const b = Buffer.isBuffer(buffer) ? buffer : Buffer.from(String(buffer), "utf8");
  if (b.length >= 2 && b[0] === 0xff && b[1] === 0xfe) return b.slice(2).toString("utf16le");
  if (b.length >= 3 && b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) return b.slice(3).toString("utf8");
  const t = b.toString("utf8");
  return t.includes("�") ? b.toString("latin1") : t;
}
const unescape30 = (v) => String(v).replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");

/* ---------- vCard : dépliage des lignes ---------- */
const debutPropriete = (l) => /^(?:[A-Za-z0-9-]+\.)?[A-Za-z][A-Za-z0-9-]*(?:;[^:]*)?:/.test(l) || /^(BEGIN|END):/i.test(l);
function deplier(txt) {
  const raw = txt.split(/\r\n|\r|\n/);
  const lignes = []; let cur = null, qp = false;
  for (let i = 0; i < raw.length; i++) {
    const l = raw[i];
    if (cur !== null && (l.startsWith(" ") || l.startsWith("\t"))) { cur += l.slice(1); continue; }           /* 3.0 et 4.0 */
    if (cur !== null && qp && cur.endsWith("=")) {
      /* coupure douce quoted printable : la suite est une continuation, sauf si la ligne suivante est une propriété */
      if (!debutPropriete(l) && l !== "") { cur = cur.slice(0, -1) + l; continue; }
      cur = cur.slice(0, -1);                                                                             /* coupure parasite en fin de valeur */
    }
    if (cur !== null) lignes.push(cur);
    cur = l; qp = /ENCODING=QUOTED-PRINTABLE/i.test(l) || /;QUOTED-PRINTABLE/i.test(l.split(":")[0] || "");
  }
  if (cur !== null) lignes.push(cur);
  return lignes.filter(l => l.trim() !== "");
}
function propriete(l) {
  const i = l.indexOf(":"); if (i < 0) return null;
  let head = l.slice(0, i), value = l.slice(i + 1);
  head = head.replace(/^[A-Za-z0-9-]+\./, "");                    /* item1.TEL (iPhone) */
  const parts = head.split(";"); const name = parts[0].toUpperCase();
  const params = {};
  for (const p of parts.slice(1)) {
    const [k, v] = p.includes("=") ? p.split("=", 2) : ["TYPE", p];   /* 2.1 : TEL;CELL;PREF */
    const key = k.toUpperCase(); const val = (v === undefined ? "" : v).toUpperCase();
    params[key] = params[key] ? params[key] + "," + val : val;
  }
  if (/QUOTED-PRINTABLE/.test(params.ENCODING || "")) value = decoderQP(value, params.CHARSET);
  return { name, params, value };
}

/* ---------- vCard : fiches ---------- */
function lireVcf(txt, source) {
  const out = []; let card = null;
  for (const l of deplier(txt)) {
    const p = propriete(l); if (!p) continue;
    if (p.name === "BEGIN" && /VCARD/i.test(p.value)) { card = { fn: "", n: "", telephones: [], version: "", email: null }; continue; }
    if (p.name === "END" && /VCARD/i.test(p.value)) { if (card) out.push(fiche(card, source)); card = null; continue; }
    if (!card) continue;
    if (p.name === "VERSION") card.version = p.value.trim();
    else if (p.name === "EMAIL") { const e = p.value.trim(); if (e && !card.email) card.email = e.slice(0, 120); }
    else if (p.name === "FN") card.fn = unescape30(p.value).trim();
    else if (p.name === "N") { const n = p.value.split(";").map(x => unescape30(x).trim()); card.n = [n[3], n[1], n[2], n[0], n[4]].filter(Boolean).join(" ").trim(); }
    else if (p.name === "TEL") {
      const types = (p.params.TYPE || "") + "," + Object.keys(p.params).filter(k => !["TYPE", "ENCODING", "CHARSET", "VALUE", "PREF"].includes(k)).join(",");
      const pref = /(^|,)PREF(,|$)/.test(types) || (p.params.PREF !== undefined && p.params.PREF !== "" ? true : false) || p.params.PREF === "";
      const brut = p.value.trim();
      if (brut) card.telephones.push({ brut, pref: !!pref, type: types.replace(/^,|,$/g, "") });
    }
  }
  if (card && (card.fn || card.telephones.length || card.email)) out.push(fiche(card, source));
  return out;
}
function fiche(card, source) {
  /* numéros identiques d'une même fiche fusionnés, PREF conservé si l'un des doublons le porte */
  const seen = new Map();
  for (const t of card.telephones) { const k = t.brut.replace(/[\s.\-()]/g, ""); if (seen.has(k)) { if (t.pref) seen.get(k).pref = true; } else seen.set(k, { brut: t.brut, pref: t.pref, type: t.type }); }
  const tels = [...seen.values()];
  /* sans PREF explicite, un seul numéro marqué mobile face à des fixes ou des numéros de travail vaut marquage */
  if (tels.length > 1 && !tels.some(t => t.pref)) { const mobiles = tels.filter(t => /CELL|MOBILE|PORTABLE|GSM|IPHONE/i.test(t.type || "")); if (mobiles.length === 1) mobiles[0].pref = true; }
  return { nom: card.fn || card.n || "", telephones: tels, source: source || "", version: card.version, email: card.email || null };
}

/* ---------- CSV ---------- */
function parseCSV(text) {
  text = String(text || "").replace(/^﻿/, "");
  const first = text.split(/\r?\n/)[0] || "";
  const delim = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ";" : (first.includes("\t") ? "\t" : ",");
  const out = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true;
    else if (c === delim) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); out.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); out.push(row); }
  return out.filter(r => r.some(x => x.trim()));
}
const norm = (s) => String(s || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
function lireCsv(txt, source) {
  const rows = parseCSV(txt); if (rows.length < 2) return [];
  const head = rows[0].map(norm);
  const iName = head.findIndex(h => ["name", "nom", "display name", "nom complet", "full name", "nom d'affichage"].includes(h));
  const iGiven = head.findIndex(h => ["given name", "first name", "prenom", "prénom", "first"].includes(h));
  const iFamily = head.findIndex(h => ["family name", "last name", "nom de famille", "last", "surname"].includes(h));
  const iTels = head.map((h, i) => (/phone|telephone|tel\b|mobile|portable|gsm|cellulaire|numero/.test(h) && !/type|label|e-mail|email/.test(h)) ? i : -1).filter(i => i >= 0);
  const iTypes = head.map((h, i) => (/phone.*type|type.*phone|tel.*type/.test(h) ? i : -1)).filter(i => i >= 0);
  if (iName < 0 && iGiven < 0 && iFamily < 0) throw new Error("CSV sans colonne de nom reconnue (Name, Nom, Given Name, First Name…).");
  if (!iTels.length) throw new Error("CSV sans colonne de téléphone reconnue (Phone, Téléphone, Mobile…).");
  return rows.slice(1).map(r => {
    const g = (i) => (i >= 0 ? (r[i] || "").trim() : "");
    const nom = g(iName) || [g(iGiven), g(iFamily)].filter(Boolean).join(" ");
    const tels = [];
    iTels.forEach((i, k) => { const v = g(i); if (!v) return; v.split(/\s*:::\s*|\s*;\s*/).filter(Boolean).forEach(x => tels.push({ brut: x, pref: false, type: g(iTypes[k] !== undefined ? iTypes[k] : -1).toUpperCase() })); });
    return fiche({ fn: nom, n: "", telephones: tels, version: "csv" }, source);
  }).filter(c => c.nom || c.telephones.length);
}

/* ---------- point d'entrée ---------- */
function lire(buffer, nomFichier, source) {
  const txt = texte(buffer);
  if (/BEGIN:VCARD/i.test(txt)) return lireVcf(txt, source);
  if (/\.(csv|txt)$/i.test(nomFichier || "") || /[,;\t]/.test(txt.split(/\r?\n/)[0] || "")) return lireCsv(txt, source);
  throw new Error("Fichier non reconnu : ni vCard (.vcf) ni CSV.");
}

module.exports = { lire, lireVcf, lireCsv, deplier, decoderQP, parseCSV };
