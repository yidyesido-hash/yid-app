/* =====================================================================
   COLLECT · génère le classeur du couple DANS la matrice v4 de Cécilia
   Deux modèles embarqués (lib/assets) : la matrice v4 telle quelle, et sa
   variante avec la colonne Hébergement (dérivée du collect d'Alexander et
   Clarisse, données retirées). L'application remplit les lignes et l'onglet
   YID_Config ; en-tête, règles d'or, tuiles, formules, couleurs, notes et
   listes déroulantes restent celles de la matrice. Le classeur recalcule
   ses tuiles à l'ouverture.
   ===================================================================== */
const fs = require("fs"), path = require("path");
const xlsxread = require("./xlsxread");
const xlsx = require("./xlsx");

const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const colIdx = (c) => xlsxread.colIndex(c);
/* Pose une valeur dans une cellule d'une ligne XML, en gardant le style de la cellule du modèle ; vide = cellule laissée vide. */
function setCell(rowXml, ref, value) {
  const col = ref.match(/^[A-Z]+/)[0];
  const body = value === null || value === undefined || value === "" ? "" : (typeof value === "number" ? `<v>${value}</v>` : `<is><t xml:space="preserve">${esc(value)}</t></is>`);
  const t = typeof value === "number" || body === "" ? "" : ' t="inlineStr"';
  const re = new RegExp(`<c r="${ref}"([^>]*?)(?:/>|>[\\s\\S]*?</c>)`);
  const m = rowXml.match(re);
  if (m) {
    const s = (m[1].match(/ s="\d+"/) || [""])[0];
    return rowXml.replace(re, body ? `<c r="${ref}"${s}${t}>${body}</c>` : `<c r="${ref}"${s}/>`);
  }
  if (!body) return rowXml;
  /* insérer à sa place, par ordre de colonne */
  const cells = [...rowXml.matchAll(/<c r="([A-Z]+)\d+"/g)];
  const neu = `<c r="${ref}"${t}>${body}</c>`;
  for (const c of cells) { if (colIdx(c[1]) > colIdx(col)) return rowXml.slice(0, c.index) + neu + rowXml.slice(c.index); }
  return rowXml.replace(/<\/row>$/, neu + "</row>");
}
function setRow(sheetXml, r, values) {
  const re = new RegExp(`<row r="${r}"[^>]*>[\\s\\S]*?</row>`);
  const m = sheetXml.match(re);
  let row = m ? m[0] : `<row r="${r}"></row>`;
  for (const [ref, v] of Object.entries(values)) row = setCell(row, ref, v);
  if (m) return sheetXml.replace(re, row);
  /* ligne absente : l'ajouter avant la première ligne de numéro supérieur, sinon à la fin */
  const rows = [...sheetXml.matchAll(/<row r="(\d+)"/g)];
  for (const x of rows) if (+x[1] > r) return sheetXml.slice(0, x.index) + row + sheetXml.slice(x.index);
  return sheetXml.replace("</sheetData>", row + "</sheetData>");
}
const serie = (iso) => { if (!iso) return ""; const d = new Date(iso + "T00:00:00Z"); return Math.round(d.getTime() / 86400000) + 25569; };
const dateLongue = (iso) => { if (!iso) return ""; const d = new Date(iso + "T00:00:00Z"); return d.getUTCDate() + " " + ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"][d.getUTCMonth()] + " " + d.getUTCFullYear(); };

/* m : le mariage ; j : la liste (lib/liste.liste) ; renvoie un Buffer xlsx */
function generer(m, j) {
  const r = j.regles, heb = r.hebergement !== "aucun";
  const tpl = xlsxread.entries(fs.readFileSync(path.join(__dirname, "assets", heb ? "matrice_v4_hebergement.xlsx" : "matrice_v4.xlsx")));
  const files = Object.assign({}, tpl);
  const c = (m.parametres || {}).checklist || {};
  /* colonnes de la liste : A nom, B tel, C côté, D invitation, E lien, F précision, G assistance, H enfants, [I hébergement], nom, prénom, désactiver, 2e numéro, source, contrôle */
  const cols = heb ? { nom: "A", tel: "B", cote: "C", inv: "D", lien: "E", prec: "F", assist: "G", enf: "H", heb: "I", nomf: "J", pren: "K", des: "L", tel2: "M", src: "N", ctrl: "O" } : { nom: "A", tel: "B", cote: "C", inv: "D", lien: "E", prec: "F", assist: "G", enf: "H", nomf: "I", pren: "J", des: "K", tel2: "L", src: "M", ctrl: "N" };
  let sheet = files["xl/worksheets/sheet1.xml"].toString("utf8");
  const lignes = j.contacts.filter(x => !x.archive);
  /* ordre de la matrice : propres par côté puis alphabétique, anomalies en bas (c'est déjà l'ordre de liste()) */
  lignes.forEach((x, i) => {
    const rr = 19 + i, v = {};
    v[cols.nom + rr] = x.nom_repertoire; v[cols.tel + rr] = x.numero ? x.numero.replace(/^\+/, "") : (x.numero_brut || "");
    v[cols.cote + rr] = x.cote || ""; v[cols.inv + rr] = x.invitation || ""; v[cols.lien + rr] = x.lien || ""; v[cols.prec + rr] = x.precision || ""; v[cols.assist + rr] = x.assistance ? "Oui" : "";
    v[cols.enf + rr] = Number.isInteger(x.nb_enfants) ? x.nb_enfants : "";
    if (heb) v[cols.heb + rr] = x.hebergement || "";
    v[cols.nomf + rr] = x.nom || ""; v[cols.pren + rr] = x.prenom || ""; v[cols.des + rr] = x.desactive ? "Oui" : ""; v[cols.tel2 + rr] = x.numero_2 ? x.numero_2.replace(/^\+/, "") : ""; v[cols.src + rr] = x.source || "";
    v[cols.ctrl + rr] = x.etat === "à voir" ? (x.anomalies || []).map(a => a.libelle || a.type).join(" ; ") : "";
    sheet = setRow(sheet, rr, v);
  });
  /* les valeurs en cache des formules sont retirées : les tuiles se recalculent à l'ouverture, quel que soit le tableur */
  sheet = sheet.replace(/(<c [^>]*>)(<f>[\s\S]*?<\/f>)<v>[\s\S]*?<\/v>/g, "$1$2");
  files["xl/worksheets/sheet1.xml"] = Buffer.from(sheet, "utf8");
  /* YID_Config */
  let cfg = files["xl/worksheets/sheet2.xml"].toString("utf8");
  const config = { B2: m.prenoms, B3: dateLongue(m.date_mariage), B4: m.lieu || "", B5: m.prevu_contrat || "", H2: m.pays || "France", H3: serie(m.date_remise), H4: serie(m.date_arret), H5: m.seuil || "", H6: m.initiales || "", H7: r.enfants === "sans" ? "sans strict" : r.enfants === "mixte" ? "mixte" : "avec", H8: r.consigne_enfants || "" };
  if (heb) { config.J6 = "Hébergement"; config.H11 = r.hebergement === "tous" ? "Tous" : "Une partie"; config.H12 = (r.lieux || []).filter(l => l !== "Par leurs propres moyens").join(" ; "); config.H13 = r.volume_heberge || ""; config.H14 = "Hébergement"; (r.lieux || []).forEach((l, i) => { config["J" + (8 + i)] = l; }); }
  (r.precisions || []).forEach((p, i) => { config["F" + (8 + i)] = p; });
  const byRow = {}; for (const [ref, v] of Object.entries(config)) { const rr = +ref.match(/\d+$/)[0]; (byRow[rr] = byRow[rr] || {})[ref] = v; }
  for (const [rr, vals] of Object.entries(byRow)) cfg = setRow(cfg, +rr, vals);
  files["xl/worksheets/sheet2.xml"] = Buffer.from(cfg, "utf8");
  /* recalcul à l'ouverture, signature Yes I Do */
  let wb = files["xl/workbook.xml"].toString("utf8");
  wb = /<calcPr/.test(wb) ? wb.replace(/<calcPr([^>]*)\/>/, (a, b) => `<calcPr${b.replace(/ fullCalcOnLoad="\d"/, "")} fullCalcOnLoad="1"/>`) : wb.replace("</workbook>", '<calcPr fullCalcOnLoad="1"/></workbook>');
  files["xl/workbook.xml"] = Buffer.from(wb, "utf8");
  if (files["docProps/core.xml"]) files["docProps/core.xml"] = Buffer.from(files["docProps/core.xml"].toString("utf8").replace(/<dc:creator>[^<]*<\/dc:creator>/, "<dc:creator>Yes I Do</dc:creator>").replace(/<cp:lastModifiedBy>[^<]*<\/cp:lastModifiedBy>/, "<cp:lastModifiedBy>Yes I Do</cp:lastModifiedBy>"), "utf8");
  /* ordre du zip : [Content_Types].xml d'abord */
  const names = Object.keys(files).sort((a, b) => (a === "[Content_Types].xml" ? -1 : b === "[Content_Types].xml" ? 1 : 0));
  return xlsx.zip(names.filter(n => files[n]).map(n => [n, files[n]]));
}

module.exports = { generer, setCell, setRow };
