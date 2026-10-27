/* =====================================================================
   MOTEUR DE FORMULAIRES YES I DO
   Construit chaque formulaire pour un foyer précis (personnes de
   l'invitation, événements auxquels il est invité, cercle des proches,
   enfants), le valide côté serveur, et prépare les lignes Excel.
   ===================================================================== */
const L = (o, lang) => (o && typeof o === "object" ? (o[lang] || o.en) : o);
const LANGS = ["en", "fr", "nl"];
const FORMS = ["confirm", "accommodation", "elsewhere", "driver", "shuttle", "concierge", "charter"];

/* ---------- textes de l'interface ---------- */
const UI = {
  en: { next: "Continue", back: "Back", send: "Send", sending: "Sending", required: "Please complete this field.", choose: "Please choose", optional: "optional", edit: "Change my answers", error: "Something went wrong. Please try again, or write to your dedicated team.", hello: "Dear", step: "Step", of: "of", tapToRemove: "Tap a name to add or remove it.", none: "No one" },
  fr: { next: "Continuer", back: "Retour", send: "Envoyer", sending: "Envoi en cours", required: "Merci de compléter ce champ.", choose: "Choisir", optional: "facultatif", edit: "Modifier mes réponses", error: "Une erreur est survenue. Merci de réessayer ou d'écrire à votre équipe dédiée.", hello: "Chers", step: "Étape", of: "sur", tapToRemove: "Touchez un nom pour l'ajouter ou le retirer.", none: "Personne" },
  nl: { next: "Doorgaan", back: "Terug", send: "Verzenden", sending: "Bezig met verzenden", required: "Vul dit veld in.", choose: "Kies", optional: "optioneel", edit: "Mijn antwoorden wijzigen", error: "Er ging iets mis. Probeer opnieuw of schrijf naar uw toegewijde team.", hello: "Beste", step: "Stap", of: "van", tapToRemove: "Tik op een naam om die toe te voegen of te verwijderen.", none: "Niemand" }
};
const t = (en, fr, nl) => ({ en, fr, nl });

