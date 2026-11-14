-- Yes I Do · schéma v13 · le lien personnel de l'invité : un jeton non devinable par fiche, et sa réponse.
ALTER TABLE contact_recu ADD COLUMN IF NOT EXISTS jeton text
;;
CREATE UNIQUE INDEX IF NOT EXISTS contact_recu_jeton ON contact_recu (jeton) WHERE jeton IS NOT NULL
;;
ALTER TABLE contact_recu ADD COLUMN IF NOT EXISTS reponse jsonb
;;
ALTER TABLE contact_recu ADD COLUMN IF NOT EXISTS reponse_le timestamptz
