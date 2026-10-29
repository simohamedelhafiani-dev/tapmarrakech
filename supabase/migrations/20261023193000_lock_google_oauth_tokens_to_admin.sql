-- OAuth access and refresh tokens must never be readable by establishment responsibles.
-- A SELECT policy on this table exposes every selected column, including access_token
-- and refresh_token, regardless of which columns the frontend normally requests.
-- Keep connection rows admin-only; responsible-facing status should be exposed through
-- a dedicated safe view/RPC if that workflow is needed in the future.

drop policy if exists "Google connections visible to admins and responsibles"
  on public.google_business_connections;

-- The existing "Google connections managed by admins" FOR ALL policy remains in place.
-- Its USING and WITH CHECK predicates restrict SELECT/INSERT/UPDATE/DELETE to admins.
