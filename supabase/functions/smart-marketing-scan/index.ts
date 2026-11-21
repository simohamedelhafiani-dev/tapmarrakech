import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const headers = { 'Content-Type': 'application/json' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
const supported = new Set(['winback', 'birthday', 'vip', 'progress']);
type ConfigRow = { establishment_id: string; smart_id: string; enabled: boolean; config: Record<string, unknown> };
type Customer = { id: string; establishment_id: string; first_name: string | null; last_visit_at: string | null; visit_count: number | null; points_balance: number | null; birth_day: number | null; birth_month: number | null; stamps_balance: number | null; notification_consent: boolean | null; marketing_consent: boolean | null; };

const num = (v: unknown, fallback: number) => { const n = typeof v === 'string' ? Number.parseFloat(v) : Number(v); return Number.isFinite(n) ? n : fallback; };
const localDateParts = () => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Casablanca', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
  return { day: Number(p.day), month: Number(p.month), date: `${p.year}-${p.month}-${p.day}` };
};

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ success: false, error: 'POST requis.' }, 405);
  const secret = Deno.env.get('SMART_MARKETING_CRON_SECRET');
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!secret || !token || token !== secret) return json({ success: false, error: 'Non autorisé.' }, 401);
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json({ success: false, error: 'Configuration Supabase absente.' }, 503);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const date = localDateParts();
  const { data: configs, error: configError } = await admin.from('smart_marketing_configs').select('establishment_id,smart_id,enabled,config').eq('enabled', true);
  if (configError) return json({ success: false, error: 'Lecture configurations impossible.' }, 500);
  let scanned = 0, queued = 0, skippedUnsupported = 0;
  const errors: string[] = [];
  for (const cfg of (configs ?? []) as ConfigRow[]) {
    if (!supported.has(cfg.smart_id)) { skippedUnsupported++; continue; }
    const runInsert = await admin.from('smart_marketing_runs').insert({ establishment_id: cfg.establishment_id, smart_id: cfg.smart_id, run_type: 'SCAN', status: 'STARTED' }).select('id').single();
    if (runInsert.error || !runInsert.data) { errors.push(`${cfg.smart_id}: log start failed`); continue; }
    const runId = runInsert.data.id;
    const { data: customers, error: customerError } = await admin.from('loyalty_customers')
      .select('id,establishment_id,first_name,last_visit_at,visit_count,points_balance,birth_day,birth_month,stamps_balance,notification_consent,marketing_consent')
      .eq('establishment_id', cfg.establishment_id)
      .eq('notification_consent', true);
    if (customerError) {
      await admin.from('smart_marketing_runs').update({ status: 'FAILED', details: { error: 'Customer scan failed' }, finished_at: new Date().toISOString() }).eq('id', runId);
      errors.push(`${cfg.smart_id}: scan failed`); continue;
    }
    const eligible: Array<{customer:Customer; trigger:string; payload:Record<string,unknown>}> = [];
    const settings = cfg.config ?? {};
    const { data: loyaltySetting, error: settingsError } = cfg.smart_id === 'progress'
      ? await admin.from('loyalty_settings').select('stamp_goal').eq('establishment_id', cfg.establishment_id).maybeSingle()
      : { data: null, error: null };
    const runErrors: string[] = [];
    if (settingsError) runErrors.push('Loyalty settings lookup failed');
    for (const customer of (customers ?? []) as Customer[]) {
      scanned++;
      let trigger = '', payload: Record<string,unknown> = {};
      if (cfg.smart_id === 'birthday' && customer.birth_day === date.day && customer.birth_month === date.month && customer.marketing_consent) {
        trigger = `birthday:${date.date}`; payload = { date: date.date, template: 'birthday' };
      } else if (cfg.smart_id === 'winback' && customer.last_visit_at && customer.marketing_consent) {
        const delayDays = Math.max(1, Math.min(365, num(settings.delayDays ?? settings.delay_days ?? settings.delay, 30)));
        const elapsed = Math.floor((Date.now() - new Date(customer.last_visit_at).getTime()) / 86400000);
        if (elapsed >= delayDays) { trigger = `winback:${customer.last_visit_at.slice(0,10)}:${delayDays}`; payload = { inactive_days: elapsed, delay_days: delayDays }; }
      } else if (cfg.smart_id === 'vip' && customer.marketing_consent) {
        const visitThreshold = Math.max(1, num(settings.thresholdVisits ?? settings.threshold_visits ?? settings.threshold, 10));
        if ((customer.visit_count ?? 0) >= visitThreshold) { trigger = `vip:${visitThreshold}:${customer.visit_count}`; payload = { visits: customer.visit_count, threshold: visitThreshold }; }
      } else if (cfg.smart_id === 'progress' && customer.marketing_consent && !settingsError) {
        const goal = Math.max(1, num(loyaltySetting?.stamp_goal, 10));
        const progressPercent = Math.max(1, Math.min(100, num(settings.thresholdPercent ?? settings.threshold_percent ?? settings.threshold, 80)));\n        const threshold = Math.max(1, Math.ceil(goal * progressPercent / 100));
        if ((customer.stamps_balance ?? 0) >= threshold && (customer.stamps_balance ?? 0) < goal) { trigger = `progress:${goal}:${customer.stamps_balance}`; payload = { stamps: customer.stamps_balance, goal, percent: Math.round((customer.stamps_balance / goal) * 100) }; }
      }
      if (trigger) eligible.push({ customer, trigger, payload });
    }
    let added = 0;
    for (const item of eligible) {
      const { error: insertError } = await admin.from('smart_marketing_queue').insert({
        establishment_id: cfg.establishment_id, customer_id: item.customer.id, smart_id: cfg.smart_id,
        trigger_key: item.trigger, payload: item.payload, status: 'PENDING', scheduled_at: new Date().toISOString(),
      });
      if (!insertError) added++;
      else if (insertError.code !== '23505') { runErrors.push(`${cfg.smart_id}: queue insert failed`); errors.push(`${cfg.smart_id}: queue insert failed`); }
    }
    queued += added;
    await admin.from('smart_marketing_runs').update({ status: runErrors.length ? 'PARTIAL' : 'COMPLETED', scanned: customers?.length ?? 0, queued: added, skipped: (customers?.length ?? 0) - eligible.length, details: { eligible: eligible.length, deduplicated: eligible.length, errors: runErrors }, finished_at: new Date().toISOString() }).eq('id', runId);
  }
  return json({ success: errors.length === 0, scanned, queued, supported: [...supported], skippedUnsupported, errors });
});
