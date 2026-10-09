# KELYANI CRM — Runbook de mise en service (pré-commercialisation)

## État vérifié le 9 octobre 2026

- Branche de travail : `feat/kelyani-crm-segmentation-automation`.
- PR de travail : #69, encore en brouillon. Ne pas fusionner dans `main` sans validation.
- Les builds Vercel des changements applicatifs récents ont abouti à `READY`. Ce contrôle ne valide pas les migrations SQL ni l'exécution de l'Edge Function.
- Projet Supabase : `tehhhdtfbonneqbyvlwx`.
- Dernière migration enregistrée dans Supabase : `20261008174745`. Les migrations CRM datées du 9 octobre ne sont donc pas appliquées à ce projet.
- Edge Function `send-loyalty-notification-push` actuellement active en version 2 ; son empreinte diffère du code de la branche. Ne pas activer l'envoi depuis l'interface avant mise à niveau coordonnée.

## Dépendances à déployer ensemble

Appliquer les migrations dans l'ordre chronologique ci-dessous, sur un environnement de test d'abord, après revue et autorisation explicite de déploiement :

1. `20261007113000_create_loyalty_raffles.sql` — tables et fonctions de base des tombolas.
2. `20261007113100_schedule_loyalty_raffle_draws.sql` — tâche cron des tirages.
3. `20261007120000_loyalty_tiers_and_raffle_rules.sql` — niveaux, seuils et multiplicateurs de tickets.
4. `20261007120100_secure_public_tier_lookup.sql` — accès public par jeton et restriction de la recherche par UUID client.
5. `20261009100000_public_loyalty_raffles.sql` — lecture publique limitée aux tombolas actives et au jeton de la carte.
6. `20261009150000_create_consent_aware_loyalty_campaigns.sql` — campagnes et notifications in-app avec consentement.
7. `20261009170000_fix_birthday_campaign_segment.sql` — ciblage anniversaire par jour ET mois.
8. `20261009180000_prevent_duplicate_loyalty_push_campaigns.sql` — réservation atomique anti-doublon des envois Web Push.
9. `20261009190000_fix_scheduled_raffle_draw_permissions.sql` — tirage planifié sans JWT utilisateur et initialisation sûre des niveaux manquants.
10. `20261009200000_fix_expired_raffle_redemption.sql` — persistance du statut `EXPIRED` sans annulation transactionnelle, et réponse explicite au frontend.
11. `20261009210000_validate_raffle_reward_window.sql` — interdit une récompense dont la validité se termine avant ou à l'heure du tirage.
12. `20261009220000_secure_campaign_history_rpc.sql` — expose l’historique des campagnes via une RPC sécurisée, sans lecture directe des tables protégées.
13. `20261009230000_fix_campaign_segment_rpc_compatibility.sql` — ajoute la signature RPC `p_segment` attendue par le formulaire CRM, tout en conservant l’ancienne signature `p_audience` pour compatibilité.

Déployer ensuite `supabase/functions/send-loyalty-notification-push/index.ts` depuis la même branche, uniquement après vérification des secrets et des tests d'autorisation. Ne pas déployer la fonction seule : elle dépend des colonnes `push_delivery_*` et de la RPC `claim_loyalty_campaign_push_delivery` créées par la migration 8.

## Tests fonctionnels de la tombola (environnement de test)

- Créer des niveaux Standard à Platinum et vérifier que les seuils/conditions OR et AND déterminent le niveau attendu.
- Créer une tombola avec niveau minimum élevé : le compteur de participants ne doit inclure que les clients éligibles.
- Vérifier les deux modes de tickets : un ticket par client, ou multiplicateur par niveau.
- Exécuter le tirage arrivé à échéance sans JWT utilisateur ; vérifier que le cron ne s'arrête pas sur un contrôle d'authentification.
- Vérifier que le nombre de gagnants ne dépasse pas `winners_count`, que chaque rang correspond au score de tirage calculé une seule fois, et qu'un second traitement ne crée ni gagnant ni notification en double.
- Vérifier les trois modes de validité, le refus d'une récompense expirant avant le tirage, l'expiration persistée (`EXPIRED`), la rédemption une seule fois, le retour explicite `EXPIRED`/`REDEEMED` et le refus pour un responsable d'un autre établissement.
- Tester un établissement historique sans niveaux : les niveaux par défaut doivent être créés sans écraser les niveaux déjà personnalisés.

## Contrôles avant toute notification réelle

- Vérifier que les treize migrations listées ci-dessus sont présentes dans l'historique et que les colonnes/RPC attendues existent.
- Vérifier les secrets de la fonction : `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PRIVATE_KEY` ; ne jamais exposer la clé service-role côté navigateur.
- Utiliser un établissement et des comptes de test dédiés, sans abonnements Web Push de vrais clients.
- Vérifier le refus d'accès à un établissement non autorisé.
- Vérifier que les clients sans `notification_consent` ne reçoivent rien et qu'un consentement retiré avant l'envoi est respecté.
- Vérifier qu'un second appel pour la même campagne est refusé et ne produit aucun doublon.
- Vérifier les compteurs sent/failed/removed et l'état final de la campagne.
- Prévoir une procédure manuelle d'investigation pour une campagne restée en `PROCESSING` : ne pas la réinitialiser automatiquement, car un envoi partiel pourrait déjà avoir eu lieu.

## Point de vigilance sécurité

- Après migration, vérifier que `get_loyalty_customer_tier(uuid)` n'est pas exécutable par `anon` ni `authenticated`, et que l'accès public passe uniquement par `get_public_loyalty_customer_tier(access_token)`. L'audit en lecture seule du projet de production a relevé un droit `EXECUTE` direct pour `authenticated` sur la fonction UUID ; la migration de sécurisation doit corriger ce point avant activation des nouvelles cartes/tombolas.

L'audit Supabase du 9 octobre signale plusieurs tables avec RLS activé mais sans policy, notamment des tables de notifications, abonnements push et campagnes, ainsi qu'une alerte de protection contre les mots de passe compromis désactivée. Ces constats doivent être triés table par table : l'absence de policy peut être intentionnelle si l'accès est strictement réservé aux fonctions privilégiées, mais il faut confirmer les privilèges SQL et l'absence d'accès direct avant commercialisation. Ne pas ajouter de policies génériques sans vérifier le modèle d'accès attendu.

## Décision de mise en service

À ce stade, l'aperçu front-end peut être vérifié, mais l'envoi Web Push n'est pas prêt à être activé en production. Garder l'action d'envoi désactivée jusqu'à ce que les migrations et la fonction soient déployées et que les tests ci-dessus passent. Aucun changement de production n'est effectué par ce runbook.
