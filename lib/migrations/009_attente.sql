-- Yes I Do · schéma v9 · liste d'attente des mariés, informations à demander à l'invité
ALTER TABLE contact_recu ADD COLUMN IF NOT EXISTS attente boolean NOT NULL DEFAULT false
;;
ALTER TABLE contact_recu ADD COLUMN IF NOT EXISTS attente_rang integer
;;
ALTER TABLE lot ADD COLUMN IF NOT EXISTS attente boolean NOT NULL DEFAULT false
