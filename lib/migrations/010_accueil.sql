-- Yes I Do · schéma v10 · l'accueil de l'invité : civilité pour la formule d'appel, nom de l'accompagnant quand il est connu.
ALTER TABLE contact_recu ADD COLUMN IF NOT EXISTS civilite text
;;
ALTER TABLE contact_recu ADD COLUMN IF NOT EXISTS accompagnant text
