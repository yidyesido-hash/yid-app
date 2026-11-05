-- Yes I Do · schéma v8 · espace mariés : lien personnel avec clé, parcours (le couple complète, ou consulte seulement)
ALTER TABLE mariage ADD COLUMN IF NOT EXISTS espace_jeton text
;;
CREATE UNIQUE INDEX IF NOT EXISTS mariage_espace_jeton ON mariage (espace_jeton) WHERE espace_jeton IS NOT NULL
;;
ALTER TABLE mariage ADD COLUMN IF NOT EXISTS espace_modifiable boolean NOT NULL DEFAULT true
;;
ALTER TABLE mariage ADD COLUMN IF NOT EXISTS espace_le timestamptz
