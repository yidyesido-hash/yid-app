/* =====================================================================
   YES I DO · LE MOTEUR DU FORMULAIRE DES INVITÉS
   Un seul code, deux usages : la page de l'invité le dessine, le serveur
   le relit pour vérifier et résumer chaque réponse (même logique).
   Il compose le formulaire d'un foyer à partir de trois entrées (méthode
   YID) : les caractéristiques du mariage (fiche, partie D), la typologie
   du foyer (collect), puis ses propres réponses.
   Règles tenues : aucun accord au genre de l'invité ; « Je ne le sais pas
   encore » partout où l'information peut manquer ; plafonds des mariés ;
   incohérences signalées ; rien de ce que décident les mariés.
   ===================================================================== */
(function (root) {
  "use strict";
  var PAYS_G = (typeof module !== "undefined" && typeof require === "function") ? require("./pays.js") : (root.YIDPays || []);

  function creer(CFG, FOY, ETAT) {
    var LANG = FOY.langue === "pt" || FOY.langue === "en" ? FOY.langue : "fr";
    var tt = function (fr, pt, en) { return LANG === "pt" ? pt : LANG === "en" ? (en == null ? fr : en) : fr; };
    var tr = function (o) { if (o == null) return ""; if (typeof o === "string") return o; return o[LANG] || o.fr || ""; };
    var MARIES = function () { return tr(CFG.maries); };
    var PASENCORE = function () { return { v: "inconnu", l: tt("Je ne le sais pas encore", "Ainda não sei", "I don't know yet") }; };
    var NBF = { fr: ["aucune", "une", "deux", "trois", "quatre", "cinq", "six", "sept"], pt: ["nenhum", "um", "dois", "três", "quatro", "cinco", "seis", "sete"], en: ["no", "one", "two", "three", "four", "five", "six", "seven"] };
    var NBP = { fr: ["aucune", "une", "deux", "trois", "quatre", "cinq", "six", "sept"], pt: ["nenhuma", "uma", "duas", "três", "quatro", "cinco", "seis", "sete"], en: ["no", "one", "two", "three", "four", "five", "six", "seven"] };
    var ORD = { fr: ["Première personne", "Deuxième personne", "Troisième personne", "Quatrième personne", "Cinquième personne"], pt: ["Primeira pessoa", "Segunda pessoa", "Terceira pessoa", "Quarta pessoa", "Quinta pessoa"], en: ["First guest", "Second guest", "Third guest", "Fourth guest", "Fifth guest"] };
    var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
    var elide = function (s) { if (LANG !== "fr") return String(s); return String(s).replace(/\b(de|que) ((?:<span data-nm="[^"]*">)?)([AEIOUYÉÈÊÂÎÔH])/g, function (m, w, sp, c) { return (w === "de" ? "d'" : "qu'") + sp + c; }); };
    var listeEt = function (a) { return a.length < 2 ? (a[0] || "") : a.slice(0, -1).join(", ") + tt(" et ", " e ", " and ") + a[a.length - 1]; };
    var MOMENTS = (CFG.moments || []).filter(function (m) { return m.ouvert !== false || !FOY.moments || FOY.moments.indexOf(m.id) >= 0; });
    var HEB = CFG.heb || { gere: "aucun" };
    var logeOffert = !!(FOY.loge && HEB.offert);
    var choixLieu = HEB.gere === "tous" && !HEB.offert && (HEB.lieux || []).length > 0;
    var MAISONS = (CFG.maisons || []).filter(function (x) { return x && x.nom; });

    var S = ETAT && typeof ETAT === "object" ? JSON.parse(JSON.stringify(ETAT)) : null;
    if (!S || !S.coord) S = { step: "accueil", presence: null, motNon: "", coord: { civ: FOY.civ || "", titre: "", titreAutre: "", nom: FOY.nom || "", prenom: FOY.prenom || "", ind: FOY.ind || "FR", tel: FOY.tel || "", email: FOY.email || "" },
      acc: { choix: null }, nbAcc: null, accs: {}, nbEnf: null, enf: {}, tous: null, mom: {}, absent: {}, seulMoment: {}, v: {}, heb: {}, dep: {}, table: {}, fin: {}, ack: {} };
    ["acc", "accs", "enf", "mom", "absent", "seulMoment", "v", "heb", "dep", "table", "fin", "ack", "resa", "extra"].forEach(function (k) { if (!S[k]) S[k] = {}; });
    S.step = S.step || "accueil";

    var MODE = "form", REQ = [], ROWS = [], SECTION = "";
    function get(p) { return p.split(".").reduce(function (o, k) { return o == null ? undefined : o[k]; }, S); }
    function set(p, v) { var ks = p.split("."), o = S; ks.slice(0, -1).forEach(function (k) { if (o[k] == null || typeof o[k] !== "object") o[k] = {}; o = o[k]; }); o[ks[ks.length - 1]] = v; }
    var fid = function (p) { return "f_" + p.replace(/[^a-zA-Z0-9]/g, "_"); };

    /* ---------- le foyer ---------- */
    function nomAcc() { var n = String(FOY.accNom || "").trim(); if (!n) return null; var p = n.split(/\s+/); return { prenom: p[0], nom: p.slice(1).join(" ") }; }
    function accIds() {
      if (S.presence !== "oui") return [];
      if (FOY.type === "deux") return ["oui", "autre"].indexOf(S.acc.choix) >= 0 ? ["acc"] : [];
      if (FOY.type === "libre") return S.acc.choix === "oui" ? ["acc"] : [];
      if (FOY.type === "plusieurs") { var n = /^\d$/.test(S.nbAcc || "") ? +S.nbAcc : 0, L = []; for (var i = 1; i <= n; i++) { var id = "p" + i; if (!S.accs[id]) S.accs[id] = {}; L.push(id); } return L; }
      return [];
    }
    function enfIds() {
      if (S.presence !== "oui" || !FOY.enfants) return [];
      var n = /^\d$/.test(S.nbEnf || "") ? +S.nbEnf : 0, L = [];
      for (var i = 1; i <= n; i++) { var id = "e" + i; if (!S.enf[id]) S.enf[id] = { prenom: "", nom: "", age: "" }; L.push(id); }
      return L;
    }
    function base() { return S.presence === "oui" ? ["inv"].concat(accIds(), enfIds()) : []; }
    function role(id) { return id === "inv" ? "inv" : (id === "acc" || id[0] === "p") ? "acc" : "enf"; }
    function fiche(id) { return id === "acc" ? S.acc : id[0] === "p" ? S.accs[id] : null; }
    function ageDe(id) { var a = S.enf[id] && S.enf[id].age; return a === "" || a == null ? null : +a; }
    function prenom(id) {
      if (id === "inv") return S.coord.prenom;
      var f = fiche(id);
      if (f) { if (f.prenom && !f.plusTard) return f.prenom; if (id === "acc" && FOY.type === "deux" && S.acc.choix === "oui") return nomAcc() ? nomAcc().prenom : tt("votre conjoint", "o seu cônjuge", "your partner"); return id === "acc" ? tt("la personne qui vous accompagne", "a pessoa que vem consigo", "the person accompanying you") : ORD[LANG][+id.slice(1) - 1].toLowerCase(); }
      return (S.enf[id] && S.enf[id].prenom) || tt("votre enfant n°", "o filho n.º ", "your child no. ") + id.slice(1);
    }
    function nm(id) { return '<span data-nm="' + id + '">' + esc(prenom(id)) + "</span>"; }
    function momOn(id, m) { if (S.tous === "oui") return true; return !(S.mom[id] && S.mom[id][m] === false); }
    function aucunMoment(id) { return !MOMENTS.some(function (m) { return momOn(id, m.id); }); }
    function present(id) { return base().indexOf(id) >= 0 && !(id !== "inv" && S.tous !== "oui" && aucunMoment(id) && S.absent[id] === "oui"); }
    function presents() { return base().filter(present); }
    function adultes() { return presents().filter(function (id) { return role(id) !== "enf" || (ageDe(id) != null && ageDe(id) >= 18); }); }
    function attend(id, m) { return present(id) && momOn(id, m); }
    var TRAITEUR = MOMENTS.filter(function (m) { return m.traiteur; }); if (!TRAITEUR.length) TRAITEUR = MOMENTS.slice();
    var REPAS = MOMENTS.filter(function (m) { return m.repas; })[0] || null;
    function repasNom() { return REPAS && !/d[îi]ner/i.test(REPAS.l.fr || REPAS.l) ? "repas" : "dîner"; }
    function servi(id) { return TRAITEUR.some(function (m) { return attend(id, m.id); }) || (!MOMENTS.length && present(id)); }
    function dine(id) { return REPAS ? attend(id, REPAS.id) : present(id); }

    /* ---------- composants ---------- */
    function req(label, ok, id) { if (MODE === "form") REQ.push({ label: elide(label), ok: ok, id: id }); }
    function row(label, val, attente) { if (MODE === "recap" && val != null && val !== "") ROWS.push({ section: SECTION, label: elide(label), val: val, attente: !!attente }); return ""; }
    function q(code, titre, aide, corps, extra, facultatif) {
      if (MODE === "recap") return corps;
      return '<section class="q" data-q="' + code + '" id="q_' + code + '"><h3>' + titre + (facultatif ? ' <span class="facult">' + tt("facultatif", "facultativo", "optional") + "</span>" : "") + "</h3>" + (aide ? '<p class="aide">' + aide + "</p>" : "") + corps + (extra || "") + "</section>";
    }
    function radio(k, opts, o) {
      o = o || {}; var v = get(k);
      if (MODE === "recap") { var s = opts.filter(function (x) { return x.v === v; })[0]; return row(o.r || "", s ? (s.rl || s.l) : "", o.attente && o.attente(v)); }
      if (!o.facultatif) req(o.need || o.r, function () { var g = get(k); return opts.some(function (x) { return x.v === g; }); }, fid(k));
      return '<div class="indic">' + tt("Une seule réponse", "Uma única resposta", "One answer") + '</div><div class="choix' + (o.ligne ? " ligne" : "") + '" id="' + fid(k) + '">' + opts.map(function (x) {
        return '<label class="opt' + (x.v === v ? " on" : "") + '"><input type="radio" name="' + esc(k) + '" value="' + esc(x.v) + '" data-k="' + esc(k) + '"' + (x.v === v ? " checked" : "") + '><span class="marq"></span><span class="lib">' + (x.html || esc(x.l)) + (x.d ? "<small>" + esc(x.d) + "</small>" : "") + "</span></label>";
      }).join("") + "</div>";
    }
    function checks(k, opts, o) {
      o = o || {};
      var val = function (x) { var v = get(k + "." + x.v); return v === undefined ? !!o.defaut : !!v; };
      if (MODE === "recap") return row(o.r || "", opts.filter(val).map(function (x) { return x.rl || x.l; }).join(", "));
      if (o.min1) req(o.need || o.r, function () { return opts.some(val); }, fid(k));
      return (o.sansIndic ? "" : '<div class="indic">' + tt("Plusieurs réponses possibles", "Várias respostas possíveis", "Several answers possible") + "</div>") + '<div class="choix' + (o.ligne ? " ligne" : "") + '" id="' + fid(k) + '">' + opts.map(function (x) {
        var on = val(x);
        return '<label class="opt case' + (on ? " on" : "") + '"><input type="checkbox" data-k="' + esc(k + "." + x.v) + '" data-groupe="' + esc(k) + '"' + (x.solo ? ' data-solo="1"' : "") + (on ? " checked" : "") + '><span class="marq"></span><span class="lib">' + (x.html || esc(x.l)) + (x.d ? "<small>" + esc(x.d) + "</small>" : "") + "</span></label>";
      }).join("") + "</div>";
    }
    function txt(k, o) {
      o = o || {}; var v = get(k) || "";
      if (MODE === "recap") return row(o.r || o.label || "", String(v).trim());
      if (o.req) req(o.need || o.label, function () { var x = String(get(k) || "").trim(); return o.type === "email" ? /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(x) : x.length > 0; }, fid(k));
      var attrs = 'id="' + fid(k) + '" data-k="' + esc(k) + '"' + (o.live ? ' data-live="' + o.live + '"' : "") + (o.ph ? ' placeholder="' + esc(o.ph) + '"' : "");
      var input = o.area ? "<textarea " + attrs + ">" + esc(v) + "</textarea>" : '<input type="' + (o.type || "text") + '" ' + attrs + ' value="' + esc(v) + '" autocomplete="' + (o.ac || "off") + '">';
      return '<div class="champ" data-champ="' + fid(k) + '">' + (o.label ? '<label for="' + fid(k) + '">' + o.label + "</label>" : "") + input + (o.aide ? '<p class="aide-champ">' + o.aide + "</p>" : "") + "</div>";
    }
    function sel(k, opts, o) {
      o = o || {}; var v = get(k);
      if (MODE === "recap") { var s = opts.filter(function (x) { return x.v === v; })[0]; return row(o.r || o.label || "", s ? (s.rl || s.l) : ""); }
      if (o.req) req(o.need || o.label, function () { var g = get(k); return opts.some(function (x) { return x.v === g; }); }, fid(k));
      return '<div class="champ" data-champ="' + fid(k) + '">' + (o.label ? '<label for="' + fid(k) + '">' + o.label + "</label>" : "") + '<select id="' + fid(k) + '" data-k="' + esc(k) + '">' + (o.ph !== false ? '<option value="">' + esc(o.ph || tt("Choisir", "Escolher", "Choose")) + "</option>" : "") +
        opts.map(function (x) { return '<option value="' + esc(x.v) + '"' + (x.v === v ? " selected" : "") + ">" + esc(x.l) + "</option>"; }).join("") + "</select></div>";
    }
    var HH = []; for (var h = 0; h < 24; h++) HH.push({ v: (h < 10 ? "0" : "") + h, l: (h < 10 ? "0" : "") + h + " h" });
    var MN = []; for (var mn = 0; mn < 60; mn += 5) MN.push({ v: (mn < 10 ? "0" : "") + mn, l: (mn < 10 ? "0" : "") + mn });
    function heure(k, o) {
      var v = get(k) || {};
      if (MODE === "recap") return row(o.r || o.label, v.h && v.m ? (LANG === "en" ? v.h + ":" + v.m : v.h + " h " + v.m) : "");
      req(o.need || o.label, function () { var x = get(k) || {}; return !!(x.h && x.m); }, fid(k));
      var s = function (part, opts, ph) { return '<select id="' + fid(k) + "_" + part + '" data-k="' + esc(k) + "." + part + '"><option value="">' + ph + "</option>" + opts.map(function (x) { return '<option value="' + x.v + '"' + (x.v === v[part] ? " selected" : "") + ">" + x.l + "</option>"; }).join("") + "</select>"; };
      return '<div class="champ" data-champ="' + fid(k) + '" id="' + fid(k) + '"><label>' + o.label + '</label><div class="heure">' + s("h", HH, tt("Heure", "Hora", "Hour")) + s("m", MN, tt("Minutes", "Minutos", "Minutes")) + "</div></div>";
    }
    function info(html, cls) { return MODE === "recap" ? "" : '<div class="info' + (cls ? " " + cls : "") + '">' + html + "</div>"; }
    function note(cle, html, boutons) { return MODE === "recap" ? "" : '<div class="note" data-note="' + esc(cle) + '">' + html + (boutons ? '<div class="actions">' + boutons + "</div>" : "") + "</div>"; }
    function ack(cle, label, sig) { req(label, function () { return S.ack[cle] === sig; }, "n_" + cle); return S.ack[cle] === sig; }
    function lienSite(page, texte) { return MODE === "recap" || !CFG.site ? "" : '<a class="lien lien-site" href="#" data-site="' + esc(page) + '">' + esc(texte) + "</a>"; }

    /* ---------- civilité, indicatifs ---------- */
    function TITRES() { return [{ v: "Docteur", l: tt("Docteur", "Doutor", "Doctor") }, { v: "Maître", l: tt("Maître", "Advogado", "Maître") }, { v: "Son Excellence", l: tt("Son Excellence", "Sua Excelência", "His or Her Excellency") }, { v: "autre", l: tt("Autre", "Outro", "Other") }]; }
    function blocCivilite(b, suf, need) {
      var h = radio(b + ".civ", [{ v: "Madame", l: tt("Madame", "Senhora", "Mrs") }, { v: "Monsieur", l: tt("Monsieur", "Senhor", "Mr") }], { ligne: true, r: tt("Civilité", "Tratamento", "Title") + suf, need: need });
      h += sel(b + ".titre", TITRES(), { label: tt("Un titre à mentionner ?", "Algum título a mencionar?", "A title to mention?"), ph: tt("Aucun", "Nenhum", "None"), r: tt("Titre", "Título", "Title") + suf });
      if (get(b + ".titre") === "autre") h += txt(b + ".titreAutre", { label: tt("Lequel ?", "Qual?", "Which one?"), req: true, need: tt("le titre à mentionner", "o título a mencionar", "the title to mention"), r: tt("Titre précisé", "Título", "Title specified") + suf });
      return h;
    }
    function optionsPays() {
      var prio = (CFG.paysPrio || ["FR"]).slice(); if (prio.indexOf(S.coord.ind) < 0 && S.coord.ind) prio.unshift(S.coord.ind);
      var col = LANG === "pt" ? 3 : LANG === "en" ? 4 : 2;
      var L = PAYS_G.slice().sort(function (a, b) { return a[col].localeCompare(b[col], LANG); });
      var top = prio.map(function (r) { return PAYS_G.filter(function (p) { return p[0] === r; })[0]; }).filter(Boolean);
      return top.concat(L.filter(function (p) { return prio.indexOf(p[0]) < 0; })).map(function (p) { return { v: p[0], l: p[5] + " " + p[col] + " " + p[1], rl: p[1] }; });
    }

    function telGroupe(t, ind) { var d = String(t || "").replace(/\D/g, "").replace(/^0/, ""); if (ind === "FR" || ind === "RE" || ind === "GP" || ind === "MQ" || ind === "GF" || ind === "YT") return d.replace(/^(\d)(\d{2})(\d{2})(\d{2})(\d{2})$/, "$1 $2 $3 $4 $5"); return d.replace(/(\d{3})(?=\d)/g, "$1 "); }
    /* ---------- étapes ---------- */
    var ETAPES = {
      accueil: { t: function () { return tt("Accueil", "Boas-vindas", "Welcome"); }, visible: function () { return true; }, rendu: etAccueil },
      presence: { t: function () { return tt("Votre réponse", "A sua resposta", "Your answer"); }, visible: function () { return true; }, rendu: etPresence },
      coord: { t: function () { return tt("Vos coordonnées", "Os seus contactos", "Your details"); }, visible: function () { return S.presence === "oui"; }, rendu: etCoord },
      accomp: { t: function () { return tt("Ceux qui vous accompagnent", "Quem vem consigo", "Those coming with you"); }, visible: function () { return S.presence === "oui" && (FOY.type !== "unique" || FOY.enfants > 0); }, rendu: etAccomp },
      moments: { t: function () { return tt("La journée", "O dia", "The day"); }, visible: function () { return S.presence === "oui" && MOMENTS.length > 1; }, rendu: etMoments },
      voyage: { t: function () { return tt("Votre venue", "A sua vinda", "Your journey"); }, visible: function () { return S.presence === "oui" && !!CFG.arrivees; }, rendu: etVoyage },
      heberg: { t: function () { return logeOffert ? tt("Votre séjour", "A sua estadia", "Your stay") : tt("Votre hébergement", "O seu alojamento", "Your accommodation"); }, visible: function () { return S.presence === "oui" && (logeOffert || choixLieu || resaPossible()); }, rendu: etHeberg },
      deplac: { t: function () { return tt("Vos déplacements", "As suas deslocações", "Getting around"); }, visible: function () { return S.presence === "oui" && (CFG.trajets || []).length > 0; }, rendu: etDeplac },
      table: { t: function () { return tt("À table", "À mesa", "At the table"); }, visible: function () { return S.presence === "oui" && presents().some(servi); }, rendu: etTable },
      fin1: { t: function () { return tt("Pour conclure", "Para terminar", "To conclude"); }, visible: function () { return S.presence === "oui"; }, rendu: etConclure },
      recap: { t: function () { return tt("Récapitulatif", "Resumo", "Summary"); }, visible: function () { return S.presence === "oui"; }, rendu: etRecap },
      fin: { t: function () { return ""; }, visible: function () { return true; }, rendu: etFin }
    };
    function ordre() { return Object.keys(ETAPES).filter(function (k) { return ETAPES[k].visible(); }); }

    function salut() {
      var d = new Date(), h = d.getHours() + d.getMinutes() / 60, p = esc(FOY.appel || FOY.prenom || "");
      if (LANG === "en") return "Dear " + p + ",";
      if (LANG === "pt") return (h >= 4.5 && h < 12 ? "Bom dia" : h >= 12 && h < 19.5 ? "Boa tarde" : "Boa noite") + ", " + p + ",";
      return (h >= 4.5 && h < 18 ? "Bonjour" : "Bonsoir") + " " + p + ",";
    }
    function phraseInvitation() {
      var M = MARIES(), p = tt(M + " ont le plaisir de vous convier à leur mariage", M + " têm o prazer de lhe endereçar o convite para o seu casamento", M + " are delighted to invite you to their wedding"), na = nomAcc();
      if (FOY.type === "deux") p += na ? tt(", en compagnie de " + na.prenom, ", na companhia de " + na.prenom, ", together with " + na.prenom) : tt(", en compagnie de votre conjoint", ", na companhia do seu cônjuge", ", together with your partner");
      if (FOY.type === "libre") p += tt(", en compagnie de la personne de votre choix", ", na companhia da pessoa da sua escolha", ", together with a guest of your choice");
      if (FOY.type === "plusieurs") p += tt(", en compagnie de " + NBP.fr[FOY.max] + " personnes de votre choix au plus", ", na companhia de até " + NBP.pt[FOY.max] + " pessoas da sua escolha", ", together with up to " + NBP.en[FOY.max] + " guests of your choice");
      if (FOY.enfants) p += FOY.enfants > 1 ? tt(", ainsi que vos enfants", ", bem como dos seus filhos", ", as well as your children") : tt(", ainsi que votre enfant", ", bem como do seu filho ou da sua filha", ", as well as your child");
      return p + ".";
    }
    function etAccueil() {
      var seul = FOY.type === "unique" && !FOY.enfants && CFG.protection;
      return '<div class="carte-accueil"><div class="marque">Yes I Do</div><p class="salut">' + salut() + "</p><h1>" + esc(phraseInvitation()) + "</h1>" +
        (seul ? '<p class="perso">' + tt("Cette invitation vous est personnellement adressée.", "Este convite é-lhe dirigido pessoalmente.", "This invitation is addressed to you personally.") + "</p>" : "") +
        "<p>" + esc(tr(CFG.quand)) + "</p>" +
        '<div class="encadre">' + tt("Nous vous remercions de bien vouloir nous répondre avant le " + tr(CFG.reponseAvant) + ".", "Agradecemos a sua resposta até " + tr(CFG.reponseAvant) + ".", "We would be grateful for your reply by " + tr(CFG.reponseAvant) + ".") + '<br><span class="doux">' + tt("Vos réponses resteront modifiables jusqu'au " + tr(CFG.modifJusqu) + ".", "As suas respostas poderão ser alteradas até " + tr(CFG.modifJusqu) + ".", "Your answers can be changed until " + tr(CFG.modifJusqu) + ".") + "</span></div>" +
        '<button class="btn" data-nav="suivant">' + tt("Confirmer votre présence", "Confirmar a sua presença", "Confirm your attendance") + "</button></div>";
    }
    function etPresence() {
      var h = q("presence", tt("Serez-vous des nôtres pour célébrer " + MARIES() + " ?", "Poderemos contar com a sua presença para celebrar " + MARIES() + "?", "Will you join us to celebrate " + MARIES() + "?"), "",
        radio("presence", [{ v: "oui", l: tt("Oui, avec plaisir", "Sim, com todo o gosto", "Yes, with pleasure") }, { v: "non", l: tt("Non, je ne pourrai malheureusement pas venir", "Infelizmente, não poderei estar presente", "No, I am sorry I will not be able to attend") }, PASENCORE()], { need: tt("votre réponse à l'invitation", "a sua resposta ao convite", "your reply to the invitation"), r: tt("Présence", "Presença", "Attendance") }));
      if (MODE === "form" && S.presence === "non") h += q("motNon", tt("Un mot pour " + MARIES() + " ?", "Uma palavra para " + MARIES() + "?", "A word for " + MARIES() + "?"), tt("Ils seront heureux de vous lire.", "Terão muito gosto em ler a sua mensagem.", "They will be delighted to read it."), txt("motNon", { area: true }), "", true);
      if (MODE === "form" && S.presence === "inconnu") h += info(tt("Nous comprenons tout à fait. Ce même lien reste à votre disposition : vous pourrez nous répondre jusqu'au " + tr(CFG.reponseAvant) + ".", "Compreendemos perfeitamente. Este mesmo link continua à sua disposição: poderá responder-nos até " + tr(CFG.reponseAvant) + ".", "We completely understand. This same link remains at your disposal: you can reply until " + tr(CFG.reponseAvant) + "."));
      return h;
    }
    function etCoord() {
      var h = q("civ", tt("Civilité", "Tratamento", "Title"), "", blocCivilite("coord", "", tt("votre civilité", "o seu tratamento", "your title")));
      h += q("nom", tt("Nom et prénom", "Apelido e nome próprio", "Surname and first name"), "", '<div class="duo">' + txt("coord.nom", { label: tt("Nom", "Apelido", "Surname"), req: true, need: tt("votre nom", "o seu apelido", "your surname"), ac: "family-name" }) + txt("coord.prenom", { label: tt("Prénom", "Nome próprio", "First name"), req: true, need: tt("votre prénom", "o seu nome próprio", "your first name"), live: "inv", ac: "given-name" }) + "</div>");
      var P = PAYS_G.filter(function (p) { return p[0] === S.coord.ind; })[0];
      h += q("tel", tt("Numéro de téléphone", "Número de telefone", "Phone number"), "", MODE === "recap" ? row(tt("Téléphone", "Telefone", "Phone"), (P ? P[1] : "") + " " + telGroupe(S.coord.tel, S.coord.ind)) :
        '<div class="tel">' + sel("coord.ind", optionsPays(), { req: true, need: tt("l'indicatif de votre pays", "o indicativo do seu país", "your country code"), ph: false }) + txt("coord.tel", { req: true, need: tt("votre numéro de téléphone", "o seu número de telefone", "your phone number"), type: "tel", ac: "tel-national" }) + "</div>");
      h += q("email", tt("Adresse email", "Endereço de email", "Email address"), tt("Pour vous tenir au courant de la suite.", "Para lhe darmos notícias dos próximos passos.", "To keep you informed of what comes next."), txt("coord.email", { req: true, type: "email", need: tt("une adresse email valide", "um endereço de email válido", "a valid email address"), r: "Email", ac: "email" }));
      return h;
    }
    function blocPersonne(b, id, qui, plusTard) {
      var f = get(b) || {}, h = "", tard = "";
      if (plusTard) tard = checks(b, [{ v: "plusTard", l: tt("Je vous communiquerai son nom plus tard", "Indicarei o nome mais tarde", "I will send you their name later") }], { sansIndic: true, r: tt("Nom", "Nome", "Name") + " · " + qui });
      if (f.plusTard) return tard + (MODE === "recap" ? row(qui, tt("Nom à communiquer", "Nome a indicar", "Name to follow"), true) : CFG.protection ? '<p class="aide-champ">' + tt("Son nom nous sera nécessaire avant le " + tr(CFG.reponseAvant) + ", pour préparer son invitation.", "Precisaremos do nome antes de " + tr(CFG.reponseAvant) + ", para prepararmos o convite.", "We will need their name by " + tr(CFG.reponseAvant) + ", to prepare their invitation.") + "</p>" : "");
      return h + blocCivilite(b, " · " + qui, tt("la civilité de ", "o tratamento de ", "the title of ") + qui) +
        '<div class="duo">' + txt(b + ".nom", { label: tt("Nom", "Apelido", "Surname"), req: true, need: tt("le nom de ", "o apelido de ", "the surname of ") + qui, r: tt("Nom", "Apelido", "Surname") + " · " + qui }) + txt(b + ".prenom", { label: tt("Prénom", "Nome próprio", "First name"), req: true, need: tt("le prénom de ", "o nome próprio de ", "the first name of ") + qui, live: id, r: tt("Prénom", "Nome próprio", "First name") + " · " + qui }) + "</div>" + tard;
    }
    function etAccomp() {
      var h = "", sans = { v: "seul", l: tt("Non, je viendrai sans accompagnant", "Não, irei sem acompanhante", "No, I will come without a guest") };
      var cadre = tt("Afin de préparer son invitation et sa place à table.", "Para prepararmos o convite e o lugar à mesa.", "So that we can prepare their invitation and their place at the table.");
      var garde = MODE === "form" && S.acc.choix === "inconnu" ? '<p class="aide">' + tt("Nous gardons sa place jusqu'au " + tr(CFG.reponseAvant) + ". Il vous suffira de revenir sur ce même lien.", "Guardaremos o lugar até " + tr(CFG.reponseAvant) + ". Bastará voltar a este mesmo link.", "We will keep their place until " + tr(CFG.reponseAvant) + ". Simply come back to this same link.") + "</p>" : "";
      if (FOY.type === "deux") {
        var na = nomAcc();
        h += q("acc", na ? tt("Viendrez-vous en compagnie de " + esc(na.prenom) + " ?", "Virá na companhia de " + esc(na.prenom) + "?", "Will you be coming with " + esc(na.prenom) + "?") : tt("Viendrez-vous en compagnie de votre conjoint ?", "Virá na companhia do seu cônjuge?", "Will you be coming with your partner?"), cadre,
          radio("acc.choix", [{ v: "oui", l: tt("Oui", "Sim", "Yes") }, { v: "autre", l: CFG.protection ? tt("Je souhaiterais venir avec une autre personne", "Gostaria de vir com outra pessoa", "I would like to come with another person") : tt("Une autre personne m'accompagnera", "Outra pessoa virá comigo", "Another person will accompany me") }, sans, PASENCORE()], { need: tt("votre réponse sur votre accompagnant", "a sua resposta sobre o acompanhante", "your answer about your guest"), r: tt("Accompagnant", "Acompanhante", "Guest"), attente: function (v) { return (v === "autre" && CFG.protection) || v === "inconnu"; } }),
          (S.acc.choix === "autre" && CFG.protection && MODE === "form" ? '<p class="aide">' + tt("Nous soumettons votre demande à " + MARIES() + " et revenons vers vous très rapidement.", "Transmitiremos o seu pedido a " + MARIES() + " e entraremos em contacto consigo muito em breve.", "We will submit your request to " + MARIES() + " and come back to you very shortly.") + "</p>" : "") + garde);
        if (S.acc.choix === "oui") { if (na && MODE === "form" && !S.acc.nom && !S.acc.prenom) { S.acc.prenom = na.prenom; S.acc.nom = na.nom; } h += q("accFiche", na ? esc(na.prenom) : tt("Votre conjoint", "O seu cônjuge", "Your partner"), "", blocPersonne("acc", "acc", na ? na.prenom : tt("votre conjoint", "o seu cônjuge", "your partner"), false)); }
        if (S.acc.choix === "autre") h += q("accFiche", tt("La personne qui vous accompagnera", "A pessoa que virá consigo", "The person accompanying you"), "", blocPersonne("acc", "acc", tt("la personne qui vous accompagne", "a pessoa que vem consigo", "the person accompanying you"), true) + (CFG.protection ? row(tt("Statut", "Estado", "Status"), tt("En attente de l'accord des mariés", "A aguardar a aprovação dos noivos", "Awaiting the couple's approval"), true) : ""));
      }
      if (FOY.type === "libre") {
        h += q("acc", tt("Viendrez-vous avec un accompagnant ?", "Virá com um acompanhante?", "Will you be bringing a guest?"), cadre, radio("acc.choix", [{ v: "oui", l: tt("Oui", "Sim", "Yes") }, sans, PASENCORE()], { need: tt("votre réponse sur l'accompagnant", "a sua resposta sobre o acompanhante", "your answer about your guest"), r: tt("Accompagnant", "Acompanhante", "Guest"), attente: function (v) { return v === "inconnu"; } }), garde);
        if (S.acc.choix === "oui") h += q("accFiche", tt("La personne qui vous accompagnera", "A pessoa que virá consigo", "The person accompanying you"), "", blocPersonne("acc", "acc", tt("la personne qui vous accompagne", "a pessoa que vem consigo", "the person accompanying you"), true));
      }
      if (FOY.type === "plusieurs") {
        var opts = [{ v: "0", l: tt("Aucune, je viendrai sans accompagnant", "Nenhuma, irei sem acompanhante", "None, I will come without a guest") }]; for (var i = 1; i <= FOY.max; i++) opts.push({ v: String(i), l: String(i) }); opts.push(PASENCORE());
        h += q("nbAcc", tt(MARIES() + " ont prévu " + NBP.fr[FOY.max] + " places pour les personnes qui vous accompagneront. Combien seront présentes ?", MARIES() + " reservaram " + NBP.pt[FOY.max] + " lugares para as pessoas que virão consigo. Quantas estarão presentes?", MARIES() + " have set aside " + NBP.en[FOY.max] + " places for those accompanying you. How many will attend?"), cadre,
          radio("nbAcc", opts, { ligne: true, need: tt("le nombre de personnes qui vous accompagneront", "o número de pessoas que virão consigo", "the number of people accompanying you"), r: tt("Accompagnants", "Acompanhantes", "Guests"), attente: function (v) { return v === "inconnu"; } }));
        accIds().forEach(function (id) { var o = ORD[LANG][+id.slice(1) - 1]; h += q("acc_" + id, o, "", blocPersonne("accs." + id, id, o.toLowerCase(), true)); });
      }
      if (FOY.enfants) {
        var n = FOY.enfants, cadreE = tt("Afin de préparer leur place et leur accueil.", "Para prepararmos o lugar e o acolhimento.", "So that we can prepare their place and their welcome.");
        if (n > 1) {
          var oe = [{ v: "0", l: tt("Aucun", "Nenhum", "None") }]; for (var j = 1; j <= n; j++) oe.push({ v: String(j), l: String(j) }); oe.push(PASENCORE());
          h += q("nbEnf", tt(MARIES() + " ont prévu " + NBF.fr[n] + " places pour vos enfants. Combien seront des vôtres ?", MARIES() + " reservaram " + NBP.pt[n] + " lugares para os seus filhos. Quantos virão?", MARIES() + " have set aside " + NBF.en[n] + " places for your children. How many will join you?"), cadreE, radio("nbEnf", oe, { ligne: true, need: tt("le nombre d'enfants qui seront des vôtres", "o número de filhos que virão", "the number of children joining you"), r: tt("Enfants", "Filhos", "Children"), attente: function (v) { return v === "inconnu"; } }));
        } else h += q("nbEnf", tt(MARIES() + " ont prévu une place pour votre enfant. Sera-t-il des vôtres ?", MARIES() + " reservaram um lugar para o seu filho ou a sua filha. Virá também?", MARIES() + " have set aside a place for your child. Will your child be joining you?"), cadreE, radio("nbEnf", [{ v: "1", l: tt("Oui", "Sim", "Yes") }, { v: "0", l: tt("Non", "Não", "No") }, PASENCORE()], { ligne: true, need: tt("votre réponse pour votre enfant", "a sua resposta sobre o seu filho ou a sua filha", "your answer for your child"), r: tt("Enfant", "Filho ou filha", "Child"), attente: function (v) { return v === "inconnu"; } }));
        var AGES = [{ v: "0", l: tt("Nourrisson (moins d'un an)", "Bebé (menos de um ano)", "Infant (under one year)") }]; for (var a = 1; a <= 30; a++) AGES.push({ v: String(a), l: a + " " + tt(a > 1 ? "ans" : "an", a > 1 ? "anos" : "ano", a > 1 ? "years" : "year") }); AGES.push({ v: "31", l: tt("Plus de 30 ans", "Mais de 30 anos", "Over 30 years") });
        enfIds().forEach(function (id, i) {
          if (MODE === "form" && !S.enf[id].nom) S.enf[id].nom = S.coord.nom;
          var corps = '<div class="duo">' + txt("enf." + id + ".prenom", { label: tt("Prénom", "Nome próprio", "First name"), req: true, need: tt("le prénom de l'enfant n°" + (i + 1), "o nome próprio do filho n.º " + (i + 1), "the first name of child no. " + (i + 1)), live: id, r: tt("Enfant", "Filho", "Child") }) + txt("enf." + id + ".nom", { label: tt("Nom", "Apelido", "Surname"), req: true, need: tt("le nom de l'enfant n°" + (i + 1), "o apelido do filho n.º " + (i + 1), "the surname of child no. " + (i + 1)), r: tt("Nom", "Apelido", "Surname") + " · " + prenom(id) }) + "</div>" +
            sel("enf." + id + ".age", AGES, { label: tt("Âge le jour du mariage", "Idade no dia do casamento", "Age on the wedding day"), req: true, need: tt("l'âge de ", "a idade de ", "the age of ") + prenom(id), r: tt("Âge", "Idade", "Age") + " · " + prenom(id) });
          if (ageDe(id) === 0) corps += '<div class="champ"><label>' + tt("Viendrez-vous avec une poussette ou un cosy ?", "Virá com um carrinho ou uma cadeirinha?", "Will you be bringing a pushchair or a car seat?") + "</label></div>" + radio("enf." + id + ".poussette", [{ v: "oui", l: tt("Oui", "Sim", "Yes") }, { v: "non", l: tt("Non", "Não", "No") }], { ligne: true, need: tt("votre réponse sur la poussette", "a sua resposta sobre o carrinho", "your answer about the pushchair"), r: tt("Poussette ou cosy", "Carrinho ou cadeirinha", "Pushchair or car seat") + " · " + prenom(id) });
          h += q("enf_" + id, tt("Enfant", "Filho ou filha", "Child"), "", corps);
        });
      }
      return h;
    }
    function etMoments() {
      var P = base(), corps = "", notes = "";
      if (MODE === "recap" && S.tous === "oui") return row(tt("La journée", "O dia", "The day"), tt("Tous les moments", "Todos os momentos", "Every moment"));
      var titreTous = P.length > 1 ? tt("Toutes les personnes de votre foyer assisteront-elles à chacun des moments ?", "Todas as pessoas do seu agregado estarão presentes em todos os momentos?", "Will everyone in your party attend each moment?") : tt("Assisterez-vous à chacun des moments de la journée ?", "Estará presente em todos os momentos do dia?", "Will you attend each moment of the day?");
      var liste = '<ul class="moments">' + MOMENTS.map(function (m) { return "<li>" + esc(tr(m.l)) + (m.d ? " <span class=\"doux\">· " + esc(tr(m.d)) + "</span>" : "") + "</li>"; }).join("") + "</ul>";
      var h = q("tous", titreTous, (MODE === "form" ? liste : ""), radio("tous", [{ v: "oui", l: P.length > 1 ? tt("Oui, à tous les moments", "Sim, em todos os momentos", "Yes, every moment") : tt("Oui, à tous les moments", "Sim, em todos os momentos", "Yes, every moment") }, { v: "non", l: tt("Non, pas à tous", "Não, nem em todos", "No, not all of them") }], { need: tt("votre réponse sur les moments de la journée", "a sua resposta sobre os momentos do dia", "your answer about the moments of the day"), r: tt("La journée", "O dia", "The day") }));
      if (S.tous !== "non") return h;
      MOMENTS.forEach(function (m) {
        if (MODE === "recap") { var l = P.filter(function (id) { return attend(id, m.id); }).map(prenom); row(tr(m.l), l.length ? listeEt(l) : tt("Personne", "Ninguém", "No one")); return; }
        corps += '<div class="sous"><h4>' + esc(tr(m.l)) + "</h4>" + (m.d ? '<p class="aide">' + esc(tr(m.d)) + "</p>" : "") + (P.length > 1 ? '<div class="indic">' + tt("Plusieurs réponses possibles", "Várias respostas possíveis", "Several answers possible") + "</div>" : "") + '<div class="choix ligne">' +
          P.map(function (id) { var on = momOn(id, m.id); return '<label class="opt case' + (on ? " on" : "") + '"><input type="checkbox" data-mom="' + id + "|" + m.id + '"' + (on ? " checked" : "") + '><span class="marq"></span><span class="lib">' + nm(id) + "</span></label>"; }).join("") + "</div></div>";
      });
      if (MODE === "form") {
        P.forEach(function (id) {
          if (!aucunMoment(id)) return;
          if (id === "inv") { notes += note("inv0", tt("Nous remarquons que vous n'avez retenu aucun moment. Pourriez-vous nous indiquer ceux auxquels vous assisterez ?", "Reparamos que não assinalou nenhum momento. Poderia indicar-nos aqueles em que estará presente?", "We notice that you have not selected any moment. Could you let us know which ones you will attend?")); req(tt("au moins un moment pour vous", "pelo menos um momento para si", "at least one moment for you"), function () { return !aucunMoment("inv"); }, "q_detail"); return; }
          notes += note("abs_" + id, tt("Nous remarquons que " + nm(id) + " ne participera à aucun moment. Faut-il comprendre que " + nm(id) + " ne sera pas des nôtres ?", "Reparamos que " + nm(id) + " não participará em nenhum momento. Devemos entender que " + nm(id) + " não virá?", "We notice that " + nm(id) + " will not attend any moment. Should we understand that " + nm(id) + " will not be joining us?") +
            '<div class="sous-note">' + radio("absent." + id, [{ v: "oui", l: tt("Oui", "Sim", "Yes") }, { v: "non", l: tt("Non, je corrige", "Não, vou corrigir", "No, let me correct this") }], { ligne: true, need: tt("votre réponse pour ", "a sua resposta sobre ", "your answer for ") + prenom(id) }) + "</div>");
          if (S.absent[id] === "non") req(tt("au moins un moment pour ", "pelo menos um momento para ", "at least one moment for ") + prenom(id), function () { return !aucunMoment(id); }, "q_detail");
        });
        MOMENTS.forEach(function (m) { presents().filter(function (id) { return role(id) === "enf" && (ageDe(id) == null || ageDe(id) < 18) && attend(id, m.id); }).forEach(function (e) {
          if (adultes().some(function (a) { return attend(a, m.id); })) return;
          notes += note("seul_" + e + m.id, tt("Nous remarquons qu'aucun adulte de votre foyer n'accompagnerait " + nm(e) + " : " + esc(tr(m.l)).toLowerCase() + ". Pourriez-vous nous préciser qui l'accompagnera ?", "Reparamos que nenhum adulto do seu agregado acompanharia " + nm(e) + ": " + esc(tr(m.l)).toLowerCase() + ". Poderia indicar-nos quem o fará?", "We notice that no adult in your party would be with " + nm(e) + ": " + esc(tr(m.l)).toLowerCase() + ". Could you tell us who will accompany them?") + txt("seulMoment." + e + "_" + m.id, { req: true, need: tt("l'adulte qui accompagnera ", "o adulto que acompanhará ", "the adult who will accompany ") + prenom(e) }));
        }); });
      } else Object.keys(S.seulMoment).forEach(function (k) { var x = k.split("_"); if (attend(x[0], x[1]) && !adultes().some(function (a) { return attend(a, x[1]); })) row(tt("Accompagnement de ", "Acompanhamento de ", "Accompanying ") + prenom(x[0]), S.seulMoment[k]); });
      return h + q("detail", tt("Pourriez-vous nous indiquer les moments auxquels chacun assistera ?", "Poderia indicar-nos os momentos em que cada pessoa estará presente?", "Could you tell us which moments each person will attend?"), "", corps, notes);
    }
    function etVoyage() {
      var modes = [{ v: "avion", l: tt("Avion", "Avião", "Plane") }, { v: "train", l: tt("Train", "Comboio", "Train") }, { v: "voiture", l: tt("Voiture", "Carro", "Car") }, { v: "taxi", l: tt("Taxi ou chauffeur", "Táxi ou motorista", "Taxi or driver") }, PASENCORE()];
      var jours = (CFG.jours || []).map(function (j) { return { v: j.v, l: tr(j.l) }; });
      function bloc(sens) {
        var p = "v." + sens, x = get(p) || {}, arr = sens === "aller", h = "";
        var suf = arr ? tt(" d'arrivée", " de chegada", " (arrival)") : tt(" de départ", " de partida", " (departure)");
        h += radio(p + ".mode", modes, { need: arr ? tt("votre moyen de transport à l'aller", "o seu meio de transporte à ida", "your means of transport on arrival") : tt("votre moyen de transport au retour", "o seu meio de transporte no regresso", "your means of transport on departure"), r: arr ? tt("Arrivée", "Chegada", "Arrival") : tt("Départ", "Partida", "Departure"), attente: function (v) { return v === "inconnu"; } });
        if (x.mode === "avion" || x.mode === "train") {
          h += txt(p + ".lieu", { label: x.mode === "avion" ? (arr ? tt("Dans quel aéroport arriverez-vous ?", "Em que aeroporto chegará?", "Which airport will you arrive at?") : tt("De quel aéroport repartirez-vous ?", "De que aeroporto partirá?", "Which airport will you leave from?")) : (arr ? tt("Dans quelle gare arriverez-vous ?", "Em que estação chegará?", "Which station will you arrive at?") : tt("De quelle gare repartirez-vous ?", "De que estação partirá?", "Which station will you leave from?")), req: true, need: x.mode === "avion" ? tt("l'aéroport", "o aeroporto", "the airport") : tt("la gare", "a estação", "the station"), r: (x.mode === "avion" ? tt("Aéroport", "Aeroporto", "Airport") : tt("Gare", "Estação", "Station")) + suf });
          h += txt(p + ".numero", { label: x.mode === "avion" ? tt("Numéro de vol", "Número do voo", "Flight number") : tt("Numéro du train", "Número do comboio", "Train number"), r: (x.mode === "avion" ? tt("Vol", "Voo", "Flight") : tt("Train", "Comboio", "Train")) + suf });
        }
        if (x.mode && x.mode !== "inconnu") {
          if (jours.length) h += sel(p + ".date", jours, { label: tt("Date", "Data", "Date"), req: true, need: arr ? tt("la date d'arrivée", "a data de chegada", "the arrival date") : tt("la date de départ", "a data de partida", "the departure date"), r: tt("Date", "Data", "Date") + suf });
          if (!x.heureInconnue) h += heure(p + ".heure", { label: arr ? tt("Heure d'arrivée", "Hora de chegada", "Arrival time") : tt("Heure de départ", "Hora de partida", "Departure time"), need: arr ? tt("l'heure d'arrivée", "a hora de chegada", "the arrival time") : tt("l'heure de départ", "a hora de partida", "the departure time"), r: tt("Heure", "Hora", "Time") + suf });
          h += checks(p, [{ v: "heureInconnue", l: tt("Je ne connais pas encore l'horaire", "Ainda não sei o horário", "I don't know the time yet") }], { sansIndic: true, r: tt("Horaire", "Horário", "Time") + suf });
        }
        return h;
      }
      return q("aller", tt("Afin d'organiser au mieux votre arrivée, comment prévoyez-vous de nous rejoindre ?", "Para organizarmos da melhor forma a sua chegada, como prevê vir ter connosco?", "So that we can best arrange your arrival, how do you plan to join us?"), presents().length > 1 ? tt("Pour l'ensemble de votre foyer.", "Para todo o seu agregado.", "For your whole party.") : "", bloc("aller")) +
        q("retour", tt("Et pour votre départ ?", "E para a sua partida?", "And for your departure?"), "", bloc("retour"));
    }
    function etHeberg() {
      var P = presents(), autres = P.filter(function (id) { return id !== "inv"; }), h = "";
      if (choixLieu) {
        var opts = HEB.lieux.map(function (l) { return { v: l, l: l }; }).concat([{ v: "propres", l: tt("Par mes propres moyens", "Pelos meus próprios meios", "By my own means") }, PASENCORE()]);
        return q("lieu", tt("Où séjournerez-vous ?", "Onde ficará alojado?", "Where will you be staying?"), "", radio("heb.lieu", opts, { need: tt("votre lieu de séjour", "o seu alojamento", "your accommodation"), r: tt("Hébergement", "Alojamento", "Accommodation"), attente: function (v) { return v === "inconnu"; } }));
      }
      if (!logeOffert) return blocResa();
      var lieu = FOY.lieu || HEB.lieu || tt("le domaine", "o domaine", "the estate");
      var texte = tt(MARIES() + " ont le plaisir de vous recevoir " + aLieu(lieu) + " pour " + tr(HEB.nuits) + ".", MARIES() + " têm o prazer de lhe oferecer a estadia em " + lieu + " na " + tr(HEB.nuits) + ".", MARIES() + " are delighted to host you at " + lieu + " for " + tr(HEB.nuits) + ".");
      if (autres.length) texte += " " + tt("Cette attention s'étend à " + listeEt(autres.map(nm)) + ".", "Esta atenção estende-se a " + listeEt(autres.map(nm)) + ".", "This kind attention extends to " + listeEt(autres.map(nm)) + ".");
      h += info(texte);
      var opts2 = [{ v: "oui", l: tt("Oui, avec plaisir", "Sim, com todo o gosto", "Yes, with pleasure") }];
      if (autres.length) opts2.push({ v: "partiel", l: tt("Oui, mais pas toutes les personnes de mon foyer", "Sim, mas não todas as pessoas do meu agregado", "Yes, but not everyone in my party") });
      opts2.push({ v: "non", l: tt("Je vous remercie, mais je ne séjournerai pas sur place", "Agradeço, mas não pernoitarei no local", "Thank you, but I will not be staying on site"), rl: tt("Ne séjournera pas sur place", "Não pernoitará no local", "Will not stay on site") }, PASENCORE());
      if (S.heb.sejour === "partiel" && !autres.length) S.heb.sejour = undefined;
      var corps = radio("heb.sejour", opts2, { need: tt("votre réponse sur votre séjour", "a sua resposta sobre a estadia", "your answer about your stay"), r: tt("Séjour sur place", "Estadia no local", "Staying on site"), attente: function (v) { return v === "inconnu"; } });
      if (S.heb.sejour === "partiel") corps += '<div class="champ"><label>' + tt("Qui séjournera sur place ?", "Quem pernoitará no local?", "Who will be staying on site?") + "</label></div>" + checks("heb.qui", P.map(function (id) { return { v: id, l: prenom(id), html: nm(id) }; }), { ligne: true, min1: true, need: tt("les personnes qui séjourneront sur place", "as pessoas que pernoitarão no local", "the people staying on site"), r: tt("Séjourneront sur place", "Pernoitarão no local", "Staying on site") });
      if (MODE === "form" && S.heb.sejour === "inconnu") corps += '<p class="aide">' + tt("Nous gardons votre chambre jusqu'au " + tr(CFG.reponseAvant) + ".", "Guardaremos o seu quarto até " + tr(CFG.reponseAvant) + ".", "We will keep your room until " + tr(CFG.reponseAvant) + ".") + "</p>";
      h += q("sejour", tt("Séjournerez-vous sur place ?", "Pernoitará no local?", "Will you be staying on site?"), "", corps);
      var dorment = dormeurs();
      if (MODE === "form") dorment.forEach(function (id) {
        if (!REPAS || dine(id)) return;
        var cle = "dort_" + id;
        if (!ack(cle, tt("la confirmation du séjour de ", "a confirmação da estadia de ", "confirmation of the stay of ") + prenom(id), "1"))
          h += note(cle, id === "inv" ? tt("Nous remarquons que vous séjournerez sur place sans assister au " + repasNom() + ". Pourriez-vous nous le confirmer ?", "Reparamos que pernoitará no local sem estar presente no jantar. Poderia confirmar-nos?", "We notice that you will stay on site without attending the dinner. Could you confirm this?") : tt("Nous remarquons que " + nm(id) + " séjournera sur place sans assister au " + repasNom() + ". Pourriez-vous nous le confirmer ?", "Reparamos que " + nm(id) + " pernoitará no local sem estar presente no jantar. Poderia confirmar-nos?", "We notice that " + nm(id) + " will stay on site without attending the dinner. Could you confirm this?"),
            '<button class="btn petit clair" data-ack="' + cle + '" data-sig="1">' + tt("Je le confirme", "Confirmo", "I confirm") + '</button><button class="btn petit clair" data-aller="q_sejour">' + tt("Je corrige", "Vou corrigir", "Let me correct this") + "</button>");
      });
      if (dorment.length && HEB.acces) h += q("arrivee", tt("À quelle heure pensez-vous arriver sur place ?", "A que horas prevê chegar ao local?", "At what time do you expect to arrive on site?"), tt("Afin que l'on vous y accueille.", "Para que o possamos receber.", "So that we can welcome you."), (S.heb.heureInconnue ? "" : heure("heb.heure", { label: tt("Heure d'arrivée", "Hora de chegada", "Arrival time"), need: tt("votre heure d'arrivée", "a sua hora de chegada", "your arrival time"), r: tt("Arrivée sur place", "Chegada ao local", "Arrival on site") })) + checks("heb", [{ v: "heureInconnue", l: tt("Je ne connais pas encore l'horaire", "Ainda não sei o horário", "I don't know the time yet") }], { sansIndic: true, r: tt("Horaire", "Horário", "Time") }));
      if (dorment.length) h += q("hebPrecision", tt("Un détail à nous signaler pour votre séjour ?", "Algum pormenor a assinalar para a sua estadia?", "Anything we should know about your stay?"), "", txt("heb.precision", { area: true, ph: tt("Un accès sans marches, des lits séparés…", "Um acesso sem degraus, camas separadas…", "Step free access, separate beds…"), r: tt("Précision pour le séjour", "Pormenor para a estadia", "Note for the stay") }), "", true);
      if (S.heb.sejour === "non") h += blocResa(); else if (MODE === "form") S.resa = {};
      return h + lienSite("hebergement", tt("Le lieu et ses alentours", "O local e arredores", "The venue and its surroundings"));
    }
    /* « au Domaine de Maffliers », « à l'Auberge du Jeu de Paume », « à la Villa… », « à l'InterContinental… » */
    function aLieu(l) {
      l = String(l || "");
      if (/^le\s/i.test(l)) return "au " + l.slice(3); if (/^les\s/i.test(l)) return "aux " + l.slice(4); if (/^la\s/i.test(l)) return "à la " + l.slice(3); if (/^l'/i.test(l)) return "à l'" + l.slice(2);
      if (/^(domaine|château|chateau|manoir|moulin|clos|mas|prieuré|palais|pavillon|relais|logis|grand hôtel|hôtel|hotel)\b/i.test(l)) return "au " + l;
      if (/^(villa|maison|bastide|ferme|grange|bergerie|chartreuse|commanderie|résidence)\b/i.test(l)) return "à la " + l;
      if (/^[aeiouyéèêâîôh]/i.test(l)) return "à l'" + l;
      return "à " + l;
    }
    /* Phase 5 : réserver une chambre dans une maison partenaire, pour un foyer qui n'est pas reçu par les mariés.
       La réservation est faite au nom de l'invité ; il règle directement l'établissement (YID ne manie jamais l'argent des invités). */
    function resaPossible() { return MAISONS.length > 0 && !!CFG.conciergerie && !choixLieu && (!logeOffert || S.heb.sejour === "non"); }
    function blocResa() {
      if (!resaPossible()) { S.resa = {}; return ""; }
      var opts = MAISONS.map(function (x) { return { v: x.nom, l: x.nom, d: [x.ville, x.tarif].filter(Boolean).join(" · ") }; }).concat([{ v: "non", l: tt("Non merci, je m'en occupe", "Não, obrigado, eu trato disso", "No thank you, I will arrange it myself") }, PASENCORE()]);
      var corps = radio("resa.maison", opts, { need: tt("votre réponse sur la réservation d'une chambre", "a sua resposta sobre a reserva de um quarto", "your answer about booking a room"), r: tt("Réservation d'une chambre", "Reserva de um quarto", "Room booking"), attente: function (v) { return v === "inconnu"; } });
      if (S.resa.maison && S.resa.maison !== "non" && S.resa.maison !== "inconnu") {
        corps += sel("resa.chambres", [1, 2, 3, 4].map(function (n) { return { v: String(n), l: String(n) }; }), { label: tt("Combien de chambres ?", "Quantos quartos?", "How many rooms?"), req: true, need: tt("le nombre de chambres", "o número de quartos", "the number of rooms"), r: tt("Chambres", "Quartos", "Rooms") });
        if (MODE === "form") corps += '<p class="aide-champ">' + tt("Nous réservons en votre nom et revenons vers vous avec la confirmation. Le règlement se fait directement auprès de l'établissement.", "Reservamos em seu nome e voltamos a contactá-lo com a confirmação. O pagamento é feito diretamente ao estabelecimento.", "We will book in your name and come back to you with the confirmation. Payment is made directly to the hotel.") + "</p>";
      }
      return q("resa", tt("Souhaitez-vous que nous vous réservions une chambre à proximité ?", "Deseja que lhe reservemos um quarto nas proximidades?", "Would you like us to book you a room nearby?"), tt(MARIES() + " ont retenu ces maisons pour leurs invités.", MARIES() + " escolheram estes alojamentos para os seus convidados.", MARIES() + " have selected these hotels for their guests."), corps);
    }
    function dormeurs() { var P = presents(); return S.heb.sejour === "oui" ? P : S.heb.sejour === "partiel" ? P.filter(function (id) { return (S.heb.qui || {})[id]; }) : []; }
    function etDeplac() {
      var T = CFG.trajets || [], n = presents().length;
      var opts = T.map(function (t) { return { v: t.id, l: tr(t.l) }; }).concat([{ v: "aucun", l: tt("Aucun, je me déplacerai par mes propres moyens", "Nenhum, deslocar-me-ei pelos meus próprios meios", "None, I will make my own way"), solo: true }]);
      var corps = checks("dep.trajets", opts, { min1: true, need: tt("votre choix de trajets", "a sua escolha de trajetos", "your choice of journeys"), r: tt("Trajets", "Trajetos", "Journeys") });
      T.forEach(function (t) { if (!(S.dep.trajets || {})[t.id]) return; var pl = []; for (var i = 1; i <= Math.max(1, n); i++) pl.push({ v: String(i), l: String(i) }); corps += sel("dep.places." + t.id, pl, { label: tt("Combien de places pour : ", "Quantos lugares para: ", "How many seats for: ") + esc(tr(t.l)) + " ?", req: true, need: tt("le nombre de places", "o número de lugares", "the number of seats"), r: T.length > 1 ? tt("Places", "Lugares", "Seats") + " · " + tr(t.l) : tt("Places", "Lugares", "Seats") });
        if ((t.retours || []).length) corps += sel("dep.retour." + t.id, t.retours.map(function (h) { return { v: h, l: h }; }).concat([{ v: "sans", l: tt("Je ne prendrai pas le retour", "Não utilizarei o regresso", "I will not take the return") }]), { label: tt("Retour vers ", "Regresso para ", "Return to ") + esc(t.de || "") + tt(" : à quelle heure ?", ": a que horas?", ": at what time?"), req: true, need: tt("l'heure de votre retour", "a hora do seu regresso", "the time of your return"), r: T.length > 1 ? tt("Retour", "Regresso", "Return") + " · " + tr(t.l) : tt("Heure du retour", "Hora do regresso", "Return time") }); });
      return q("trajets", tt("Afin de faciliter vos déplacements, " + MARIES() + " ont prévu plusieurs trajets. Lesquels souhaiteriez-vous emprunter ?", "Para facilitar as suas deslocações, " + MARIES() + " previram vários trajetos. Quais deseja utilizar?", "To make getting around easier, " + MARIES() + " have arranged several journeys. Which would you like to take?"), "", corps);
    }
    var REGIMES = [{ v: "veg", fr: "Végétarien", pt: "Vegetariano", en: "Vegetarian", veg: true }, { v: "vegan", fr: "Végétalien", pt: "Vegano", en: "Vegan", veg: true }, { v: "porc", fr: "Sans porc", pt: "Sem carne de porco", en: "No pork" }, { v: "alcool", fr: "Sans alcool", pt: "Sem álcool", en: "No alcohol" }, { v: "halal", fr: "Halal", pt: "Halal", en: "Halal" }, { v: "casher", fr: "Casher", pt: "Kosher", en: "Kosher" }, { v: "gluten", fr: "Sans gluten", pt: "Sem glúten", en: "Gluten free" }, { v: "lactose", fr: "Sans lactose", pt: "Sem lactose", en: "Lactose free" }, { v: "coque", fr: "Allergie aux fruits à coque", pt: "Alergia a frutos de casca rija", en: "Tree nut allergy", allergie: true }, { v: "arachide", fr: "Allergie aux arachides", pt: "Alergia ao amendoim", en: "Peanut allergy", allergie: true }, { v: "mer", fr: "Allergie aux poissons et fruits de mer", pt: "Alergia a peixe e marisco", en: "Fish and seafood allergy", allergie: true, bad: /poisson|peixe|fish/i }, { v: "autre", fr: "Autre", pt: "Outro", en: "Other" }];
    function etTable() {
      var P = presents(), auDiner = (CFG.plats || []).length ? P.filter(dine) : [], servis = P.filter(function (id) { return servi(id) && !(role(id) === "enf" && ageDe(id) === 0); }), h = "";
      var concerne = function (id) { return S.table.regime === "oui" && (servis.length === 1 || (S.table.qui || {})[id]); };
      var menuEnfant = function (id) { return role(id) === "enf" && CFG.ageMenu && ageDe(id) != null && ageDe(id) < CFG.ageMenu; };
      if (auDiner.length) {
        var corps = "", avecChoix = auDiner.filter(function (id) { return !menuEnfant(id); });
        auDiner.forEach(function (id) {
          if (role(id) === "enf" && ageDe(id) === 0) { row(tt("Plat", "Prato", "Dish") + " · " + prenom(id), tt("Nourrisson", "Bebé", "Infant")); return; }
          if (menuEnfant(id)) { if (MODE === "form") corps += '<div class="sous"><p>' + tt("Un menu enfant sera servi à " + nm(id) + ".", "Será servido um menu infantil a " + nm(id) + ".", "A children's menu will be served to " + nm(id) + ".") + "</p></div>"; else row(tt("Plat", "Prato", "Dish") + " · " + prenom(id), tt("Menu enfant", "Menu infantil", "Children's menu")); return; }
          var ent = avecChoix.length > 1 ? (id === "inv" ? tt("Pour vous", "Para si", "For you") : tt("Et pour ", "E para ", "And for ") + nm(id) + " ?") : "";
          var R = (S.table.reg || {})[id] || {}, veg = concerne(id) && REGIMES.some(function (r) { return r.veg && R[r.v]; });
          var x = (MODE === "form" && ent ? "<h4>" + ent + "</h4>" : "") + radio("table.plat." + id, CFG.plats.map(function (p) { return { v: p.v, l: tr(p.l) }; }), { ligne: true, need: tt("le plat de ", "o prato de ", "the dish for ") + (id === "inv" ? tt("votre choix", "sua escolha", "your choice") : prenom(id)), r: tt("Plat", "Prato", "Dish") + " · " + prenom(id) });
          if (CFG.cuisson && /viande|carne|boeuf|bœuf|agneau|veau/i.test(String(((S.table.plat || {})[id]) || "") + " " + (CFG.plats.filter(function (p) { return p.v === (S.table.plat || {})[id]; })[0] || { l: "" }).l.fr)) x += '<div class="champ"><label>' + tt("Quelle cuisson préférez-vous ?", "Que ponto de cozedura prefere?", "How would you like it cooked?") + "</label></div>" + radio("table.cuisson." + id, [{ v: "Bleue", l: tt("Bleue", "Muito mal passada", "Blue") }, { v: "Saignante", l: tt("Saignante", "Mal passada", "Rare") }, { v: "À point", l: tt("À point", "Média", "Medium") }, { v: "Bien cuite", l: tt("Bien cuite", "Bem passada", "Well done") }], { ligne: true, need: tt("la cuisson de ", "o ponto de ", "the cooking for ") + prenom(id), r: tt("Cuisson", "Cozedura", "Cooking") + " · " + prenom(id) });
          if (veg && MODE === "form") x += '<p class="aide-champ">' + tt("Un plat végétarien sera préparé pour " + nm(id) + ".", "Será preparado um prato vegetariano para " + nm(id) + ".", "A vegetarian dish will be prepared for " + nm(id) + ".") + "</p>";
          corps += '<div class="sous" id="plat_' + id + '">' + x + "</div>";
        });
        h += q("plats", (REPAS ? tt(tr(REPAS.l) + " : le chef propose ", tr(REPAS.l) + ": o chef propõe ", tr(REPAS.l) + ": the chef suggests ") : tt("Le chef propose ", "O chef propõe ", "The chef suggests ")) + esc(listeEt(CFG.plats.map(function (p) { return tr(p.l).toLowerCase(); }))) + tt(". Lequel aurait votre préférence ?", ". Qual prefere?", ". Which would you prefer?"), "", corps);
      }
      var c2 = radio("table.regime", [{ v: "non", l: tt("Non", "Não", "No") }, { v: "oui", l: tt("Oui", "Sim", "Yes") }], { ligne: true, need: tt("votre réponse sur les régimes et allergies", "a sua resposta sobre regimes e alergias", "your answer about diets and allergies"), r: tt("Régime ou allergie", "Regime ou alergia", "Diet or allergy") });
      if (S.table.regime === "oui") {
        var liste = servis;
        if (servis.length > 1) { c2 += '<div class="champ"><label>' + tt("Qui est concerné ?", "Quem está abrangido?", "Who is concerned?") + "</label></div>" + checks("table.qui", servis.map(function (id) { return { v: id, l: prenom(id), html: nm(id) }; }), { ligne: true, min1: true, need: tt("les personnes concernées", "as pessoas abrangidas", "the people concerned"), r: tt("Personnes concernées", "Pessoas abrangidas", "People concerned") }); liste = servis.filter(function (id) { return (S.table.qui || {})[id]; }); }
        liste.forEach(function (id) {
          c2 += '<div class="sous">' + (MODE === "form" && servis.length > 1 ? "<h4>" + nm(id) + "</h4>" : "") + checks("table.reg." + id, REGIMES.map(function (r) { return { v: r.v, l: r[LANG] }; }), { ligne: true, min1: true, need: tt("le régime ou l'allergie de ", "o regime ou a alergia de ", "the diet or allergy of ") + prenom(id), r: tt("Régime", "Regime", "Diet") + " · " + prenom(id) });
          var R = (S.table.reg || {})[id] || {};
          if (R.autre) c2 += txt("table.regAutre." + id, { label: tt("Pourriez-vous préciser ?", "Poderia especificar?", "Could you specify?"), req: true, need: tt("la précision du régime de ", "o pormenor do regime de ", "the details of the diet of ") + prenom(id), r: tt("Précision", "Pormenor", "Details") + " · " + prenom(id) });
          if (REGIMES.some(function (r) { return r.allergie && R[r.v]; })) c2 += '<div class="champ"><label>' + tt("S'agit-il d'une allergie sévère ?", "Trata-se de uma alergia grave?", "Is it a severe allergy?") + "</label></div>" + radio("table.severe." + id, [{ v: "oui", l: tt("Oui", "Sim", "Yes") }, { v: "non", l: tt("Non", "Não", "No") }], { ligne: true, need: tt("la sévérité de l'allergie de ", "a gravidade da alergia de ", "the severity of the allergy of ") + prenom(id), r: tt("Allergie sévère", "Alergia grave", "Severe allergy") + " · " + prenom(id) });
          c2 += "</div>";
        });
      }
      h += q("regime", servis.length > 1 ? tt("Afin que chacun soit servi en toute sérénité, l'une des personnes de votre foyer suit-elle un régime particulier ou présente-t-elle une allergie ?", "Para que todos sejam servidos com toda a tranquilidade, alguma pessoa do seu agregado segue um regime alimentar especial ou tem alguma alergia?", "So that everyone is served with complete peace of mind, does anyone in your party follow a particular diet or have an allergy?") : tt("Afin de vous servir en toute sérénité, suivez-vous un régime particulier ou présentez-vous une allergie ?", "Para que tudo lhe seja servido com toda a tranquilidade, segue algum regime alimentar especial ou tem alguma alergia?", "So that we can serve you with complete peace of mind, do you follow a particular diet or have an allergy?"), "", c2);
      if (MODE === "form") auDiner.forEach(function (id) {
        var R = (S.table.reg || {})[id] || {}, pl = CFG.plats.filter(function (p) { return p.v === (S.table.plat || {})[id]; })[0];
        if (!(concerne(id) && R.mer && pl && /poisson|peixe|fish/i.test(pl.l.fr || pl.l))) return;
        var cle = "conf_" + id;
        if (!ack(cle, tt("votre réponse sur le plat de ", "a sua resposta sobre o prato de ", "your answer about the dish of ") + prenom(id), "mer"))
          h += note(cle, id === "inv" ? tt("Nous remarquons que vous avez choisi le poisson, alors que vous nous indiquez une allergie aux poissons et fruits de mer. Souhaitez-vous modifier votre choix ?", "Reparamos que escolheu peixe, embora nos indique uma alergia a peixe e marisco. Deseja alterar a sua escolha?", "We notice that you have chosen fish, although you mention an allergy to fish and seafood. Would you like to change your choice?") : tt("Nous remarquons que " + nm(id) + " a choisi le poisson, alors que vous nous indiquez une allergie aux poissons et fruits de mer. Souhaitez-vous modifier ce choix ?", "Reparamos que " + nm(id) + " escolheu peixe, embora nos indique uma alergia a peixe e marisco. Deseja alterar essa escolha?", "We notice that " + nm(id) + " has chosen fish, although you mention an allergy to fish and seafood. Would you like to change this choice?"),
            '<button class="btn petit clair" data-aller="plat_' + id + '">' + tt("Modifier le choix", "Alterar a escolha", "Change the choice") + '</button><button class="btn petit clair" data-ack="' + cle + '" data-sig="mer">' + tt("Conserver ce choix", "Manter a escolha", "Keep this choice") + "</button>");
      });
      return h + q("chef", tt("Une précision pour le chef ?", "Algum pormenor para o chef?", "A note for the chef?"), "", txt("table.precision", { area: true, r: tt("Précision pour le chef", "Pormenor para o chef", "Note for the chef") }), "", true);
    }
    function etConclure() {
      var h = "";
      if (CFG.conciergerie) {
        var corps = radio("fin.concierge", [{ v: "tout", l: tt("Oui, pour l'ensemble de ma venue", "Sim, para toda a minha vinda", "Yes, for my entire journey") }, { v: "partie", l: tt("Oui, pour une partie", "Sim, para uma parte", "Yes, for part of it") }, { v: "non", l: tt("Non, merci", "Não, agradeço", "No, thank you") }], { need: tt("votre réponse sur l'organisation de votre venue", "a sua resposta sobre a organização da sua vinda", "your answer about organising your journey"), r: tt("Aide pour venir", "Ajuda para vir", "Help with travel") });
        if (S.fin.concierge === "partie") {
          var opts = [{ v: "aller", l: tt("Le trajet jusqu'au mariage", "A viagem até ao casamento", "Getting to the wedding") }];
          if (MOMENTS.length > 1) opts.push({ v: "entre", l: tt("Les trajets entre les lieux", "As deslocações entre os locais", "Getting between venues") });
          opts.push({ v: "retour", l: tt("Le retour après la soirée", "O regresso depois da festa", "Getting back after the evening") });
          if ((!logeOffert || S.heb.sejour === "non") && !resaPossible()) opts.push({ v: "hotel", l: tt("Un hébergement à proximité", "Um alojamento nas proximidades", "Accommodation nearby") });
          opts.push({ v: "autre", l: tt("Autre chose", "Outra coisa", "Something else") });
          Object.keys(S.fin.pour || {}).forEach(function (k) { if (!opts.some(function (o) { return o.v === k; })) delete S.fin.pour[k]; });
          corps += '<div class="champ"><label>' + tt("Pour quoi pouvons-nous vous aider ?", "Em que podemos ajudar?", "How can we help?") + "</label></div>" + checks("fin.pour", opts, { min1: true, need: tt("ce pour quoi nous pouvons vous aider", "aquilo em que podemos ajudar", "what we can help you with"), r: tt("Aide demandée", "Ajuda pedida", "Help requested") });
          if ((S.fin.pour || {}).autre) corps += txt("fin.pourAutre", { label: tt("Pourriez-vous préciser ?", "Poderia especificar?", "Could you specify?"), req: true, need: tt("la précision de votre demande", "o pormenor do seu pedido", "the details of your request"), r: tt("Précision", "Pormenor", "Details") });
        }
        if (MODE === "form" && (S.fin.concierge === "tout" || S.fin.concierge === "partie")) corps += '<p class="aide">' + tt("Nous revenons vers vous très rapidement.", "Entraremos em contacto consigo muito em breve.", "We will come back to you very shortly.") + "</p>";
        h += q("concierge", tt("Souhaitez-vous que nous vous aidions à organiser votre venue ?", "Deseja ajuda para organizar a sua vinda?", "Would you like us to help organise your journey?"), tt("Notre conciergerie s'en charge avec plaisir.", "O nosso serviço de concierge trata de tudo com todo o gosto.", "Our concierge service will gladly take care of it."), corps);
      }
      h += q("attention", tt("Une attention particulière à nous signaler ?", "Alguma atenção especial a assinalar?", "Anything in particular we should know?"), "", txt("fin.attention", { area: true, ph: tt("Une mobilité réduite, un fauteuil à prévoir…", "Mobilidade reduzida, uma cadeira de rodas…", "Reduced mobility, a wheelchair to plan for…"), r: tt("Attention particulière", "Atenção especial", "Particular attention") }), "", true);
      h += q("mot", tt("Un mot pour " + MARIES() + " ?", "Uma palavra para " + MARIES() + "?", "A word for " + MARIES() + "?"), tt("Ils seront heureux de vous lire.", "Terão muito gosto em ler a sua mensagem.", "They will be delighted to read it."), txt("fin.mot", { area: true, r: tt("Votre mot", "A sua mensagem", "Your message") }), "", true);
      if (CFG.engagement) h += q("engagement", tt("Afin que chacun profite pleinement de chaque moment, nous vous remercions de bien vouloir respecter les horaires du programme.", "Para que todos aproveitem plenamente cada momento, agradecemos que respeite os horários do programa.", "So that everyone can fully enjoy each moment, we kindly ask you to respect the timings of the programme."), "", checks("fin", [{ v: "engagement", l: tt("Je m'engage à respecter les horaires", "Comprometo-me a respeitar os horários", "I undertake to respect the timings") }], { sansIndic: true, min1: true, need: tt("votre engagement sur les horaires", "o seu compromisso com os horários", "your commitment to the timings"), r: tt("Horaires", "Horários", "Timings") }));
      return h + lienSite("programme", tt("Le programme de la journée", "O programa do dia", "The programme of the day"));
    }
    function collecte() {
      var sM = MODE, sR = REQ; MODE = "recap"; ROWS = [];
      var secs = ordre().filter(function (k) { return ["accueil", "recap", "fin"].indexOf(k) < 0; });
      secs.forEach(function (k) { SECTION = k; ETAPES[k].rendu(); blocExtra(k); });
      MODE = sM; REQ = sR;
      return { secs: secs.map(function (k) { return { k: k, t: ETAPES[k].t() }; }), rows: ROWS.filter(function (r) { return r.val !== "" && r.label !== ""; }) };
    }
    function aConfirmer() {
      var L = [];
      if (S.acc.choix === "autre" && CFG.protection) L.push(tt("la personne qui vous accompagnera, soumise à l'accord des mariés", "a pessoa que virá consigo, sujeita à aprovação dos noivos", "the person accompanying you, subject to the couple's approval"));
      if (S.acc.choix === "inconnu" || S.nbAcc === "inconnu") L.push(tt("la venue de votre accompagnant", "a vinda do seu acompanhante", "whether your guest will attend"));
      if (accIds().some(function (id) { return (fiche(id) || {}).plusTard; })) L.push(tt("un nom à nous communiquer", "um nome a indicar-nos", "a name to send us"));
      if (S.nbEnf === "inconnu") L.push(tt("la venue de vos enfants", "a vinda dos seus filhos", "whether your children will attend"));
      if (logeOffert && S.heb.sejour === "inconnu") L.push(tt("votre séjour sur place", "a sua estadia no local", "your stay on site"));
      if (resaPossible() && S.resa.maison === "inconnu") L.push(tt("la réservation de votre chambre", "a reserva do seu quarto", "your room booking"));
      if (choixLieu && S.heb.lieu === "inconnu") L.push(tt("votre hébergement", "o seu alojamento", "your accommodation"));
      if (CFG.arrivees && ((S.v.aller || {}).mode === "inconnu" || (S.v.retour || {}).mode === "inconnu" || (S.v.aller || {}).heureInconnue || (S.v.retour || {}).heureInconnue)) L.push(tt("les horaires de votre venue", "os horários da sua vinda", "the timings of your journey"));
      return L;
    }
    function etRecap() {
      var c = collecte(), h = "<h2>" + tt("Le récapitulatif", "O resumo", "The summary") + '</h2><p class="chapeau">' + tt("Voici le récapitulatif de vos réponses. Nous vous remercions de bien vouloir le relire avant de nous le transmettre.", "Eis o resumo das suas respostas. Agradecemos que o releia antes de no-lo enviar.", "Here is the summary of your answers. Please take a moment to read it before sending it to us.") + "</p>";
      var L = aConfirmer(); if (L.length) h += '<div class="info">' + tt("Reste à confirmer : ", "Falta confirmar: ", "Still to confirm: ") + esc(listeEt(L)) + ".</div>";
      c.secs.forEach(function (s) {
        var rs = c.rows.filter(function (r) { return r.section === s.k; });
        h += '<div class="recap-sec"><header><b>' + esc(s.t) + '</b><button class="lien" data-modifier="' + s.k + '">' + tt("Modifier", "Alterar", "Change") + "</button></header>" + (rs.length ? rs.map(function (r) { return '<div class="rr"><span>' + esc(r.label) + "</span><b>" + esc(r.val) + (r.attente ? '<span class="attente">' + tt("à confirmer", "a confirmar", "to confirm") + "</span>" : "") + "</b></div>"; }).join("") : '<div class="rr"><span>' + tt("Aucune précision", "Sem pormenores", "No details") + "</span><b></b></div>") + "</div>";
      });
      return h + '<p class="fin-recap">' + tt("Merci d'avoir pris le temps de nous répondre. Le site de votre mariage reste à votre disposition, et nous reviendrons vers vous si besoin.", "Agradecemos o tempo que dedicou a responder-nos. O site do casamento continua à sua disposição, e entraremos em contacto consigo se for necessário.", "Thank you for taking the time to reply. Your wedding website remains at your disposal, and we will come back to you if needed.") + "</p>";
    }
    function etFin() {
      var p = esc(S.coord.prenom);
      if (S.presence === "non") return '<div class="carte-accueil"><div class="marque">Yes I Do</div><h1>' + tt("Merci " + p + " de nous avoir répondu.", p + ", agradecemos a sua resposta.", "Thank you " + p + " for your reply.") + "</h1><p>" + tt(MARIES() + " seront désolés de ne pas vous compter parmi eux" + (String(S.motNon || "").trim() ? ", et votre mot leur sera transmis" : "") + ".", MARIES() + " lamentarão não contar com a sua presença" + (String(S.motNon || "").trim() ? ", e a sua mensagem ser-lhes-á transmitida" : "") + ".", MARIES() + " will be sorry not to have you with them" + (String(S.motNon || "").trim() ? ", and your message will be passed on to them" : "") + ".") + '</p><p class="doux">' + tt("Si vos projets venaient à changer d'ici le " + tr(CFG.modifJusqu) + ", ce même lien vous permettra de nous le faire savoir.", "Se os seus planos mudarem até " + tr(CFG.modifJusqu) + ", este mesmo link permitir-lhe-á informar-nos.", "Should your plans change before " + tr(CFG.modifJusqu) + ", this same link will let you tell us.") + "</p></div>";
      if (S.presence === "inconnu") return '<div class="carte-accueil"><div class="marque">Yes I Do</div><h1>' + tt("Merci " + p + ".", p + ", agradecemos a sua resposta.", "Thank you " + p + ".") + "</h1><p>" + tt("Nous attendons votre réponse avant le " + tr(CFG.reponseAvant) + ". Ce même lien reste à votre disposition.", "Aguardamos a sua resposta até " + tr(CFG.reponseAvant) + ". Este mesmo link continua à sua disposição.", "We look forward to your reply by " + tr(CFG.reponseAvant) + ". This same link remains at your disposal.") + "</p></div>";
      return '<div class="carte-accueil"><div class="marque">Yes I Do</div><h1>' + tt("Merci " + p + ".", p + ", agradecemos a sua resposta.", "Thank you " + p + ".") + "</h1><p>" + tt(MARIES() + " seront ravis de vous compter parmi eux.", MARIES() + " ficarão muito felizes por contar com a sua presença.", MARIES() + " will be delighted to have you with them.") + "</p><p>" + tt("Vous allez recevoir le récapitulatif de vos réponses dans quelques instants. Nous serons heureux de répondre à toutes vos questions, et reviendrons vers vous si besoin.", "Dentro de instantes receberá o resumo das suas respostas. Teremos todo o gosto em responder às suas perguntas, e entraremos em contacto consigo se for necessário.", "You will receive the summary of your answers in a few moments. We will be happy to answer any questions, and will come back to you if needed.") + '</p><p class="doux">' + tt("Vos réponses restent modifiables jusqu'au " + tr(CFG.modifJusqu) + ", depuis ce même lien.", "As suas respostas podem ser alteradas até " + tr(CFG.modifJusqu) + ", através deste mesmo link.", "Your answers can be changed until " + tr(CFG.modifJusqu) + ", from this same link.") + "</p></div>";
    }

    /* ---------- lecture pour le serveur et l'équipe ---------- */
    /* Les questions nées des colonnes du mariage (méthode YID), rangées à leur étape ; à « Pour conclure » si leur étape n'est pas affichée. */
    function extraPour(c) {
      var p = c.pour || "tous";
      if (p === "loges") return FOY.loge && (!logeOffert || dormeurs().length > 0);
      if (p === "non_loges") return !FOY.loge || S.heb.sejour === "non";
      if (p === "enfants") return enfIds().length > 0;
      if (p === "accompagnes") return accIds().length > 0;
      var m = /^colonne:([^=]+)=(.*)$/.exec(p); if (m) return String((FOY.colonnes || {})[m[1]] || "") === m[2];
      return true;
    }
    function blocExtra(k) {
      var Q = (CFG.questions || []).filter(function (c) { var ici = c.etape === k || (k === "fin1" && ordre().indexOf(c.etape) < 0); return ici && extraPour(c); });
      if (!S.extra) S.extra = {};
      return Q.map(function (c) {
        var b = "extra." + c.id, rr = c.nom, corps = "", inconnu = c.inconnu ? [PASENCORE()] : [];
        var opts = c.reponses === "ouinon" ? [{ v: "oui", l: tt("Oui", "Sim", "Yes") }, { v: "non", l: tt("Non", "Não", "No") }] : (c.options || []).map(function (o) { return { v: o, l: o }; });
        var champ = function (base, label, need) {
          if (c.reponses === "texte") return txt(base, { area: true, req: !c.facultatif, need: need, r: label });
          if (c.reponses === "nombre") { var n = []; for (var i = 0; i <= 10; i++) n.push({ v: String(i), l: String(i) }); return sel(base, n, { req: !c.facultatif, need: need, r: label }); }
          if (c.reponses === "heure") return heure(base, { label: tt("Heure", "Hora", "Time"), need: need, r: label });
          if (c.reponses === "multiple") return checks(base, opts, { min1: !c.facultatif, need: need, r: label });
          return radio(base, opts.concat(inconnu), c.facultatif ? { facultatif: true, r: label } : { need: need, r: label, attente: function (v) { return v === "inconnu"; } });
        };
        if (c.portee === "personne" && c.reponses === "ouinon") {
          corps = radio(b + ".tous", [{ v: "non", l: tt("Personne", "Ninguém", "No one") }, { v: "oui", l: tt("Oui, certaines personnes", "Sim, algumas pessoas", "Yes, some people") }].concat(inconnu), c.facultatif ? { facultatif: true, r: rr } : { need: tt("votre réponse : ", "a sua resposta: ", "your answer: ") + rr.toLowerCase(), r: rr, attente: function (v) { return v === "inconnu"; } });
          if ((S.extra[c.id] || {}).tous === "oui") corps += checks(b + ".qui", presents().map(function (id) { return { v: id, l: prenom(id), html: nm(id) }; }), { ligne: true, min1: true, need: tt("les personnes concernées", "as pessoas abrangidas", "the people concerned"), r: rr + tt(" · qui", " · quem", " · who") });
        } else if (c.portee === "personne") {
          presents().forEach(function (id) { corps += '<div class="sous">' + (MODE === "form" ? "<h4>" + nm(id) + "</h4>" : "") + champ(b + "." + id, rr + " · " + prenom(id), rr.toLowerCase() + tt(" de ", " de ", " for ") + prenom(id)) + "</div>"; });
        } else corps = champ(b + ".v", rr, tt("votre réponse : ", "a sua resposta: ", "your answer: ") + rr.toLowerCase());
        if (c.precision) { var v = (S.extra[c.id] || {}).v, t = (S.extra[c.id] || {}).tous; if ((v && v !== "non" && v !== "inconnu") || t === "oui") corps += txt(b + ".precision", { label: tt("Une précision ?", "Algum pormenor?", "Any detail?"), r: rr + tt(" · précision", " · pormenor", " · detail") }); }
        return q("x_" + c.id, esc(tr(c.q)), c.aide ? esc(c.aide) : "", corps, "", c.facultatif);
      }).join("");
    }
    function manquantsEtape(k) { MODE = "form"; REQ = []; SECTION = k; ETAPES[k].rendu(); blocExtra(k); var vus = {}; return REQ.filter(function (r) { if (r.ok() || vus[r.label]) return false; vus[r.label] = 1; return true; }).map(function (r) { return r.label; }); }
    function verifierTout() { var out = []; ordre().forEach(function (k) { if (["accueil", "recap", "fin"].indexOf(k) < 0) out = out.concat(manquantsEtape(k)); }); return out; }
    function personnes() {
      return presents().map(function (id) {
        var f = fiche(id), r = role(id), e = S.enf[id] || {}, R = (S.table.reg || {})[id] || {};
        var nomComplet = id === "inv" ? (S.coord.prenom + " " + S.coord.nom) : f ? (f.plusTard ? null : ((f.prenom || "") + " " + (f.nom || "")).trim() || (id === "acc" && nomAcc() ? FOY.accNom : null)) : ((e.prenom || "") + " " + (e.nom || "")).trim();
        return { id: id, role: r === "inv" ? "invité" : r === "acc" ? "accompagnant" : "enfant", nom: nomComplet, civilite: id === "inv" ? S.coord.civ : f ? f.civ || null : null, age: r === "enf" ? ageDe(id) : null, poussette: r === "enf" && e.poussette === "oui",
          moments: MOMENTS.filter(function (m) { return attend(id, m.id); }).map(function (m) { return m.id; }), plat: (S.table.plat || {})[id] ? ((CFG.plats.filter(function (p) { return p.v === S.table.plat[id]; })[0] || {}).l || {}).fr || S.table.plat[id] : null,
          cuisson: (S.table.cuisson || {})[id] || null, regimes: S.table.regime === "oui" ? REGIMES.filter(function (x) { return R[x.v]; }).map(function (x) { return x.fr; }) : [], regime_autre: (S.table.regAutre || {})[id] || null, allergie_severe: (S.table.severe || {})[id] === "oui",
          vegetarien: S.table.regime === "oui" && REGIMES.some(function (x) { return x.veg && R[x.v]; }), dort: dormeurs().indexOf(id) >= 0, a_confirmer: !!(f && f.plusTard) };
      });
    }
    function signaux() {
      var s = [];
      if (S.presence === "inconnu") s.push("Présence à confirmer : relancer avant le " + tr(CFG.reponseAvant).toString());
      if (S.presence !== "oui") return s;
      aConfirmer().forEach(function (x) { s.push("À confirmer : " + x); });
      if (S.acc.choix === "autre") s.push(CFG.protection ? "Accompagnant remplacé : soumettre aux mariés (protection de la liste)" : "Accompagnant remplacé : pour information");
      if (CFG.protection && accIds().some(function (id) { return (fiche(id) || {}).plusTard; })) s.push("Nom à obtenir avant le " + tr(CFG.reponseAvant) + " (protection de la liste)");
      if (logeOffert && S.heb.sejour === "non") s.push("Hébergement offert décliné : à réattribuer avec les mariés");
      if (resaPossible() && S.resa.maison && ["non", "inconnu"].indexOf(S.resa.maison) < 0) s.push("Réservation d'hôtel demandée : " + S.resa.maison + ", " + (S.resa.chambres || 1) + " chambre(s), à confirmer à l'invité");
      if (logeOffert && dormeurs().length) s.push("Logés sur place : " + dormeurs().length + " personne(s)");
      presents().forEach(function (id) { var a = ageDe(id); if (role(id) === "enf" && a === 0) s.push("Nourrisson : " + prenom(id) + (dormeurs().indexOf(id) >= 0 ? ", logé : lit pour bébé à vérifier avec le lieu" : "") + ((S.enf[id] || {}).poussette === "oui" ? ", poussette ou cosy dans la salle" : "")); });
      if (CFG.arrivees && dormeurs().length && (S.v.aller || {}).date && CFG.jours && CFG.jours[1] && S.v.aller.date < CFG.jours[1].v) s.push("Arrivée la veille du mariage : vérifier l'hébergement de la nuit précédente");
      var nd = REPAS ? presents().filter(function (id) { return !dine(id); }).length : 0; if (nd) s.push(nd + " personne(s) ne dîneront pas : repas en moins pour le traiteur");
      if (S.fin.concierge === "tout") s.push("Conciergerie : aide demandée pour l'ensemble de la venue");
      if (S.fin.concierge === "partie") s.push("Conciergerie : aide demandée (" + Object.keys(S.fin.pour || {}).filter(function (k) { return S.fin.pour[k]; }).join(", ") + ")");
      if (S.table.severe && Object.keys(S.table.severe).some(function (k) { return S.table.severe[k] === "oui"; })) s.push("Allergie sévère : à signaler en priorité au traiteur");
      if (String(S.fin.attention || "").trim()) s.push("Attention particulière : " + String(S.fin.attention).trim());
      if (S.coord.nom !== FOY.nom || S.coord.prenom !== FOY.prenom || (FOY.tel && S.coord.tel !== FOY.tel)) s.push("Coordonnées modifiées par l'invité");
      if (LANG === "pt") s.push("Langue de l'invité : portugais");
      return s;
    }
    /* Les champs historiques lus par le reste de l'outil (présence, accompagnant, enfants, hébergement, mot). */
    function compat() {
      var o = { v: 2, presence: S.presence === "oui" ? "Avec joie, présent(e)" : S.presence === "non" ? "À regret, absent(e)" : "À confirmer" };
      if (S.presence !== "oui") { o.mot = S.motNon || null; return o; }
      var ps = personnes(), acc = ps.filter(function (p) { return p.role === "accompagnant"; });
      if (acc.length) o.accompagnant = acc.map(function (p) { return p.nom || "Nom à communiquer"; }).join(", "); else if (FOY.type !== "unique") o.vient_accompagne = "Non, je viendrai seul(e)";
      o.enfants = ps.filter(function (p) { return p.role === "enfant"; }).map(function (p) { return { prenom: (p.nom || "").split(" ")[0], age: p.age }; });
      o.email = S.coord.email || null; o.mot = String(S.fin.mot || "").trim() || null;
      if (choixLieu && S.heb.lieu && S.heb.lieu !== "inconnu") o.hebergement = S.heb.lieu === "propres" ? "Par leurs propres moyens" : S.heb.lieu;
      if (logeOffert && S.heb.sejour === "non") o.hebergement = "Par leurs propres moyens";
      o.personnes = ps.length;
      if ((CFG.questions || []).length) { o.colonnes = {}; (CFG.questions || []).forEach(function (c) { var x = (S.extra || {})[c.id]; if (x) o.colonnes[c.nom] = x; }); }
      (CFG.trajets || []).forEach(function (t) { if ((S.dep.trajets || {})[t.id]) { o["nav_" + t.id + "_aller"] = String((S.dep.places || {})[t.id] || ""); if ((S.dep.retour || {})[t.id]) o["nav_" + t.id + "_retour"] = S.dep.retour[t.id] === "sans" ? "Pas de navette" : S.dep.retour[t.id]; } else o["nav_" + t.id + "_aller"] = "Non merci"; });
      var trajet = function (x) { x = x || {}; if (!x.mode) return null; if (x.mode === "inconnu") return "À confirmer"; var md = { avion: "Vol", train: "Train", voiture: "Voiture", taxi: "Taxi ou chauffeur" }[x.mode]; var j = (CFG.jours || []).filter(function (d) { return d.v === x.date; })[0]; return [md + (x.numero ? " " + x.numero : ""), x.lieu || "", j ? j.l.fr : "", x.heureInconnue ? "horaire à confirmer" : x.heure && x.heure.h ? x.heure.h + " h " + x.heure.m : ""].filter(Boolean).join(", "); };
      if (CFG.arrivees) { o.arrivee = trajet(S.v.aller); o.depart = trajet(S.v.retour); }
      if (logeOffert && S.heb.sejour !== "non") o.hebergement = FOY.lieu || HEB.lieu || null;
      if (resaPossible() && S.resa.maison && ["non", "inconnu"].indexOf(S.resa.maison) < 0) { o.hebergement = S.resa.maison; o.reservation = { maison: S.resa.maison, chambres: Number(S.resa.chambres || 1), statut: "demandée" }; }
      if (choixLieu && S.heb.lieu === "inconnu") delete o.hebergement;
      return o;
    }

    /* ---------- dessin et événements (navigateur) ---------- */
    var EL = null, HOOKS = {};
    function pied(et) { var ord = ordre(), dern = S.step === "recap", non = S.step === "presence" && (S.presence === "non" || S.presence === "inconnu"); return '<div class="manquant-box"></div><div class="nav"><button class="lien" data-nav="retour">' + tt("Retour", "Voltar", "Back") + "</button>" + (S.fromRecap && !dern ? '<button class="btn clair" data-nav="recap">' + tt("Revenir au récapitulatif", "Voltar ao resumo", "Back to the summary") + "</button>" : "") + '<button class="btn" data-nav="' + (dern || non ? "envoyer" : "suivant") + '">' + (dern ? tt("Transmettre mes réponses", "Enviar as minhas respostas", "Send my answers") : non ? tt("Transmettre ma réponse", "Enviar a minha resposta", "Send my answer") : tt("Continuer", "Continuar", "Continue")) + "</button></div>"; }
    function render(keep) {
      if (!EL) return; var y = keep ? (EL.scrollTop || window.scrollY) : 0; REQ = []; MODE = "form";
      var ord = ordre(); if (ord.indexOf(S.step) < 0) S.step = ord[0];
      var h = '<div class="marque">' + esc(tt("Mariage de ", "Casamento de ", "The wedding of ") + MARIES()) + "</div>";
      if (["accueil", "fin"].indexOf(S.step) < 0) { var vis = ord.filter(function (k) { return ["accueil", "fin"].indexOf(k) < 0; }); h += '<div class="etapes">' + vis.map(function (k, j) { return '<i class="' + (j <= vis.indexOf(S.step) ? "fait" : "") + '"></i>'; }).join("") + "</div>"; if (S.step !== "recap") h += "<h2>" + esc(ETAPES[S.step].t()) + "</h2>"; }
      SECTION = S.step; h += ETAPES[S.step].rendu(); if (["accueil", "presence", "recap", "fin"].indexOf(S.step) < 0) h += blocExtra(S.step);
      if (["accueil", "fin"].indexOf(S.step) < 0) h += pied();
      EL.innerHTML = elide(h); EL.setAttribute("lang", LANG);
      if (keep) { if (EL.scrollTop !== undefined && EL.scrollHeight > EL.clientHeight) EL.scrollTop = y; else window.scrollTo(0, y); }
    }
    function manquants() { var vus = {}; return REQ.filter(function (r) { if (r.ok() || vus[r.label]) return false; vus[r.label] = 1; return true; }); }
    function verifier() {
      EL.querySelectorAll(".manque").forEach(function (n) { n.classList.remove("manque"); });
      var m = manquants(), box = EL.querySelector(".manquant-box"); if (!m.length) { box.innerHTML = ""; return true; }
      box.innerHTML = '<div class="manquant">' + tt("Il nous manque encore : ", "Ainda nos falta: ", "We still need: ") + esc(listeEt(m.map(function (x) { return x.label; }))) + ".</div>";
      var first = null; m.forEach(function (x) { var n = EL.querySelector("#" + x.id) || EL.querySelector('[data-note="' + x.id.replace(/^n_/, "") + '"]'); if (n) { (n.closest(".champ") || n.closest(".q") || n).classList.add("manque"); if (!first) first = n; } });
      if (first && first.scrollIntoView) (first.closest(".q") || first).scrollIntoView({ behavior: "smooth", block: "start" });
      return false;
    }
    function aller(step) { S.step = step; render(false); if (EL.scrollIntoView) EL.scrollIntoView({ block: "start" }); if (HOOKS.etape) HOOKS.etape(step); }
    function brancher(el, hooks) {
      EL = el; HOOKS = hooks || {};
      el.addEventListener("change", function (ev) {
        var t = ev.target;
        if (t.dataset && t.dataset.mom) { var x = t.dataset.mom.split("|"); set("mom." + x[0] + "." + x[1], t.checked); render(true); return; }
        var k = t.dataset && t.dataset.k; if (!k) return;
        if (t.type === "radio") {
          set(k, t.value);
          if (k === "acc.choix") S.acc = { choix: t.value };
          if (k === "heb.sejour") { delete S.heb.qui; if (["oui", "partiel"].indexOf(t.value) < 0) { delete S.heb.precision; delete S.heb.heure; } }
          if (k === "fin.concierge" && t.value !== "partie") { delete S.fin.pour; delete S.fin.pourAutre; }
          if (/^v\.(aller|retour)\.mode$/.test(k)) { var b = k.replace(/\.mode$/, ""), o = get(b); Object.keys(o).forEach(function (z) { if (z !== "mode") delete o[z]; }); }
          if (k === "tous" && t.value === "oui") { S.mom = {}; S.absent = {}; }
          render(true); return;
        }
        if (t.type === "checkbox") {
          set(k, t.checked); var g = t.dataset.groupe;
          if (g && t.checked) { var grp = get(g) || {}; el.querySelectorAll('input[data-groupe="' + g + '"]').forEach(function (n) { if (n === t) return; if (t.dataset.solo || n.dataset.solo) grp[n.dataset.k.split(".").pop()] = false; }); }
          if (/\.plusTard$/.test(k) && t.checked) { var bb = get(k.replace(/\.plusTard$/, "")); ["civ", "titre", "titreAutre", "nom", "prenom"].forEach(function (z) { delete bb[z]; }); }
          render(true); return;
        }
        if (t.tagName === "SELECT") { set(k, t.value || undefined); render(true); }
      });
      el.addEventListener("input", function (ev) {
        var t = ev.target, k = t.dataset && t.dataset.k; if (!k || t.tagName === "SELECT" || t.type === "radio" || t.type === "checkbox") return;
        set(k, t.value);
        if (t.dataset.live) el.querySelectorAll('[data-nm="' + t.dataset.live + '"]').forEach(function (n) { n.textContent = prenom(t.dataset.live); });
        var c = t.closest(".champ"); if (c) c.classList.remove("manque");
      });
      el.addEventListener("click", function (ev) {
        var b = ev.target.closest("button, a"); if (!b || !el.contains(b)) return;
        if (b.dataset.site) { ev.preventDefault(); if (HOOKS.site) HOOKS.site(b.dataset.site); return; }
        if (b.dataset.nav) {
          var ord = ordre(), i = ord.indexOf(S.step);
          if (b.dataset.nav === "retour") { if (i > 0) aller(ord[i - 1]); return; }
          if (b.dataset.nav === "suivant") { if (S.step !== "accueil" && !verifier()) return; if (HOOKS.brouillon) HOOKS.brouillon(S); aller(ord[i + 1]); return; }
          if (b.dataset.nav === "recap") { if (!verifier()) return; S.fromRecap = false; aller("recap"); return; }
          if (b.dataset.nav === "envoyer") {
            if (!verifier()) return; b.disabled = true;
            var fin = function () { S.fromRecap = false; aller("fin"); };
            if (HOOKS.envoyer) Promise.resolve(HOOKS.envoyer(S)).then(fin, function (e) { b.disabled = false; var box = el.querySelector(".manquant-box"); if (box) box.innerHTML = '<div class="manquant">' + esc((e && e.message) || tt("L'envoi n'a pas abouti. Merci de réessayer dans un instant.", "O envio não foi concluído. Tente novamente dentro de instantes.", "Your answers could not be sent. Please try again in a moment.")) + "</div>"; });
            else fin();
            return;
          }
        }
        if (b.dataset.modifier) { S.fromRecap = true; aller(b.dataset.modifier); return; }
        if (b.dataset.aller) { var n = el.querySelector("#" + b.dataset.aller); if (n && n.scrollIntoView) n.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
        if (b.dataset.ack) { S.ack[b.dataset.ack] = b.dataset.sig; render(true); return; }
      });
      render(false);
    }

    return { brancher: brancher, render: render, etat: function () { return S; }, langue: function () { return LANG; }, ordre: ordre, verifierTout: verifierTout, collecte: collecte, personnes: personnes, signaux: signaux, compat: compat, aConfirmer: aConfirmer, aller: function (k) { S.step = k; } };
  }

  var api = { creer: creer };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.YIDMoteur = api;
})(this);
