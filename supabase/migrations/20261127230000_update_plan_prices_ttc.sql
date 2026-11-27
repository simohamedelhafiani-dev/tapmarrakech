-- Launch prices, VAT included (Clic To Connect SARL invoices 20% VAT).
UPDATE public.subscription_plans SET price_mad = 399 WHERE name = 'Basic';
UPDATE public.subscription_plans SET price_mad = 599 WHERE name = 'Premium';
UPDATE public.subscription_plans SET price_mad = 899 WHERE name = 'Enterprise';
