-- Yes I Do · schéma v5 · l'étape Liste d'invités fusionnée : qualification sur les contacts reçus, clé, états, sept étapes.
ALTER TABLE contact_recu ADD COLUMN IF NOT EXISTS invitation text
;;
ALTER TABLE contact_recu ADD COLUMN IF NOT EXISTS assistance boolean NOT NULL DEFAULT false
;;
ALTER TABLE contact_recu ADD COLUMN IF NOT EXISTS nb_enfants integer
;;
ALTER TABLE contact_recu ADD COLUMN IF NOT EXISTS hebergement text
;;
ALTER TABLE contact_recu ADD COLUMN IF NOT EXISTS nom text
;;
ALTER TABLE contact_recu ADD COLUMN IF NOT EXISTS prenom text
;;
ALTER TABLE contact_recu ADD COLUMN IF NOT EXISTS email text
;;
ALTER TABLE contact_recu ADD COLUMN IF NOT EXISTS note text
;;
ALTER TABLE contact_recu ADD COLUMN IF NOT EXISTS corrections jsonb NOT NULL DEFAULT '[]'::jsonb
;;
ALTER TABLE contact_recu ADD COLUMN IF NOT EXISTS cle text
;;
ALTER TABLE contact_recu ADD COLUMN IF NOT EXISTS complet_le timestamptz
;;
ALTER TABLE contact_recu ADD COLUMN IF NOT EXISTS motif_desactivation text
;;
ALTER TABLE contact_recu ADD COLUMN IF NOT EXISTS qualification jsonb NOT NULL DEFAULT '{}'::jsonb
;;
ALTER TABLE lot ADD COLUMN IF NOT EXISTS deduction text
;;
ALTER TABLE lot ADD COLUMN IF NOT EXISTS desactive boolean NOT NULL DEFAULT false
;;
ALTER TABLE mariage ADD COLUMN IF NOT EXISTS compteur_cle integer NOT NULL DEFAULT 0
;;
-- sept étapes : l'ancienne étape 2 (Contacts reçus) fusionne avec la 3 (Liste d'invités) ; une étape 2 marquée terminée ne l'est plus tant que la liste n'est pas qualifiée
UPDATE mariage SET etapes = etapes - '2', etape = LEAST(etape, 2) WHERE etapes ? '2'
