-- Yes I Do · schéma v15 · partenaires : le répertoire (repris de la cartographie), les échanges tracés, le suivi par mariage ; le site des invités
CREATE TABLE IF NOT EXISTS partenaire (
  id              serial PRIMARY KEY,
  cle             text NOT NULL UNIQUE,                -- nom et ville normalisés : un import ne crée jamais de doublon
  categorie       text NOT NULL,                       -- venue, hotel, autocar, chauffeur, spa, table, degustation, planner, ...
  destination     text,
  gamme           text,
  etoiles         integer,
  nom             text NOT NULL,
  ville           text,
  lat             double precision,
  lng             double precision,
  note            text,
  prix            text,
  site            text,
  email           text,
  telephone       text,
  whatsapp        text,
  contact_nom     text,                                -- l'interlocuteur nommé, appris au fil des échanges
  relation        text,
  verifie         boolean NOT NULL DEFAULT false,
  source          text,
  actif           boolean NOT NULL DEFAULT true,
  cree_le         timestamptz NOT NULL DEFAULT now(),
  modifie_le      timestamptz NOT NULL DEFAULT now()
)
;;
CREATE TABLE IF NOT EXISTS partenaire_echange (
  id              serial PRIMARY KEY,
  partenaire_id   integer NOT NULL REFERENCES partenaire(id),
  mariage_id      integer REFERENCES mariage(id),
  canal           text NOT NULL,                       -- appel, whatsapp, email, rendez-vous, note
  issue           text,
  resume          text,
  reponses        jsonb NOT NULL DEFAULT '{}'::jsonb,  -- les réponses du guide d'appel
  duree_min       integer,
  relance_le      date,
  par             text,
  le              timestamptz NOT NULL DEFAULT now()
)
;;
CREATE INDEX IF NOT EXISTS partenaire_echange_idx ON partenaire_echange (partenaire_id, le)
;;
CREATE INDEX IF NOT EXISTS partenaire_echange_m_idx ON partenaire_echange (mariage_id, le)
;;
CREATE TABLE IF NOT EXISTS mariage_partenaire (
  mariage_id      integer NOT NULL REFERENCES mariage(id),
  partenaire_id   integer NOT NULL REFERENCES partenaire(id),
  statut          text NOT NULL DEFAULT 'à contacter',
  accord          jsonb NOT NULL DEFAULT '{}'::jsonb,  -- chambres, tarif invités, date butoir, réservation, conditions
  publie          boolean NOT NULL DEFAULT false,      -- visible des invités sur le site du mariage
  notes           text,
  relance_le      date,
  ajoute_par      text,
  ajoute_le       timestamptz NOT NULL DEFAULT now(),
  modifie_le      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (mariage_id, partenaire_id)
)
;;
ALTER TABLE contact_recu ADD COLUMN IF NOT EXISTS vu_le timestamptz
