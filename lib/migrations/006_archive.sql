-- Yes I Do · schéma v6 · remise à zéro = archivage à part (hors liste, hors désactivés), lots numérotés et nommés, objet de l'email
ALTER TABLE contact_recu ADD COLUMN IF NOT EXISTS archive boolean NOT NULL DEFAULT false
;;
ALTER TABLE contact_recu ADD COLUMN IF NOT EXISTS archive_le timestamptz
;;
ALTER TABLE lot ADD COLUMN IF NOT EXISTS numero integer
;;
ALTER TABLE lot ADD COLUMN IF NOT EXISTS libelle text
;;
ALTER TABLE lot ADD COLUMN IF NOT EXISTS objet text
;;
ALTER TABLE lot ADD COLUMN IF NOT EXISTS vides integer NOT NULL DEFAULT 0
;;
-- les lignes d'une remise à zéro passée (motif posé par la v1.3) passent en archive
UPDATE contact_recu SET archive = true, archive_le = modifie_le WHERE desactive AND motif_desactivation LIKE 'liste remise à zéro%'
