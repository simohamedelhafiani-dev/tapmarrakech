import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const STAGING_REF = 'jsllksnmylpxcgqaeidq';

test('QA SQL bridge: authorized manager, transaction consistency, and cross-establishment denial', async () => {
  const url = process.env.E2E_SUPABASE_URL!;
  const key = process.env.E2E_SUPABASE_ANON_KEY!;
  expect(new URL(url).hostname).toBe(`${STAGING_REF}.supabase.co`);
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const publicClient = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: loginError } = await client.auth.signInWithPassword({
    email: process.env.E2E_RESPONSIBLE_EMAIL!,
    password: process.env.E2E_RESPONSIBLE_PASSWORD!,
  });
  expect(loginError).toBeNull();

  // Resolve the QA Responsable's actual active assignment. Never assume an
  // old Riad Demo UUID or depend on a pre-existing customer fixture.
  const { data: establishments, error: establishmentsError } = await client.rpc('get_my_establishments');
  expect(establishmentsError).toBeNull();
  let establishmentId: string | null = null;
  for (const row of establishments ?? []) {
    if (!row.id) continue;
    const { data: settings, error: settingsError } = await client.rpc('get_loyalty_program_settings', {
      p_establishment_id: row.id,
    });
    expect(settingsError).toBeNull();
    const config = Array.isArray(settings) ? settings[0] : settings;
    if (config?.enabled === true) {
      establishmentId = row.id;
      break;
    }
  }
  expect(establishmentId, 'Le Responsable QA doit avoir un établissement avec fidélité activée').toBeTruthy();

  const unique = Date.now().toString().slice(-8);
  const { data: enrollment, error: enrollmentError } = await publicClient.rpc(
    'register_public_loyalty_customer_for_enrollment_v3',
    {
      p_establishment_id: establishmentId,
      p_first_name: `QA-BRIDGE-${unique}`,
      p_last_name: 'Bridge',
      p_phone: `+2126${unique}`,
      p_birth_date: null,
      p_email: null,
      p_interests: [],
      p_marketing_consent: false,
      p_notification_consent: false,
      p_preferred_channel: 'NONE',
      p_visit_frequency: null,
    },
  );
  expect(enrollmentError, 'Création d’un client temporaire sur l’établissement QA').toBeNull();
  expect(enrollment?.access_token).toBeTruthy();
  const { data: cardRows, error: cardError } = await publicClient.rpc('get_public_loyalty_card', {
    p_access_token: enrollment.access_token,
  });
  expect(cardError).toBeNull();
  const card = Array.isArray(cardRows) ? cardRows[0] : cardRows;
  const customer = { id: card.customer_id };

  const { data, error } = await client.rpc('fn_test_verify_loyalty_data', {
    p_establishment_id: establishmentId, p_customer_id: customer.id,
  });
  expect(error).toBeNull();
  expect(data.customer_id).toBe(customer.id);
  expect(Number(data.points_balance)).toBe(0);
  expect(Number(data.total_points_earned)).toBe(0);
  expect(Number(data.total_points_redeemed)).toBe(0);
  expect(Number(data.visit_count)).toBe(0);
  expect(Array.isArray(data.transactions)).toBe(true);
  expect(data.transactions).toHaveLength(0);

  // A deliberately wrong establishment must never reveal this customer's data.
  const { data: denied, error: deniedError } = await client.rpc('fn_test_verify_loyalty_data', {
    p_establishment_id: '00000000-0000-4000-8000-000000000001',
    p_customer_id: customer.id,
  });
  expect(denied).toBeNull();
  expect(deniedError).not.toBeNull();
  await Promise.all([client.auth.signOut(), publicClient.auth.signOut()]);
});
