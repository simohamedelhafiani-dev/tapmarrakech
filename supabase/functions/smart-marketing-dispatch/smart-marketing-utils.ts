export function extractBearerToken(header:string|null):string|null {
 if(!header)return null;
 const match=header.match(/^Bearer\s+(.+)$/i);
 return match?.[1]?.trim() || null;
}
export function constantTimeEqual(actual: string, expected: string): boolean {
 if (actual.length !== expected.length) return false;
 let mismatch = 0;
 for (let i = 0; i < actual.length; i += 1) mismatch |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
 return mismatch === 0;
}

export function normalizeLimit(value:unknown):number {
 const n=Number(value);
 return Number.isFinite(n)&&n>0 ? Math.max(1,Math.min(Math.floor(n),200)) : 50;
}
export function progressThreshold(goal:number):number {
 return Math.max(1,Math.ceil(Math.max(1,goal)*0.8));
}
export function buildTriggerKey(type:string,date:string,days?:number):string {
 return days===undefined ? `${type}:${date}` : `${type}:${date}:${days}`;
}

export function parseSmartConfigNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === 'string' ? Number.parseFloat(value.trim()) : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function resolveSmartMessage(customMessage: unknown, fallbackMessage: string): string {
  return typeof customMessage === 'string' && customMessage.trim().length > 0 ? customMessage.trim() : fallbackMessage;
}

export function retryDelayMinutes(attempts: number): number {
  const normalized = Number.isFinite(attempts) ? Math.max(1, Math.floor(attempts)) : 1;
  return Math.min(30, 2 ** Math.max(0, normalized - 1));
}

export function parseHappyHourSchedule(value: unknown): { start: string; end: string } | null {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})$/);
  if (!match) return null;
  const valid = (time: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
  if (!valid(match[1]) || !valid(match[2]) || match[1] >= match[2]) return null;
  return { start: match[1], end: match[2] };
}

export function formatLocalDateKey(year: unknown, month: unknown, day: unknown): string {
  const y = String(year ?? '').trim();
  const m = String(month ?? '').trim().padStart(2, '0');
  const d = String(day ?? '').trim().padStart(2, '0');
  if (!/^\d{4}$/.test(y) || !/^\d{2}$/.test(m) || !/^\d{2}$/.test(d)) return '';
  return `${y}-${m}-${d}`;
}

export function resolveRewardClaimCycle(
  goal: number,
  claim: { id?: unknown; claim_id?: unknown; status?: unknown; claim_status?: unknown; expires_at?: unknown } | null | undefined,
  nowMs = Date.now(),
): { pendingActive: boolean; triggerKey: string } {
  if (!claim) return { pendingActive: false, triggerKey: `reward:${goal}:initial` };
  const claimId = String(claim.claim_id ?? claim.id ?? '');
  const status = String(claim.claim_status ?? claim.status ?? '').toUpperCase();
  const expiry = Date.parse(String(claim.expires_at ?? ''));
  const pendingActive = status === 'PENDING' && Number.isFinite(expiry) && expiry > nowMs;
  const cycleStatus = status === 'PENDING' && !pendingActive ? 'EXPIRED' : (status || 'UNKNOWN');
  return {
    pendingActive,
    triggerKey: `reward:${goal}:${claimId ? `${claimId}:${cycleStatus}` : 'initial'}`,
  };
}
