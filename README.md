# yid-app · l'application Yes I Do

Une seule application porte tout le parcours invité, du premier contact à la suppression des données.
Les classeurs Excel SharePoint en sont les miroirs de contrôle : rien ne part jamais d'un Excel.

Version 1.0 · le socle : Postgres (Neon), le modèle de données, la connexion de l'équipe, la vérification des trois voyants.

- `api/forms.js` : l'API (formulaires invités, connexion, vérification, suivi, imports, exports, journal)
- `lib/db.js` : Postgres Neon en production, PGlite en local ; `lib/migrations/` : le schéma, une version par fichier
- `lib/store.js` : foyers et personnes, réponses versionnées, journal, file d'attente Excel
- `lib/graph.js` : Microsoft 365 (SharePoint, Excel, autorisations email)
- `lib/engine.js` : construction et validation des formulaires, lignes Excel
- `lib/weddings/` : la configuration des mariages (reprise par l'écran Paramètres en 1.1)
- `public/index.html` : administration ; `public/yid-forms.js` : moteur chargé par la plateforme Squarespace ; `public/essai.html` : banc d'essai
- `test/dev-server.js` : serveur local (`npm run dev`, mot de passe `test`) ; `test/recette.js` : recette automatique (`npm test`)

Dépôt GitHub : les dossiers `api`, `lib`, `public`, `test` et les fichiers `package.json`, `vercel.json`, `.gitignore`, `.env.example`, `README.md`.
Jamais de fichiers à plat. `node_modules` et `test/data` ne se déposent pas.
