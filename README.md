# TapMarrakech

TapMarrakech est une plateforme SaaS de collecte d’avis pour hôtels, riads, restaurants, cafés, spas et commerces de Marrakech. Les clients notent leur expérience via une page mobile accessible par QR Code ou carte NFC. Les avis positifs peuvent être orientés vers Google, tandis que les retours négatifs restent privés pour l’équipe.

## 1. Installation

```bash
npm install
```

## 2. Configuration Supabase

Créez ou utilisez un projet Supabase, puis activez l’authentification Email/Password sans confirmation email obligatoire pour les tests. Les tables et les règles de sécurité de TapMarrakech sont créées par la migration déjà appliquée au projet.

Pour une exportation indépendante, copiez le SQL de la migration `create_tapmarrakech_schema` dans le SQL Editor Supabase et exécutez-le une seule fois.

## 3. Variables d’environnement

Copiez `.env.example` vers `.env` et renseignez l’URL du projet et la clé publique anon. Seule cette clé publique doit être utilisée dans le navigateur. Ne mettez jamais la clé service role dans l’application.

## 4. Lancement local

```bash
npm run dev
```

## 5. Déploiement Vercel

Importez le projet dans Vercel, sélectionnez Vite si la détection automatique ne le fait pas, puis ajoutez les deux variables `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` dans les variables d’environnement. Lancez un nouveau déploiement.

## 6. Connecter tapmarrakech.ma

Dans Vercel, ajoutez `tapmarrakech.ma` et `www.tapmarrakech.ma` dans les domaines du projet. Chez votre registrar, ajoutez les enregistrements DNS indiqués par Vercel. Après propagation, les URLs publiques fonctionneront comme `https://tapmarrakech.ma/r/riad-atlas`.

## 7. Créer un établissement

Créez un compte sur `/register`, connectez-vous, puis ouvrez **Établissements > Nouvel établissement**. Renseignez le nom, un slug unique, le lien du logo si disponible, le lien Google Reviews de cet établissement et le seuil de redirection (4 par défaut).

## 8. Configurer Google Reviews

Dans Google Business Profile, copiez le lien direct permettant d’écrire un avis pour l’établissement concerné. Collez-le dans le champ **Lien Google Reviews**. Chaque établissement conserve son propre lien.

## 9. Générer le QR Code

Depuis la carte de l’établissement, cliquez sur **QR Code** pour afficher l’aperçu, puis sur **Télécharger le PNG**. Le QR Code ouvre automatiquement la page publique du bon établissement.

## 10. Utiliser une carte NFC

Programmez l’URL publique affichée sur la carte de l’établissement, par exemple `https://tapmarrakech.ma/r/riad-atlas`. Le téléphone du client ouvrira cette URL dans son navigateur lorsqu’il approchera la carte.

## 11. Suivre les avis chaque semaine

Le tableau de bord affiche les avis reçus par semaine, les notes positives et négatives, ainsi que les périodes 7 jours, 30 jours, 3 mois, 6 mois et 12 mois. La page **Analytics** détaille le volume, la répartition des notes, la satisfaction, les redirections Google, les retours privés et les scans des pages publiques.

## Routes principales

- `/login`, `/register`, `/forgot-password`
- `/dashboard`
- `/dashboard/establishments`
- `/dashboard/reviews`
- `/dashboard/analytics`
- `/r/:slug`

## Technologies

React, Vite, TypeScript, Tailwind CSS, Supabase Auth/Database, React Router, Recharts, QRCode et Lucide React.
TapMarrakech - Production
