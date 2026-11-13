-- Yes I Do · schéma v11 · la photo de profil de chaque membre de l'équipe (image réduite, en data URL).
ALTER TABLE utilisateur ADD COLUMN IF NOT EXISTS photo text
