# Phase 1 additions — security verification plan

## A → B: anonymous settings-access tests

Before any security migration, test the following identities separately:

| Identity | Target | Action | Expected A | Expected B |
|---|---|---|---|---|
| Anonymous | `ai_global_settings` | SELECT | direct/public access attempt | **REFUSED** |
| Employee | `ai_global_settings` | SELECT | authenticated employee access attempt | **REFUSED** |
| Responsible | `ai_global_settings` | SELECT | authenticated responsible access attempt | **REFUSED** |
| Anonymous | every other settings/config table identified in Production | SELECT | direct/public access attempt | **REFUSED unless explicitly public by design** |
| Employee | every other settings/config table identified in Production | SELECT | authenticated employee access attempt | **REFUSED unless explicitly required** |
| Responsible | every other settings/config table identified in Production | SELECT | authenticated responsible access attempt | **REFUSED unless explicitly required** |

The test must be performed against the separated TEST project first. Production is read-only during Phase 0.

The result of every test will be recorded as PASS/FAIL with the exact SQL/API operation and observed error.

## OpenAI key relocation — added to plan

Target architecture:

1. Remove the raw OpenAI key from `ai_global_settings`.
2. Store it as an Edge Function secret (or Supabase Vault secret if selected).
3. Edge Functions read the secret server-side only.
4. Admin UI keeps only non-secret configuration: provider, model, enabled, limits, instructions.
5. No raw key is returned by any RPC.
6. Existing AI functionality remains operational during migration.

Migration must be reversible:

- **Forward:** provision new secret → update Edge Functions to read secret → verify AI functions → remove/disable DB key storage only after verification.
- **Rollback:** restore Edge Functions to the previous DB-key read path temporarily, without exposing the key to clients; only then remove the new secret if required.
- Production execution only after TEST validation and backup.
- The migration must not log or print the secret.

Files/functions expected to change will be identified after Phase 0 reproduction; no AI-key migration is being executed now.

## Reproducibility proof — strengthened

The TEST Supabase project must be completely separate from Production:

- separate Supabase project;
- separate URL and anon/service-role keys;
- zero Production/client data;
- no Production users, establishments, reviews, customers, tokens or files;
- GitHub migrations applied from a clean database;
- Production exports used only as comparison evidence.

Comparison must include:

1. tables and columns;
2. indexes and constraints;
3. functions/RPCs;
4. function ownership;
5. function language;
6. SECURITY DEFINER / SECURITY INVOKER;
7. function EXECUTE privileges by role;
8. RLS enabled/forced status;
9. every RLS policy, command, role and expression;
10. storage buckets;
11. every storage policy, command, role and expression;
12. triggers and trigger functions;
13. extensions installed and versions where available;
14. sequences and identity/default definitions where relevant;
15. views/materialized views where relevant;
16. grants/revokes at schema/table/function/storage levels where relevant.

The proof is successful only if TEST matches Production, or every difference is explicitly classified as:
- expected/versioned difference,
- missing migration to recover,
- production-only object,
- obsolete repository object,
- or unresolved discrepancy.

No client data is copied into TEST.

## Reviews / Google

The review flow and Google redirection remain strictly out of scope. No review code, review constraint, `google_review_url`, `redirect_threshold`, or review policy will be changed as part of these steps.
