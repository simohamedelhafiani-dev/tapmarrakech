import { test, expect } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const STAGING_REF = 'jsllksnmylpxcgqaeidq';

function stagingClient() {
  const url = process.env.E2E_SUPABASE_URL!;
  expect(new URL(url).hostname).toBe(`${STAGING_REF}.supabase.co`);
  return createClient(url, process.env.E2E_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function findStampEstablishment(manager: SupabaseClient): Promise<{ id: string; goal: number } | null> {
  const { data, error } = await manager.rpc('get_my_establishments');
  expect(error, 'Le Responsable QA doit pouvoir lister ses établissements').toBeNull();

  for (const row of data ?? []) {
    if (!row.id) continue;
    const { data: settings, error: settingsError } = await manager.rpc('get_loyalty_program_settings', {
      p_establishment_id: row.id,
    });
    expect(settingsError, 'Lecture des paramètres fidélité Staging').toBeNull();
    const config = Array.isArray(settings) ? settings[0] : settings;
    if (config?.enabled === true && config?.program_type === 'STAMP' && Number(config?.stamp_goal) > 0) {
      return { id: row.id, goal: Number(config.stamp_goal) };
    }
  }
  return null;
}

test('Tampons — QR actif réutilisé, surplus conservé et QR rejoué refusé', async () => {
  const manager = stagingClient();
  const publicClient = stagingClient();

  const { error: loginError } = await manager.auth.signInWithPassword({
    email: process.env.E2E_RESPONSIBLE_EMAIL!,
    password: process.env.E2E_RESPONSIBLE_PASSWORD!,
  });
  expect(loginError).toBeNull();

  const stampProgram = await findStampEstablishment(manager);
  test.skip(
    !stampProgram,
    'Fixture Staging manquante : aucun programme STAMP actif. Activer un établissement QA dédié avant de certifier ce scénario.',
  );
  const { id: establishmentId, goal } = stampProgram!;
  const { data: scannerRows, error: scannerError } = await manager.rpc(
    'get_or_create_establishment_scanner_link',
    { p_establishment_id: establishmentId },
  );
  expect(scannerError).toBeNull();
  const scanner = Array.isArray(scannerRows) ? scannerRows[0] : scannerRows;
  expect(scanner?.scanner_token).toBeTruthy();

  const unique = Date.now().toString().slice(-8);
  const { data: enrollmentRows, error: enrollmentError } = await publicClient.rpc(
    'register_public_loyalty_customer_for_enrollment_v2',
    {
      p_establishment_id: establishmentId,
      p_first_name: `QA-STAMP-${unique}`,
      p_last_name: 'Atomicity',
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
  expect(enrollmentError, 'Inscription client QA').toBeNull();
  const enrollment = Array.isArray(enrollmentRows) ? enrollmentRows[0] : enrollmentRows;
  expect(enrollment?.access_token).toBeTruthy();

  const { data: cardRows, error: cardError } = await publicClient.rpc('get_public_loyalty_card', {
    p_access_token: enrollment.access_token,
  });
  expect(cardError).toBeNull();
  const card = Array.isArray(cardRows) ? cardRows[0] : cardRows;
  expect(card?.customer_id).toBeTruthy();

  // Earn exactly the configured threshold, using real scanner RPC calls on Staging.
  for (let i = 0; i < goal; i += 1) {
    const { data, error } = await publicClient.rpc('add_loyalty_stamp_by_scanner', {
      p_scanner_token: scanner.scanner_token,
      p_customer_id: card.customer_id,
    });
    expect(error, `Attribution du tampon ${i + 1}/${goal}`).toBeNull();
    const result = Array.isArray(data) ? data[0] : data;
    expect(Number(result?.stamps_balance)).toBe(i + 1);
  }

  const { data: firstRows, error: firstError } = await publicClient.rpc(
    'create_public_loyalty_stamp_reward_claim',
    { p_access_token: enrollment.access_token },
  );
  expect(firstError, 'Création du QR de récompense').toBeNull();
  const first = Array.isArray(firstRows) ? firstRows[0] : firstRows;
  expect(first?.claim_token).toBeTruthy();
  expect(Number(first?.stamps_required)).toBe(goal);

  // A second request while the first QR is live must return the same claim.
  const { data: secondRows, error: secondError } = await publicClient.rpc(
    'create_public_loyalty_stamp_reward_claim',
    { p_access_token: enrollment.access_token },
  );
  expect(secondError, 'La seconde demande doit réutiliser le QR actif').toBeNull();
  const second = Array.isArray(secondRows) ? secondRows[0] : secondRows;
  expect(second?.claim_token).toBe(first.claim_token);

  // Earn two additional stamps after claim creation; redemption must preserve them.
  for (let i = 1; i <= 2; i += 1) {
    const { data, error } = await publicClient.rpc('add_loyalty_stamp_by_scanner', {
      p_scanner_token: scanner.scanner_token,
      p_customer_id: card.customer_id,
    });
    expect(error, `Attribution du tampon supplémentaire ${i}`).toBeNull();
    const result = Array.isArray(data) ? data[0] : data;
    expect(Number(result?.stamps_balance)).toBe(goal + i);
  }

  const { data: redeemedRows, error: redeemedError } = await publicClient.rpc(
    'redeem_public_loyalty_stamp_reward_claim',
    { p_scanner_token: scanner.scanner_token, p_claim_token: first.claim_token },
  );
  expect(redeemedError, 'Validation du QR').toBeNull();
  const redeemed = Array.isArray(redeemedRows) ? redeemedRows[0] : redeemedRows;
  expect(Number(redeemed?.new_stamps_balance)).toBe(2);

  const { data: claimAfterRows, error: claimAfterError } = await publicClient.rpc(
    'get_public_loyalty_stamp_reward_claim',
    { p_claim_token: first.claim_token },
  );
  expect(claimAfterError).toBeNull();
  const claimAfter = Array.isArray(claimAfterRows) ? claimAfterRows[0] : claimAfterRows;
  expect(claimAfter?.status).toBe('REDEEMED');

  // Replay must be rejected and must not consume the two retained stamps.
  const { error: replayError } = await publicClient.rpc(
    'redeem_public_loyalty_stamp_reward_claim',
    { p_scanner_token: scanner.scanner_token, p_claim_token: first.claim_token },
  );
  expect(replayError, 'Un QR déjà validé ne doit pas être rejoué').not.toBeNull();

  await Promise.all([manager.auth.signOut(), publicClient.auth.signOut()]);
});
