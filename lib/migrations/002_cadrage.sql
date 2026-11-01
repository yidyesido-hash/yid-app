-- Yes I Do · schéma v2 · l'étape Cadrage, l'accueil et les réglages (v1.1).

ALTER TABLE mariage ADD COLUMN IF NOT EXISTS initiales text
;;
ALTER TABLE mariage ADD COLUMN IF NOT EXISTS date_demarrage date
;;
ALTER TABLE mariage ADD COLUMN IF NOT EXISTS delai_arret_jours integer
;;
ALTER TABLE mariage ADD COLUMN IF NOT EXISTS etape integer NOT NULL DEFAULT 1          -- étape en cours, 1 à 8
;;
ALTER TABLE mariage ADD COLUMN IF NOT EXISTS etapes jsonb NOT NULL DEFAULT '{}'::jsonb -- étapes franchies : { "1": "2026-11-01T..." }
;;
ALTER TABLE mariage ADD COLUMN IF NOT EXISTS fiche_version integer NOT NULL DEFAULT 0
;;
ALTER TABLE mariage ADD COLUMN IF NOT EXISTS fiche_pdf text                             -- chemin SharePoint de la dernière fiche call 1
;;
ALTER TABLE mariage ADD COLUMN IF NOT EXISTS cadence jsonb NOT NULL DEFAULT '{}'::jsonb -- modèle (appel ou lien d'abord), intervalle entre rappels
;;
ALTER TABLE mariage ADD COLUMN IF NOT EXISTS purge_prevue date
;;
ALTER TABLE mariage ADD COLUMN IF NOT EXISTS purge_effectuee timestamptz
;;
ALTER TABLE mariage ADD COLUMN IF NOT EXISTS boite_verifiee_le timestamptz
;;
ALTER TABLE mariage ADD COLUMN IF NOT EXISTS sharepoint jsonb NOT NULL DEFAULT '{}'::jsonb -- ce qui a été créé : dossier, classeurs, fiche, erreurs
;;
CREATE TABLE IF NOT EXISTS reglage (
  cle         text PRIMARY KEY,
  valeur      text NOT NULL,
  modifie_le  timestamptz NOT NULL DEFAULT now(),
  modifie_par text
)
