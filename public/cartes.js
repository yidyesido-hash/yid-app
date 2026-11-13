/* =====================================================================
   COMPOSANTS DE LA MAQUETTE · comportement
   YID.pile(el, opts) : pile de cartes à glisser (doigt, souris, flèches)
   YID.voirPlus(racine) : replie les textes longs marqués data-replie
   Le bouton pour remonter s'installe tout seul.
   ===================================================================== */
(function(){
  var YID = window.YID = window.YID || {};
  var TONS = ["t-espresso", "t-champagne", "t-sable", "t-cacao", "t-ivoire"];
  YID.ton = function(k){ return TONS[k % TONS.length]; };

  /* opts : index de départ, onChange(i), avancer() -> bool (false bloque le passage) */
  YID.pile = function(el, opts){
    opts = opts || {};
    var cards = [].slice.call(el.children).filter(function(c){ return c.classList.contains("sc"); });
    var i = Math.max(0, Math.min(opts.index || 0, cards.length - 1)), x0 = null, y0 = null, dx = 0, bouge = false, axe = null;
    function lay(){
      cards.forEach(function(c, k){ var p = k - i; c.style.pointerEvents = p === 0 ? "auto" : "none";
        if (p < 0) { c.style.transform = "translateX(-118%) rotate(-7deg)"; c.style.opacity = 0; }
        else if (p > 2) { c.style.transform = "translateX(56px) scale(.82)"; c.style.opacity = 0; }
        else { c.style.transform = "translateX(" + (p * 24) + "px) scale(" + (1 - p * .07) + ")"; c.style.opacity = p === 0 ? 1 : (p === 1 ? .94 : .72); }
        c.style.zIndex = 20 - Math.abs(p); });
      if (opts.onChange) opts.onChange(i, cards.length);
    }
    function secoue(){ var c = cards[i]; if (!c) return; c.classList.remove("shake"); void c.offsetWidth; c.classList.add("shake"); }
    function go(n){ if (n === i || n < 0 || n >= cards.length) { lay(); return; } i = n; lay(); }
    el.addEventListener("pointerdown", function(e){ if (e.target.closest("input,select,textarea,button,a,label")) return; x0 = e.clientX; y0 = e.clientY; dx = 0; bouge = false; axe = null; if (cards[i]) cards[i].classList.add("drag"); });
    el.addEventListener("pointermove", function(e){ if (x0 === null || !cards[i]) return; var ddx = e.clientX - x0, ddy = e.clientY - y0;
      if (!axe && (Math.abs(ddx) > 8 || Math.abs(ddy) > 8)) axe = Math.abs(ddx) > Math.abs(ddy) ? "x" : "y";
      if (axe !== "x") return; dx = ddx; bouge = true; cards[i].style.transform = "translateX(" + dx + "px) rotate(" + (dx / 28) + "deg)"; });
    function fin(){ if (x0 === null) return; x0 = null; if (cards[i]) cards[i].classList.remove("drag");
      if (axe === "x" && dx < -60) { if (i < cards.length - 1) go(i + 1); else { lay(); secoue(); } } else if (axe === "x" && dx > 60) { if (i > 0) go(i - 1); else lay(); } else lay(); }
    el.addEventListener("pointerup", fin); el.addEventListener("pointercancel", fin); el.addEventListener("pointerleave", fin);
    el.addEventListener("click", function(e){ if (bouge) { e.preventDefault(); e.stopPropagation(); bouge = false; } }, true);
    lay();
    return { aller: go, suivante: function(){ if (i < cards.length - 1) go(i + 1); }, precedente: function(){ if (i > 0) go(i - 1); }, index: function(){ return i; }, secoue: secoue, carte: function(){ return cards[i]; }, total: cards.length };
  };
  /* les flèches du clavier pilotent la pile visible */
  document.addEventListener("keydown", function(e){ if (/input|select|textarea/i.test((e.target.tagName || ""))) return; var p = YID.pileActive; if (!p) return; if (e.key === "ArrowRight") p.suivante(); if (e.key === "ArrowLeft") p.precedente(); });

  YID.points = function(el, i, n){ if (!el) return; var deb = Math.max(0, Math.min(i - 5, n - 11)), h = ""; for (var k = deb; k < Math.min(n, deb + 11); k++) h += '<i class="' + (k === i ? "on" : "") + '"></i>'; el.innerHTML = h; };

  YID.voirPlus = function(racine){
    (racine || document).querySelectorAll("[data-replie]:not([data-vu])").forEach(function(t){
      t.setAttribute("data-vu", "1"); t.classList.add("replie");
      requestAnimationFrame(function(){ if (t.scrollHeight <= t.clientHeight + 2) { t.classList.remove("replie"); return; }
        var b = document.createElement("button"); b.type = "button"; b.className = "voirplus"; b.textContent = "Voir plus";
        b.onclick = function(){ var o = t.classList.toggle("replie"); b.textContent = o ? "Voir plus" : "Voir moins"; };
        t.insertAdjacentElement("afterend", b); });
    });
  };

  function remonter(){
    var b = document.createElement("button"); b.id = "remonter"; b.type = "button"; b.setAttribute("aria-label", "Remonter en haut de la page");
    b.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>';
    b.onclick = function(){ window.scrollTo({ top: 0, behavior: "smooth" }); };
    document.body.appendChild(b);
    var maj = function(){ b.classList.toggle("on", window.scrollY > 500); };
    window.addEventListener("scroll", maj, { passive: true }); maj();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", remonter); else remonter();
})();
