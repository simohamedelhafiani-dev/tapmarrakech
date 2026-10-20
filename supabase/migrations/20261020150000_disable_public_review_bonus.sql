-- KELYANI: disable the legacy public RPC that awarded points for claiming a public review.
-- The deployed historical function signature is (text, text).
-- Apply only through the reviewed migration workflow; this file does not change production by itself.
revoke execute on function public.claim_public_loyalty_review_bonus(text, text) from public;
revoke execute on function public.claim_public_loyalty_review_bonus(text, text) from anon;
revoke execute on function public.claim_public_loyalty_review_bonus(text, text) from authenticated;
