# Google Wallet Staging verification

## Scope
This check is restricted to the Supabase Staging project. It does not create, update, or delete Wallet passes or loyalty data.

## Required Edge Function secrets
- `GOOGLE_WALLET_ISSUER_ID` (or `WALLET_ISSUER_ID`)
- `GOOGLE_WALLET_SERVICE_ACCOUNT_JSON` (or `GOOGLE_WALLET_SERVICE_ACCOUNT` or `GOOGLE_SERVICE_ACCOUNT_JSON`)

The JSON must contain `client_email` and `private_key`. Never commit the JSON or log its contents.

## Test sequence
1. Invoke `google-wallet-staging-check` with a valid administrator Supabase access token.
2. Expect HTTP 200, `oauth: "ok"`, and `walletApi: "reachable"`.
3. If HTTP 503, confirm the Staging secret names (values must never be copied into logs or chat).
4. If HTTP 403 at `issuer_api_access`, confirm the service account email has Developer access to the matching Issuer account and that the Issuer ID is correct.
5. Only after this read-only check passes, implement a separate pass creation test using a dedicated QA establishment and QA customer.

## Safety
- Do not use Production credentials or data.
- Do not create a pass until a dedicated Staging QA establishment/customer is selected.
- Never return private keys, access tokens, or full service-account JSON to the client.
