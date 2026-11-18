/* =====================================================================
   LES FICHIERS DU MARIAGE (phase 2)
   Un classeur pour le wedding planner, composé des réponses relues par le
   moteur v2 : une ligne par personne, puis les vues de chaque métier.
     Synthèse      les chiffres et les points d'attention
     Invités       chaque personne : foyer, rôle, âge, moments, plat, régime, logé, table
     Traiteur      les couverts par moment et par plat, les régimes, les allergies sévères, les menus enfant
     Hébergement   la rooming list par maison : foyers, personnes, arrivée, précisions, nourrissons
     Venues        arrivées et départs, navettes, conciergerie
     Attention     les signaux de chaque foyer, à traiter
   Le nom du couple n'apparaît jamais dans les onglets destinés aux
   prestataires (Traiteur, Hébergement) : le code du mariage suffit.
   ===================================================================== */
const db = require("./db");
const store = require("./store");
const MOTEUR = require("../public/formulaire/moteur.js");

async function donnees(code) {
  const m = await store.mariageFresh(code); if (!m) throw new Error("mariage inconnu");
  const F = require("./formulaire"), cfg = F.config(m);
  const cs = await db.query("SELECT * FROM contact_recu WHERE mariage_id = $1 AND NOT desactive AND NOT archive ORDER BY cle NULLS LAST, id", [m.id]);
  const plan = ((m.parametres || {}).plan) || {};
  const tables = {}; (plan.tables || []).forEach(t => { tables[t.id] = t.nom; });
  const foyers = cs.map(c => {
    const r = c.reponse || {}, etat = r.etat || c.brouillon || null;
    const e = etat ? MOTEUR.creer(cfg, F.foyer(c, m), etat) : null;
    const statut = !c.reponse_le ? (c.brouillon && c.brouillon.presence === "inconnu" ? "Hésite" : "Sans réponse") : /regret/.test(r.presence || "") ? "Absent" : "Présent";
    return { c, r, e, statut, table: tables[(plan.placements || {})[c.id]] || "", personnes: statut === "Présent" && e ? e.personnes() : [] };
  });
  return { m, cfg, foyers };
}

