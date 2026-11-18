-- Yes I Do · schéma v16 · le formulaire des invités (moteur v2) : langue du foyer, accompagnants autorisés, brouillon, signaux
ALTER TABLE contact_recu ADD COLUMN IF NOT EXISTS langue text
;;
ALTER TABLE contact_recu ADD COLUMN IF NOT EXISTS nb_accompagnants integer
;;
ALTER TABLE contact_recu ADD COLUMN IF NOT EXISTS brouillon jsonb
;;
ALTER TABLE contact_recu ADD COLUMN IF NOT EXISTS signaux jsonb NOT NULL DEFAULT '[]'::jsonb
