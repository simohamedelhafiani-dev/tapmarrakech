/*
# Enforce the public review routing business rule

The public flow is fixed:
- Ratings 1, 2, 3 are private feedback.
- Ratings 4, 5 are positive reviews routed to Google.

The constraint is NOT VALID so existing historical rows are not rejected or
rewritten. PostgreSQL still enforces the constraint for all new rows and
future updates to existing rows.
*/

ALTER TABLE public.reviews
  ADD CONSTRAINT reviews_rating_type_consistency
  CHECK (
    (rating BETWEEN 1 AND 3 AND type = 'negative')
    OR
    (rating BETWEEN 4 AND 5 AND type = 'positive')
  )
  NOT VALID;
