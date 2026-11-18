/* Le montage du formulaire : page autonome, ou fenêtre ouverte depuis le site du mariage (yid-invite.js). */
(function (g) {
  "use strict";
  function monter(el, d, api, jeton, opts) {
    opts = opts || {};
    el.classList.add("yidf");
    var e = g.YIDMoteur.creer(d.cfg, d.foyer, d.etat);
    var poster = function (action, S) {
      return fetch(api + "?action=" + action, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ yid: jeton, etat: S }) })
        .then(function (r) { return r.json().then(function (j) { if (!r.ok || !j.ok) throw new Error(j.detail || ""); return j; }); });
    };
    var minuterie = null;
    e.brancher(el, {
      brouillon: function (S) { if (d.deja) return; clearTimeout(minuterie); minuterie = setTimeout(function () { poster("invite-brouillon", S).catch(function () {}); }, 400); },
      envoyer: function (S) { if (d.deja && d.modifiable === false) return Promise.reject(new Error(e.langue() === "pt" ? "As respostas já não podem ser alteradas." : "Les réponses ne sont plus modifiables.")); return poster("invite-repondre", S).then(function () { d.deja = true; }); },
      etape: opts.etape, site: opts.site
    });
    return e;
  }
  g.YIDFormulaire = { monter: monter };
})(this);
