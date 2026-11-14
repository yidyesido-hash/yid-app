/* =====================================================================
   YES I DO · LE LIEN PERSONNEL DE L'INVITÉ, sur le site du mariage
   À poser une fois dans Squarespace (Paramètres, Avancé, Injection de
   code, pied de page) :
     <script src="https://invites.yidyesido.info/yid-invite.js" defer></script>
   Le lien envoyé à l'invité est l'adresse du site suivie de ?yid=JETON.
   Sans jeton, le script ne fait rien : le site reste tel quel.
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

  function poser(d){
    var sec = el("section", "yi yi-sec"); sec.id = "yid-accueil";
    var hero = document.querySelector("#sections > section, main section, .page-section, article");
    if (hero && hero.parentNode) hero.parentNode.insertBefore(sec, hero.nextSibling); else document.body.insertBefore(sec, document.body.firstChild);
    var R = {}; d.questions.forEach(function(q){ R[q.k] = q.v; });
    var carte = el("div", "yi-carte"); sec.appendChild(carte);
    function visible(q){ if (!q.si) return true; var p = q.si.split(":"), k = p[0], i = p[1]; if (i === "*") return !!R[k]; var qq = d.questions.filter(function(z){ return z.k === k; })[0]; return qq && qq.o && R[k] === qq.o[+i]; }
    function dessiner(merci){
      var h = '<div class="yi-k">' + esc(d.couple) + (d.date ? " · " + new Date(d.date + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "") + '</div>' +
        '<div class="yi-sal">' + esc(d.salutation) + '</div><p class="yi-acc">' + esc(d.accroche) + '</p>';
      if (merci || (d.deja && !carte._modif)) { h += '<p class="yi-merci">' + (R.presence && d.questions[0].o && R.presence === d.questions[0].o[1] ? "Nous avons bien noté votre réponse, et la transmettons aux mariés avec tous vos mots." : "Merci, votre réponse est bien notée. Nous revenons vers vous très prochainement pour la suite de votre venue.") + '</p><button type="button" class="yi-lien" data-modif>Modifier ma réponse</button>'; carte.innerHTML = h; carte.querySelector("[data-modif]").onclick = function(){ carte._modif = true; dessiner(false); }; return; }
      d.questions.forEach(function(q, n){ if (!visible(q)) return;
        h += '<div class="yi-q"><label class="yi-l">' + esc(q.l) + '</label>' + (q.aide ? '<span class="yi-aide">' + esc(q.aide) + '</span>' : '');
        if (q.type === "choix") h += '<div class="yi-opts">' + q.o.map(function(o){ return '<button type="button" class="yi-opt" data-k="' + q.k + '" data-v="' + esc(o) + '" aria-pressed="' + (R[q.k] === o) + '">' + esc(o) + '</button>'; }).join("") + '</div>';
        else if (q.type === "fixe") h += '<span class="yi-fixe">' + esc(q.v) + '</span>';
        else if (q.type === "texte") h += '<input type="text" data-t="' + q.k + '" value="' + esc(R[q.k] || "") + '" autocomplete="name">';
        else if (q.type === "long") h += '<textarea data-t="' + q.k + '">' + esc(R[q.k] || "") + '</textarea>';
        else if (q.type === "enfants") { var E = R.enfants || []; for (var i = 0; i < q.n; i++) h += '<div class="yi-enf"><input type="text" placeholder="Prénom" data-ep="' + i + '" value="' + esc((E[i] || {}).prenom || "") + '"><input type="number" min="0" max="25" placeholder="Âge" data-ea="' + i + '" value="' + esc((E[i] || {}).age == null ? "" : E[i].age) + '"></div>'; }
        h += '</div>'; });
      h += '<button type="button" class="yi-btn" data-envoi>Envoyer ma réponse</button><p class="yi-err" data-err></p>';
      carte.innerHTML = h;
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
        .then(function(r){ return r.json(); }).then(function(x){ if (!x.ok) { err.textContent = x.detail || "Votre réponse n'a pas pu être envoyée."; b.disabled = false; return; } d.deja = true; carte._modif = false; dessiner(true); sec.scrollIntoView({ behavior: "smooth", block: "start" }); })
        .catch(function(){ err.textContent = "La connexion a été interrompue, merci de réessayer."; b.disabled = false; });
    }
    dessiner(false);
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
