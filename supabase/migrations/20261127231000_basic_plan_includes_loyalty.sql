-- The Basic plan includes the loyalty card (marketing site: "fidélisation dès 399 DH TTC").
UPDATE public.subscription_plans
SET features = '["Page publique","Avis & réputation","Contact","Fidélité"]'::jsonb,
    description = 'Page publique, réputation et carte de fidélité'
WHERE name = 'Basic';