const TX = {
  who: t("Who will be there", "Qui sera présent", "Wie is erbij"),
  whoHelp: t("Your invitation includes the people below. For each moment of the weekend, keep the names of those who will join.", "Votre invitation comprend les personnes ci-dessous. Pour chaque moment du week-end, gardez les noms de celles qui seront présentes.", "Uw uitnodiging omvat de onderstaande personen. Houd voor elk moment van het weekend de namen aan van wie erbij is."),
  plusOne: t("Name of the person accompanying you", "Nom de la personne qui vous accompagne", "Naam van de persoon die u vergezelt"),
  table: t("At the table", "À table", "Aan tafel"),
  tableHelp: t("For the wedding dinner on Saturday. Tell us about any dietary need, even a small one: it is passed on to the caterer.", "Pour le dîner du mariage le samedi. Indiquez tout besoin alimentaire, même léger : il est transmis au traiteur.", "Voor het huwelijksdiner op zaterdag. Vermeld elke dieetwens, ook een kleine: die wordt doorgegeven aan de cateraar."),
  menuFor: t("Menu for", "Menu de", "Menu voor"),
  dietFor: t("Dietary needs or allergies for", "Régime ou allergies de", "Dieetwensen of allergieën van"),
  dietPh: t("For example: no pork, gluten free, nut allergy", "Par exemple : sans porc, sans gluten, allergie aux fruits à coque", "Bijvoorbeeld: geen varkensvlees, glutenvrij, notenallergie"),
  noDinner: t("No one from your household will be at the dinner on Saturday, so there is nothing to choose here.", "Personne de votre foyer ne sera au dîner du samedi, il n'y a donc rien à choisir ici.", "Niemand van uw gezin is op het diner van zaterdag, er valt hier dus niets te kiezen."),
  travel: t("Your travel", "Votre voyage", "Uw reis"),
  travelHelp: t("Knowing how you arrive and leave lets us arrange your driver, your shuttle and your room at the right time. If your plans are not set yet, say so: you can come back to this form with the same link.", "Savoir comment vous arrivez et repartez nous permet de prévoir votre chauffeur, votre navette et votre chambre au bon moment. Si vos plans ne sont pas encore arrêtés, dites-le : vous pourrez revenir sur ce formulaire avec le même lien.", "Weten hoe u aankomt en vertrekt, laat ons toe uw chauffeur, uw shuttle en uw kamer op het juiste moment te regelen. Staan uw plannen nog niet vast, zeg het: u kunt met dezelfde link terugkomen naar dit formulier."),
  arrKnown: t("Your arrival", "Votre arrivée", "Uw aankomst"),
  depKnown: t("Your departure", "Votre départ", "Uw vertrek"),
  known: t("I know my details", "Je connais mes informations", "Ik ken mijn gegevens"),
  later: t("Not yet, I will add them later", "Pas encore, je les ajouterai plus tard", "Nog niet, ik vul ze later aan"),
  mode: t("Travelling by", "Moyen de transport", "Reizend met"),
  plane: t("Plane", "Avion", "Vliegtuig"), train: t("Train", "Train", "Trein"), car: t("Car", "Voiture", "Auto"),
  date: t("Date", "Date", "Datum"), time: t("Time", "Heure", "Uur"),
  place: t("Airport or station", "Aéroport ou gare", "Luchthaven of station"),
  number: t("Flight or train number", "Numéro de vol ou de train", "Vlucht- of treinnummer"),
  contact: t("How to reach you", "Comment vous joindre", "Hoe wij u bereiken"),
  contactHelp: t("We write only when there is something useful to tell you. Email is the easiest from abroad.", "Nous n'écrivons que lorsque nous avons quelque chose d'utile à vous dire. L'email est le plus simple depuis l'étranger.", "Wij schrijven alleen als wij u iets nuttigs te zeggen hebben. E-mail is het eenvoudigst vanuit het buitenland."),
  email: t("Email", "Email", "E-mail"), phone: t("Mobile phone, with country code", "Téléphone portable, avec indicatif", "Gsm, met landcode"),
  note: t("Anything you would like us to know", "Ce que vous souhaitez nous dire", "Wat u ons nog wilt laten weten"),
  hotel: t("House", "Maison", "Huis"), nights: t("Nights", "Nuits", "Nachten"), adults: t("Number of adults", "Nombre d'adultes", "Aantal volwassenen"),
  room: t("Room category", "Catégorie de chambre", "Kamertype"),
  accoTitle: t("Your accommodation request", "Votre demande d'hébergement", "Uw accommodatieaanvraag"),
  elseTitle: t("Where you will be staying", "Où vous logerez", "Waar u verblijft"),
  placeName: t("Name of the hotel, house or guest house", "Nom de l'hôtel, de la maison ou de la maison d'hôtes", "Naam van het hotel, huis of gastenverblijf"),
  placeAddress: t("Address", "Adresse", "Adres"),
  driverTitle: t("Your transfers", "Vos transferts", "Uw transfers"),
  driverNo: t("Noted: you will organise your own arrival and departure. You can change your mind at any time from this page.", "C'est noté : vous organisez vous-même votre arrivée et votre départ. Vous pouvez changer d'avis à tout moment depuis cette page.", "Genoteerd: u regelt zelf uw aankomst en vertrek. U kunt op elk moment van gedachten veranderen via deze pagina."),
  passengers: t("Passengers", "Passagers", "Passagiers"), luggage: t("Suitcases", "Valises", "Koffers"),
  depNeeded: t("A driver for your departure as well", "Un chauffeur aussi pour votre départ", "Ook een chauffeur voor uw vertrek"),
  yes: t("Yes", "Oui", "Ja"), no: t("No", "Non", "Nee"),
  dropoff: t("Where should the driver take you", "Où le chauffeur doit-il vous déposer", "Waar moet de chauffeur u afzetten"),
  shuttleTitle: t("Your seats on the shuttles", "Vos places dans les navettes", "Uw plaatsen in de shuttles"),
  days: t("Days", "Jours", "Dagen"), pickup: t("Pick up point", "Point de prise en charge", "Opstapplaats"), seats: t("Number of seats", "Nombre de places", "Aantal plaatsen"),
  concTitle: t("Your concierge request", "Votre demande de conciergerie", "Uw conciërgeaanvraag"),
  ctype: t("Your request", "Votre demande", "Uw aanvraag"), house: t("House or place you have in mind, if any", "Maison ou lieu souhaité, si vous en avez un", "Huis of plaats die u in gedachten heeft, indien van toepassing"),
  day: t("Day", "Jour", "Dag"), people: t("Number of people", "Nombre de personnes", "Aantal personen"),
  details: t("Details", "Précisions", "Details"),
  fee: t("I accept the service fee of 30 € per request (60 € per rental car, on quote for a particular request), confirmed before anything is set in motion and settled in advance.", "J'accepte les frais de service de 30 € par demande (60 € par véhicule de location, sur devis pour une demande particulière), confirmés avant toute démarche et réglés d'avance.", "Ik aanvaard de servicevergoeding van 30 € per aanvraag (60 € per huurwagen, op offerte voor een bijzondere aanvraag), vooraf bevestigd en vooraf betaald."),
  charterTitle: t("Guest charter", "Charte de l'invité", "Gastencharter"),
  charterRead: t("I have read the guest charter", "J'ai lu la charte de l'invité", "Ik heb het gastencharter gelezen"),
  anonTitle: t("Your details", "Vos coordonnées", "Uw gegevens"),
  anonHelp: t("This page works best from the link in your personal invitation. If you do not have it at hand, leave us your details and your dedicated team will come back to you.", "Cette page fonctionne au mieux depuis le lien de votre invitation personnelle. Si vous ne l'avez pas sous la main, laissez-nous vos coordonnées et votre équipe dédiée reviendra vers vous.", "Deze pagina werkt het best via de link in uw persoonlijke uitnodiging. Heeft u die niet bij de hand, laat dan uw gegevens achter en uw toegewijde team neemt contact met u op."),
  fullName: t("Full name, as on your invitation", "Nom complet, comme sur votre invitation", "Volledige naam, zoals op uw uitnodiging"),
  message: t("Your message", "Votre message", "Uw bericht")
};

