/* Yes I Do · l'application installée. Le réseau d'abord, toujours : la copie gardée ne sert que hors ligne.
   Rien de l'API n'est jamais gardé ici (les données restent sur le serveur ; la tablette du jour J a sa propre réserve). */
var CACHE = "yid-coquille-1";
self.addEventListener("install", function (e) { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(["/", "/habillage.css", "/cartes.css", "/cartes.js", "/img/logo-blanc.png", "/img/logo-noir.png"]).catch(function () {}); })); });
self.addEventListener("activate", function (e) { e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); })); });
self.addEventListener("fetch", function (e) {
  var r = e.request, u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== location.origin || u.pathname.indexOf("/api/") === 0) return;
  e.respondWith(fetch(r).then(function (rep) {
    if (rep && rep.ok && rep.type === "basic") { var copie = rep.clone(); caches.open(CACHE).then(function (c) { c.put(r, copie); }); }
    return rep;
  }).catch(function () { return caches.match(r, { ignoreSearch: r.mode === "navigate" }).then(function (m) { return m || (r.mode === "navigate" ? caches.match("/") : Response.error()); }); }));
});
