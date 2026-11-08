import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const STAGING_REF = 'jsllksnmylpxcgqaeidq';
const ESTABLISHMENT_ID = '9366af04-bda7-4fb1-a521-8c08868b27ad';

test('QA SQL bridge: authorized manager, transaction consistency, and cross-establishment denial', async () => {
  const url = process.env.E2E_SUPABASE_URL!;
  const key = process.env.E2E_SUPABASE_ANON_KEY!;
  expect(new URL(url).hostname).toBe(`${STAGING_REF}.supabase.co`);
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: loginError } = await client.auth.signInWithPassword({
    email: process.env.E2E_RESPONSIBLE_EMAIL!,
    password: process.env.E2E_RESPONSIBLE_PASSWORD!,
  });
  expect(loginError).toBeNull();

  const { data: customers, error: listError } = await client
    .from('loyalty_customers').select('id,points_balance,total_points_earned,total_points_redeemed,visit_count')
    .eq('establishment_id', ESTABLISHMENT_ID).limit(1);
  expect(listError).toBeNull();
  expect(customers?.length).toBeGreaterThan(0);
  const customer = customers![0];

  const { data, error } = await client.rpc('fn_test_verify_loyalty_data', {
    p_establishment_id: ESTABLISHMENT_ID, p_customer_id: customer.id,
  });
  expect(error).toBeNull();
  expect(data.customer_id).toBe(customer.id);
  expect(Number(data.points_balance)).toBe(Number(customer.points_balance));
  expect(Number(data.total_points_earned)).toBe(Number(customer.total_points_earned));
  expect(Number(data.total_points_redeemed)).toBe(Number(customer.total_points_redeemed));
  expect(Number(data.visit_count)).toBe(Number(customer.visit_count));
  expect(Array.isArray(data.transactions)).toBe(true);

  // A deliberately wrong establishment must never reveal this customer's data.
  const { data: denied, error: deniedError } = await client.rpc('fn_test_verify_loyalty_data', {
    p_establishment_id: '00000000-0000-4000-8000-000000000001',
    p_customer_id: customer.id,
  });
  expect(denied).toBeNull();
  expect(deniedError).not.toBeNull();
  await client.auth.signOut();
});
