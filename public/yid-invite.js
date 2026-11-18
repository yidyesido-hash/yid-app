/* =====================================================================
   YES I DO · LE LIEN PERSONNEL DE L'INVITÉ, sur le site du mariage
   À poser une fois dans Squarespace (Paramètres, Avancé, Injection de
   code, pied de page) :
     <script src="https://invites.yidyesido.info/yid-invite.js" defer></script>
   Le lien envoyé à l'invité est l'adresse du site suivie de ?yid=JETON.
   Sans jeton, le script ne fait rien : le site reste tel quel.
   Avec jeton : « Le mariage de » devient « Bonjour Aïssa » (Bonsoir de 18 h
   à 4 h 30), une phrase d'invitation suit les prénoms des mariés, et le
   bouton de confirmation ouvre le formulaire personnel en plein écran.
   ===================================================================== */
(function () {
  if (window.YIDInvite) return; window.YIDInvite = true;
  var src = (document.currentScript && document.currentScript.src) || "";
  var API = (src ? src.replace(/\/yid-invite\.js.*$/, "") : "https://invites.yidyesido.info") + "/api/forms";
  var IMG = API.replace(/\/api\/forms$/, "") + "/img/";
  var jeton = (new URLSearchParams(location.search).get("yid") || "").toLowerCase();
  try { if (jeton) sessionStorage.setItem("yid", jeton); else jeton = sessionStorage.getItem("yid") || ""; } catch (e) {}
  if (!/^[a-z0-9]{12}$/.test(jeton)) return;

  var CSS = '\
.yi{--or:#B8956A;--encre:#141210;--creme:#FAF7F2;--trait:#E6E1DA;--doux:#6B655E;font-family:Inter,system-ui,sans-serif;color:var(--encre);text-align:left}\
.yi *{box-sizing:border-box;text-transform:none!important;letter-spacing:normal}\
.yi-sec{padding:56px 20px;background:var(--creme)}\
.yi-carte{max-width:620px;margin:0 auto;background:#fff;border:1px solid var(--trait);border-radius:28px;padding:36px 28px;box-shadow:0 30px 60px -40px rgba(20,18,16,.35)}\
.yi-k{font:600 11px/1 Inter,sans-serif;letter-spacing:.22em!important;text-transform:uppercase!important;color:var(--or)}\
.yi-sal{font:500 34px/1.15 "Cormorant Garamond",Georgia,serif;margin:14px 0 10px}\
.yi-acc{font:italic 400 21px/1.4 "Cormorant Garamond",Georgia,serif;color:#3A332C;margin:0}\
.yi-q{margin:26px 0 0}\
.yi-l{display:block;font:500 15px/1.4 Inter,sans-serif;margin:0 0 10px}\
.yi-aide{display:block;font:400 13px/1.5 Inter,sans-serif;color:var(--doux);margin:-4px 0 10px}\
.yi-opts{display:flex;flex-direction:column;gap:8px}\
.yi-opt{min-height:50px;padding:12px 18px;border:1px solid var(--trait);border-radius:16px;background:#fff;font:400 15px/1.3 Inter,sans-serif;color:var(--encre);text-align:left;cursor:pointer}\
.yi-opt[aria-pressed=true]{background:var(--encre);border-color:var(--encre);color:#fff}\
.yi input,.yi textarea{width:100%;min-height:50px;padding:12px 16px;border:1px solid var(--trait);border-radius:16px;font:400 15px/1.4 Inter,sans-serif;color:var(--encre);background:#fff}\
.yi textarea{min-height:100px;resize:vertical}\
.yi-enf{display:grid;grid-template-columns:1fr 92px;gap:8px;margin-bottom:8px}\
.yi-fixe{display:inline-block;padding:12px 18px;border-radius:16px;background:var(--creme);font:500 15px/1.3 Inter,sans-serif}\
.yi-btn{display:block;width:100%;min-height:56px;margin-top:30px;border:0;border-radius:28px;background:linear-gradient(160deg,#EBD6B0,#D4B07A);color:var(--encre);font:600 15px Inter,sans-serif;cursor:pointer}\
.yi-btn[disabled]{opacity:.6}\
.yi-err{color:#9B3B2E;font:400 14px/1.5 Inter,sans-serif;margin:12px 0 0;min-height:1em}\
.yi-merci{font:italic 400 22px/1.45 "Cormorant Garamond",Georgia,serif;margin:22px 0 0}\
.yi-lien{background:none;border:0;padding:0;margin-top:14px;font:500 13px Inter,sans-serif;color:var(--doux);text-decoration:underline;text-underline-offset:3px;cursor:pointer}\
.yi-plein{position:fixed;inset:0;z-index:10001;background:rgba(20,16,12,.55);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);overflow-y:auto;padding:24px 14px}.yi-plein .yi-carte{position:relative;margin:4vh auto}.yi-plein .yi-k{padding-right:48px}.yi-fermer{position:absolute;top:16px;right:16px;width:40px;height:40px;border-radius:20px;border:1px solid var(--trait);background:#fff;font:400 22px/1 Inter,sans-serif;color:var(--encre);cursor:pointer;padding:0}.yi-phrase{display:block;margin:14px auto 0;font-style:italic;font-weight:400;letter-spacing:.02em!important;text-transform:none!important;line-height:1.35}.yi-maisons{display:grid;gap:14px;grid-template-columns:repeat(auto-fill,minmax(240px,1fr))}.yi-maison{padding:20px 22px;border:1px solid var(--trait);border-radius:22px;background:rgba(255,255,255,.6)}.yi-mnom{font-family:"Cormorant Garamond",Georgia,serif;font-size:24px;line-height:1.15;margin-top:6px}.yi-pass{margin:24px 0 6px;padding:20px;border:1px solid var(--trait);border-radius:22px;text-align:center}.yi-pass img{display:block;margin:12px auto 0;width:200px;height:200px;image-rendering:pixelated}\
.yi-bulle{position:fixed;left:18px;bottom:18px;z-index:9999;width:58px;height:58px;border-radius:29px;border:0;background:#141210;box-shadow:0 14px 30px -10px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0}\
.yi-bulle img{width:30px}\
.yi-voile{position:fixed;inset:0;z-index:10000;background:rgba(20,18,16,.4);display:flex;align-items:flex-end;justify-content:center}\
.yi-feuille{width:min(480px,100%);margin:10px;background:#fff;border-radius:28px;padding:24px}\
.yi-p{display:flex;align-items:center;gap:14px;padding:12px 0;border-top:1px solid var(--trait)}\
.yi-p img{width:48px;height:48px;border-radius:24px;object-fit:cover;background:var(--creme)}\
.yi-p b{display:block;font:500 15px Inter,sans-serif}.yi-p a{font:400 13px Inter,sans-serif;color:var(--encre);margin-right:14px}\
';
  function el(t, cls, html){ var e = document.createElement(t); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function abs(u){ return u && u.charAt(0) === "/" ? API.replace(/\/api\/forms$/, "") + u : u; }
  function esc(s){ return String(s == null ? "" : s).replace(/[&<>"]/g, function(c){ return { "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c]; }); }

  function demarrer(){
    var st = el("style", null, CSS); document.head.appendChild(st);
    if (!document.querySelector('link[href*="Cormorant+Garamond"]')) { var f = el("link"); f.rel = "stylesheet"; f.href = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;1,400&family=Inter:wght@400;500;600&display=swap"; document.head.appendChild(f); }
    fetch(API + "?action=invite&yid=" + jeton).then(function(r){ return r.json(); }).then(function(d){ if (d && d.ok) poser(d); }).catch(function(){});
  }

  function salut(){ var h = new Date(), m = h.getHours() * 60 + h.getMinutes(); return m >= 270 && m < 1080 ? "Bonjour" : "Bonsoir"; }
  function feuilles(){ var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), out = [], n; while ((n = w.nextNode())) if (n.nodeValue.trim()) out.push(n); return out; }
  /* le haut du site : « Le mariage de » devient la salutation, la phrase d'invitation suit les prénoms */
  function accueillir(d){
    var T = feuilles(), k = -1;
    for (var i = 0; i < T.length; i++) if (/^\s*le mariage de\s*$/i.test(T[i].nodeValue)) { k = i; break; }
    if (k < 0) return false;
    var kick = T[k].parentNode; T[k].nodeValue = salut() + " " + d.appel + ",";
    var datee = null, dernier = null;
    for (var j = k + 1; j < T.length && j < k + 12; j++) { if (/\b20\d\d\b/.test(T[j].nodeValue)) { datee = T[j].parentNode; break; } dernier = T[j].parentNode; }
    if (!dernier) return true;
    var bloc = dernier.closest(".sqs-block-content, .sqs-html-content, h1, h2, h3, p") || dernier;
    var cs = getComputedStyle(dernier), ph = document.createElement("span");
    ph.className = "yi-phrase"; ph.textContent = "ont le plaisir de vous convier à leur mariage";
    ph.style.fontFamily = cs.fontFamily; ph.style.color = getComputedStyle(kick).color || cs.color; ph.style.fontSize = "clamp(17px, 4.6vw, 22px)";
    bloc.appendChild(ph);
    return true;
  }
  /* le bouton de confirmation du site ouvre le formulaire personnel en plein écran */
  function brancher(ouvrir){
    document.querySelectorAll("a, button").forEach(function(b){ if (!/confirm|rsvp|r\.s\.v\.p/i.test(b.textContent || "")) return; if (b.closest(".yi")) return;
      b.addEventListener("click", function(e){ e.preventDefault(); e.stopPropagation(); ouvrir(); }, true); });
  }
  /* les maisons partenaires en accord, posées dans le bloc <div data-yid="hebergement"></div> de la page Hébergement */
  function maisons(d){
    var zones = document.querySelectorAll('[data-yid="hebergement"]'); if (!zones.length || !d.maisons || !d.maisons.length) return;
    var html = d.maisons.map(function(x){ return '<div class="yi-maison"><div class="yi-k">' + esc(x.ville || "") + (x.etoiles ? ' · ' + x.etoiles + ' étoiles' : '') + '</div><div class="yi-mnom">' + esc(x.nom) + '</div>' + (x.tarif ? '<p class="yi-aide" style="margin:6px 0 0">Tarif réservé aux invités : ' + esc(x.tarif) + '</p>' : '') + (x.butoir ? '<p class="yi-aide" style="margin:2px 0 0">À réserver avant le ' + esc(new Date(x.butoir + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long" })) + '</p>' : '') + '</div>'; }).join("");
    for (var i = 0; i < zones.length; i++) { zones[i].classList.add("yi"); zones[i].innerHTML = '<div class="yi-maisons">' + html + '</div><p class="yi-aide" style="margin-top:14px">Pour réserver, indiquez votre choix dans votre réponse : nous transmettons votre demande à la maison, qui revient vers vous directement.</p>'; }
  }
  /* moteur v2 (méthode YID) : le formulaire composé pour ce foyer, servi par l'outil, dans la même fenêtre */
  function charger(src, ok){ var x = document.createElement("script"); x.src = src; x.onload = ok; document.head.appendChild(x); }
  function poser2(d){
    var base = API.replace(/\/api\/forms$/, ""), V = "?v=1.22.0";
    var css = el("link"); css.rel = "stylesheet"; css.href = base + "/formulaire/formulaire.css" + V; document.head.appendChild(css);
    var sec = el("div", "yi yi-plein"); sec.id = "yid-accueil"; sec.hidden = true; document.body.appendChild(sec);
    var carte = el("div", "yi-carte"); carte.style.padding = "0"; carte.style.overflow = "hidden"; sec.appendChild(carte);
    var zone = el("div"); carte.appendChild(zone);
    var x = el("button", "yi-fermer", "×"); x.type = "button"; x.setAttribute("aria-label", "Fermer"); carte.insertBefore(x, zone);
    var monte = false, fermer = function(){ sec.hidden = true; document.documentElement.style.overflow = ""; };
    x.onclick = fermer; sec.onclick = function(e){ if (e.target === sec) fermer(); };
    var ouvrir = function(){ sec.hidden = false; document.documentElement.style.overflow = "hidden";
      if (monte) return; monte = true;
      charger(base + "/formulaire/pays.js" + V, function(){ charger(base + "/formulaire/moteur.js" + V, function(){ charger(base + "/formulaire/page.js" + V, function(){
        window.YIDFormulaire.monter(zone, d, API, jeton, { etape: function(){ sec.scrollTop = 0; }, site: function(page){ fermer(); var a = document.querySelector('a[href*="' + page + '"]'); if (a) location.href = a.href; } });
      }); }); });
    };
    brancher(ouvrir);
    if (/[?&]yidouvrir=1/.test(location.search)) ouvrir();
  }
  function poser(d){
    accueillir(d); maisons(d);
    if (d.v === 2) return poser2(d);
    var sec = el("div", "yi yi-plein"); sec.id = "yid-accueil"; sec.hidden = true; document.body.appendChild(sec);
    var ouvrir = function(){ sec.hidden = false; document.documentElement.style.overflow = "hidden"; dessiner(false); };
    var fermer = function(){ sec.hidden = true; document.documentElement.style.overflow = ""; };
    sec.onclick = function(e){ if (e.target === sec) fermer(); };
    brancher(ouvrir);
    var R = {}; d.questions.forEach(function(q){ R[q.k] = q.v; });
    var carte = el("div", "yi-carte"); sec.appendChild(carte);
    var croix = function(){ var x = el("button", "yi-fermer", "×"); x.type = "button"; x.setAttribute("aria-label", "Fermer"); x.onclick = fermer; carte.insertBefore(x, carte.firstChild); };
    function visible(q){ if (!q.si) return true; var p = q.si.split(":"), k = p[0], i = p[1]; if (i === "*") return !!R[k]; var qq = d.questions.filter(function(z){ return z.k === k; })[0]; return qq && qq.o && R[k] === qq.o[+i]; }
    function dessiner(merci){
      var h = '<div class="yi-k">' + esc(d.couple) + (d.date ? " · " + new Date(d.date + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "") + '</div>' +
        '<div class="yi-sal">' + esc(salut() + " " + d.appel + ",") + '</div><p class="yi-acc">' + esc(d.accroche) + '</p>';
      if (merci || (d.deja && !carte._modif)) { h += '<p class="yi-merci">' + (R.presence && d.questions[0].o && R.presence === d.questions[0].o[1] ? "Nous avons bien noté votre réponse, et la transmettons aux mariés avec tous vos mots." : "Merci, votre réponse est bien notée. Nous revenons vers vous très prochainement pour la suite de votre venue.") + '</p>' + (R.presence === d.questions[0].o[0] ? '<div class="yi-pass"><div class="yi-k">Votre pass pour le week end</div><img src="' + API + '?action=pass&yid=' + jeton + '" alt="Votre pass" width="200" height="200"><p class="yi-aide" style="margin:8px 0 0">Présentez ce code à votre arrivée. Il est personnel.</p></div>' : '') + '<button type="button" class="yi-lien" data-modif>Modifier ma réponse</button>'; carte.innerHTML = h; croix(); carte.querySelector("[data-modif]").onclick = function(){ carte._modif = true; dessiner(false); }; return; }
      d.questions.forEach(function(q, n){ if (!visible(q)) return;
        h += '<div class="yi-q"><label class="yi-l">' + esc(q.l) + '</label>' + (q.aide ? '<span class="yi-aide">' + esc(q.aide) + '</span>' : '');
        if (q.type === "choix") h += '<div class="yi-opts">' + q.o.map(function(o){ return '<button type="button" class="yi-opt" data-k="' + q.k + '" data-v="' + esc(o) + '" aria-pressed="' + (R[q.k] === o) + '">' + esc(o) + '</button>'; }).join("") + '</div>';
        else if (q.type === "fixe") h += '<span class="yi-fixe">' + esc(q.v) + '</span>';
        else if (q.type === "texte") h += '<input type="text" data-t="' + q.k + '" value="' + esc(R[q.k] || "") + '" autocomplete="name">';
        else if (q.type === "email") h += '<input type="email" inputmode="email" data-t="' + q.k + '" value="' + esc(R[q.k] || "") + '" autocomplete="email" placeholder="prenom@exemple.com">';
        else if (q.type === "long") h += '<textarea data-t="' + q.k + '">' + esc(R[q.k] || "") + '</textarea>';
        else if (q.type === "enfants") { var E = R.enfants || []; for (var i = 0; i < q.n; i++) h += '<div class="yi-enf"><input type="text" placeholder="Prénom" data-ep="' + i + '" value="' + esc((E[i] || {}).prenom || "") + '"><input type="number" min="0" max="25" placeholder="Âge" data-ea="' + i + '" value="' + esc((E[i] || {}).age == null ? "" : E[i].age) + '"></div>'; }
        h += '</div>'; });
      h += '<button type="button" class="yi-btn" data-envoi>Envoyer ma réponse</button><p class="yi-err" data-err></p>';
      carte.innerHTML = h; croix();
      carte.querySelectorAll("[data-k]").forEach(function(b){ b.onclick = function(){ lire(); R[b.dataset.k] = b.dataset.v; dessiner(false); }; });
      carte.querySelector("[data-envoi]").onclick = envoyer;
    }
    function lire(){
      carte.querySelectorAll("[data-t]").forEach(function(i){ R[i.dataset.t] = i.value; });
      if (carte.querySelector("[data-ep]")) { var E = []; carte.querySelectorAll("[data-ep]").forEach(function(i){ E[+i.dataset.ep] = { prenom: i.value, age: (carte.querySelector('[data-ea="' + i.dataset.ep + '"]') || {}).value }; }); R.enfants = E; }
    }
    function envoyer(){
      lire(); var b = carte.querySelector("[data-envoi]"), err = carte.querySelector("[data-err]"); b.disabled = true; err.textContent = "";
      fetch(API + "?action=invite-repondre", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ yid: jeton, reponses: R }) })
        .then(function(r){ return r.json(); }).then(function(x){ if (!x.ok) { err.textContent = x.detail || "Votre réponse n'a pas pu être envoyée."; b.disabled = false; return; } d.deja = true; carte._modif = false; dessiner(true); sec.scrollTop = 0; })
        .catch(function(){ err.textContent = "La connexion a été interrompue, merci de réessayer."; b.disabled = false; });
    }
    bulle(d.equipe || []);
  }

  function bulle(eq){
    if (!eq.length) return;
    var b = el("button", "yi yi-bulle", '<img src="' + IMG + 'logo-blanc.png" alt="">'); b.type = "button"; b.setAttribute("aria-label", "Contacter Yes I Do"); document.body.appendChild(b);
    b.onclick = function(){
      var v = el("div", "yi yi-voile"), f = el("div", "yi-feuille", '<div class="yi-k">Yes I Do, à votre écoute</div>' + eq.map(function(p){ return '<div class="yi-p"><img src="' + esc(abs(p.photo) || IMG + "logo-noir.png") + '" alt=""><div><b>' + esc(p.prenom) + '</b>' + (p.tel ? '<a href="' + esc(p.tel) + '">Appeler</a>' : '') + (p.whatsapp ? '<a href="' + esc(p.whatsapp) + '" target="_blank" rel="noopener">WhatsApp</a>' : '') + '</div></div>'; }).join(""));
      v.appendChild(f); document.body.appendChild(v); v.onclick = function(e){ if (e.target === v) v.remove(); };
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", demarrer); else demarrer();
})();
