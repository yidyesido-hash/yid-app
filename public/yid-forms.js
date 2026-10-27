/* =====================================================================
   YES I DO · FORMULAIRES INVITÉS · moteur navigateur
   Appelé par le bloc 00b de la plateforme Squarespace :
   YIDForms.mount(élément, { api, w, k, form, extra, lang })
   Les questions, le préremplissage et les règles viennent du serveur ;
   ce fichier ne fait que les présenter dans la charte Yes I Do.
   ===================================================================== */
(function () {
  if (window.YIDForms) return;

  var CSS = '\
.yf{font-family:var(--yid-b,"Inter",system-ui,sans-serif);color:var(--yid-ink,#141210);text-align:left}\
.yf *{box-sizing:border-box;text-transform:none!important}\
.yf__hello{font:400 22px/1.35 var(--yid-h,"Cormorant Garamond",Georgia,serif);margin:6px 0 4px}\
.yf__prog{display:flex;align-items:center;gap:10px;margin:8px 0 22px;font:500 12px/1 var(--yid-b,Inter,sans-serif);letter-spacing:.14em;color:var(--yid-muted,#6B655E);text-transform:uppercase!important}\
.yf__bar{flex:1;height:2px;background:var(--yid-line,#E6E1DA);border-radius:2px;overflow:hidden}\
.yf__bar i{display:block;height:100%;background:var(--yid-gold,#B8956A);transition:width .3s}\
.yf__title{font:600 25px/1.25 var(--yid-h,"Cormorant Garamond",Georgia,serif);margin:0 0 8px}\
.yf__help{font:400 15px/1.65 var(--yid-b,Inter,sans-serif);color:var(--yid-muted,#6B655E);margin:0 0 22px}\
.yf__f{margin:0 0 22px}\
.yf__l{display:block;font:500 15px/1.4 var(--yid-b,Inter,sans-serif);margin:0 0 9px}\
.yf__l small{font-weight:400;color:var(--yid-muted,#6B655E)}\
.yf input[type=text],.yf input[type=email],.yf input[type=tel],.yf input[type=number],.yf input[type=time],.yf select,.yf textarea{width:100%;min-height:52px;padding:13px 16px;border:1px solid var(--yid-line,#E6E1DA);border-radius:14px;background:#fff;font:400 16px/1.4 var(--yid-b,Inter,sans-serif);color:inherit;-webkit-appearance:none;appearance:none}\
.yf select{background-image:linear-gradient(45deg,transparent 50%,#6B655E 50%),linear-gradient(135deg,#6B655E 50%,transparent 50%);background-position:calc(100% - 22px) 23px,calc(100% - 16px) 23px;background-size:6px 6px;background-repeat:no-repeat;padding-right:44px}\
.yf textarea{min-height:110px;resize:vertical}\
.yf input:focus,.yf select:focus,.yf textarea:focus{outline:none;border-color:var(--yid-ink,#141210);box-shadow:0 0 0 3px rgba(184,149,106,.18)}\
.yf__opts{display:flex;flex-wrap:wrap;gap:10px}\
.yf__opt{display:inline-flex;align-items:center;gap:10px;min-height:48px;padding:11px 18px;border:1px solid var(--yid-line,#E6E1DA);border-radius:999px;background:#fff;font:400 15px/1.3 var(--yid-b,Inter,sans-serif);color:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:border-color .15s,background .15s}\
.yf__opt:hover{border-color:var(--yid-ink,#141210)}\
.yf__opt[aria-pressed=true]{background:var(--yid-ink,#141210);border-color:var(--yid-ink,#141210);color:#fff}\
.yf__opt[aria-pressed=true]::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--yid-gold,#B8956A)}\
.yf__opt:focus-visible{outline:2px solid var(--yid-gold,#B8956A);outline-offset:2px}\
.yf__opts--col{flex-direction:column;align-items:stretch}.yf__opts--col .yf__opt{border-radius:14px;justify-content:flex-start}\
.yf__check{display:flex;gap:12px;align-items:flex-start;font:400 15px/1.55 var(--yid-b,Inter,sans-serif);cursor:pointer}\
.yf__check input{width:22px;height:22px;flex:0 0 auto;margin-top:1px;accent-color:var(--yid-ink,#141210)}\
.yf__fixed{display:inline-flex;align-items:center;gap:10px;padding:11px 18px;border-radius:999px;background:var(--yid-cream,#FAF7F2);font:500 15px/1.3 var(--yid-b,Inter,sans-serif)}\
.yf__fixed::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--yid-gold,#B8956A)}\
.yf__info{background:var(--yid-cream,#FAF7F2);border-radius:14px;padding:14px 18px;font:400 15px/1.6 var(--yid-b,Inter,sans-serif)}\
.yf__err{display:none;color:#9B3B2E;font:400 13.5px/1.4 var(--yid-b,Inter,sans-serif);margin-top:7px}\
.yf__f.is-err .yf__err{display:block}\
.yf__f.is-err input,.yf__f.is-err select,.yf__f.is-err textarea{border-color:#9B3B2E}\
.yf__nav{display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;align-items:center;margin-top:30px;padding-top:22px;border-top:1px solid var(--yid-line,#E6E1DA)}\
.yf__btn{display:inline-flex;align-items:center;justify-content:center;min-height:52px;padding:12px 28px;border-radius:999px;border:1px solid var(--yid-ink,#141210);background:var(--yid-ink,#141210);color:#fff;font:500 14px/1 var(--yid-b,Inter,sans-serif);letter-spacing:.12em;text-transform:uppercase!important;cursor:pointer}\
.yf__btn:hover{background:#000}.yf__btn[disabled]{opacity:.5;cursor:default}\
.yf__btn--ghost{background:transparent;color:var(--yid-ink,#141210);border-color:var(--yid-line,#E6E1DA)}\
.yf__btn--ghost:hover{background:transparent;border-color:var(--yid-ink,#141210)}\
.yf__btn:focus-visible{outline:2px solid var(--yid-gold,#B8956A);outline-offset:3px}\
.yf__hp{position:absolute!important;left:-9999px!important;width:1px;height:1px;overflow:hidden}\
.yf__done{text-align:center;padding:26px 6px}\
.yf__done svg{width:54px;height:54px;stroke:var(--yid-gold,#B8956A);fill:none;stroke-width:1.4;margin-bottom:14px}\
.yf__done p{font:400 19px/1.6 var(--yid-h,"Cormorant Garamond",Georgia,serif);max-width:520px;margin:0 auto 22px}\
.yf__wait{padding:40px 0;text-align:center;font:400 17px/1.5 var(--yid-h,"Cormorant Garamond",Georgia,serif);color:var(--yid-muted,#6B655E)}\
.yf__fail{padding:22px;text-align:center;font:400 15px/1.6 var(--yid-b,Inter,sans-serif);color:var(--yid-muted,#6B655E)}\
@media(max-width:480px){.yf__nav{flex-direction:column-reverse;align-items:stretch}.yf__btn{width:100%}}\
@media(prefers-reduced-motion:reduce){.yf *{transition:none!important}}';

  function css() { if (document.getElementById("yfCss")) return; var s = document.createElement("style"); s.id = "yfCss"; s.textContent = CSS; document.head.appendChild(s); }
  function el(tag, attrs, html) { var e = document.createElement(tag); if (attrs) for (var k in attrs) { if (k === "class") e.className = attrs[k]; else e.setAttribute(k, attrs[k]); } if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  var WAIT = { en: "One moment", fr: "Un instant", nl: "Een ogenblik" };
  var FAIL = { en: "This form cannot be displayed at the moment. Please try again shortly, or write to your dedicated team.", fr: "Ce formulaire ne peut pas s'afficher pour le moment. Merci de réessayer dans un instant, ou d'écrire à votre équipe dédiée.", nl: "Dit formulier kan momenteel niet worden weergegeven. Probeer het zo meteen opnieuw, of schrijf naar uw toegewijde team." };

  function visible(f, v) {
    var c = f.showIf; if (!c) return true; var val = v[c.f];
    if ("eq" in c) return val === c.eq;
    if ("in" in c) return c.in.indexOf(val) > -1;
    if ("has" in c) return Array.isArray(val) && val.indexOf(c.has) > -1;
    if ("filled" in c) return !!(val && String(val).trim());
    if ("empty" in c) return !val || (Array.isArray(val) && !val.length);
    return true;
  }

  function mount(root, o) {
    css();
    var lang = o.lang || "en";
    root.innerHTML = '<div class="yf"><div class="yf__wait">' + WAIT[lang] + '</div></div>';
    var qs = "action=form&w=" + encodeURIComponent(o.w) + "&f=" + encodeURIComponent(o.form) + "&lang=" + lang + (o.k ? "&k=" + encodeURIComponent(o.k) : "");
    Object.keys(o.extra || {}).forEach(function (k) { qs += "&" + encodeURIComponent(k) + "=" + encodeURIComponent(o.extra[k]); });
    fetch(o.api.replace(/\/$/, "") + "/api/forms?" + qs, { cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (s) { if (!s.ok) throw 0; render(root, o, s); })
      .catch(function () { root.innerHTML = '<div class="yf"><div class="yf__fail">' + FAIL[lang] + '</div></div>'; });
  }

  function render(root, o, s) {
    var ui = s.ui, v = JSON.parse(JSON.stringify(s.values || {})), step = 0, n = s.steps.length;
    var box = el("div", { class: "yf" }); root.innerHTML = ""; root.appendChild(box);

    function draw() {
      box.innerHTML = "";
      if (s.greeting && step === 0) box.appendChild(el("p", { class: "yf__hello" }, esc(s.greeting) + ","));
      if (n > 1) box.appendChild(el("div", { class: "yf__prog" }, "<span>" + esc(ui.step) + " " + (step + 1) + " " + esc(ui.of) + " " + n + '</span><span class="yf__bar"><i style="width:' + Math.round((step + 1) / n * 100) + '%"></i></span>'));
      var st = s.steps[step];
      if (st.title && n > 1) box.appendChild(el("h3", { class: "yf__title" }, esc(st.title)));
      if (st.help) box.appendChild(el("p", { class: "yf__help" }, esc(st.help)));
      var form = el("div", { class: "yf__fields" }); box.appendChild(form);
      st.fields.forEach(function (f) { form.appendChild(field(f)); });
      var hp = el("div", { class: "yf__hp", "aria-hidden": "true" }, '<input type="text" tabindex="-1" autocomplete="off" name="website">'); box.appendChild(hp);
      var nav = el("div", { class: "yf__nav" });
      var back = el("button", { class: "yf__btn yf__btn--ghost", type: "button" }, esc(ui.back));
      back.style.visibility = step === 0 ? "hidden" : "visible";
      back.onclick = function () { step--; draw(); scrollTop(); };
      var last = step === n - 1;
      var next = el("button", { class: "yf__btn", type: "button" }, esc(last ? ui.send : ui.next));
      next.onclick = function () { if (!check()) return; if (!last) { step++; draw(); scrollTop(); } else submit(next, hp.querySelector("input").value); };
      nav.appendChild(back); nav.appendChild(next); box.appendChild(nav);
      refresh();
    }

    function field(f) {
      var w = el("div", { class: "yf__f", "data-name": f.name }); w._f = f;
      var opt = !f.required && ["info", "fixed", "check"].indexOf(f.type) < 0 ? ' <small>(' + esc(ui.optional) + ')</small>' : "";
      if (f.type === "info") { w.appendChild(el("div", { class: "yf__info" }, esc(f.text))); return w; }
      if (f.type === "fixed") { if (f.label) w.appendChild(el("span", { class: "yf__l" }, esc(f.label))); if (f.text) w.appendChild(el(f.label ? "span" : "div", { class: f.label ? "yf__fixed" : "yf__info" }, esc(f.text))); return w; }
      if (f.type === "check") {
        var lab = el("label", { class: "yf__check" }); var cb = el("input", { type: "checkbox" }); cb.checked = !!v[f.name];
        cb.onchange = function () { v[f.name] = cb.checked; w.classList.remove("is-err"); };
        lab.appendChild(cb); lab.appendChild(el("span", null, esc(f.label))); w.appendChild(lab);
      } else {
        w.appendChild(el("label", { class: "yf__l", for: "yf_" + f.name }, esc(f.label) + opt));
        if (["people", "checkboxes", "radio"].indexOf(f.type) > -1) {
          var multi = f.type !== "radio", g = el("div", { class: "yf__opts" + (f.type === "radio" && f.options.some(function (x) { return x.l.length > 26; }) ? " yf__opts--col" : ""), role: multi ? "group" : "radiogroup" });
          f.options.forEach(function (op) {
            var b = el("button", { class: "yf__opt", type: "button", "aria-pressed": "false" }, esc(op.l));
            function sync() { var cur = v[f.name]; b.setAttribute("aria-pressed", String(multi ? (Array.isArray(cur) && cur.indexOf(op.v) > -1) : cur === op.v)); }
            b.onclick = function () {
              if (multi) { var cur = Array.isArray(v[f.name]) ? v[f.name].slice() : []; var i = cur.indexOf(op.v); if (i > -1) cur.splice(i, 1); else cur.push(op.v); v[f.name] = cur; }
              else v[f.name] = op.v;
              g.querySelectorAll(".yf__opt").forEach(function (x) { x._sync(); }); w.classList.remove("is-err"); refresh();
            };
            b._sync = sync; sync(); g.appendChild(b);
          });
          w.appendChild(g);
        } else if (f.type === "select") {
          var sel = el("select", { id: "yf_" + f.name }); sel.appendChild(el("option", { value: "" }, esc(ui.choose)));
          f.options.forEach(function (op) { var x = el("option", { value: op.v }, esc(op.l)); if (v[f.name] === op.v) x.selected = true; sel.appendChild(x); });
          sel.onchange = function () { v[f.name] = sel.value; w.classList.remove("is-err"); refresh(); }; w.appendChild(sel);
        } else {
          var tag = f.type === "textarea" ? "textarea" : "input";
          var inp = el(tag, { id: "yf_" + f.name });
          if (tag === "input") { inp.type = f.type === "number" ? "number" : f.type; if (f.type === "number") { inp.min = f.min; inp.max = f.max; inp.inputMode = "numeric"; } if (f.type === "email") inp.autocomplete = "email"; if (f.type === "tel") inp.autocomplete = "tel"; }
          if (f.placeholder) inp.placeholder = f.placeholder;
          inp.value = v[f.name] == null ? "" : v[f.name];
          inp.oninput = function () { v[f.name] = inp.value; w.classList.remove("is-err"); if (f.type === "text") refresh(); };
          w.appendChild(inp);
        }
      }
      w.appendChild(el("div", { class: "yf__err" }, esc(ui.required)));
      return w;
    }

    function refresh() { box.querySelectorAll(".yf__f").forEach(function (w) { w.style.display = visible(w._f, v) ? "" : "none"; }); }

    function empty(f) { var val = v[f.name]; if (f.type === "check") return !val; if (Array.isArray(val)) return !val.length; return val == null || String(val).trim() === ""; }
    function check() {
      var ok = true, first = null;
      box.querySelectorAll(".yf__f").forEach(function (w) {
        var f = w._f; if (!f || !visible(f, v) || ["info", "fixed"].indexOf(f.type) > -1) return;
        var bad = (f.required && empty(f)) || (f.type === "email" && v[f.name] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v[f.name]));
        w.classList.toggle("is-err", !!bad); if (bad) { ok = false; first = first || w; }
      });
      if (first) first.scrollIntoView({ behavior: "smooth", block: "center" });
      return ok;
    }

    function submit(btn, hp) {
      btn.disabled = true; btn.textContent = ui.sending;
      fetch(o.api.replace(/\/$/, "") + "/api/forms?action=submit", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ w: o.w, k: o.k || "", f: o.form, lang: s.lang, extra: o.extra || {}, data: v, website: hp }) })
        .then(function (r) { return r.json().then(function (j) { return { code: r.status, j: j }; }); })
        .then(function (r) {
          if (r.j.ok) { done(r.j.done); if (o.onDone) try { o.onDone(o.form, v); } catch (e) {} return; }
          if (r.code === 422 && r.j.errors) {
            var target = 0; s.steps.some(function (st, i) { return st.fields.some(function (f) { if (r.j.errors.indexOf(f.name) > -1) { target = i; return true; } }); });
            step = target; draw(); r.j.errors.forEach(function (nm) { var w = box.querySelector('.yf__f[data-name="' + nm + '"]'); if (w) w.classList.add("is-err"); }); return;
          }
          throw 0;
        })
        .catch(function () { btn.disabled = false; btn.textContent = ui.send; var e = box.querySelector(".yf__fail") || el("div", { class: "yf__fail" }); e.textContent = ui.error; box.appendChild(e); });
    }

    function done(text) {
      box.innerHTML = '<div class="yf__done"><svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="21"/><path d="M15 25l6 6 12-13"/></svg><p>' + esc(text) + '</p></div>';
      if (s.matched) { var again = el("button", { class: "yf__btn yf__btn--ghost", type: "button" }, esc(ui.edit)); again.onclick = function () { step = 0; draw(); scrollTop(); }; box.querySelector(".yf__done").appendChild(again); }
      scrollTop();
    }
    function scrollTop() { var r = root.getBoundingClientRect(); if (r.top < 0 || r.top > window.innerHeight * 0.6) window.scrollBy({ top: r.top - 90, behavior: "smooth" }); }

    draw();
  }

  window.YIDForms = { mount: mount };
  document.dispatchEvent(new CustomEvent("yidforms:ready"));
})();
