-- Yes I Do · schéma v1 · le modèle de données de la section 3 du plan de construction.
-- Neuf objets, chacun avec un seul propriétaire et une seule façon de naître.
-- On ne supprime jamais : les lignes se désactivent (desactive = true).

CREATE TABLE IF NOT EXISTS mariage (
  id              serial PRIMARY KEY,
  code            text NOT NULL UNIQUE,              -- AK00, AM27 : préfixe des clés de foyer
  prenoms         text NOT NULL,                     -- « Awa et Kévin »
  statut          text NOT NULL DEFAULT 'En préparation', -- Prospect, Signé, En préparation, Clos
  date_mariage    date,
  lieu            text,
  pays            text DEFAULT 'FR',
  pack            text,
  langue_defaut   text NOT NULL DEFAULT 'fr',
  date_remise     date,                              -- remise de la liste par les mariés
  date_arret      date,                              -- clôture contractuelle de la liste
  prevu_contrat   integer,
  seuil           integer,
  site            text,                              -- adresse de la plateforme invités
  boite_email     text,                              -- boîte partagée du mariage
  dossier         text,                              -- dossier SharePoint : Listes d'invités / Prénoms
  parametres      jsonb NOT NULL DEFAULT '{}'::jsonb,  -- périodes, menus, maisons, cadence des rappels, modules activés, proches, quotas
  desactive       boolean NOT NULL DEFAULT false,
  cree_le         timestamptz NOT NULL DEFAULT now(),
  modifie_le      timestamptz NOT NULL DEFAULT now()
)
;;
CREATE TABLE IF NOT EXISTS utilisateur (
  id              serial PRIMARY KEY,
  nom             text NOT NULL,
  email           text,
  role            text NOT NULL DEFAULT 'agent',     -- administrateur, agent, planner, maries
  mariages        jsonb NOT NULL DEFAULT '[]'::jsonb, -- codes des mariages autorisés ; [] = tous pour un administrateur
  secret          text,                              -- empreinte du mot de passe (phase ultérieure)
  desactive       boolean NOT NULL DEFAULT false,
  cree_le         timestamptz NOT NULL DEFAULT now()
)
;;
CREATE TABLE IF NOT EXISTS contact_recu (
  id              serial PRIMARY KEY,
  mariage_id      integer NOT NULL REFERENCES mariage(id),
  nom_repertoire  text NOT NULL,
  numeros         jsonb NOT NULL DEFAULT '[]'::jsonb,
  source          text NOT NULL,                     -- Export Épouse, Export Époux, Liste Tante Awa
  cote            text,
  fichier         text,                              -- nom du fichier archivé
  recu_le         timestamptz NOT NULL DEFAULT now(),
  brut            jsonb                              -- la fiche telle que lue, preuve
)
;;
CREATE TABLE IF NOT EXISTS foyer (
  id              serial PRIMARY KEY,
  mariage_id      integer NOT NULL REFERENCES mariage(id),
  cle             text NOT NULL,                     -- clé du foyer, posée à la qualification, jamais réutilisée
  nom_affichage   text NOT NULL,                     -- « Famille Miller » ; défaut : nom de répertoire
  nom_repertoire  text,
  telephone       text,
  telephone_2     text,
  cote            text,                              -- Épouse, Époux
  invitation      text,                              -- Pour deux, Unique, Ne sait pas encore
  lien            text,                              -- lien avec les mariés
  precision       text,                              -- proche de rattachement
  assistance      text,                              -- type d'assistance (liste du mariage)
  nb_enfants      integer NOT NULL DEFAULT 0,
  colonnes        jsonb NOT NULL DEFAULT '{}'::jsonb,  -- colonnes propres au mariage : présence, hébergement
  proches         boolean NOT NULL DEFAULT false,    -- cercle des proches (événements réservés)
  accompagnant    boolean NOT NULL DEFAULT false,    -- peut venir accompagné
  evenements      jsonb,                             -- identifiants d'événements si différents de la règle du mariage
  langue          text NOT NULL DEFAULT 'en',
  email           text,
  canal           text,                              -- canal préféré
  relais_id       integer REFERENCES foyer(id),      -- foyer relais (secrétariat de famille)
  statut          text NOT NULL DEFAULT 'En attente',-- En attente, Confirmé, Décliné, Cas particulier
  source          text,
  contact_recu_id integer REFERENCES contact_recu(id),
  desactive       boolean NOT NULL DEFAULT false,
  cree_le         timestamptz NOT NULL DEFAULT now(),
  modifie_le      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mariage_id, cle)
)
;;
CREATE INDEX IF NOT EXISTS foyer_mariage_idx ON foyer (mariage_id, desactive)
;;
CREATE TABLE IF NOT EXISTS personne (
  id              serial PRIMARY KEY,
  foyer_id        integer NOT NULL REFERENCES foyer(id),
  ordre           integer NOT NULL DEFAULT 1,
  code            text NOT NULL,                     -- m1, m2, c1 : identifiant dans le formulaire
  nom             text NOT NULL,
  enfant          boolean NOT NULL DEFAULT false,
  age             text,
  menu            text,
  regime          text,
  table_nom       text,
  place           text,
  presence        jsonb NOT NULL DEFAULT '{}'::jsonb,  -- par événement
  desactive       boolean NOT NULL DEFAULT false
)
;;
CREATE INDEX IF NOT EXISTS personne_foyer_idx ON personne (foyer_id)
;;
CREATE TABLE IF NOT EXISTS reponse (
  id              serial PRIMARY KEY,
  mariage_id      integer NOT NULL REFERENCES mariage(id),
  foyer_id        integer REFERENCES foyer(id),      -- vide : réponse sans foyer reconnu
  formulaire      text NOT NULL,                     -- confirm, accommodation, elsewhere, driver, shuttle, concierge, charter
  version         integer NOT NULL DEFAULT 1,        -- une nouvelle version par modification
  contenu         jsonb NOT NULL,
  langue          text,
  extra           jsonb,
  origine         text NOT NULL DEFAULT 'invite',    -- invite, appel, relais
  navigateur      text,
  cree_le         timestamptz NOT NULL DEFAULT now()
)
;;
CREATE INDEX IF NOT EXISTS reponse_foyer_idx ON reponse (foyer_id, formulaire, version)
;;
CREATE TABLE IF NOT EXISTS anomalie (
  id              serial PRIMARY KEY,
  mariage_id      integer NOT NULL REFERENCES mariage(id),
  foyer_id        integer REFERENCES foyer(id),
  personne_id     integer REFERENCES personne(id),
  type            text NOT NULL,
  detail          jsonb,
  detectee_le     timestamptz NOT NULL DEFAULT now(),
  etat            text NOT NULL DEFAULT 'ouverte',   -- ouverte, tranchée
  decision        text,
  tranchee_par    text,
  tranchee_le     timestamptz
)
;;
CREATE TABLE IF NOT EXISTS message (
  id              serial PRIMARY KEY,
  mariage_id      integer NOT NULL REFERENCES mariage(id),
  foyer_id        integer REFERENCES foyer(id),
  modele          text NOT NULL,
  canal           text NOT NULL,                     -- email, whatsapp, appel, lien
  destinataire    text,
  langue          text,
  contenu         text,
  envoye_le       timestamptz,
  par             text,
  ouvert_le       timestamptz,
  repondu_le      timestamptz
)
;;
CREATE TABLE IF NOT EXISTS journal (
  id              serial PRIMARY KEY,
  mariage_id      integer REFERENCES mariage(id),    -- vide pour une opération hors mariage (partenaires, administration)
  operation       text NOT NULL,
  detail          text,
  avant           jsonb,
  apres           jsonb,
  operateur       text,
  cree_le         timestamptz NOT NULL DEFAULT now()
)
;;
CREATE INDEX IF NOT EXISTS journal_mariage_idx ON journal (mariage_id, cree_le)
;;
-- File d'attente des écritures Excel qui ont échoué : rejouées à la synchronisation suivante, jamais perdues.
CREATE TABLE IF NOT EXISTS excel_attente (
  id              serial PRIMARY KEY,
  mariage_id      integer NOT NULL REFERENCES mariage(id),
  classeur        text NOT NULL,
  tableau         text NOT NULL,
  lignes          jsonb NOT NULL,
  tentatives      integer NOT NULL DEFAULT 0,
  derniere_erreur text,
  cree_le         timestamptz NOT NULL DEFAULT now()
)
;;
-- Limite de requêtes par adresse et par minute, côté invité.
CREATE TABLE IF NOT EXISTS limite_requetes (
  cle             text PRIMARY KEY,
  n               integer NOT NULL DEFAULT 0,
  expire_le       timestamptz NOT NULL
)
