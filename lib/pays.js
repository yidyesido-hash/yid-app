/* =====================================================================
   TABLE DES PAYS · lecture des numéros de téléphone
   ind : indicatif international ; lg : longueurs admises du numéro
   national (après retrait du 0 de composition quand le pays en a un) ;
   mob : préfixes des mobiles ; fixe : préfixes des fixes (quand connus) ;
   trunk : le pays compose un 0 devant le numéro national (retiré en
   international). Les pays absents de la table sont lus avec leur seul
   indicatif : le numéro est accepté et signalé « format à vérifier »
   s'il est anormalement court ou long.
   Extensible sans code : ajouter une ligne.
   ===================================================================== */
const PAYS = [
  { code: "FR", nom: "France", ind: "33", lg: [9], mob: ["6", "7"], fixe: ["1", "2", "3", "4", "5", "9"], trunk: true },
  { code: "BE", nom: "Belgique", ind: "32", lg: [8, 9], mob: ["4"], fixe: ["1", "2", "3", "5", "6", "7", "8", "9"], trunk: true },
  { code: "LU", nom: "Luxembourg", ind: "352", lg: [6, 7, 8, 9], mob: ["62", "66", "69"], fixe: [], trunk: false },
  { code: "CH", nom: "Suisse", ind: "41", lg: [9], mob: ["74", "75", "76", "77", "78", "79"], fixe: ["2", "3", "4", "5", "6", "8"], trunk: true },
  { code: "GB", nom: "Royaume Uni", ind: "44", lg: [10], mob: ["7"], fixe: ["1", "2", "3"], trunk: true },
  { code: "IE", nom: "Irlande", ind: "353", lg: [9], mob: ["8"], fixe: [], trunk: true },
  { code: "US", nom: "États Unis", ind: "1", lg: [10], mob: [], fixe: [], trunk: false },
  { code: "CA", nom: "Canada", ind: "1", lg: [10], mob: [], fixe: [], trunk: false },
  { code: "NL", nom: "Pays Bas", ind: "31", lg: [9], mob: ["6"], fixe: ["1", "2", "3", "4", "5", "7", "8"], trunk: true },
  { code: "DE", nom: "Allemagne", ind: "49", lg: [10, 11], mob: ["15", "16", "17"], fixe: [], trunk: true },
  { code: "AT", nom: "Autriche", ind: "43", lg: [9, 10, 11, 12], mob: ["6"], fixe: [], trunk: true },
  { code: "ES", nom: "Espagne", ind: "34", lg: [9], mob: ["6", "7"], fixe: ["8", "9"], trunk: false },
  { code: "IT", nom: "Italie", ind: "39", lg: [9, 10, 11], mob: ["3"], fixe: ["0"], trunk: false },
  { code: "PT", nom: "Portugal", ind: "351", lg: [9], mob: ["9"], fixe: ["2"], trunk: false },
  { code: "GR", nom: "Grèce", ind: "30", lg: [10], mob: ["69"], fixe: ["2"], trunk: false },
  { code: "PL", nom: "Pologne", ind: "48", lg: [9], mob: ["45", "5", "6", "7", "8"], fixe: [], trunk: false },
  { code: "RO", nom: "Roumanie", ind: "40", lg: [9], mob: ["7"], fixe: ["2", "3"], trunk: true },
  { code: "SE", nom: "Suède", ind: "46", lg: [7, 8, 9, 10], mob: ["7"], fixe: [], trunk: true },
  { code: "NO", nom: "Norvège", ind: "47", lg: [8], mob: ["4", "9"], fixe: [], trunk: false },
  { code: "DK", nom: "Danemark", ind: "45", lg: [8], mob: [], fixe: [], trunk: false },
  { code: "TR", nom: "Turquie", ind: "90", lg: [10], mob: ["5"], fixe: [], trunk: true },
  { code: "IL", nom: "Israël", ind: "972", lg: [8, 9], mob: ["5"], fixe: [], trunk: true },
  { code: "LB", nom: "Liban", ind: "961", lg: [7, 8], mob: ["3", "7", "8"], fixe: [], trunk: true },
  { code: "AE", nom: "Émirats arabes unis", ind: "971", lg: [8, 9], mob: ["5"], fixe: [], trunk: true },
  { code: "MA", nom: "Maroc", ind: "212", lg: [9], mob: ["6", "7"], fixe: ["5"], trunk: true },
  { code: "DZ", nom: "Algérie", ind: "213", lg: [8, 9], mob: ["5", "6", "7"], fixe: [], trunk: true },
  { code: "TN", nom: "Tunisie", ind: "216", lg: [8], mob: ["2", "4", "5", "9"], fixe: ["3", "7"], trunk: false },
  { code: "SN", nom: "Sénégal", ind: "221", lg: [9], mob: ["7"], fixe: ["3"], trunk: false },
  { code: "CI", nom: "Côte d'Ivoire", ind: "225", lg: [10], mob: ["01", "05", "07"], fixe: ["2"], trunk: false },
  { code: "ML", nom: "Mali", ind: "223", lg: [8], mob: ["6", "7", "8", "9"], fixe: ["2"], trunk: false },
  { code: "GN", nom: "Guinée", ind: "224", lg: [9], mob: ["6"], fixe: [], trunk: false },
  { code: "TG", nom: "Togo", ind: "228", lg: [8], mob: ["7", "9"], fixe: ["2"], trunk: false },
  { code: "BJ", nom: "Bénin", ind: "229", lg: [8, 10], mob: [], fixe: [], trunk: false },
  { code: "CM", nom: "Cameroun", ind: "237", lg: [9], mob: ["6"], fixe: ["2"], trunk: false },
  { code: "GA", nom: "Gabon", ind: "241", lg: [8, 9], mob: ["06", "07", "6", "7"], fixe: [], trunk: false },
  { code: "CG", nom: "République du Congo", ind: "242", lg: [9], mob: ["04", "05", "06"], fixe: ["02"], trunk: false },
  { code: "CD", nom: "République démocratique du Congo", ind: "243", lg: [9], mob: ["8", "9"], fixe: [], trunk: true },
  { code: "NG", nom: "Nigeria", ind: "234", lg: [10], mob: ["7", "8", "9"], fixe: [], trunk: true },
  { code: "GH", nom: "Ghana", ind: "233", lg: [9], mob: ["2", "5"], fixe: ["3"], trunk: true },
  { code: "KE", nom: "Kenya", ind: "254", lg: [9], mob: ["1", "7"], fixe: [], trunk: true },
  { code: "ZA", nom: "Afrique du Sud", ind: "27", lg: [9], mob: ["6", "7", "8"], fixe: [], trunk: true },
  { code: "MG", nom: "Madagascar", ind: "261", lg: [9], mob: ["3"], fixe: ["2"], trunk: true },
  { code: "MU", nom: "Maurice", ind: "230", lg: [7, 8], mob: ["5"], fixe: [], trunk: false },
  { code: "RE", nom: "La Réunion", ind: "262", lg: [9], mob: ["692", "693"], fixe: ["262", "263"], trunk: true },
  { code: "GP", nom: "Guadeloupe", ind: "590", lg: [9], mob: ["690", "691"], fixe: ["590"], trunk: true },
  { code: "MQ", nom: "Martinique", ind: "596", lg: [9], mob: ["696", "697"], fixe: ["596"], trunk: true },
  { code: "GF", nom: "Guyane", ind: "594", lg: [9], mob: ["694"], fixe: ["594"], trunk: true },
  { code: "HT", nom: "Haïti", ind: "509", lg: [8], mob: ["3", "4"], fixe: ["2"], trunk: false },
  { code: "BR", nom: "Brésil", ind: "55", lg: [10, 11], mob: [], fixe: [], trunk: true },
  { code: "MX", nom: "Mexique", ind: "52", lg: [10], mob: [], fixe: [], trunk: false },
  { code: "JP", nom: "Japon", ind: "81", lg: [9, 10], mob: ["70", "80", "90"], fixe: [], trunk: true },
  { code: "CN", nom: "Chine", ind: "86", lg: [10, 11], mob: ["1"], fixe: [], trunk: true },
  { code: "IN", nom: "Inde", ind: "91", lg: [10], mob: ["6", "7", "8", "9"], fixe: [], trunk: true },
  { code: "AU", nom: "Australie", ind: "61", lg: [9], mob: ["4"], fixe: ["2", "3", "7", "8"], trunk: true }
];
/* Les numéros des départements et régions d'outre mer tapés à la française (0690…) : leur vrai indicatif. */
const DOM = [["0690", "590"], ["0691", "590"], ["0696", "596"], ["0697", "596"], ["0694", "594"], ["0639", "262"], ["0692", "262"], ["0693", "262"]];
/* Indicatifs connus hors table (lecture avec l'indicatif seul). */
const INDICATIFS = ["1", "7", "20", "27", "30", "31", "32", "33", "34", "36", "39", "40", "41", "43", "44", "45", "46", "47", "48", "49", "51", "52", "53", "54", "55", "56", "57", "58", "60", "61", "62", "63", "64", "65", "66", "81", "82", "84", "86", "90", "91", "92", "93", "94", "95", "98", "211", "212", "213", "216", "218", "220", "221", "222", "223", "224", "225", "226", "227", "228", "229", "230", "231", "232", "233", "234", "235", "236", "237", "238", "239", "240", "241", "242", "243", "244", "245", "246", "248", "249", "250", "251", "252", "253", "254", "255", "256", "257", "258", "260", "261", "262", "263", "264", "265", "266", "267", "268", "269", "290", "291", "297", "298", "299", "350", "351", "352", "353", "354", "355", "356", "357", "358", "359", "370", "371", "372", "373", "374", "375", "376", "377", "378", "380", "381", "382", "383", "385", "386", "387", "389", "420", "421", "423", "500", "501", "502", "503", "504", "505", "506", "507", "508", "509", "590", "591", "592", "593", "594", "595", "596", "597", "598", "599", "670", "672", "673", "674", "675", "676", "677", "678", "679", "680", "681", "682", "683", "685", "686", "687", "688", "689", "690", "691", "692", "850", "852", "853", "855", "856", "880", "886", "960", "961", "962", "963", "964", "965", "966", "967", "968", "970", "971", "972", "973", "974", "975", "976", "977", "992", "993", "994", "995", "996", "998"];

const parNom = (nom) => PAYS.find(p => p.nom === nom) || null;
const parCode = (code) => PAYS.find(p => p.code === code) || null;
const parIndicatif = (ind) => PAYS.find(p => p.ind === ind) || null;

module.exports = { PAYS, DOM, INDICATIFS, parNom, parCode, parIndicatif };
