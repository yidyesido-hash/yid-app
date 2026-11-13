-- Yes I Do · schéma v12 · la photo de chaque mariage (carte d'accueil, bandeaux) : clé publique non devinable, image à part.
ALTER TABLE mariage ADD COLUMN IF NOT EXISTS photo_cle text
;;
CREATE TABLE IF NOT EXISTS photo_mariage (
  mariage_id integer PRIMARY KEY REFERENCES mariage(id) ON DELETE CASCADE,
  type text NOT NULL,
  donnees text NOT NULL,
  modifie_le timestamptz NOT NULL DEFAULT now(),
  modifie_par text
)
