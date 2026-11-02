-- Yes I Do · schéma v4 · étape 2, Contacts reçus : les lots reçus, les contacts lus, leurs anomalies.
CREATE TABLE IF NOT EXISTS lot (
  id              serial PRIMARY KEY,
  mariage_id      integer NOT NULL REFERENCES mariage(id),
  source          text NOT NULL,                     -- étiquette de provenance : Export Épouse, Liste Tante Awa, Email de …
  cote            text,                              -- Épouse, Époux, ou vide « à préciser » (lot arrivé par email)
  proche          text,                              -- prénom du proche contributeur, le cas échéant
  fichier         text,                              -- nom du fichier reçu
  archive         text,                              -- chemin SharePoint de l'archive
  origine         text NOT NULL DEFAULT 'dépôt',     -- dépôt, email
  email_id        text,                              -- identifiant du message quand le lot vient de la boîte
  expediteur      text,
  lus             integer NOT NULL DEFAULT 0,
  ajoutes         integer NOT NULL DEFAULT 0,
  connus          integer NOT NULL DEFAULT 0,
  a_voir          integer NOT NULL DEFAULT 0,
  detail          jsonb NOT NULL DEFAULT '{}'::jsonb,
  operateur       text,
  recu_le         timestamptz NOT NULL DEFAULT now()
)
;;
CREATE INDEX IF NOT EXISTS lot_mariage_idx ON lot (mariage_id)
;;
ALTER TABLE contact_recu ADD COLUMN IF NOT EXISTS lot_id integer REFERENCES lot(id)
;;
ALTER TABLE contact_recu ADD COLUMN IF NOT EXISTS numero text
;;
ALTER TABLE contact_recu ADD COLUMN IF NOT EXISTS numero_2 text
;;
ALTER TABLE contact_recu ADD COLUMN IF NOT EXISTS numero_brut text
;;
ALTER TABLE contact_recu ADD COLUMN IF NOT EXISTS statut_numero text NOT NULL DEFAULT 'ok'
;;
ALTER TABLE contact_recu ADD COLUMN IF NOT EXISTS lien text
;;
ALTER TABLE contact_recu ADD COLUMN IF NOT EXISTS precision text
;;
ALTER TABLE contact_recu ADD COLUMN IF NOT EXISTS proche text
;;
ALTER TABLE contact_recu ADD COLUMN IF NOT EXISTS mentions jsonb NOT NULL DEFAULT '[]'::jsonb
;;
ALTER TABLE contact_recu ADD COLUMN IF NOT EXISTS etat text NOT NULL DEFAULT 'propre'
;;
ALTER TABLE contact_recu ADD COLUMN IF NOT EXISTS desactive boolean NOT NULL DEFAULT false
;;
ALTER TABLE contact_recu ADD COLUMN IF NOT EXISTS modifie_le timestamptz NOT NULL DEFAULT now()
;;
CREATE INDEX IF NOT EXISTS contact_recu_mariage_idx ON contact_recu (mariage_id, desactive)
;;
ALTER TABLE anomalie ADD COLUMN IF NOT EXISTS contact_id integer REFERENCES contact_recu(id)
;;
ALTER TABLE anomalie ADD COLUMN IF NOT EXISTS autre_contact_id integer REFERENCES contact_recu(id)
;;
CREATE INDEX IF NOT EXISTS anomalie_contact_idx ON anomalie (contact_id, etat)
