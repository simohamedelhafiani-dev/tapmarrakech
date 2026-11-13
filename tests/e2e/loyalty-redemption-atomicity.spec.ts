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

type StampFixtureCleanup = {
  admin: SupabaseClient;
  managerId: string;
  previousEstablishmentId: string | null;
  establishmentId: string;
};
let stampFixtureCleanup: StampFixtureCleanup | null = null;

test.afterEach(async () => {
  const fixture = stampFixtureCleanup;
  stampFixtureCleanup = null;
  if (!fixture) return;

  const { error: loginError } = await fixture.admin.auth.signInWithPassword({
    email: process.env.E2E_ADMIN_EMAIL!,
    password: process.env.E2E_ADMIN_PASSWORD!,
  });
  expect(loginError, 'Réauthentification Admin Staging avant nettoyage').toBeNull();

  if (fixture.previousEstablishmentId) {
    const { error } = await fixture.admin.functions.invoke('admin-manage-responsibles', {
      body: { action: 'assign', user_id: fixture.managerId, establishment_id: fixture.previousEstablishmentId },
    });
    expect(error, 'Restauration de l’affectation QA initiale').toBeNull();
  } else {
    const { error } = await fixture.admin.functions.invoke('admin-manage-responsibles', {
      body: { action: 'unassign', user_id: fixture.managerId },
    });
    expect(error, 'Retrait de l’affectation temporaire QA').toBeNull();
  }

  const { error: deleteError } = await fixture.admin
    .from('establishments')
    .delete()
    .eq('id', fixture.establishmentId);
  expect(deleteError, 'Suppression de la fixture Staging (données liées en cascade)').toBeNull();

  const { data: remaining, error: verifyError } = await fixture.admin
    .from('establishments')
    .select('id')
    .eq('id', fixture.establishmentId);
  expect(verifyError).toBeNull();
  expect(remaining ?? []).toHaveLength(0);
  await fixture.admin.auth.signOut();
});

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

  const admin = stagingClient();
  const { error: adminLoginError } = await admin.auth.signInWithPassword({
    email: process.env.E2E_ADMIN_EMAIL!,
    password: process.env.E2E_ADMIN_PASSWORD!,
  });
  expect(adminLoginError, 'Connexion Admin QA sur Staging').toBeNull();

  const { data: managerProfile, error: profileError } = await admin
    .from('profiles')
    .select('id')
    .eq('email', process.env.E2E_RESPONSIBLE_EMAIL!)
    .single();
  expect(profileError, 'Compte Responsable QA identifié').toBeNull();

  const { data: previousAssignments, error: assignmentsError } = await admin
    .from('establishment_staff')
    .select('establishment_id')
    .eq('user_id', managerProfile.id)
    .eq('role', 'MANAGER')
    .eq('active', true);
  expect(assignmentsError, 'Affectation QA initiale lisible').toBeNull();
  const previousEstablishmentId = previousAssignments?.[0]?.establishment_id ?? null;

  const { data: businessTypes, error: businessTypeError } = await admin
    .from('ai_business_types')
    .select('id')
    .eq('active', true)
    .limit(1);
  expect(businessTypeError).toBeNull();
  expect(businessTypes?.[0]?.id, 'Type établissement actif disponible sur Staging').toBeTruthy();

  const suffix = Date.now().toString();
  const { data: created, error: createError } = await admin
    .from('establishments')
    .insert({
      name: `QA STAMP Atomicity ${suffix}`,
      slug: `qa-stamp-atomicity-${suffix}`,
      ai_business_type_id: businessTypes![0].id,
      google_review_url: '',
      redirect_threshold: 4,
    })
    .select('id')
    .single();
  expect(createError, 'Création établissement fixture par Admin Staging').toBeNull();
  expect(created?.id).toBeTruthy();

  stampFixtureCleanup = {
    admin,
    managerId: managerProfile.id,
    previousEstablishmentId,
    establishmentId: created.id,
  };

  const { data: assignment, error: assignmentError } = await admin.functions.invoke('admin-manage-responsibles', {
    body: { action: 'assign', user_id: managerProfile.id, establishment_id: created.id },
  });
  expect(assignmentError, 'Affectation temporaire du Responsable QA').toBeNull();
  expect(assignment?.success).toBeTruthy();

  const { error: loginError } = await manager.auth.signInWithPassword({
    email: process.env.E2E_RESPONSIBLE_EMAIL!,
    password: process.env.E2E_RESPONSIBLE_PASSWORD!,
  });
  expect(loginError).toBeNull();

  const { error: settingsError } = await manager.rpc('save_loyalty_program_settings', {
    p_establishment_id: created.id,
    p_program_type: 'STAMP',
    p_stamp_goal: 2,
    p_stamp_reward_name: 'Récompense QA',
    p_stamp_reward_description: 'Fixture temporaire Playwright Staging',
    p_discount_percent: null,
    p_discount_valid_days: 7,
    p_points_per_currency: 1,
    p_currency: 'MAD',
    p_enabled: true,
    p_discount_points_threshold: 1000,
  });
  expect(settingsError, 'Activation du programme STAMP sur la fixture isolée').toBeNull();

  const stampProgram = await findStampEstablishment(manager);
  expect(stampProgram, 'Programme STAMP QA activé et visible par le Responsable').not.toBeNull();
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
