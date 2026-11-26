-- The API-grant reconciliation migration later re-granted INSERT on reviews
-- to anon. Public review creation must remain behind submit-public-review.
-- Revoke the inherited PUBLIC grant as well as the explicit browser-role grant.
REVOKE INSERT ON TABLE public.reviews FROM PUBLIC, anon, authenticated;
