-- KELYANI: disable legacy public RPCs that awarded points for claiming a public review.
-- Both deployed overloads are revoked: (text, text) and (uuid, text).
-- Apply only through the reviewed migration workflow; this file does not change production by itself.
revoke execute on function public.claim_public_loyalty_review_bonus(text, text) from public;
revoke execute on function public.claim_public_loyalty_review_bonus(text, text) from anon;
revoke execute on function public.claim_public_loyalty_review_bonus(text, text) from authenticated;

revoke execute on function public.claim_public_loyalty_review_bonus(uuid, text) from public;
revoke execute on function public.claim_public_loyalty_review_bonus(uuid, text) from anon;
revoke execute on function public.claim_public_loyalty_review_bonus(uuid, text) from authenticated;
