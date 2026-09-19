# Secrets audit — 2026-09-19

## Scope

Read-only audit of the TapMarrakech repository, current client code, Edge Function source present in GitHub, .gitignore/.env.example, and the supplied Production function export.

No secret was rotated and no application/DB configuration was changed during this audit.

## Findings

### 1. Client-side Supabase configuration

The browser client uses only:

- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY

in `src/lib/supabase.ts`.

The employee client also uses those same public variables when constructing its Supabase client and when calling `employee-login`.

No service-role key is present in the inspected client source.

**Status: PASS — no privileged key identified in the shipped source inspected.**

### 2. Environment files

`.gitignore` ignores `.env` and `*.local`.

`.env.example` contains variable names only:

- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY

No secret value is present there.

**Status: PASS.**

### 3. Edge Functions in GitHub

The repository currently contains source for:

- analyze-reviews
- design-menu
- import-menu
- submit-public-review

The inspected AI functions read `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` from Deno environment variables. The service-role key is therefore server-side in source, not bundled into the browser.

The OpenAI credential is read from `ai_global_settings.api_key` server-side and used in the Edge Function request to OpenAI.

**Status: PASS for source-level placement.**

### 4. AI key handling

Production has `ai_global_settings.api_key`.

The Admin UI does not select or display the raw API key. It uses:

- `admin_get_ai_settings()` returning `has_api_key`
- `admin_save_ai_settings(... p_api_key ...)`

The supplied Production function definition shows `admin_get_ai_settings()` returns only the boolean `has_api_key`, not the raw key. The save function is SECURITY DEFINER and checks `is_tapmarrakech_admin()`.

**Status: PASS for the observed DB/API path.**

### 5. Git history

The repository history was inspected through GitHub commit metadata and targeted searches for common secret names/patterns. No direct secret value was identified from the searches performed.

However, the available GitHub connector does not provide a complete server-side secret-scanning service over every historical Git blob. Therefore this report does NOT claim cryptographic proof that every historical blob is secret-free.

**Status: PARTIAL — no finding, but historical-blob exhaustiveness remains unverified.**

### 6. Production Edge Function configuration

The actual deployed Supabase Edge Function environment configuration was not accessible through the available repository connector.

Therefore the following are NOT verified from this audit:

- whether SUPABASE_SERVICE_ROLE_KEY is configured correctly in the deployed functions
- whether any unexpected environment secret exists in Production
- whether an old OpenAI key remains configured elsewhere
- whether the missing Production `employee-login` function has additional secrets/configuration

**Status: UNVERIFIED.**

## Items that must be changed

No emergency secret rotation is justified by the evidence inspected so far.

The following must nevertheless be completed before Phase 1 is considered security-complete:

1. Obtain a read-only inventory of Production Edge Function environment variable NAMES (never values).
2. Confirm `SUPABASE_SERVICE_ROLE_KEY` exists only in server-side Edge Function configuration.
3. Confirm no OpenAI secret is configured in Vercel/browser environment variables.
4. Confirm the deployed `employee-login` function configuration.
5. Perform a true full historical Git secret scan outside the limited GitHub connector search if available.
6. If any real secret is found in Git history or client-delivered code, rotate it before proceeding.
7. Keep `ai_global_settings.api_key` server-side; do not expose its raw value through RPC responses or client code.

## Explicitly out of scope

No review flow, Google redirect, `google_review_url`, `redirect_threshold`, review constraint, or `submit-public-review` behavior was modified.

## Conclusion

No exposed privileged secret was found in the inspected current repository/client source.

The main unresolved items are deployment-level configuration and exhaustive historical-blob scanning. These are verification gaps, not confirmed leaks.
