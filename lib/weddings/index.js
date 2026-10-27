const am27 = require("./am27");

/* AK00 : mariage fictif Awa & Kévin, banc d'essai permanent. Même configuration qu'AM27,
   stockage et classeur Excel séparés : aucune réponse de test ne touche un vrai mariage. */
const ak00 = Object.assign({}, am27, {
  id: "AK00",
  couple: "Awa & Kévin",
  site: process.env.SITE_URL_AK00 || am27.site,
  excel: Object.assign({}, am27.excel, { path: "Listes d'invités/Awa et Kévin (test)/Réponses Awa et Kévin.xlsx" })
});

module.exports = { AM27: am27, AK00: ak00 };
