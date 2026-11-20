# Wallet Studio multi-etablissement — Apple Wallet & Google Wallet

## Objectif
Permettre a chaque etablissement de personnaliser et publier independamment le design de ses cartes Apple Wallet et Google Wallet. Les modifications d'un etablissement ne doivent jamais affecter un autre.

## Principes produit
- Deux configurations separees par etablissement : Apple Wallet et Google Wallet.
- Identite propre au commerce : logo, images/banniere, couleurs, champs affiches et choix de mise en page dans les limites de chaque plateforme.
- Preview en direct distincte pour Apple et Google, qui doit refleter le rendu realiste et les contraintes de la plateforme.
- Brouillon, sauvegarde, publication, historique/rollback de configuration.
- Le design de carte KELYANI dans l'app reste distinct des designs Wallet.
- Le theme Nardo Tech s'applique a l'interface de l'editeur, pas aux passes des commerces.

## Architecture proposee
1. UI Wallet Studio : onglets Apple Wallet / Google Wallet; controls de personnalisation; preview mobile; sauvegarde brouillon; publier; restaurer.
2. Donnees : configuration scindee par establishment_id et platform, versionnee; ne pas dupliquer la logique loyalty.
3. Assets : bucket prive ou public selon usage, validation type/taille, ownership lie a l'etablissement, URLs signees si prive.
4. Backend publication : Edge Functions valident le role et l'ownership, appliquent la config au pass/provider, puis consignent version et statut.
5. Apple Wallet : generator .pkpass, manifest/signature PKCS#7, certificate/private key en secrets server-side, pass serial stable, web service endpoint et push updates selon besoin. Certificate absent: mode draft/preview uniquement.
6. Google Wallet : reutiliser l'integration existante, mettre a jour les classes/objects Wallet selon le design de l'etablissement et respecter les limites de champs/colors/images de Google Wallet.

## Modele de donnees cible (a confirmer avec schema existant)
- wallet_design_configs: id, establishment_id, platform ('apple'|'google'), draft_config, published_config, version, status, updated_by, timestamps.
- wallet_design_assets: id, establishment_id, platform, storage_path, asset_type, metadata, created_by, timestamps.
- contraintes uniques: (establishment_id, platform).
- RLS: seuls membres autorises de l'etablissement peuvent lire/modifier; publication et assets verifies par Edge Functions; aucun privilege client pour changer establishment_id/ownership.

## Parametres de design
- Apple: pass style/storeCard, logo, strip/background, colors, relevant fields, barcode/QR, localization, dimensions et formats compatibles.
- Google: logo, hero image, colors, text modules, barcode et champs autorises pour loyalty class/object.
- Preview n'est qu'une approximation si les rendus natifs Wallet ne sont pas identiques au mockup.

## Workflow
1. Charger les deux configs de l'etablissement.
2. Modifier un draft et preview localement.
3. Valider les assets et les permissions.
4. Sauvegarder le draft.
5. Publier explicitement sur la plateforme choisie.
6. Backend applique la config et retourne le statut.
7. Historiser la version; rollback restaure une config precedente.

## Tests et critères d'acceptation
- Isolation multi-tenant: A ne peut lire/modifier/publier les configs/assets de B.
- Apple et Google configs independantes.
- Preview reactif; draft non publie ne change pas les passes live.
- Publication ne modifie que l'etablissement et la plateforme cible.
- Validation des formats, dimensions, tailles et couleurs.
- Apple: generation, signature valide, installation iPhone, mise a jour de points/tampons et push/web-service si implemente.
- Google: classes/objects valides, add-to-wallet, updates points/tampons, regression de l'existant.
- Rollback, erreurs et logs sans secrets.
- Tests automatises unitaires, RLS SQL et E2E en Preview/Staging uniquement.

## Sequence de livraison
A. Re-audit schema et fonctions existantes; identifier migrations/config UI a reutiliser.
B. Model/data access + RLS/migration seulement si necessaire.
C. UI editor + preview + draft/save.
D. Publication Google Wallet avec regression tests.
E. Apple PassKit backend et secrets, en attente certificat Apple Developer.
F. E2E, tests sur appareils, revue et PR.

## Limites de securite / operations
- Certificats Apple et cles privees uniquement en secrets server-side; jamais React, VITE_, Git ou storage public.
- Aucun secret Google expose au client.
- Ne pas toucher main, ne pas fusionner, ne pas deployer en production.
- Developpement et tests uniquement sur branche isolee, Preview et Supabase Staging.
