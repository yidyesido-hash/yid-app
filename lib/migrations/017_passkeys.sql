-- Yes I Do · schéma v17 · connexion par empreinte ou reconnaissance faciale (clés d'accès de l'appareil, WebAuthn)
CREATE TABLE IF NOT EXISTS cle_acces (
  id serial PRIMARY KEY,
  utilisateur_id integer NOT NULL,
  cred_id text NOT NULL UNIQUE,
  cle_publique text NOT NULL,
  compteur bigint NOT NULL DEFAULT 0,
  transports text,
  appareil text,
  cree_le timestamptz NOT NULL DEFAULT now(),
  derniere_le timestamptz
)
;;
CREATE INDEX IF NOT EXISTS cle_acces_utilisateur ON cle_acces (utilisateur_id)
