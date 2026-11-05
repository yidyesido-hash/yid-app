-- Yes I Do · schéma v7 · présence à plusieurs moments (qualification.periodes), lot collect reconnu (les deux côtés)
ALTER TABLE lot ADD COLUMN IF NOT EXISTS collect boolean NOT NULL DEFAULT false
;;
UPDATE lot SET collect = true WHERE deduction LIKE 'collect%' OR source = 'Collect v4'
;;
UPDATE lot SET libelle = replace(libelle, ' · collect v4 · ', ' · les deux côtés · ') WHERE collect AND libelle LIKE '% · collect v4 · %'
;;
-- l'ancienne présence unique devient une liste d'un seul moment
UPDATE contact_recu SET qualification = jsonb_set(qualification - 'periode', '{periodes}', jsonb_build_array(qualification->>'periode')) WHERE qualification ? 'periode' AND coalesce(qualification->>'periode', '') <> ''
;;
UPDATE contact_recu SET qualification = qualification - 'periode' WHERE qualification ? 'periode'
;;
-- « Cadrage » devient « Fiche du mariage » (vocabulaire tranché le 5 novembre)
UPDATE reglage SET valeur = replace(replace(valeur, '1. Cadrage.', '1. Fiche du mariage.'), 'étape 1, Cadrage', 'étape 1, Fiche du mariage') WHERE cle = 'cheminement'
