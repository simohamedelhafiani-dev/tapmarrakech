# Connexion WhatsApp Business à Meta — checklist de mise en service

Ce guide décrit le parcours Embedded Signup et la boîte de réception WhatsApp présents dans KELYANI. Il ne configure pas votre tableau de bord Meta ni votre projet Supabase à votre place.

## 1. Préparer l’application Meta

Dans Meta for Developers, sélectionner l’application KELYANI utilisée pour la connexion client et :

- ajouter/configurer le produit WhatsApp et le parcours Embedded Signup ;
- créer une configuration Embedded Signup compatible avec WhatsApp Cloud API et récupérer son ID ;
- autoriser le domaine HTTPS de KELYANI dans les réglages de l’application et les domaines/URL OAuth pertinents ;
- demander les accès WhatsApp nécessaires à la lecture du WABA et à l’envoi/réception, notamment `whatsapp_business_management` et `whatsapp_business_messaging` ;
- effectuer la vérification de l’entreprise et la revue d’application/Advanced Access requises avant l’usage par des clients externes ;
- configurer le produit Webhooks pour l’objet WhatsApp Business Account et s’abonner au champ `messages`.

L’accès Standard/Test peut être limité aux personnes, comptes et numéros ajoutés à l’application. Valider l’onboarding avec un compte et un numéro de test avant de commercialiser.

## 2. Renseigner les variables

Côté build Vite (dans les variables d’environnement de l’hébergeur front) :

- `VITE_META_APP_ID` : ID de l’application Meta.
- `VITE_META_EMBEDDED_SIGNUP_CONFIG_ID` : ID de la configuration Embedded Signup.
- `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` : valeurs publiques du projet Supabase correspondant.

Côté Supabase Edge Functions, définir les secrets ci-dessous avec `supabase secrets set` (ne jamais mettre les secrets Meta ni la clé service-role dans une variable `VITE_*`) :

- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `META_APP_ID`, `META_APP_SECRET`
- `META_GRAPH_API_VERSION` (la version doit être active et prise en charge par l’application Meta)
- `META_WEBHOOK_VERIFY_TOKEN` (générer une valeur aléatoire longue et la saisir à l’identique dans Meta)
- `KELYANI_APP_ORIGIN` (origine exacte du site, sans chemin ni barre finale, par exemple `https://app.example.com`)

Les valeurs serveur doivent être définies dans le projet Supabase auquel le front se connecte. Ne pas copier de tokens Meta dans un fichier versionné.

## 3. Appliquer et déployer

1. Vérifier que les migrations WhatsApp sont appliquées dans l’ordre, dont `20261121150000_create_whatsapp_connections.sql`, `20261122180000_whatsapp_oauth_state_nonce.sql`, `20261123100000_reconcile_whatsapp_connection_schema.sql` et la migration Vault ajoutée avec cette préparation.
2. Vérifier que l’extension Supabase Vault est disponible dans le projet.
3. Déployer `whatsapp-oauth-state`, `whatsapp-oauth-exchange`, `whatsapp-webhook`, `whatsapp-inbox` et `whatsapp-send-message`.
4. Garder la vérification JWT activée pour les quatre fonctions invoquées par un utilisateur connecté. La fonction `whatsapp-webhook` doit accepter la vérification GET de Meta sans JWT ; elle valide la signature HMAC SHA-256 des POST.
5. Dans le tableau de bord Meta, définir l’URL de callback du webhook à `https://<PROJECT_REF>.supabase.co/functions/v1/whatsapp-webhook` et utiliser exactement le même `META_WEBHOOK_VERIFY_TOKEN`.
6. Revenir dans KELYANI sur `/dashboard/whatsapp`, lancer la connexion Meta avec un établissement de test, puis ouvrir `/dashboard/whatsapp/inbox`.

## 4. Test d’acceptation avant vente

- Le parcours OAuth finit avec un WABA et un numéro vérifiés ; la ligne de connexion est `active` et ne contient pas de jeton en clair.
- Envoyer un message WhatsApp entrant au numéro connecté : il apparaît une seule fois dans la boîte de réception.
- Répondre depuis la boîte : le message sort, puis les statuts `sent`, `delivered` ou `read` se mettent à jour via webhook.
- Vérifier les refus d’accès d’un utilisateur d’un autre établissement et l’absence de jeton dans les réponses réseau, logs et tables lisibles par le client.
- Vérifier les limites Meta de fenêtre de service client et de modèles approuvés avant d’activer des messages proactifs. La boîte actuelle envoie des réponses texte manuelles ; elle ne fournit pas encore un moteur d’automatisation de conversation.

## Ce que le dépôt ne peut pas confirmer

Le code source ne prouve pas que les secrets sont présents dans Supabase/Vercel, que les migrations ont été appliquées à la production, que les permissions Meta ont été approuvées, que le webhook a été vérifié, ni qu’un numéro client a terminé le parcours. Ces contrôles nécessitent un accès aux tableaux de bord et un test réel.
