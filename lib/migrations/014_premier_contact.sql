-- Yes I Do · schéma v14 · la file de premier contact : l'issue de chaque prise de contact, horodatée et signée.
ALTER TABLE contact_recu ADD COLUMN IF NOT EXISTS premier_contact jsonb