function classeur(D) {
  const { m, cfg, foyers } = D, mom = cfg.moments, plats = cfg.plats;
  const presents = foyers.filter(f => f.statut === "Présent"), P = [].concat(...presents.map(f => f.personnes.map(p => Object.assign({ f }, p))));
  const nomMoment = (id) => (mom.find(x => x.id === id) || {}).l || id;
  /* Synthèse */
  const syn = [
    ["Mariage", m.code + " · " + (m.prenoms || "")], ["Date", String(m.date_mariage || "").slice(0, 10)], ["Lieu", m.lieu || ""],
    ["Foyers invités", foyers.length], ["Foyers présents", presents.length], ["Foyers absents", foyers.filter(f => f.statut === "Absent").length],
    ["Foyers qui hésitent", foyers.filter(f => f.statut === "Hésite").length], ["Foyers sans réponse", foyers.filter(f => f.statut === "Sans réponse").length],
    ["Personnes présentes", P.length], ["dont enfants", P.filter(p => p.role === "enfant").length], ["dont nourrissons", P.filter(p => p.age === 0).length],
    ["Personnes logées", P.filter(p => p.dort).length], ["Noms à confirmer", P.filter(p => p.a_confirmer).length]
  ].concat(mom.map(x => ["Présents · " + x.l, P.filter(p => p.moments.includes(x.id)).length]))
   .concat(plats.map(pl => ["Plat · " + pl.l.fr, P.filter(p => p.plat === pl.l.fr).length]));
  /* Invités */
  const inv = P.map(p => [p.f.c.cle || "", p.f.c.nom_repertoire, p.nom || "Nom à communiquer", p.role, p.civilite || "", p.age == null ? "" : p.age === 0 ? "Nourrisson" : p.age, p.f.c.cote || "", p.f.c.lien || "",
    ...mom.map(x => p.moments.includes(x.id) ? "Oui" : ""), p.plat || (p.role === "enfant" && p.age === 0 ? "Nourrisson" : p.role === "enfant" && cfg.ageMenu && p.age < cfg.ageMenu ? "Menu enfant" : ""),
    p.regimes.join(", ") + (p.regime_autre ? " (" + p.regime_autre + ")" : ""), p.allergie_severe ? "Oui" : "", p.dort ? (p.f.r.hebergement || p.f.c.hebergement || "Oui") : "", p.f.table, p.f.e ? p.f.e.langue() : ""]);
  /* Traiteur : par moment servi, par plat ; régimes ; allergies sévères */
  const trt = [];
  mom.filter(x => x.traiteur).forEach(x => {
    const ici = P.filter(p => p.moments.includes(x.id));
    trt.push([x.l, "Couverts", ici.filter(p => p.age !== 0).length, ""]);
    if (x.repas) {
      plats.forEach(pl => trt.push([x.l, pl.l.fr, ici.filter(p => p.plat === pl.l.fr).length, ""]));
      if (cfg.ageMenu) trt.push([x.l, "Menu enfant (moins de " + cfg.ageMenu + " ans)", ici.filter(p => p.role === "enfant" && p.age > 0 && p.age < cfg.ageMenu).length, ""]);
      trt.push([x.l, "Végétarien (plat préparé)", ici.filter(p => p.vegetarien).length, ""]);
    }
    trt.push([x.l, "Nourrissons (pas de couvert, chaise haute à prévoir)", ici.filter(p => p.age === 0).length, ""]);
  });
  const regs = {}; P.forEach(p => p.regimes.forEach(r => { regs[r] = (regs[r] || 0) + 1; }));
  Object.keys(regs).sort().forEach(r => trt.push(["Régimes", r, regs[r], ""]));
  P.filter(p => p.allergie_severe).forEach(p => trt.push(["Allergie sévère", p.regimes.filter(x => /Allergie/.test(x)).join(", "), 1, "Table " + (p.f.table || "à placer") + " · " + (p.f.c.cle || "")]));
  presents.forEach(f => { const pr = String(((f.r.etat || {}).table || {}).precision || "").trim(); if (pr) trt.push(["Précision pour le chef", pr, "", "Table " + (f.table || "à placer") + " · " + (f.c.cle || "")]); });
  /* Hébergement : la rooming list, par maison */
  const heb = [];
  const maisons = {}; P.filter(p => p.dort).forEach(p => { const h = p.f.r.hebergement || p.f.c.hebergement || "À attribuer"; (maisons[h] = maisons[h] || []).push(p); });
  Object.keys(maisons).sort().forEach(h => {
    const parFoyer = {}; maisons[h].forEach(p => { (parFoyer[p.f.c.id] = parFoyer[p.f.c.id] || []).push(p); });
    Object.values(parFoyer).forEach(L => {
      const f = L[0].f, S = f.r.etat || {}, hh = (S.heb || {}).heure;
      heb.push([h, f.c.cle || "", L.map(p => p.nom || "Nom à communiquer").join(" ; "), L.length, L.filter(p => p.role === "enfant").map(p => p.age === 0 ? "nourrisson" : p.age + " ans").join(", "), L.some(p => p.age === 0) ? "Lit bébé à confirmer avec la maison" : "",
        (S.heb || {}).heureInconnue ? "À confirmer" : hh && hh.h ? hh.h + " h " + hh.m : "", String((S.heb || {}).precision || ""), String((S.fin || {}).attention || "")]);
    });
  });
  foyers.filter(f => f.statut === "Présent" && f.c.hebergement && f.c.hebergement !== "Par leurs propres moyens" && !f.personnes.some(p => p.dort)).forEach(f => heb.push([f.c.hebergement, f.c.cle || "", "Hébergement décliné par le foyer", 0, "", "", "", "Chambre à réattribuer avec les mariés", ""]));
  /* Venues */
  const ven = presents.map(f => { const S = f.r.etat || {}, pl = Object.keys(f.r).filter(k => /^nav_.*_aller$/.test(k)).map(k => f.r[k]).filter(v => v && v !== "Non merci");
    return [f.c.cle || "", f.c.nom_repertoire, f.personnes.length, f.r.arrivee || "", f.r.depart || "", pl.join(", "), Object.keys(f.r).filter(k => /^nav_.*_retour$/.test(k)).map(k => f.r[k]).join(", "),
      S.fin && S.fin.concierge ? ({ tout: "Toute la venue", partie: "En partie : " + Object.keys(S.fin.pour || {}).filter(k => S.fin.pour[k]).join(", "), non: "" }[S.fin.concierge] || "") : ""]; });
  /* Attention */
  const att = [];
  foyers.forEach(f => (f.c.signaux || []).forEach(s => att.push([f.c.cle || "", f.c.nom_repertoire, f.statut, s])));
  const N = { name: "Synthèse", table: "Synthese", headers: ["Indicateur", "Valeur"], rows: syn };
  return [N,
    { name: "Invités", table: "Invites", headers: ["Clé", "Foyer", "Nom", "Rôle", "Civilité", "Âge", "Côté", "Lien"].concat(mom.map(x => x.l)).concat(["Plat", "Régime ou allergie", "Allergie sévère", "Logé", "Table", "Langue"]), rows: inv },
    { name: "Traiteur", table: "Traiteur", headers: ["Moment", "Détail", "Nombre", "Repère"], rows: trt },
    { name: "Hébergement", table: "Hebergement", headers: ["Maison", "Clé", "Personnes", "Nombre", "Enfants", "Couchage", "Arrivée sur place", "Précision du foyer", "Attention particulière"], rows: heb },
    { name: "Venues", table: "Venues", headers: ["Clé", "Foyer", "Personnes", "Arrivée", "Départ", "Navette, places", "Navette, retour", "Conciergerie"], rows: ven },
    { name: "Attention", table: "Attention", headers: ["Clé", "Foyer", "Réponse", "Point à traiter"], rows: att }];
}

async function planner(code) {
  const D = await donnees(code), feuilles = classeur(D);
  const buffer = require("./xlsx").build(feuilles);
  return { nom: `Fichier wedding planner ${D.m.code} ${new Date().toISOString().slice(0, 10)}.xlsx`, buffer, resume: feuilles[0].rows };
}

module.exports = { donnees, classeur, planner };
