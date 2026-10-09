# KELYANI CRM — Runbook de mise en service (pré-commercialisation)

## État vérifié le 9 octobre 2026

- Branche de travail : `feat/kelyani-crm-segmentation-automation`.
- PR de travail : #69, encore en brouillon. Ne pas fusionner dans `main` sans validation.
- Aperçu Vercel du commit `a2c5743d33e1814e54d98d547a98bafe64941573` : `READY`.
- Projet Supabase : `tehhhdtfbonneqbyvlwx`.
- Dernière migration enregistrée dans Supabase : `20261008174745`. Les migrations CRM datées du 9 octobre ne sont donc pas appliquées à ce projet.
- Edge Function `send-loyalty-notification-push` actuellement active en version 2 ; son empreinte diffère du code de la branche. Ne pas activer l'envoi depuis l'interface avant mise à niveau coordonnée.

## Dépendances à déployer ensemble

Appliquer dans l'ordre, après revue et autorisation explicite de déploiement :

1. `20261009150000_create_consent_aware_loyalty_campaigns.sql` — RPC de création de campagne et notifications in-app avec consentement.
2. `20261009170000_fix_birthday_campaign_segment.sql` — ciblage anniversaire par jour ET mois.
3. `20261009180000_prevent_duplicate_loyalty_push_campaigns.sql` — réservation atomique d'une campagne Web Push pour éviter les doubles envois.
4. Déployer ensuite `supabase/functions/send-loyalty-notification-push/index.ts` depuis la même branche.

Ne pas déployer la fonction seule : elle dépend de la RPC `claim_loyalty_campaign_push_delivery` créée par la troisième migration.

## Contrôles avant toute notification réelle

- Vérifier que les trois migrations sont présentes dans l'historique et que les colonnes/RPC attendues existent.
- Vérifier les secrets de la fonction : `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PRIVATE_KEY` ; ne jamais exposer la clé service-role côté navigateur.
- Utiliser un établissement et des comptes de test dédiés, sans abonnements Web Push de vrais clients.
- Vérifier le refus d'accès à un établissement non autorisé.
- Vérifier que les clients sans `notification_consent` ne reçoivent rien et qu'un consentement retiré avant l'envoi est respecté.
- Vérifier qu'un second appel pour la même campagne est refusé et ne produit aucun doublon.
- Vérifier les compteurs sent/failed/removed et l'état final de la campagne.
- Prévoir une procédure manuelle d'investigation pour une campagne restée en `PROCESSING` : ne pas la réinitialiser automatiquement, car un envoi partiel pourrait déjà avoir eu lieu.

## Point de vigilance sécurité

L'audit Supabase du 9 octobre signale plusieurs tables avec RLS activé mais sans policy, notamment des tables de notifications, abonnements push et campagnes, ainsi qu'une alerte de protection contre les mots de passe compromis désactivée. Ces constats doivent être triés table par table : l'absence de policy peut être intentionnelle si l'accès est strictement réservé aux fonctions privilégiées, mais il faut confirmer les privilèges SQL et l'absence d'accès direct avant commercialisation. Ne pas ajouter de policies génériques sans vérifier le modèle d'accès attendu.

## Décision de mise en service

À ce stade, l'aperçu front-end peut être vérifié, mais l'envoi Web Push n'est pas prêt à être activé en production. Garder l'action d'envoi désactivée jusqu'à ce que les migrations et la fonction soient déployées et que les tests ci-dessus passent. Aucun changement de production n'est effectué par ce runbook.
