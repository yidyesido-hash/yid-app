-- Yes I Do · schéma v3 · l'équipe : des accès nommés pour que le journal dise qui a fait quoi.
ALTER TABLE utilisateur ADD COLUMN IF NOT EXISTS derniere_connexion timestamptz
;;
ALTER TABLE utilisateur ADD COLUMN IF NOT EXISTS modifie_le timestamptz NOT NULL DEFAULT now()
;;
CREATE UNIQUE INDEX IF NOT EXISTS utilisateur_nom_idx ON utilisateur (lower(nom))
