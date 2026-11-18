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
    var LANG = (FOY.langue === "pt" ? "pt" : "fr");
    var tt = function (fr, pt) { return LANG === "pt" ? pt : fr; };
    var tr = function (o) { if (o == null) return ""; if (typeof o === "string") return o; return o[LANG] || o.fr || ""; };
    var MARIES = function () { return tr(CFG.maries); };
    var PASENCORE = function () { return { v: "inconnu", l: tt("Je ne le sais pas encore", "Ainda não sei") }; };
    var NBF = { fr: ["aucune", "une", "deux", "trois", "quatre", "cinq", "six", "sept"], pt: ["nenhum", "um", "dois", "três", "quatro", "cinco", "seis", "sete"] };
    var NBP = { fr: ["aucune", "une", "deux", "trois", "quatre", "cinq", "six", "sept"], pt: ["nenhuma", "uma", "duas", "três", "quatro", "cinco", "seis", "sete"] };
    var ORD = { fr: ["Première personne", "Deuxième personne", "Troisième personne", "Quatrième personne", "Cinquième personne"], pt: ["Primeira pessoa", "Segunda pessoa", "Terceira pessoa", "Quarta pessoa", "Quinta pessoa"] };
    var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
    var elide = function (s) { return String(s).replace(/\b(de|que) ((?:<span data-nm="[^"]*">)?)([AEIOUYÉÈÊÂÎÔH])/g, function (m, w, sp, c) { return (w === "de" ? "d'" : "qu'") + sp + c; }); };
    var listeEt = function (a) { return a.length < 2 ? (a[0] || "") : a.slice(0, -1).join(", ") + tt(" et ", " e ") + a[a.length - 1]; };
    var MOMENTS = (CFG.moments || []).filter(function (m) { return !FOY.moments || !FOY.moments.length || FOY.moments.indexOf(m.id) >= 0; });
    var HEB = CFG.heb || { gere: "aucun" };
    var logeOffert = !!(FOY.loge && HEB.offert);
    var choixLieu = HEB.gere === "tous" && !HEB.offert && (HEB.lieux || []).length > 0;

    var S = ETAT && typeof ETAT === "object" ? JSON.parse(JSON.stringify(ETAT)) : null;
    if (!S || !S.coord) S = { step: "accueil", presence: null, motNon: "", coord: { civ: FOY.civ || "", titre: "", titreAutre: "", nom: FOY.nom || "", prenom: FOY.prenom || "", ind: FOY.ind || "FR", tel: FOY.tel || "", email: FOY.email || "" },
      acc: { choix: null }, nbAcc: null, accs: {}, nbEnf: null, enf: {}, tous: null, mom: {}, absent: {}, seulMoment: {}, v: {}, heb: {}, dep: {}, table: {}, fin: {}, ack: {} };
    ["acc", "accs", "enf", "mom", "absent", "seulMoment", "v", "heb", "dep", "table", "fin", "ack"].forEach(function (k) { if (!S[k]) S[k] = {}; });
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
      if (f) { if (f.prenom && !f.plusTard) return f.prenom; if (id === "acc" && FOY.type === "deux" && S.acc.choix === "oui") return nomAcc() ? nomAcc().prenom : tt("votre conjoint", "o seu cônjuge"); return id === "acc" ? tt("la personne qui vous accompagne", "a pessoa que vem consigo") : ORD[LANG][+id.slice(1) - 1].toLowerCase(); }
      return (S.enf[id] && S.enf[id].prenom) || tt("votre enfant n°", "o filho n.º ") + id.slice(1);
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
    function servi(id) { return TRAITEUR.some(function (m) { return attend(id, m.id); }) || (!MOMENTS.length && present(id)); }
    function dine(id) { return REPAS ? attend(id, REPAS.id) : present(id); }

    /* ---------- composants ---------- */
    function req(label, ok, id) { if (MODE === "form") REQ.push({ label: elide(label), ok: ok, id: id }); }
    function row(label, val, attente) { if (MODE === "recap" && val != null && val !== "") ROWS.push({ section: SECTION, label: elide(label), val: val, attente: !!attente }); return ""; }
    function q(code, titre, aide, corps, extra, facultatif) {
      if (MODE === "recap") return corps;
      return '<section class="q" data-q="' + code + '" id="q_' + code + '"><h3>' + titre + (facultatif ? ' <span class="facult">' + tt("facultatif", "facultativo") + "</span>" : "") + "</h3>" + (aide ? '<p class="aide">' + aide + "</p>" : "") + corps + (extra || "") + "</section>";
    }
    function radio(k, opts, o) {
      o = o || {}; var v = get(k);
      if (MODE === "recap") { var s = opts.filter(function (x) { return x.v === v; })[0]; return row(o.r || "", s ? (s.rl || s.l) : "", o.attente && o.attente(v)); }
      if (!o.facultatif) req(o.need || o.r, function () { var g = get(k); return opts.some(function (x) { return x.v === g; }); }, fid(k));
      return '<div class="indic">' + tt("Une seule réponse", "Uma única resposta") + '</div><div class="choix' + (o.ligne ? " ligne" : "") + '" id="' + fid(k) + '">' + opts.map(function (x) {
        return '<label class="opt' + (x.v === v ? " on" : "") + '"><input type="radio" name="' + esc(k) + '" value="' + esc(x.v) + '" data-k="' + esc(k) + '"' + (x.v === v ? " checked" : "") + '><span class="marq"></span><span class="lib">' + (x.html || esc(x.l)) + (x.d ? "<small>" + esc(x.d) + "</small>" : "") + "</span></label>";
      }).join("") + "</div>";
    }
    function checks(k, opts, o) {
      o = o || {};
      var val = function (x) { var v = get(k + "." + x.v); return v === undefined ? !!o.defaut : !!v; };
      if (MODE === "recap") return row(o.r || "", opts.filter(val).map(function (x) { return x.rl || x.l; }).join(", "));
      if (o.min1) req(o.need || o.r, function () { return opts.some(val); }, fid(k));
      return (o.sansIndic ? "" : '<div class="indic">' + tt("Plusieurs réponses possibles", "Várias respostas possíveis") + "</div>") + '<div class="choix' + (o.ligne ? " ligne" : "") + '" id="' + fid(k) + '">' + opts.map(function (x) {
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
      return '<div class="champ" data-champ="' + fid(k) + '">' + (o.label ? '<label for="' + fid(k) + '">' + o.label + "</label>" : "") + '<select id="' + fid(k) + '" data-k="' + esc(k) + '">' + (o.ph !== false ? '<option value="">' + esc(o.ph || tt("Choisir", "Escolher")) + "</option>" : "") +
        opts.map(function (x) { return '<option value="' + esc(x.v) + '"' + (x.v === v ? " selected" : "") + ">" + esc(x.l) + "</option>"; }).join("") + "</select></div>";
    }
    var HH = []; for (var h = 0; h < 24; h++) HH.push({ v: (h < 10 ? "0" : "") + h, l: (h < 10 ? "0" : "") + h + " h" });
    var MN = []; for (var mn = 0; mn < 60; mn += 5) MN.push({ v: (mn < 10 ? "0" : "") + mn, l: (mn < 10 ? "0" : "") + mn });
    function heure(k, o) {
      var v = get(k) || {};
      if (MODE === "recap") return row(o.r || o.label, v.h && v.m ? v.h + " h " + v.m : "");
      req(o.need || o.label, function () { var x = get(k) || {}; return !!(x.h && x.m); }, fid(k));
      var s = function (part, opts, ph) { return '<select id="' + fid(k) + "_" + part + '" data-k="' + esc(k) + "." + part + '"><option value="">' + ph + "</option>" + opts.map(function (x) { return '<option value="' + x.v + '"' + (x.v === v[part] ? " selected" : "") + ">" + x.l + "</option>"; }).join("") + "</select>"; };
      return '<div class="champ" data-champ="' + fid(k) + '" id="' + fid(k) + '"><label>' + o.label + '</label><div class="heure">' + s("h", HH, tt("Heure", "Hora")) + s("m", MN, tt("Minutes", "Minutos")) + "</div></div>";
    }
    function info(html, cls) { return MODE === "recap" ? "" : '<div class="info' + (cls ? " " + cls : "") + '">' + html + "</div>"; }
    function note(cle, html, boutons) { return MODE === "recap" ? "" : '<div class="note" data-note="' + esc(cle) + '">' + html + (boutons ? '<div class="actions">' + boutons + "</div>" : "") + "</div>"; }
    function ack(cle, label, sig) { req(label, function () { return S.ack[cle] === sig; }, "n_" + cle); return S.ack[cle] === sig; }
    function lienSite(page, texte) { return MODE === "recap" || !CFG.site ? "" : '<a class="lien lien-site" href="#" data-site="' + esc(page) + '">' + esc(texte) + "</a>"; }

    /* ---------- civilité, indicatifs ---------- */
    function TITRES() { return [{ v: "Docteur", l: tt("Docteur", "Doutor") }, { v: "Maître", l: tt("Maître", "Advogado") }, { v: "Son Excellence", l: tt("Son Excellence", "Sua Excelência") }, { v: "autre", l: tt("Autre", "Outro") }]; }
    function blocCivilite(b, suf, need) {
      var h = radio(b + ".civ", [{ v: "Madame", l: tt("Madame", "Senhora") }, { v: "Monsieur", l: tt("Monsieur", "Senhor") }], { ligne: true, r: tt("Civilité", "Tratamento") + suf, need: need });
      h += sel(b + ".titre", TITRES(), { label: tt("Un titre à mentionner ?", "Algum título a mencionar?"), ph: tt("Aucun", "Nenhum"), r: tt("Titre", "Título") + suf });
      if (get(b + ".titre") === "autre") h += txt(b + ".titreAutre", { label: tt("Lequel ?", "Qual?"), req: true, need: tt("le titre à mentionner", "o título a mencionar"), r: tt("Titre précisé", "Título") + suf });
      return h;
    }
    function optionsPays() {
      var prio = (CFG.paysPrio || ["FR"]).slice(); if (prio.indexOf(S.coord.ind) < 0 && S.coord.ind) prio.unshift(S.coord.ind);
      var col = LANG === "pt" ? 3 : 2;
      var L = PAYS_G.slice().sort(function (a, b) { return a[col].localeCompare(b[col], LANG); });
      var top = prio.map(function (r) { return PAYS_G.filter(function (p) { return p[0] === r; })[0]; }).filter(Boolean);
      return top.concat(L.filter(function (p) { return prio.indexOf(p[0]) < 0; })).map(function (p) { return { v: p[0], l: p[4] + " " + p[col] + " " + p[1], rl: p[1] }; });
    }

    /* ---------- étapes ---------- */
    var ETAPES = {
      accueil: { t: function () { return tt("Accueil", "Boas-vindas"); }, visible: function () { return true; }, rendu: etAccueil },
      presence: { t: function () { return tt("Votre réponse", "A sua resposta"); }, visible: function () { return true; }, rendu: etPresence },
      coord: { t: function () { return tt("Vos coordonnées", "Os seus contactos"); }, visible: function () { return S.presence === "oui"; }, rendu: etCoord },
      accomp: { t: function () { return tt("Ceux qui vous accompagnent", "Quem vem consigo"); }, visible: function () { return S.presence === "oui" && (FOY.type !== "unique" || FOY.enfants > 0); }, rendu: etAccomp },
      moments: { t: function () { return tt("La journée", "O dia"); }, visible: function () { return S.presence === "oui" && MOMENTS.length > 1; }, rendu: etMoments },
      voyage: { t: function () { return tt("Votre venue", "A sua vinda"); }, visible: function () { return S.presence === "oui" && !!CFG.arrivees; }, rendu: etVoyage },
      heberg: { t: function () { return logeOffert ? tt("Votre séjour", "A sua estadia") : tt("Votre hébergement", "O seu alojamento"); }, visible: function () { return S.presence === "oui" && (logeOffert || choixLieu); }, rendu: etHeberg },
      deplac: { t: function () { return tt("Vos déplacements", "As suas deslocações"); }, visible: function () { return S.presence === "oui" && (CFG.trajets || []).length > 0; }, rendu: etDeplac },
      table: { t: function () { return tt("À table", "À mesa"); }, visible: function () { return S.presence === "oui" && presents().some(servi); }, rendu: etTable },
      fin1: { t: function () { return tt("Pour conclure", "Para terminar"); }, visible: function () { return S.presence === "oui"; }, rendu: etConclure },
      recap: { t: function () { return tt("Récapitulatif", "Resumo"); }, visible: function () { return S.presence === "oui"; }, rendu: etRecap },
      fin: { t: function () { return ""; }, visible: function () { return true; }, rendu: etFin }
    };
    function ordre() { return Object.keys(ETAPES).filter(function (k) { return ETAPES[k].visible(); }); }

    function salut() {
      var d = new Date(), h = d.getHours() + d.getMinutes() / 60, p = esc(FOY.appel || FOY.prenom || "");
      if (LANG === "pt") return (h >= 4.5 && h < 12 ? "Bom dia" : h >= 12 && h < 19.5 ? "Boa tarde" : "Boa noite") + ", " + p + ",";
      return (h >= 4.5 && h < 18 ? "Bonjour" : "Bonsoir") + " " + p + ",";
    }
    function phraseInvitation() {
      var M = MARIES(), p = tt(M + " ont le plaisir de vous convier à leur mariage", M + " têm o prazer de lhe endereçar o convite para o seu casamento"), na = nomAcc();
      if (FOY.type === "deux") p += na ? tt(", en compagnie de " + na.prenom, ", na companhia de " + na.prenom) : tt(", en compagnie de votre conjoint", ", na companhia do seu cônjuge");
      if (FOY.type === "libre") p += tt(", en compagnie de la personne de votre choix", ", na companhia da pessoa da sua escolha");
      if (FOY.type === "plusieurs") p += tt(", en compagnie de " + NBP.fr[FOY.max] + " personnes de votre choix au plus", ", na companhia de até " + NBP.pt[FOY.max] + " pessoas da sua escolha");
      if (FOY.enfants) p += FOY.enfants > 1 ? tt(", ainsi que vos enfants", ", bem como dos seus filhos") : tt(", ainsi que votre enfant", ", bem como do seu filho ou da sua filha");
      return p + ".";
    }
    function etAccueil() {
      var seul = FOY.type === "unique" && !FOY.enfants && CFG.audience;
      return '<div class="carte-accueil"><div class="marque">Yes I Do</div><p class="salut">' + salut() + "</p><h1>" + esc(phraseInvitation()) + "</h1>" +
        (seul ? '<p class="perso">' + tt("Cette invitation vous est personnellement adressée.", "Este convite é-lhe dirigido pessoalmente.") + "</p>" : "") +
        "<p>" + esc(tr(CFG.quand)) + "</p>" +
        '<div class="encadre">' + tt("Nous vous remercions de bien vouloir nous répondre avant le " + tr(CFG.reponseAvant) + ".", "Agradecemos a sua resposta até " + tr(CFG.reponseAvant) + ".") + '<br><span class="doux">' + tt("Vos réponses resteront modifiables jusqu'au " + tr(CFG.modifJusqu) + ".", "As suas respostas poderão ser alteradas até " + tr(CFG.modifJusqu) + ".") + "</span></div>" +
        '<button class="btn" data-nav="suivant">' + tt("Confirmer votre présence", "Confirmar a sua presença") + "</button></div>";
    }
    function etPresence() {
      var h = q("presence", tt("Serez-vous des nôtres pour célébrer " + MARIES() + " ?", "Poderemos contar com a sua presença para celebrar " + MARIES() + "?"), "",
        radio("presence", [{ v: "oui", l: tt("Oui, avec plaisir", "Sim, com todo o gosto") }, { v: "non", l: tt("Non, je ne pourrai malheureusement pas venir", "Infelizmente, não poderei estar presente") }, PASENCORE()], { need: tt("votre réponse à l'invitation", "a sua resposta ao convite"), r: tt("Présence", "Presença") }));
      if (MODE === "form" && S.presence === "non") h += q("motNon", tt("Un mot pour " + MARIES() + " ?", "Uma palavra para " + MARIES() + "?"), tt("Ils seront heureux de vous lire.", "Terão muito gosto em ler a sua mensagem."), txt("motNon", { area: true }), "", true);
      if (MODE === "form" && S.presence === "inconnu") h += info(tt("Nous comprenons tout à fait. Ce même lien reste à votre disposition : vous pourrez nous répondre jusqu'au " + tr(CFG.reponseAvant) + ".", "Compreendemos perfeitamente. Este mesmo link continua à sua disposição: poderá responder-nos até " + tr(CFG.reponseAvant) + "."));
      return h;
    }
    function etCoord() {
      var h = q("civ", tt("Civilité", "Tratamento"), "", blocCivilite("coord", "", tt("votre civilité", "o seu tratamento")));
      h += q("nom", tt("Nom et prénom", "Apelido e nome próprio"), "", '<div class="duo">' + txt("coord.nom", { label: tt("Nom", "Apelido"), req: true, need: tt("votre nom", "o seu apelido"), ac: "family-name" }) + txt("coord.prenom", { label: tt("Prénom", "Nome próprio"), req: true, need: tt("votre prénom", "o seu nome próprio"), live: "inv", ac: "given-name" }) + "</div>");
      var P = PAYS_G.filter(function (p) { return p[0] === S.coord.ind; })[0];
      h += q("tel", tt("Numéro de téléphone", "Número de telefone"), "", MODE === "recap" ? row(tt("Téléphone", "Telefone"), (P ? P[1] : "") + " " + S.coord.tel) :
        '<div class="tel">' + sel("coord.ind", optionsPays(), { req: true, need: tt("l'indicatif de votre pays", "o indicativo do seu país"), ph: false }) + txt("coord.tel", { req: true, need: tt("votre numéro de téléphone", "o seu número de telefone"), type: "tel", ac: "tel-national" }) + "</div>");
      h += q("email", tt("Adresse email", "Endereço de email"), tt("Pour vous tenir au courant de la suite.", "Para lhe darmos notícias dos próximos passos."), txt("coord.email", { req: true, type: "email", need: tt("une adresse email valide", "um endereço de email válido"), r: "Email", ac: "email" }));
      return h;
    }
    function blocPersonne(b, id, qui, plusTard) {
      var f = get(b) || {}, h = "";
      if (plusTard) h += checks(b, [{ v: "plusTard", l: tt("Je vous communiquerai son nom plus tard", "Indicarei o nome mais tarde") }], { sansIndic: true, r: tt("Nom", "Nome") + " · " + qui });
      if (f.plusTard) return h + (MODE === "recap" ? row(qui, tt("Nom à communiquer", "Nome a indicar"), true) : "");
      return h + blocCivilite(b, " · " + qui, tt("la civilité de ", "o tratamento de ") + qui) +
        '<div class="duo">' + txt(b + ".nom", { label: tt("Nom", "Apelido"), req: true, need: tt("le nom de ", "o apelido de ") + qui, r: tt("Nom", "Apelido") + " · " + qui }) + txt(b + ".prenom", { label: tt("Prénom", "Nome próprio"), req: true, need: tt("le prénom de ", "o nome próprio de ") + qui, live: id, r: tt("Prénom", "Nome próprio") + " · " + qui }) + "</div>";
    }
    function etAccomp() {
      var h = "", sans = { v: "seul", l: tt("Non, je viendrai sans accompagnant", "Não, irei sem acompanhante") };
      var cadre = tt("Afin de préparer son invitation et sa place à table.", "Para prepararmos o convite e o lugar à mesa.");
      var garde = MODE === "form" && S.acc.choix === "inconnu" ? '<p class="aide">' + tt("Nous gardons sa place jusqu'au " + tr(CFG.reponseAvant) + ". Il vous suffira de revenir sur ce même lien.", "Guardaremos o lugar até " + tr(CFG.reponseAvant) + ". Bastará voltar a este mesmo link.") + "</p>" : "";
      if (FOY.type === "deux") {
        var na = nomAcc();
        h += q("acc", na ? tt("Viendrez-vous en compagnie de " + esc(na.prenom) + " ?", "Virá na companhia de " + esc(na.prenom) + "?") : tt("Viendrez-vous en compagnie de votre conjoint ?", "Virá na companhia do seu cônjuge?"), cadre,
          radio("acc.choix", [{ v: "oui", l: tt("Oui", "Sim") }, { v: "autre", l: tt("Une autre personne m'accompagnera", "Outra pessoa virá comigo") }, sans, PASENCORE()], { need: tt("votre réponse sur votre accompagnant", "a sua resposta sobre o acompanhante"), r: tt("Accompagnant", "Acompanhante"), attente: function (v) { return v === "autre" || v === "inconnu"; } }),
          (S.acc.choix === "autre" && MODE === "form" ? '<p class="aide">' + tt("Nous soumettons votre demande à " + MARIES() + " et revenons vers vous très rapidement.", "Transmitiremos o seu pedido a " + MARIES() + " e entraremos em contacto consigo muito em breve.") + "</p>" : "") + garde);
        if (S.acc.choix === "oui") { if (na && MODE === "form" && !S.acc.nom && !S.acc.prenom) { S.acc.prenom = na.prenom; S.acc.nom = na.nom; } h += q("accFiche", na ? esc(na.prenom) : tt("Votre conjoint", "O seu cônjuge"), "", blocPersonne("acc", "acc", na ? na.prenom : tt("votre conjoint", "o seu cônjuge"), false)); }
        if (S.acc.choix === "autre") h += q("accFiche", tt("La personne qui vous accompagnera", "A pessoa que virá consigo"), "", blocPersonne("acc", "acc", tt("la personne qui vous accompagne", "a pessoa que vem consigo"), true) + row(tt("Statut", "Estado"), tt("En attente de l'accord des mariés", "A aguardar a aprovação dos noivos"), true));
      }
      if (FOY.type === "libre") {
        h += q("acc", tt("Viendrez-vous avec un accompagnant ?", "Virá com um acompanhante?"), cadre, radio("acc.choix", [{ v: "oui", l: tt("Oui", "Sim") }, sans, PASENCORE()], { need: tt("votre réponse sur l'accompagnant", "a sua resposta sobre o acompanhante"), r: tt("Accompagnant", "Acompanhante"), attente: function (v) { return v === "inconnu"; } }), garde);
        if (S.acc.choix === "oui") h += q("accFiche", tt("La personne qui vous accompagnera", "A pessoa que virá consigo"), "", blocPersonne("acc", "acc", tt("la personne qui vous accompagne", "a pessoa que vem consigo"), true));
      }
      if (FOY.type === "plusieurs") {
        var opts = [{ v: "0", l: tt("Aucune, je viendrai sans accompagnant", "Nenhuma, irei sem acompanhante") }]; for (var i = 1; i <= FOY.max; i++) opts.push({ v: String(i), l: String(i) }); opts.push(PASENCORE());
        h += q("nbAcc", tt(MARIES() + " ont prévu " + NBP.fr[FOY.max] + " places pour les personnes qui vous accompagneront. Combien seront présentes ?", MARIES() + " reservaram " + NBP.pt[FOY.max] + " lugares para as pessoas que virão consigo. Quantas estarão presentes?"), cadre,
          radio("nbAcc", opts, { ligne: true, need: tt("le nombre de personnes qui vous accompagneront", "o número de pessoas que virão consigo"), r: tt("Accompagnants", "Acompanhantes"), attente: function (v) { return v === "inconnu"; } }));
        accIds().forEach(function (id) { var o = ORD[LANG][+id.slice(1) - 1]; h += q("acc_" + id, o, "", blocPersonne("accs." + id, id, o.toLowerCase(), true)); });
      }
      if (FOY.enfants) {
        var n = FOY.enfants, cadreE = tt("Afin de préparer leur place et leur accueil.", "Para prepararmos o lugar e o acolhimento.");
        if (n > 1) {
          var oe = [{ v: "0", l: tt("Aucun", "Nenhum") }]; for (var j = 1; j <= n; j++) oe.push({ v: String(j), l: String(j) }); oe.push(PASENCORE());
          h += q("nbEnf", tt(MARIES() + " ont prévu " + NBF.fr[n] + " places pour vos enfants. Combien seront des vôtres ?", MARIES() + " reservaram " + NBP.pt[n] + " lugares para os seus filhos. Quantos virão?"), cadreE, radio("nbEnf", oe, { ligne: true, need: tt("le nombre d'enfants qui seront des vôtres", "o número de filhos que virão"), r: tt("Enfants", "Filhos"), attente: function (v) { return v === "inconnu"; } }));
        } else h += q("nbEnf", tt(MARIES() + " ont prévu une place pour votre enfant. Sera-t-il des vôtres ?", MARIES() + " reservaram um lugar para o seu filho ou a sua filha. Virá também?"), cadreE, radio("nbEnf", [{ v: "1", l: tt("Oui", "Sim") }, { v: "0", l: tt("Non", "Não") }, PASENCORE()], { ligne: true, need: tt("votre réponse pour votre enfant", "a sua resposta sobre o seu filho ou a sua filha"), r: tt("Enfant", "Filho ou filha"), attente: function (v) { return v === "inconnu"; } }));
        var AGES = [{ v: "0", l: tt("Nourrisson (moins d'un an)", "Bebé (menos de um ano)") }]; for (var a = 1; a <= 30; a++) AGES.push({ v: String(a), l: a + " " + tt(a > 1 ? "ans" : "an", a > 1 ? "anos" : "ano") }); AGES.push({ v: "31", l: tt("Plus de 30 ans", "Mais de 30 anos") });
        enfIds().forEach(function (id, i) {
          if (MODE === "form" && !S.enf[id].nom) S.enf[id].nom = S.coord.nom;
          var corps = '<div class="duo">' + txt("enf." + id + ".prenom", { label: tt("Prénom", "Nome próprio"), req: true, need: tt("le prénom de l'enfant n°" + (i + 1), "o nome próprio do filho n.º " + (i + 1)), live: id, r: tt("Enfant", "Filho") }) + txt("enf." + id + ".nom", { label: tt("Nom", "Apelido"), req: true, need: tt("le nom de l'enfant n°" + (i + 1), "o apelido do filho n.º " + (i + 1)), r: tt("Nom", "Apelido") + " · " + prenom(id) }) + "</div>" +
            sel("enf." + id + ".age", AGES, { label: tt("Âge le jour du mariage", "Idade no dia do casamento"), req: true, need: tt("l'âge de ", "a idade de ") + prenom(id), r: tt("Âge", "Idade") + " · " + prenom(id) });
          if (ageDe(id) === 0) corps += '<div class="champ"><label>' + tt("Viendrez-vous avec une poussette ou un cosy ?", "Virá com um carrinho ou uma cadeirinha?") + "</label></div>" + radio("enf." + id + ".poussette", [{ v: "oui", l: tt("Oui", "Sim") }, { v: "non", l: tt("Non", "Não") }], { ligne: true, need: tt("votre réponse sur la poussette", "a sua resposta sobre o carrinho"), r: tt("Poussette ou cosy", "Carrinho ou cadeirinha") + " · " + prenom(id) });
          h += q("enf_" + id, tt("Enfant", "Filho ou filha"), "", corps);
        });
      }
      return h;
    }
    function etMoments() {
      var P = base(), corps = "", notes = "";
      if (MODE === "recap" && S.tous === "oui") return row(tt("La journée", "O dia"), tt("Tous les moments", "Todos os momentos"));
      var titreTous = P.length > 1 ? tt("Toutes les personnes de votre foyer assisteront-elles à chacun des moments ?", "Todas as pessoas do seu agregado estarão presentes em todos os momentos?") : tt("Assisterez-vous à chacun des moments de la journée ?", "Estará presente em todos os momentos do dia?");
      var liste = '<ul class="moments">' + MOMENTS.map(function (m) { return "<li>" + esc(tr(m.l)) + (m.d ? " <span class=\"doux\">· " + esc(tr(m.d)) + "</span>" : "") + "</li>"; }).join("") + "</ul>";
      var h = q("tous", titreTous, (MODE === "form" ? liste : ""), radio("tous", [{ v: "oui", l: P.length > 1 ? tt("Oui, à tous les moments", "Sim, em todos os momentos") : tt("Oui, à tous les moments", "Sim, em todos os momentos") }, { v: "non", l: tt("Non, pas à tous", "Não, nem em todos") }], { need: tt("votre réponse sur les moments de la journée", "a sua resposta sobre os momentos do dia"), r: tt("La journée", "O dia") }));
      if (S.tous !== "non") return h;
      MOMENTS.forEach(function (m) {
        if (MODE === "recap") { var l = P.filter(function (id) { return attend(id, m.id); }).map(prenom); row(tr(m.l), l.length ? listeEt(l) : tt("Personne", "Ninguém")); return; }
        corps += '<div class="sous"><h4>' + esc(tr(m.l)) + "</h4>" + (m.d ? '<p class="aide">' + esc(tr(m.d)) + "</p>" : "") + (P.length > 1 ? '<div class="indic">' + tt("Plusieurs réponses possibles", "Várias respostas possíveis") + "</div>" : "") + '<div class="choix ligne">' +
          P.map(function (id) { var on = momOn(id, m.id); return '<label class="opt case' + (on ? " on" : "") + '"><input type="checkbox" data-mom="' + id + "|" + m.id + '"' + (on ? " checked" : "") + '><span class="marq"></span><span class="lib">' + nm(id) + "</span></label>"; }).join("") + "</div></div>";
      });
      if (MODE === "form") {
        P.forEach(function (id) {
          if (!aucunMoment(id)) return;
          if (id === "inv") { notes += note("inv0", tt("Nous remarquons que vous n'avez retenu aucun moment. Pourriez-vous nous indiquer ceux auxquels vous assisterez ?", "Reparamos que não assinalou nenhum momento. Poderia indicar-nos aqueles em que estará presente?")); req(tt("au moins un moment pour vous", "pelo menos um momento para si"), function () { return !aucunMoment("inv"); }, "q_detail"); return; }
          notes += note("abs_" + id, tt("Nous remarquons que " + nm(id) + " ne participera à aucun moment. Faut-il comprendre que " + nm(id) + " ne sera pas des nôtres ?", "Reparamos que " + nm(id) + " não participará em nenhum momento. Devemos entender que " + nm(id) + " não virá?") +
            '<div class="sous-note">' + radio("absent." + id, [{ v: "oui", l: tt("Oui", "Sim") }, { v: "non", l: tt("Non, je corrige", "Não, vou corrigir") }], { ligne: true, need: tt("votre réponse pour ", "a sua resposta sobre ") + prenom(id) }) + "</div>");
          if (S.absent[id] === "non") req(tt("au moins un moment pour ", "pelo menos um momento para ") + prenom(id), function () { return !aucunMoment(id); }, "q_detail");
        });
        MOMENTS.forEach(function (m) { presents().filter(function (id) { return role(id) === "enf" && (ageDe(id) == null || ageDe(id) < 18) && attend(id, m.id); }).forEach(function (e) {
          if (adultes().some(function (a) { return attend(a, m.id); })) return;
          notes += note("seul_" + e + m.id, tt("Nous remarquons qu'aucun adulte de votre foyer n'accompagnerait " + nm(e) + " : " + esc(tr(m.l)).toLowerCase() + ". Pourriez-vous nous préciser qui l'accompagnera ?", "Reparamos que nenhum adulto do seu agregado acompanharia " + nm(e) + ": " + esc(tr(m.l)).toLowerCase() + ". Poderia indicar-nos quem o fará?") + txt("seulMoment." + e + "_" + m.id, { req: true, need: tt("l'adulte qui accompagnera ", "o adulto que acompanhará ") + prenom(e) }));
        }); });
      } else Object.keys(S.seulMoment).forEach(function (k) { var x = k.split("_"); if (attend(x[0], x[1]) && !adultes().some(function (a) { return attend(a, x[1]); })) row(tt("Accompagnement de ", "Acompanhamento de ") + prenom(x[0]), S.seulMoment[k]); });
      return h + q("detail", tt("Pourriez-vous nous indiquer les moments auxquels chacun assistera ?", "Poderia indicar-nos os momentos em que cada pessoa estará presente?"), "", corps, notes);
    }
    function etVoyage() {
      var modes = [{ v: "avion", l: tt("Avion", "Avião") }, { v: "train", l: tt("Train", "Comboio") }, { v: "voiture", l: tt("Voiture", "Carro") }, { v: "taxi", l: tt("Taxi ou chauffeur", "Táxi ou motorista") }, PASENCORE()];
      var jours = (CFG.jours || []).map(function (j) { return { v: j.v, l: tr(j.l) }; });
      function bloc(sens) {
        var p = "v." + sens, x = get(p) || {}, arr = sens === "aller", h = "";
        var suf = arr ? tt(" d'arrivée", " de chegada") : tt(" de départ", " de partida");
        h += radio(p + ".mode", modes, { need: arr ? tt("votre moyen de transport à l'aller", "o seu meio de transporte à ida") : tt("votre moyen de transport au retour", "o seu meio de transporte no regresso"), r: arr ? tt("Arrivée", "Chegada") : tt("Départ", "Partida"), attente: function (v) { return v === "inconnu"; } });
        if (x.mode === "avion" || x.mode === "train") {
          h += txt(p + ".lieu", { label: x.mode === "avion" ? (arr ? tt("Dans quel aéroport arriverez-vous ?", "Em que aeroporto chegará?") : tt("De quel aéroport repartirez-vous ?", "De que aeroporto partirá?")) : (arr ? tt("Dans quelle gare arriverez-vous ?", "Em que estação chegará?") : tt("De quelle gare repartirez-vous ?", "De que estação partirá?")), req: true, need: x.mode === "avion" ? tt("l'aéroport", "o aeroporto") : tt("la gare", "a estação"), r: (x.mode === "avion" ? tt("Aéroport", "Aeroporto") : tt("Gare", "Estação")) + suf });
          h += txt(p + ".numero", { label: x.mode === "avion" ? tt("Numéro de vol", "Número do voo") : tt("Numéro du train", "Número do comboio"), r: (x.mode === "avion" ? tt("Vol", "Voo") : tt("Train", "Comboio")) + suf });
        }
        if (x.mode && x.mode !== "inconnu") {
          if (jours.length) h += sel(p + ".date", jours, { label: tt("Date", "Data"), req: true, need: arr ? tt("la date d'arrivée", "a data de chegada") : tt("la date de départ", "a data de partida"), r: tt("Date", "Data") + suf });
          h += checks(p, [{ v: "heureInconnue", l: tt("Je ne connais pas encore l'horaire", "Ainda não sei o horário") }], { sansIndic: true, r: tt("Horaire", "Horário") + suf });
          if (!x.heureInconnue) h += heure(p + ".heure", { label: arr ? tt("Heure d'arrivée", "Hora de chegada") : tt("Heure de départ", "Hora de partida"), need: arr ? tt("l'heure d'arrivée", "a hora de chegada") : tt("l'heure de départ", "a hora de partida"), r: tt("Heure", "Hora") + suf });
        }
        return h;
      }
      return q("aller", tt("Afin d'organiser au mieux votre arrivée, comment prévoyez-vous de nous rejoindre ?", "Para organizarmos da melhor forma a sua chegada, como prevê vir ter connosco?"), presents().length > 1 ? tt("Pour l'ensemble de votre foyer.", "Para todo o seu agregado.") : "", bloc("aller")) +
        q("retour", tt("Et pour votre départ ?", "E para a sua partida?"), "", bloc("retour"));
    }
    function etHeberg() {
      var P = presents(), autres = P.filter(function (id) { return id !== "inv"; }), h = "";
      if (choixLieu) {
        var opts = HEB.lieux.map(function (l) { return { v: l, l: l }; }).concat([{ v: "propres", l: tt("Par mes propres moyens", "Pelos meus próprios meios") }, PASENCORE()]);
        return q("lieu", tt("Où séjournerez-vous ?", "Onde ficará alojado?"), "", radio("heb.lieu", opts, { need: tt("votre lieu de séjour", "o seu alojamento"), r: tt("Hébergement", "Alojamento"), attente: function (v) { return v === "inconnu"; } }));
      }
      var lieu = FOY.lieu || HEB.lieu || tt("le domaine", "o domaine");
      var texte = tt(MARIES() + " ont le plaisir de vous recevoir " + aLieu(lieu) + " pour " + tr(HEB.nuits) + ".", MARIES() + " têm o prazer de lhe oferecer a estadia em " + lieu + " na " + tr(HEB.nuits) + ".");
      if (autres.length) texte += " " + tt("Cette attention s'étend à " + listeEt(autres.map(nm)) + ".", "Esta atenção estende-se a " + listeEt(autres.map(nm)) + ".");
      h += info(texte);
      var opts2 = [{ v: "oui", l: tt("Oui, avec plaisir", "Sim, com todo o gosto") }];
      if (autres.length) opts2.push({ v: "partiel", l: tt("Oui, mais pas toutes les personnes de mon foyer", "Sim, mas não todas as pessoas do meu agregado") });
      opts2.push({ v: "non", l: tt("Je vous remercie, mais je ne séjournerai pas sur place", "Agradeço, mas não pernoitarei no local"), rl: tt("Ne séjournera pas sur place", "Não pernoitará no local") }, PASENCORE());
      if (S.heb.sejour === "partiel" && !autres.length) S.heb.sejour = undefined;
      var corps = radio("heb.sejour", opts2, { need: tt("votre réponse sur votre séjour", "a sua resposta sobre a estadia"), r: tt("Séjour sur place", "Estadia no local"), attente: function (v) { return v === "inconnu"; } });
      if (S.heb.sejour === "partiel") corps += '<div class="champ"><label>' + tt("Qui séjournera sur place ?", "Quem pernoitará no local?") + "</label></div>" + checks("heb.qui", P.map(function (id) { return { v: id, l: prenom(id), html: nm(id) }; }), { ligne: true, min1: true, need: tt("les personnes qui séjourneront sur place", "as pessoas que pernoitarão no local"), r: tt("Séjourneront sur place", "Pernoitarão no local") });
      if (MODE === "form" && S.heb.sejour === "inconnu") corps += '<p class="aide">' + tt("Nous gardons votre chambre jusqu'au " + tr(CFG.reponseAvant) + ".", "Guardaremos o seu quarto até " + tr(CFG.reponseAvant) + ".") + "</p>";
      h += q("sejour", tt("Séjournerez-vous sur place ?", "Pernoitará no local?"), "", corps);
      var dorment = dormeurs();
      if (MODE === "form") dorment.forEach(function (id) {
        if (!MOMENTS.length || servi(id)) return;
        var cle = "dort_" + id;
        if (!ack(cle, tt("la confirmation du séjour de ", "a confirmação da estadia de ") + prenom(id), "1"))
          h += note(cle, id === "inv" ? tt("Nous remarquons que vous séjournerez sur place sans assister à la réception. Pourriez-vous nous le confirmer ?", "Reparamos que pernoitará no local sem estar presente na receção. Poderia confirmar-nos?") : tt("Nous remarquons que " + nm(id) + " séjournera sur place sans assister à la réception. Pourriez-vous nous le confirmer ?", "Reparamos que " + nm(id) + " pernoitará no local sem estar presente na receção. Poderia confirmar-nos?"),
            '<button class="btn petit clair" data-ack="' + cle + '" data-sig="1">' + tt("Je le confirme", "Confirmo") + '</button><button class="btn petit clair" data-aller="q_sejour">' + tt("Je corrige", "Vou corrigir") + "</button>");
      });
      if (dorment.length && HEB.acces) h += q("arrivee", tt("À quelle heure pensez-vous arriver sur place ?", "A que horas prevê chegar ao local?"), tt("Afin que l'on vous y accueille.", "Para que o possamos receber."), checks("heb", [{ v: "heureInconnue", l: tt("Je ne connais pas encore l'horaire", "Ainda não sei o horário") }], { sansIndic: true, r: tt("Horaire", "Horário") }) + (S.heb.heureInconnue ? "" : heure("heb.heure", { label: tt("Heure d'arrivée", "Hora de chegada"), need: tt("votre heure d'arrivée", "a sua hora de chegada"), r: tt("Arrivée sur place", "Chegada ao local") })));
      if (dorment.length) h += q("hebPrecision", tt("Un détail à nous signaler pour votre séjour ?", "Algum pormenor a assinalar para a sua estadia?"), "", txt("heb.precision", { area: true, ph: tt("Un accès sans marches, des lits séparés…", "Um acesso sem degraus, camas separadas…"), r: tt("Précision pour le séjour", "Pormenor para a estadia") }), "", true);
      return h + lienSite("hebergement", tt("Le lieu et ses alentours", "O local e arredores"));
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
    function dormeurs() { var P = presents(); return S.heb.sejour === "oui" ? P : S.heb.sejour === "partiel" ? P.filter(function (id) { return (S.heb.qui || {})[id]; }) : []; }
    function etDeplac() {
      var T = CFG.trajets || [], n = presents().length;
      var opts = T.map(function (t) { return { v: t.id, l: tr(t.l) }; }).concat([{ v: "aucun", l: tt("Aucun, je me déplacerai par mes propres moyens", "Nenhum, deslocar-me-ei pelos meus próprios meios"), solo: true }]);
      var corps = checks("dep.trajets", opts, { min1: true, need: tt("votre choix de trajets", "a sua escolha de trajetos"), r: tt("Trajets", "Trajetos") });
      T.forEach(function (t) { if (!(S.dep.trajets || {})[t.id]) return; var pl = []; for (var i = 1; i <= Math.max(1, n); i++) pl.push({ v: String(i), l: String(i) }); corps += sel("dep.places." + t.id, pl, { label: tt("Combien de places pour : ", "Quantos lugares para: ") + esc(tr(t.l)) + " ?", req: true, need: tt("le nombre de places", "o número de lugares"), r: T.length > 1 ? tt("Places", "Lugares") + " · " + tr(t.l) : tt("Places", "Lugares") });
        if ((t.retours || []).length) corps += sel("dep.retour." + t.id, t.retours.map(function (h) { return { v: h, l: h }; }).concat([{ v: "sans", l: tt("Je ne prendrai pas le retour", "Não utilizarei o regresso") }]), { label: tt("Retour vers ", "Regresso para ") + esc(t.de || "") + tt(" : à quelle heure ?", ": a que horas?"), req: true, need: tt("l'heure de votre retour", "a hora do seu regresso"), r: T.length > 1 ? tt("Retour", "Regresso") + " · " + tr(t.l) : tt("Heure du retour", "Hora do regresso") }); });
      return q("trajets", tt("Afin de faciliter vos déplacements, " + MARIES() + " ont prévu plusieurs trajets. Lesquels souhaiteriez-vous emprunter ?", "Para facilitar as suas deslocações, " + MARIES() + " previram vários trajetos. Quais deseja utilizar?"), "", corps);
    }
    var REGIMES = [{ v: "veg", fr: "Végétarien", pt: "Vegetariano", veg: true }, { v: "vegan", fr: "Végétalien", pt: "Vegano", veg: true }, { v: "porc", fr: "Sans porc", pt: "Sem carne de porco" }, { v: "alcool", fr: "Sans alcool", pt: "Sem álcool" }, { v: "halal", fr: "Halal", pt: "Halal" }, { v: "casher", fr: "Casher", pt: "Kosher" }, { v: "gluten", fr: "Sans gluten", pt: "Sem glúten" }, { v: "lactose", fr: "Sans lactose", pt: "Sem lactose" }, { v: "coque", fr: "Allergie aux fruits à coque", pt: "Alergia a frutos de casca rija", allergie: true }, { v: "arachide", fr: "Allergie aux arachides", pt: "Alergia ao amendoim", allergie: true }, { v: "mer", fr: "Allergie aux poissons et fruits de mer", pt: "Alergia a peixe e marisco", allergie: true, bad: /poisson|peixe|fish/i }, { v: "autre", fr: "Autre", pt: "Outro" }];
    function etTable() {
      var P = presents(), auDiner = (CFG.plats || []).length ? P.filter(dine) : [], servis = P.filter(servi), h = "";
      var concerne = function (id) { return S.table.regime === "oui" && (servis.length === 1 || (S.table.qui || {})[id]); };
      var menuEnfant = function (id) { return role(id) === "enf" && CFG.ageMenu && ageDe(id) != null && ageDe(id) < CFG.ageMenu; };
      if (auDiner.length) {
        var corps = "", avecChoix = auDiner.filter(function (id) { return !menuEnfant(id); });
        auDiner.forEach(function (id) {
          if (role(id) === "enf" && ageDe(id) === 0) { row(tt("Plat", "Prato") + " · " + prenom(id), tt("Nourrisson", "Bebé")); return; }
          if (menuEnfant(id)) { if (MODE === "form") corps += '<div class="sous"><p>' + tt("Un menu enfant sera servi à " + nm(id) + ".", "Será servido um menu infantil a " + nm(id) + ".") + "</p></div>"; else row(tt("Plat", "Prato") + " · " + prenom(id), tt("Menu enfant", "Menu infantil")); return; }
          var ent = avecChoix.length > 1 ? (id === "inv" ? tt("Pour vous", "Para si") : tt("Et pour ", "E para ") + nm(id) + " ?") : "";
          var R = (S.table.reg || {})[id] || {}, veg = concerne(id) && REGIMES.some(function (r) { return r.veg && R[r.v]; });
          var x = (MODE === "form" && ent ? "<h4>" + ent + "</h4>" : "") + radio("table.plat." + id, CFG.plats.map(function (p) { return { v: p.v, l: tr(p.l) }; }), { ligne: true, need: tt("le plat de ", "o prato de ") + (id === "inv" ? tt("votre choix", "sua escolha") : prenom(id)), r: tt("Plat", "Prato") + " · " + prenom(id) });
          if (CFG.cuisson && /viande|carne|boeuf|bœuf|agneau|veau/i.test(String(((S.table.plat || {})[id]) || "") + " " + (CFG.plats.filter(function (p) { return p.v === (S.table.plat || {})[id]; })[0] || { l: "" }).l.fr)) x += '<div class="champ"><label>' + tt("Quelle cuisson préférez-vous ?", "Que ponto de cozedura prefere?") + "</label></div>" + radio("table.cuisson." + id, [{ v: "Bleue", l: tt("Bleue", "Muito mal passada") }, { v: "Saignante", l: tt("Saignante", "Mal passada") }, { v: "À point", l: tt("À point", "Média") }, { v: "Bien cuite", l: tt("Bien cuite", "Bem passada") }], { ligne: true, need: tt("la cuisson de ", "o ponto de ") + prenom(id), r: tt("Cuisson", "Cozedura") + " · " + prenom(id) });
          if (veg && MODE === "form") x += '<p class="aide-champ">' + tt("Un plat végétarien sera préparé pour " + nm(id) + ".", "Será preparado um prato vegetariano para " + nm(id) + ".") + "</p>";
          corps += '<div class="sous" id="plat_' + id + '">' + x + "</div>";
        });
        h += q("plats", (REPAS ? tt(tr(REPAS.l) + " : le chef propose ", tr(REPAS.l) + ": o chef propõe ") : tt("Le chef propose ", "O chef propõe ")) + esc(listeEt(CFG.plats.map(function (p) { return tr(p.l).toLowerCase(); }))) + tt(". Lequel aurait votre préférence ?", ". Qual prefere?"), "", corps);
      }
      var c2 = radio("table.regime", [{ v: "non", l: tt("Non", "Não") }, { v: "oui", l: tt("Oui", "Sim") }], { ligne: true, need: tt("votre réponse sur les régimes et allergies", "a sua resposta sobre regimes e alergias"), r: tt("Régime ou allergie", "Regime ou alergia") });
      if (S.table.regime === "oui") {
        var liste = servis;
        if (servis.length > 1) { c2 += '<div class="champ"><label>' + tt("Qui est concerné ?", "Quem está abrangido?") + "</label></div>" + checks("table.qui", servis.map(function (id) { return { v: id, l: prenom(id), html: nm(id) }; }), { ligne: true, min1: true, need: tt("les personnes concernées", "as pessoas abrangidas"), r: tt("Personnes concernées", "Pessoas abrangidas") }); liste = servis.filter(function (id) { return (S.table.qui || {})[id]; }); }
        liste.forEach(function (id) {
          c2 += '<div class="sous">' + (MODE === "form" && servis.length > 1 ? "<h4>" + nm(id) + "</h4>" : "") + checks("table.reg." + id, REGIMES.map(function (r) { return { v: r.v, l: r[LANG] }; }), { ligne: true, min1: true, need: tt("le régime ou l'allergie de ", "o regime ou a alergia de ") + prenom(id), r: tt("Régime", "Regime") + " · " + prenom(id) });
          var R = (S.table.reg || {})[id] || {};
          if (R.autre) c2 += txt("table.regAutre." + id, { label: tt("Pourriez-vous préciser ?", "Poderia especificar?"), req: true, need: tt("la précision du régime de ", "o pormenor do regime de ") + prenom(id), r: tt("Précision", "Pormenor") + " · " + prenom(id) });
          if (REGIMES.some(function (r) { return r.allergie && R[r.v]; })) c2 += '<div class="champ"><label>' + tt("S'agit-il d'une allergie sévère ?", "Trata-se de uma alergia grave?") + "</label></div>" + radio("table.severe." + id, [{ v: "oui", l: tt("Oui", "Sim") }, { v: "non", l: tt("Non", "Não") }], { ligne: true, need: tt("la sévérité de l'allergie de ", "a gravidade da alergia de ") + prenom(id), r: tt("Allergie sévère", "Alergia grave") + " · " + prenom(id) });
          c2 += "</div>";
        });
      }
      h += q("regime", servis.length > 1 ? tt("Afin que chacun soit servi en toute sérénité, l'une des personnes de votre foyer suit-elle un régime particulier ou présente-t-elle une allergie ?", "Para que todos sejam servidos com toda a tranquilidade, alguma pessoa do seu agregado segue um regime alimentar especial ou tem alguma alergia?") : tt("Afin de vous servir en toute sérénité, suivez-vous un régime particulier ou présentez-vous une allergie ?", "Para que tudo lhe seja servido com toda a tranquilidade, segue algum regime alimentar especial ou tem alguma alergia?"), "", c2);
      if (MODE === "form") auDiner.forEach(function (id) {
        var R = (S.table.reg || {})[id] || {}, pl = CFG.plats.filter(function (p) { return p.v === (S.table.plat || {})[id]; })[0];
        if (!(concerne(id) && R.mer && pl && /poisson|peixe/i.test(pl.l.fr || pl.l))) return;
        var cle = "conf_" + id;
        if (!ack(cle, tt("votre réponse sur le plat de ", "a sua resposta sobre o prato de ") + prenom(id), "mer"))
          h += note(cle, id === "inv" ? tt("Nous remarquons que vous avez choisi le poisson, alors que vous nous indiquez une allergie aux poissons et fruits de mer. Souhaitez-vous modifier votre choix ?", "Reparamos que escolheu peixe, embora nos indique uma alergia a peixe e marisco. Deseja alterar a sua escolha?") : tt("Nous remarquons que " + nm(id) + " a choisi le poisson, alors que vous nous indiquez une allergie aux poissons et fruits de mer. Souhaitez-vous modifier ce choix ?", "Reparamos que " + nm(id) + " escolheu peixe, embora nos indique uma alergia a peixe e marisco. Deseja alterar essa escolha?"),
            '<button class="btn petit clair" data-aller="plat_' + id + '">' + tt("Modifier le choix", "Alterar a escolha") + '</button><button class="btn petit clair" data-ack="' + cle + '" data-sig="mer">' + tt("Conserver ce choix", "Manter a escolha") + "</button>");
      });
      return h + q("chef", tt("Une précision pour le chef ?", "Algum pormenor para o chef?"), "", txt("table.precision", { area: true, r: tt("Précision pour le chef", "Pormenor para o chef") }), "", true);
    }
    function etConclure() {
      var h = "";
      if (CFG.conciergerie) {
        var corps = radio("fin.concierge", [{ v: "tout", l: tt("Oui, pour l'ensemble de ma venue", "Sim, para toda a minha vinda") }, { v: "partie", l: tt("Oui, pour une partie", "Sim, para uma parte") }, { v: "non", l: tt("Non, merci", "Não, agradeço") }], { need: tt("votre réponse sur l'organisation de votre venue", "a sua resposta sobre a organização da sua vinda"), r: tt("Aide pour venir", "Ajuda para vir") });
        if (S.fin.concierge === "partie") {
          var opts = [{ v: "aller", l: tt("Le trajet jusqu'au mariage", "A viagem até ao casamento") }];
          if (MOMENTS.length > 1) opts.push({ v: "entre", l: tt("Les trajets entre les lieux", "As deslocações entre os locais") });
          opts.push({ v: "retour", l: tt("Le retour après la soirée", "O regresso depois da festa") });
          if (!logeOffert || S.heb.sejour === "non") opts.push({ v: "hotel", l: tt("Un hébergement à proximité", "Um alojamento nas proximidades") });
          opts.push({ v: "autre", l: tt("Autre chose", "Outra coisa") });
          Object.keys(S.fin.pour || {}).forEach(function (k) { if (!opts.some(function (o) { return o.v === k; })) delete S.fin.pour[k]; });
          corps += '<div class="champ"><label>' + tt("Pour quoi pouvons-nous vous aider ?", "Em que podemos ajudar?") + "</label></div>" + checks("fin.pour", opts, { min1: true, need: tt("ce pour quoi nous pouvons vous aider", "aquilo em que podemos ajudar"), r: tt("Aide demandée", "Ajuda pedida") });
          if ((S.fin.pour || {}).autre) corps += txt("fin.pourAutre", { label: tt("Pourriez-vous préciser ?", "Poderia especificar?"), req: true, need: tt("la précision de votre demande", "o pormenor do seu pedido"), r: tt("Précision", "Pormenor") });
        }
        if (MODE === "form" && (S.fin.concierge === "tout" || S.fin.concierge === "partie")) corps += '<p class="aide">' + tt("Nous revenons vers vous très rapidement.", "Entraremos em contacto consigo muito em breve.") + "</p>";
        h += q("concierge", tt("Souhaitez-vous que nous vous aidions à organiser votre venue ?", "Deseja ajuda para organizar a sua vinda?"), tt("Notre conciergerie s'en charge avec plaisir.", "O nosso serviço de concierge trata de tudo com todo o gosto."), corps);
      }
      h += q("attention", tt("Une attention particulière à nous signaler ?", "Alguma atenção especial a assinalar?"), "", txt("fin.attention", { area: true, ph: tt("Une mobilité réduite, un fauteuil à prévoir…", "Mobilidade reduzida, uma cadeira de rodas…"), r: tt("Attention particulière", "Atenção especial") }), "", true);
      h += q("mot", tt("Un mot pour " + MARIES() + " ?", "Uma palavra para " + MARIES() + "?"), tt("Ils seront heureux de vous lire.", "Terão muito gosto em ler a sua mensagem."), txt("fin.mot", { area: true, r: tt("Votre mot", "A sua mensagem") }), "", true);
      if (CFG.engagement) h += q("engagement", tt("Afin que chacun profite pleinement de chaque moment, nous vous remercions de bien vouloir respecter les horaires du programme.", "Para que todos aproveitem plenamente cada momento, agradecemos que respeite os horários do programa."), "", checks("fin", [{ v: "engagement", l: tt("Je m'engage à respecter les horaires", "Comprometo-me a respeitar os horários") }], { sansIndic: true, min1: true, need: tt("votre engagement sur les horaires", "o seu compromisso com os horários"), r: tt("Horaires", "Horários") }));
      return h + lienSite("programme", tt("Le programme de la journée", "O programa do dia"));
    }
    function collecte() {
      var sM = MODE, sR = REQ; MODE = "recap"; ROWS = [];
      var secs = ordre().filter(function (k) { return ["accueil", "recap", "fin"].indexOf(k) < 0; });
      secs.forEach(function (k) { SECTION = k; ETAPES[k].rendu(); });
      MODE = sM; REQ = sR;
      return { secs: secs.map(function (k) { return { k: k, t: ETAPES[k].t() }; }), rows: ROWS.filter(function (r) { return r.val !== "" && r.label !== ""; }) };
    }
    function aConfirmer() {
      var L = [];
      if (S.acc.choix === "autre") L.push(tt("la personne qui vous accompagnera, soumise à l'accord des mariés", "a pessoa que virá consigo, sujeita à aprovação dos noivos"));
      if (S.acc.choix === "inconnu" || S.nbAcc === "inconnu") L.push(tt("la venue de votre accompagnant", "a vinda do seu acompanhante"));
      if (accIds().some(function (id) { return (fiche(id) || {}).plusTard; })) L.push(tt("un nom à nous communiquer", "um nome a indicar-nos"));
      if (S.nbEnf === "inconnu") L.push(tt("la venue de vos enfants", "a vinda dos seus filhos"));
      if (logeOffert && S.heb.sejour === "inconnu") L.push(tt("votre séjour sur place", "a sua estadia no local"));
      if (choixLieu && S.heb.lieu === "inconnu") L.push(tt("votre hébergement", "o seu alojamento"));
      if (CFG.arrivees && ((S.v.aller || {}).mode === "inconnu" || (S.v.retour || {}).mode === "inconnu" || (S.v.aller || {}).heureInconnue || (S.v.retour || {}).heureInconnue)) L.push(tt("les horaires de votre venue", "os horários da sua vinda"));
      return L;
    }
    function etRecap() {
      var c = collecte(), h = "<h2>" + tt("Le récapitulatif", "O resumo") + '</h2><p class="chapeau">' + tt("Voici le récapitulatif de vos réponses. Nous vous remercions de bien vouloir le relire avant de nous le transmettre.", "Eis o resumo das suas respostas. Agradecemos que o releia antes de no-lo enviar.") + "</p>";
      var L = aConfirmer(); if (L.length) h += '<div class="info">' + tt("Reste à confirmer : ", "Falta confirmar: ") + esc(listeEt(L)) + ".</div>";
      c.secs.forEach(function (s) {
        var rs = c.rows.filter(function (r) { return r.section === s.k; });
        h += '<div class="recap-sec"><header><b>' + esc(s.t) + '</b><button class="lien" data-modifier="' + s.k + '">' + tt("Modifier", "Alterar") + "</button></header>" + (rs.length ? rs.map(function (r) { return '<div class="rr"><span>' + esc(r.label) + "</span><b>" + esc(r.val) + (r.attente ? '<span class="attente">' + tt("à confirmer", "a confirmar") + "</span>" : "") + "</b></div>"; }).join("") : '<div class="rr"><span>' + tt("Aucune précision", "Sem pormenores") + "</span><b></b></div>") + "</div>";
      });
      return h + '<p class="fin-recap">' + tt("Merci d'avoir pris le temps de nous répondre. Le site de votre mariage reste à votre disposition, et nous reviendrons vers vous si besoin.", "Agradecemos o tempo que dedicou a responder-nos. O site do casamento continua à sua disposição, e entraremos em contacto consigo se for necessário.") + "</p>";
    }
    function etFin() {
      var p = esc(S.coord.prenom);
      if (S.presence === "non") return '<div class="carte-accueil"><div class="marque">Yes I Do</div><h1>' + tt("Merci " + p + " de nous avoir répondu.", p + ", agradecemos a sua resposta.") + "</h1><p>" + tt(MARIES() + " seront désolés de ne pas vous compter parmi eux" + (String(S.motNon || "").trim() ? ", et votre mot leur sera transmis" : "") + ".", MARIES() + " lamentarão não contar com a sua presença" + (String(S.motNon || "").trim() ? ", e a sua mensagem ser-lhes-á transmitida" : "") + ".") + '</p><p class="doux">' + tt("Si vos projets venaient à changer d'ici le " + tr(CFG.modifJusqu) + ", ce même lien vous permettra de nous le faire savoir.", "Se os seus planos mudarem até " + tr(CFG.modifJusqu) + ", este mesmo link permitir-lhe-á informar-nos.") + "</p></div>";
      if (S.presence === "inconnu") return '<div class="carte-accueil"><div class="marque">Yes I Do</div><h1>' + tt("Merci " + p + ".", p + ", agradecemos a sua resposta.") + "</h1><p>" + tt("Nous attendons votre réponse avant le " + tr(CFG.reponseAvant) + ". Ce même lien reste à votre disposition.", "Aguardamos a sua resposta até " + tr(CFG.reponseAvant) + ". Este mesmo link continua à sua disposição.") + "</p></div>";
      return '<div class="carte-accueil"><div class="marque">Yes I Do</div><h1>' + tt("Merci " + p + ".", p + ", agradecemos a sua resposta.") + "</h1><p>" + tt(MARIES() + " seront ravis de vous compter parmi eux.", MARIES() + " ficarão muito felizes por contar com a sua presença.") + "</p><p>" + tt("Vous allez recevoir le récapitulatif de vos réponses dans quelques instants. Nous serons heureux de répondre à toutes vos questions, et reviendrons vers vous si besoin.", "Dentro de instantes receberá o resumo das suas respostas. Teremos todo o gosto em responder às suas perguntas, e entraremos em contacto consigo se for necessário.") + '</p><p class="doux">' + tt("Vos réponses restent modifiables jusqu'au " + tr(CFG.modifJusqu) + ", depuis ce même lien.", "As suas respostas podem ser alteradas até " + tr(CFG.modifJusqu) + ", através deste mesmo link.") + "</p></div>";
    }

    /* ---------- lecture pour le serveur et l'équipe ---------- */
    function manquantsEtape(k) { MODE = "form"; REQ = []; SECTION = k; ETAPES[k].rendu(); var vus = {}; return REQ.filter(function (r) { if (r.ok() || vus[r.label]) return false; vus[r.label] = 1; return true; }).map(function (r) { return r.label; }); }
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
      if (S.acc.choix === "autre") s.push("Accompagnant remplacé : soumettre aux mariés");
      if (logeOffert && S.heb.sejour === "non") s.push("Hébergement offert décliné : à réattribuer avec les mariés");
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
      (CFG.trajets || []).forEach(function (t) { if ((S.dep.trajets || {})[t.id]) { o["nav_" + t.id + "_aller"] = String((S.dep.places || {})[t.id] || ""); if ((S.dep.retour || {})[t.id]) o["nav_" + t.id + "_retour"] = S.dep.retour[t.id] === "sans" ? "Pas de navette" : S.dep.retour[t.id]; } else o["nav_" + t.id + "_aller"] = "Non merci"; });
      var trajet = function (x) { x = x || {}; if (!x.mode) return null; if (x.mode === "inconnu") return "À confirmer"; var md = { avion: "Vol", train: "Train", voiture: "Voiture", taxi: "Taxi ou chauffeur" }[x.mode]; var j = (CFG.jours || []).filter(function (d) { return d.v === x.date; })[0]; return [md + (x.numero ? " " + x.numero : ""), x.lieu || "", j ? j.l.fr : "", x.heureInconnue ? "horaire à confirmer" : x.heure && x.heure.h ? x.heure.h + " h " + x.heure.m : ""].filter(Boolean).join(", "); };
      if (CFG.arrivees) { o.arrivee = trajet(S.v.aller); o.depart = trajet(S.v.retour); }
      if (logeOffert && S.heb.sejour !== "non") o.hebergement = FOY.lieu || HEB.lieu || null;
      if (choixLieu && S.heb.lieu === "inconnu") delete o.hebergement;
      return o;
    }

    /* ---------- dessin et événements (navigateur) ---------- */
    var EL = null, HOOKS = {};
    function pied(et) { var ord = ordre(), dern = S.step === "recap", non = S.step === "presence" && (S.presence === "non" || S.presence === "inconnu"); return '<div class="manquant-box"></div><div class="nav"><button class="lien" data-nav="retour">' + tt("Retour", "Voltar") + "</button>" + (S.fromRecap && !dern ? '<button class="btn clair" data-nav="recap">' + tt("Revenir au récapitulatif", "Voltar ao resumo") + "</button>" : "") + '<button class="btn" data-nav="' + (dern || non ? "envoyer" : "suivant") + '">' + (dern ? tt("Transmettre mes réponses", "Enviar as minhas respostas") : non ? tt("Transmettre ma réponse", "Enviar a minha resposta") : tt("Continuer", "Continuar")) + "</button></div>"; }
    function render(keep) {
      if (!EL) return; var y = keep ? (EL.scrollTop || window.scrollY) : 0; REQ = []; MODE = "form";
      var ord = ordre(); if (ord.indexOf(S.step) < 0) S.step = ord[0];
      var h = '<div class="marque">' + esc(tt("Mariage de ", "Casamento de ") + MARIES()) + "</div>";
      if (["accueil", "fin"].indexOf(S.step) < 0) { var vis = ord.filter(function (k) { return ["accueil", "fin"].indexOf(k) < 0; }); h += '<div class="etapes">' + vis.map(function (k, j) { return '<i class="' + (j <= vis.indexOf(S.step) ? "fait" : "") + '"></i>'; }).join("") + "</div>"; if (S.step !== "recap") h += "<h2>" + esc(ETAPES[S.step].t()) + "</h2>"; }
      SECTION = S.step; h += ETAPES[S.step].rendu();
      if (["accueil", "fin"].indexOf(S.step) < 0) h += pied();
      EL.innerHTML = elide(h); EL.setAttribute("lang", LANG);
      if (keep) { if (EL.scrollTop !== undefined && EL.scrollHeight > EL.clientHeight) EL.scrollTop = y; else window.scrollTo(0, y); }
    }
    function manquants() { var vus = {}; return REQ.filter(function (r) { if (r.ok() || vus[r.label]) return false; vus[r.label] = 1; return true; }); }
    function verifier() {
      EL.querySelectorAll(".manque").forEach(function (n) { n.classList.remove("manque"); });
      var m = manquants(), box = EL.querySelector(".manquant-box"); if (!m.length) { box.innerHTML = ""; return true; }
      box.innerHTML = '<div class="manquant">' + tt("Il nous manque encore : ", "Ainda nos falta: ") + esc(listeEt(m.map(function (x) { return x.label; }))) + ".</div>";
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
            if (HOOKS.envoyer) Promise.resolve(HOOKS.envoyer(S)).then(fin, function (e) { b.disabled = false; var box = el.querySelector(".manquant-box"); if (box) box.innerHTML = '<div class="manquant">' + esc((e && e.message) || tt("L'envoi n'a pas abouti. Merci de réessayer dans un instant.", "O envio não foi concluído. Tente novamente dentro de instantes.")) + "</div>"; });
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
