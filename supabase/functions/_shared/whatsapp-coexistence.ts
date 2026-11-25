export function normalizePhone(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\D/g, '') : '';
}

export function getMessageDirection(message: Record<string, unknown>, businessPhone: unknown): 'inbound' | 'outbound' {
  const from = normalizePhone(message.from);
  const business = normalizePhone(businessPhone);
  if (from && business && from === business) return 'outbound';
  return message.direction === 'outbound' ? 'outbound' : 'inbound';
}

export function mapDeliveryStatus(value: unknown, direction: 'inbound' | 'outbound'): 'received' | 'queued' | 'sent' | 'delivered' | 'read' | 'failed' {
  const status = typeof value === 'string' ? value.toLowerCase() : '';
  if (status === 'played') return 'read';
  if (status === 'pending') return 'queued';
  if (status === 'error') return 'failed';
  if (status === 'sent' || status === 'delivered' || status === 'read' || status === 'failed') return status;
  return direction === 'outbound' ? 'sent' : 'received';
}

export function toIsoTimestamp(value: unknown, fallback = new Date()): string {
  const numberValue = typeof value === 'number' ? value : Number(value);
  if (Number.isFinite(numberValue) && numberValue > 0) {
    const milliseconds = numberValue > 1_000_000_000_000 ? numberValue : numberValue * 1000;
    const date = new Date(milliseconds);
    if (Number.isFinite(date.getTime())) return date.toISOString();
  }
  return fallback.toISOString();
}