const DONE = {
  confirm: t("Thank you. Your answers are with your dedicated team, who will prepare everything around them. You can come back to change them at any time with the same link.", "Merci. Vos réponses sont entre les mains de votre équipe dédiée, qui prépare tout autour d'elles. Vous pouvez revenir les modifier à tout moment avec le même lien.", "Dank u. Uw antwoorden zijn bij uw toegewijde team, dat alles eromheen voorbereidt. U kunt ze op elk moment wijzigen met dezelfde link."),
  accommodation: t("Thank you. We have your request. Yes I Do will come back to you with the hotel's confirmation and its secure payment link.", "Merci. Votre demande est bien reçue. Yes I Do revient vers vous avec la confirmation de l'hôtel et son lien de paiement sécurisé.", "Dank u. Wij hebben uw aanvraag. Yes I Do komt bij u terug met de bevestiging van het hotel en zijn beveiligde betaallink."),
  elsewhere: t("Thank you. Your welcome and your transfers will be arranged accordingly.", "Merci. Votre accueil et vos transferts seront prévus en conséquence.", "Dank u. Uw onthaal en uw transfers worden daarop afgestemd."),
  driver: t("Thank you. Your dedicated team will send your details to the chauffeur company, which confirms the booking and its price directly with you.", "Merci. Votre équipe dédiée transmet vos informations à la société de chauffeurs, qui confirme la réservation et son prix directement avec vous.", "Dank u. Uw toegewijde team bezorgt uw gegevens aan het chauffeursbedrijf, dat de boeking en de prijs rechtstreeks met u bevestigt."),
  driverNo: t("Thank you, it is noted.", "Merci, c'est noté.", "Dank u, het is genoteerd."),
  shuttle: t("Thank you. Your seats are noted; the coach company will confirm them and your team will remind you of each departure the day before.", "Merci. Vos places sont notées ; la société d'autocars les confirmera et votre équipe vous rappellera chaque départ la veille.", "Dank u. Uw plaatsen zijn genoteerd; het busbedrijf bevestigt ze en uw team herinnert u de dag ervoor aan elk vertrek."),
  concierge: t("Thank you. We confirm availability and come back to you before anything is set in motion.", "Merci. Nous vérifions la disponibilité et revenons vers vous avant toute démarche.", "Dank u. Wij controleren de beschikbaarheid en komen bij u terug voordat er iets in gang wordt gezet."),
  charter: t("Thank you for reading it. See you in Saint Émilion.", "Merci de l'avoir lue. À très bientôt à Saint Émilion.", "Dank u om het te lezen. Tot binnenkort in Saint Émilion."),
  anon: t("Thank you. Your dedicated team will come back to you shortly.", "Merci. Votre équipe dédiée revient vers vous très vite.", "Dank u. Uw toegewijde team neemt snel contact met u op.")
};

