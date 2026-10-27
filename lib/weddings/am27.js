/* =====================================================================
   MARIAGE ALLETA & MARK · Saint Émilion · 3 au 7 juin 2027
   Tout ce qui est propre à ce mariage vit ici : événements, menus,
   maisons, navettes, textes. Pour un autre mariage, on copie ce fichier.
   Les textes sont en trois langues : { en, fr, nl }.
   ===================================================================== */
const t = (en, fr, nl) => ({ en, fr, nl });

module.exports = {
  id: "AM27",
  couple: "Alleta & Mark",
  site: process.env.SITE_URL_AM27 || "https://REMPLACER-adresse-du-site.squarespace.com",

  /* Classeur Excel de réponses (.xlsx avec tableaux nommés), chemin depuis la racine du drive MS_DRIVE */
  excel: {
    path: "Listes d'invités/Alleta et Mark/Réponses Alleta et Mark.xlsx",
    tables: { guests: "Invites", travel: "Voyages", accommodation: "Hebergement", elsewhere: "Ailleurs", driver: "Transferts", shuttle: "Navettes", concierge: "Conciergerie", charter: "Charte", other: "Messages" }
  },

  /* Événements. inner: réservé au cercle des proches (proches = oui dans la liste). dinner: on demande le menu. */
  events: [
    { id: "fri_am",    inner: true, label: t("Friday morning in Bordeaux", "Vendredi matin à Bordeaux", "Vrijdagochtend in Bordeaux") },
    { id: "rehearsal", inner: true, label: t("Rehearsal dinner, Friday", "Rehearsal dinner, vendredi", "Rehearsal dinner, vrijdag") },
    { id: "welcome",   label: t("Welcome party, Friday 4 June", "Soirée de bienvenue, vendredi 4 juin", "Welkomstfeest, vrijdag 4 juni") },
    { id: "wedding",   dinner: true, label: t("The wedding, Saturday 5 June", "Le mariage, samedi 5 juin", "Het huwelijk, zaterdag 5 juni") },
    { id: "brunch",    label: t("Farewell brunch, Sunday 6 June", "Brunch d'au revoir, dimanche 6 juin", "Afscheidsbrunch, zondag 6 juni") }
  ],

  /* Menus du dîner du samedi. À confirmer avec les mariés et le traiteur : seuls ces libellés changent. */
  menus: {
    adult: [
      { id: "meat", label: t("Meat", "Viande", "Vlees") },
      { id: "fish", label: t("Fish", "Poisson", "Vis") },
      { id: "veg",  label: t("Vegetarian", "Végétarien", "Vegetarisch") }
    ],
    child: [ { id: "child", label: t("Children's menu", "Menu enfant", "Kindermenu") } ]
  },

  nights: [
    { id: "n3", label: t("Thursday 3", "Jeudi 3", "Donderdag 3") },
    { id: "n4", label: t("Friday 4", "Vendredi 4", "Vrijdag 4") },
    { id: "n5", label: t("Saturday 5", "Samedi 5", "Zaterdag 5") },
    { id: "n6", label: t("Sunday 6", "Dimanche 6", "Zondag 6") }
  ],

  arrivalDates:   ["2027-06-01", "2027-06-02", "2027-06-03", "2027-06-04", "2027-06-05"],
  departureDates: ["2027-06-05", "2027-06-06", "2027-06-07", "2027-06-08", "2027-06-09"],
  places: [
    { id: "BOD", label: t("Bordeaux Mérignac airport", "Aéroport de Bordeaux Mérignac", "Luchthaven Bordeaux Mérignac") },
    { id: "BSJ", label: t("Bordeaux Saint Jean station", "Gare de Bordeaux Saint Jean", "Station Bordeaux Saint Jean") },
    { id: "LIB", label: t("Libourne station", "Gare de Libourne", "Station Libourne") },
    { id: "OTH", label: t("Other", "Autre", "Andere") }
  ],

  hotels: [
    { id: "Pavie", name: "Hôtel de Pavie", rooms: [t("Suite", "Suite", "Suite")] },
    { id: "Grand Barrail", name: "Château Grand Barrail", rooms: [t("Room", "Chambre", "Kamer"), t("Suite", "Suite", "Suite")] },
    { id: "Ducs de Sienne", name: "Aux Ducs de Sienne", rooms: [t("Classic room", "Chambre classique", "Classic kamer"), t("Superior room", "Chambre supérieure", "Superior kamer"), t("Deluxe room", "Chambre deluxe", "Deluxe kamer"), t("Quadruple deluxe, up to 4", "Quadruple deluxe, jusqu'à 4", "Quadruple deluxe, tot 4"), t("Terrace suite, up to 4", "Suite terrasse, jusqu'à 4", "Terrassuite, tot 4")] },
    { id: "Mercure Libourne", name: "Mercure Libourne Saint Émilion", rooms: [t("Standard room", "Chambre standard", "Standaardkamer"), t("Privilege room with balcony", "Chambre privilège avec balcon", "Privilegekamer met balkon")] },
    { id: "Logis des Remparts", name: "Au Logis des Remparts", rooms: [t("Double room", "Chambre double", "Tweepersoonskamer"), t("Double room, garden view", "Chambre double vue jardin", "Tweepersoonskamer met tuinzicht"), t("Superior room", "Chambre supérieure", "Superior kamer"), t("Prestige room", "Chambre prestige", "Prestigekamer"), t("Prestige duo suite", "Suite duo prestige", "Prestige duo suite")] }
  ],

  /* Navettes : jours proposés (lien avec les événements) et points de prise en charge */
  shuttleDays: [
    { id: "fri_bdx", inner: true, event: "fri_am", label: t("Friday afternoon, Bordeaux to Saint Émilion", "Vendredi après-midi, Bordeaux vers Saint Émilion", "Vrijdagnamiddag, Bordeaux naar Saint Émilion") },
    { id: "fri", event: "welcome", label: t("Friday evening, welcome party", "Vendredi soir, soirée de bienvenue", "Vrijdagavond, welkomstfeest") },
    { id: "sat", event: "wedding", label: t("Saturday, the wedding and the return", "Samedi, le mariage et le retour", "Zaterdag, het huwelijk en de terugrit") },
    { id: "sun", event: "brunch", label: t("Sunday, the brunch", "Dimanche, le brunch", "Zondag, de brunch") }
  ],
  pickups: [
    t("Hôtel de Pavie", "Hôtel de Pavie", "Hôtel de Pavie"),
    t("Château Grand Barrail", "Château Grand Barrail", "Château Grand Barrail"),
    t("Aux Ducs de Sienne", "Aux Ducs de Sienne", "Aux Ducs de Sienne"),
    t("Mercure Libourne", "Mercure Libourne", "Mercure Libourne"),
    t("Au Logis des Remparts", "Au Logis des Remparts", "Au Logis des Remparts"),
    t("Village meeting point", "Point de rendez-vous du village", "Verzamelpunt in het dorp"),
    t("Elsewhere, the team will advise me", "Ailleurs, l'équipe me conseillera", "Elders, het team adviseert mij")
  ],

  conciergeTypes: [
    t("Spa", "Spa", "Spa"), t("Restaurant table", "Table au restaurant", "Tafel in een restaurant"), t("Wine tasting or château visit", "Dégustation ou visite de château", "Wijnproeverij of châteaubezoek"),
    t("Rental car", "Véhicule de location", "Huurwagen"), t("Driver outside the wedding", "Chauffeur en dehors du mariage", "Chauffeur buiten het huwelijk"), t("Extra nights", "Nuits supplémentaires", "Extra nachten"), t("Something else", "Autre demande", "Iets anders")
  ],
  conciergeDays: ["2027-06-02", "2027-06-03", "2027-06-04", "2027-06-05", "2027-06-06", "2027-06-07", "2027-06-08"]
};
