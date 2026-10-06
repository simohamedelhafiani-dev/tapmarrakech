-- A customer may only hold one pending QR for a given promotion.
-- Once redeemed or expired, a new claim may be created.
create unique index if not exists loyalty_promotion_claims_one_pending_per_customer_promotion
on public.loyalty_promotion_claims (customer_id, promotion_id)
where status = 'PENDING';