/* ---------- utilitaires ---------- */
function fmtDate(iso, lang) {
  const d = new Date(iso + "T12:00:00Z");
  return d.toLocaleDateString(lang === "fr" ? "fr-FR" : lang === "nl" ? "nl-NL" : "en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
}
function invitedEvents(cfg, hh) {
  if (Array.isArray(hh.events) && hh.events.length) return cfg.events.filter(e => hh.events.includes(e.id));
  return cfg.events.filter(e => !e.inner || hh.inner);
}
function people(hh) {
  const list = (hh.members || []).map(m => ({ id: m.id, name: m.name, child: !!m.child, age: m.age || "" }));
  return list;
}
function firstNames(hh) {
  const n = people(hh).filter(m => !m.child).map(m => m.name.split(" ")[0]);
  if (!n.length) return hh.name;
  return n.length === 1 ? n[0] : n.slice(0, -1).join(", ") + " & " + n[n.length - 1];
}

/* ---------- construction des formulaires ---------- */
function build(cfg, hh, form, lang, extra, saved) {
  lang = LANGS.includes(lang) ? lang : "en";
  const x = (o) => L(o, lang);
  extra = extra || {};
  const answers = saved || {};
  const conf = (answers.confirm || {}).data || {};
  const steps = [];
  let done = DONE[form];

  if (!hh) {
    steps.push({ title: x(TX.anonTitle), help: x(TX.anonHelp), fields: [
      { name: "full_name", type: "text", label: x(TX.fullName), required: true },
      { name: "email", type: "email", label: x(TX.email), required: true },
      { name: "phone", type: "tel", label: x(TX.phone) },
      { name: "message", type: "textarea", label: x(TX.message), required: form !== "confirm" }
    ] });
    return { form, lang, matched: false, steps, values: {}, done: x(DONE.anon) };
  }

  const ppl = people(hh);
  const pOpts = ppl.map(p => ({ v: p.id, l: p.name }));
  const evs = invitedEvents(cfg, hh);
  const defaults = {};
  const travelFields = (prefix, label, dates) => {
    const k = prefix + "_known";
    return [
      { name: k, type: "radio", label: x(label), required: true, options: [{ v: "yes", l: x(TX.known) }, { v: "later", l: x(TX.later) }] },
      { name: prefix + "_mode", type: "radio", label: x(TX.mode), required: true, showIf: { f: k, eq: "yes" }, options: [{ v: "plane", l: x(TX.plane) }, { v: "train", l: x(TX.train) }, { v: "car", l: x(TX.car) }] },
      { name: prefix + "_date", type: "select", label: x(TX.date), required: true, showIf: { f: k, eq: "yes" }, options: dates.map(d => ({ v: d, l: fmtDate(d, lang) })) },
      { name: prefix + "_time", type: "time", label: x(TX.time), required: true, showIf: { f: k, eq: "yes" } },
      { name: prefix + "_place", type: "select", label: x(TX.place), required: true, showIf: { f: prefix + "_mode", in: ["plane", "train"] }, options: cfg.places.map(p => ({ v: p.id, l: x(p.label) })) },
      { name: prefix + "_number", type: "text", label: x(TX.number), showIf: { f: prefix + "_mode", in: ["plane", "train"] }, placeholder: "AF 1234 · TGV 8521" }
    ];
  };

  if (form === "confirm") {
    const who = evs.map(e => { defaults["att__" + e.id] = pOpts.map(o => o.v); return { name: "att__" + e.id, type: "people", label: x(e.label), options: pOpts }; });
    if (hh.plusOne) who.push({ name: "plus_one", type: "text", label: x(TX.plusOne) });
    steps.push({ title: x(TX.who), help: x(TX.whoHelp) + " " + x(UI[lang].tapToRemove), fields: who });

    const dinner = evs.find(e => e.dinner);
    if (dinner) {
      const tf = [];
      ppl.forEach(p => {
        const opts = (p.child ? cfg.menus.child.concat(cfg.menus.adult) : cfg.menus.adult).map(m => ({ v: m.id, l: x(m.label) }));
        if (p.child) defaults["menu__" + p.id] = cfg.menus.child[0].id;
        tf.push({ name: "menu__" + p.id, type: "radio", label: x(TX.menuFor) + " " + p.name, required: true, options: opts, showIf: { f: "att__" + dinner.id, has: p.id } });
        tf.push({ name: "diet__" + p.id, type: "text", label: x(TX.dietFor) + " " + p.name, placeholder: x(TX.dietPh), showIf: { f: "att__" + dinner.id, has: p.id } });
      });
      if (hh.plusOne) {
        tf.push({ name: "menu__plus", type: "radio", label: x(TX.menuFor) + " " + x(TX.plusOne).toLowerCase(), required: true, options: cfg.menus.adult.map(m => ({ v: m.id, l: x(m.label) })), showIf: { f: "plus_one", filled: true } });
        tf.push({ name: "diet__plus", type: "text", label: x(TX.dietFor) + " " + x(TX.plusOne).toLowerCase(), placeholder: x(TX.dietPh), showIf: { f: "plus_one", filled: true } });
      }
      tf.push({ name: "_nodinner", type: "info", text: x(TX.noDinner), showIf: { f: "att__" + dinner.id, empty: true } });
      steps.push({ title: x(TX.table), help: x(TX.tableHelp), fields: tf });
    }

    steps.push({ title: x(TX.travel), help: x(TX.travelHelp), fields: travelFields("arr", TX.arrKnown, cfg.arrivalDates).concat(travelFields("dep", TX.depKnown, cfg.departureDates)) });
    defaults.email = hh.email || ""; defaults.phone = hh.phone || "";
    steps.push({ title: x(TX.contact), help: x(TX.contactHelp), fields: [
      { name: "email", type: "email", label: x(TX.email), required: true },
      { name: "phone", type: "tel", label: x(TX.phone), required: true },
      { name: "note", type: "textarea", label: x(TX.note) }
    ] });
  }

  else if (form === "accommodation") {
    const hotel = cfg.hotels.find(h => h.id === extra.hotel);
    const f = [];
    if (hotel) { f.push({ name: "hotel", type: "fixed", label: x(TX.hotel), value: hotel.id, text: hotel.name }); defaults.hotel = hotel.id; }
    else f.push({ name: "hotel", type: "select", label: x(TX.hotel), required: true, options: cfg.hotels.map(h => ({ v: h.id, l: h.name })) });
    const roomsFor = (h) => h.rooms.map(r => ({ v: L(r, "en"), l: x(r) }));
    if (hotel) f.push({ name: "room", type: "select", label: x(TX.room), required: true, options: roomsFor(hotel) });
    else cfg.hotels.forEach(h => f.push({ name: "room__" + h.id.replace(/\s/g, "_"), type: "select", label: x(TX.room), required: true, options: roomsFor(h), showIf: { f: "hotel", eq: h.id } }));
    f.push({ name: "nights", type: "checkboxes", label: x(TX.nights), required: true, options: cfg.nights.map(n => ({ v: n.id, l: x(n.label) })) });
    f.push({ name: "adults", type: "number", label: x(TX.adults), required: true, min: 1, max: 8 });
    f.push({ name: "email", type: "email", label: x(TX.email), required: true });
    f.push({ name: "phone", type: "tel", label: x(TX.phone), required: true });
    f.push({ name: "note", type: "textarea", label: x(TX.note) });
    const coming = Object.keys(conf).filter(k => k.startsWith("att__")).reduce((s, k) => Math.max(s, (conf[k] || []).length), 0);
    defaults.adults = String(Math.max(1, coming ? Math.min(coming, ppl.filter(p => !p.child).length || coming) : ppl.filter(p => !p.child).length || 1));
    defaults.nights = ["n3", "n4", "n5"];
    defaults.email = conf.email || hh.email || ""; defaults.phone = conf.phone || hh.phone || "";
    steps.push({ title: x(TX.accoTitle), fields: f });
  }

  else if (form === "elsewhere") {
    defaults.nights = ["n3", "n4", "n5"];
    steps.push({ title: x(TX.elseTitle), fields: [
      { name: "place_name", type: "text", label: x(TX.placeName), required: true },
      { name: "place_address", type: "text", label: x(TX.placeAddress) },
      { name: "nights", type: "checkboxes", label: x(TX.nights), required: true, options: cfg.nights.map(n => ({ v: n.id, l: x(n.label) })) },
      { name: "note", type: "textarea", label: x(TX.note) }
    ] });
  }

  else if (form === "driver") {
    const wants = extra.driver === "no" ? "no" : "yes";
    if (wants === "no") {
      done = DONE.driverNo;
      steps.push({ title: x(TX.driverTitle), fields: [{ name: "driver", type: "fixed", value: "no", text: x(TX.driverNo) }] });
    } else {
      const f = [{ name: "driver", type: "fixed", value: "yes", text: "" }];
      f.push({ name: "passengers", type: "number", label: x(TX.passengers), required: true, min: 1, max: 12 });
      f.push({ name: "luggage", type: "number", label: x(TX.luggage), min: 0, max: 20 });
      const arr = travelFields("arr", TX.arrKnown, cfg.arrivalDates).filter(q => q.name !== "arr_known");
      arr.forEach(q => { if (q.showIf && q.showIf.f === "arr_known") delete q.showIf; });
      arr[0].label = x(TX.arrKnown) + " · " + x(TX.mode).toLowerCase();
      f.push(...arr);
      f.push({ name: "dep_needed", type: "radio", label: x(TX.depNeeded), required: true, options: [{ v: "yes", l: x(TX.yes) }, { v: "no", l: x(TX.no) }] });
      const dep = travelFields("dep", TX.depKnown, cfg.departureDates).filter(q => q.name !== "dep_known");
      dep.forEach(q => { if (q.showIf && q.showIf.f === "dep_known") q.showIf = { f: "dep_needed", eq: "yes" }; });
      dep[0].label = x(TX.depKnown) + " · " + x(TX.mode).toLowerCase();
      f.push(...dep);
      f.push({ name: "dropoff", type: "text", label: x(TX.dropoff), required: true });
      f.push({ name: "note", type: "textarea", label: x(TX.note) });
      steps.push({ title: x(TX.driverTitle), fields: f });
      ["arr_mode", "arr_date", "arr_time", "arr_place", "arr_number", "dep_mode", "dep_date", "dep_time", "dep_place", "dep_number"].forEach(k => { if (conf[k]) defaults[k] = conf[k]; });
      defaults.dep_needed = "yes";
      defaults.passengers = String(Math.max(1, ppl.length));
      const acco = (answers.accommodation || {}).data, els = (answers.elsewhere || {}).data;
      if (acco && acco.hotel) { const h = cfg.hotels.find(z => z.id === acco.hotel); defaults.dropoff = h ? h.name : acco.hotel; }
      else if (els && els.place_name) defaults.dropoff = els.place_name + (els.place_address ? ", " + els.place_address : "");
    }
  }

  else if (form === "shuttle") {
    const evIds = evs.map(e => e.id);
    const days = cfg.shuttleDays.filter(d => evIds.includes(d.event) && (!d.inner || hh.inner));
    defaults.days = days.filter(d => !d.inner).map(d => d.id);
    defaults.seats = String(Math.max(1, ppl.length));
    steps.push({ title: x(TX.shuttleTitle), fields: [
      { name: "days", type: "checkboxes", label: x(TX.days), required: true, options: days.map(d => ({ v: d.id, l: x(d.label) })) },
      { name: "pickup", type: "select", label: x(TX.pickup), required: true, options: cfg.pickups.map(p => ({ v: L(p, "en"), l: x(p) })) },
      { name: "seats", type: "number", label: x(TX.seats), required: true, min: 1, max: 12 }
    ] });
    const acco = (answers.accommodation || {}).data;
    if (acco && acco.hotel) { const h = cfg.hotels.find(z => z.id === acco.hotel); const p = h && cfg.pickups.find(pp => L(pp, "en") === h.name.replace("Mercure Libourne Saint Émilion", "Mercure Libourne")); if (p) defaults.pickup = L(p, "en"); }
  }

  else if (form === "concierge") {
    defaults.people = String(Math.max(1, ppl.filter(p => !p.child).length));
    steps.push({ title: x(TX.concTitle), fields: [
      { name: "ctype", type: "select", label: x(TX.ctype), required: true, options: cfg.conciergeTypes.map(c => ({ v: L(c, "en"), l: x(c) })) },
      { name: "house", type: "text", label: x(TX.house) },
      { name: "day", type: "select", label: x(TX.day), required: true, options: cfg.conciergeDays.map(d => ({ v: d, l: fmtDate(d, lang) })) },
      { name: "people", type: "number", label: x(TX.people), required: true, min: 1, max: 20 },
      { name: "note", type: "textarea", label: x(TX.details), required: true },
      { name: "fee_ok", type: "check", label: x(TX.fee), required: true }
    ] });
  }

  else if (form === "charter") {
    steps.push({ title: x(TX.charterTitle), fields: [{ name: "read", type: "check", label: x(TX.charterRead), required: true }] });
  }

  const savedVals = (answers[form] && answers[form].data) || {};
  const values = Object.assign({}, defaults, form === "accommodation" && extra.hotel && savedVals.hotel !== extra.hotel ? {} : savedVals);
  if (form === "accommodation" && extra.hotel) values.hotel = extra.hotel;
  return {
    form, lang, matched: true, inner: !!hh.inner,
    greeting: x(UI[lang].hello === "Chers" && ppl.filter(p => !p.child).length === 1 ? t("Dear", "Cher", "Beste") : { en: UI.en.hello, fr: UI.fr.hello, nl: UI.nl.hello }) + " " + firstNames(hh),
    steps, values, done: x(done), submittedAt: answers[form] ? answers[form].at : null
  };
}

/* ---------- règles d'affichage, identiques côté navigateur ---------- */
function visible(field, v) {
  const c = field.showIf; if (!c) return true;
  const val = v[c.f];
  if ("eq" in c) return val === c.eq;
  if ("in" in c) return c.in.includes(val);
  if ("has" in c) return Array.isArray(val) && val.includes(c.has);
  if ("filled" in c) return !!(val && String(val).trim());
  if ("empty" in c) return !val || (Array.isArray(val) && !val.length);
  return true;
}

/* ---------- validation serveur ---------- */
function validate(schema, input) {
  const out = {}, errors = [];
  const v = Object.assign({}, input);
  schema.steps.forEach(st => st.fields.forEach(f => {
    if (f.type === "info") return;
    if (f.type === "fixed") { out[f.name] = f.value; v[f.name] = f.value; return; }
    if (!visible(f, v)) return;
    let val = v[f.name];
    const optVals = (f.options || []).map(o => o.v);
    if (["people", "checkboxes"].includes(f.type)) {
      val = Array.isArray(val) ? val.filter(z => optVals.includes(z)) : [];
      if (f.required && !val.length) errors.push(f.name);
    } else if (["radio", "select"].includes(f.type)) {
      val = optVals.includes(val) ? val : "";
      if (f.required && !val) errors.push(f.name);
    } else if (f.type === "check") {
      val = val === true || val === "true" || val === "on";
      if (f.required && !val) errors.push(f.name);
    } else if (f.type === "number") {
      const n = parseInt(val, 10);
      val = isNaN(n) ? "" : Math.min(f.max ?? 999, Math.max(f.min ?? 0, n));
      if (f.required && val === "") errors.push(f.name);
    } else {
      val = (val == null ? "" : String(val)).trim().slice(0, f.type === "textarea" ? 2000 : 200);
      if (f.type === "email" && val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) errors.push(f.name);
      if (f.type === "time" && val && !/^\d{2}:\d{2}$/.test(val)) errors.push(f.name);
      if (f.required && !val) errors.push(f.name);
    }
    out[f.name] = val; v[f.name] = val;
  }));
  return { data: out, errors };
}

/* ---------- lignes Excel ---------- */
const yn = (b) => (b ? "oui" : "non");
const stamp = () => new Date().toISOString().replace("T", " ").slice(0, 16);
function rows(cfg, hh, form, data, lang) {
  const T = cfg.excel.tables, now = stamp();
  if (!hh) return [[T.other, [[now, form, data.full_name || "", data.email || "", data.phone || "", data.message || "", lang]]]];
  const base = [now, hh.key, hh.name];
  const nightsCols = (n) => cfg.nights.map(x => yn((n || []).includes(x.id)));
  const menuLabel = (id) => { const m = cfg.menus.adult.concat(cfg.menus.child).find(z => z.id === id); return m ? L(m.label, "fr") : ""; };
  const placeLabel = (id) => { const p = cfg.places.find(z => z.id === id); return p ? L(p.label, "fr") : ""; };
  const trav = (p) => [data[p + "_known"] || (data[p + "_mode"] ? "yes" : ""), data[p + "_mode"] || "", data[p + "_date"] || "", data[p + "_time"] || "", placeLabel(data[p + "_place"]), data[p + "_number"] || ""];
  if (form === "confirm") {
    const evs = invitedEvents(cfg, hh);
    const evCell = (eid, pid) => (evs.find(e => e.id === eid) ? yn((data["att__" + eid] || []).includes(pid)) : "");
    const r = people(hh).map(p => base.concat([p.name, yn(p.child), p.age, ...cfg.events.map(e => evCell(e.id, p.id)), menuLabel(data["menu__" + p.id]), data["diet__" + p.id] || "", lang, yn(hh.inner)]));
    if (data.plus_one) r.push(base.concat([data.plus_one, "non", "", ...cfg.events.map(e => evs.find(z => z.id === e.id) ? "à préciser" : ""), menuLabel(data.menu__plus), data.diet__plus || "", lang, yn(hh.inner)]));
    return [[T.guests, r], [T.travel, [base.concat(trav("arr"), trav("dep"), [data.email || "", data.phone || "", data.note || ""])]]];
  }
  if (form === "accommodation") {
    const room = data.room || Object.keys(data).filter(k => k.startsWith("room__")).map(k => data[k]).find(Boolean) || "";
    return [[T.accommodation, [base.concat([data.email, data.phone, data.hotel, data.adults, ...nightsCols(data.nights), (data.nights || []).length, room, data.note || "", "Demande reçue"])]]];
  }
  if (form === "elsewhere") return [[T.elsewhere, [base.concat([data.place_name, data.place_address || "", ...nightsCols(data.nights), data.note || ""])]]];
  if (form === "driver") return [[T.driver, [base.concat([data.driver, data.passengers || "", data.luggage || "", ...trav("arr").slice(1), data.dep_needed || "", ...trav("dep").slice(1), data.dropoff || "", data.note || ""])]]];
  if (form === "shuttle") return [[T.shuttle, [base.concat([...cfg.shuttleDays.map(d => yn((data.days || []).includes(d.id))), data.pickup, data.seats])]]];
  if (form === "concierge") return [[T.concierge, [base.concat([data.ctype, data.house || "", data.day, data.people, data.note, yn(data.fee_ok), "Demande reçue"])]]];
  if (form === "charter") return [[T.charter, [base.concat([yn(data.read)])]]];
  return [];
}

/* En-têtes des tableaux Excel, dans l'ordre exact des colonnes ci-dessus */
function headers(cfg) {
  const ev = cfg.events.map(e => L(e.label, "fr").split(",")[0]);
  const tr = (p) => [p + " connu", p + " moyen", p + " date", p + " heure", p + " lieu", p + " numéro"];
  const n = cfg.nights.map(x => "Nuit " + L(x.label, "fr").toLowerCase());
  const base = ["Horodatage", "Clé", "Foyer"];
  const T = cfg.excel.tables;
  return {
    [T.guests]: base.concat(["Invité", "Enfant", "Âge", ...ev, "Menu", "Régime et allergies", "Langue", "Proches"]),
    [T.travel]: base.concat(tr("Arrivée"), tr("Départ"), ["Email", "Téléphone", "Remarque"]),
    [T.accommodation]: base.concat(["Email", "Téléphone", "Hôtel", "Adultes", ...n, "Nuits totales", "Catégorie", "Remarque", "Statut"]),
    [T.elsewhere]: base.concat(["Hébergement", "Adresse", ...n, "Remarque"]),
    [T.driver]: base.concat(["Chauffeur", "Passagers", "Valises", "Arrivée moyen", "Arrivée date", "Arrivée heure", "Arrivée lieu", "Arrivée numéro", "Départ souhaité", "Départ moyen", "Départ date", "Départ heure", "Départ lieu", "Départ numéro", "Dépose", "Remarque"]),
    [T.shuttle]: base.concat([...cfg.shuttleDays.map(d => L(d.label, "fr").split(",")[0]), "Prise en charge", "Places"]),
    [T.concierge]: base.concat(["Demande", "Maison", "Jour", "Personnes", "Précisions", "Frais acceptés", "Statut"]),
    [T.charter]: base.concat(["Charte lue"]),
    [T.other]: ["Horodatage", "Formulaire", "Nom", "Email", "Téléphone", "Message", "Langue"]
  };
}

/* ---------- état d'avancement d'un foyer, pour le suivi ---------- */
function status(cfg, hh, ans) {
  const c = (ans.confirm || {}).data;
  const travelOk = c && c.arr_known === "yes" && c.dep_known === "yes";
  const acco = ans.accommodation ? "Hôtel partenaire : " + ans.accommodation.data.hotel : ans.elsewhere ? "Ailleurs : " + ans.elsewhere.data.place_name : "";
  return {
    key: hh.key, foyer: hh.name, proches: yn(hh.inner),
    confirmation: c ? "reçue" : "en attente",
    voyage: !c ? "" : travelOk ? "complet" : "à compléter",
    hebergement: acco || "non renseigné",
    chauffeur: ans.driver ? (ans.driver.data.driver === "yes" ? "oui" : "non") : "non renseigné",
    navettes: ans.shuttle ? (ans.shuttle.data.days || []).length + " jour(s)" : "non renseigné",
    charte: ans.charter ? "lue" : "",
    derniere_activite: Object.values(ans).map(a => a.at).sort().pop() || ""
  };
}

module.exports = { FORMS, LANGS, UI, build, validate, visible, rows, headers, status, people, invitedEvents, firstNames };
