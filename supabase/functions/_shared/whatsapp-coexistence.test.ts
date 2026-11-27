import { getMessageDirection, mapDeliveryStatus, normalizePhone, toIsoTimestamp } from './whatsapp-coexistence.ts';

function assertEquals(actual: unknown, expected: unknown) {
  if (actual !== expected) throw new Error(`Expected ${String(expected)}, received ${String(actual)}`);
}

Deno.test('classifies messages sent by the business app as outbound', () => {
  assertEquals(getMessageDirection({ from: '+1 (555) 123-4567', to: '15550000000' }, '15551234567'), 'outbound');
  assertEquals(getMessageDirection({ from: '15550000000', to: '15551234567' }, '15551234567'), 'inbound');
});

Deno.test('maps coexistence history delivery states', () => {
  assertEquals(mapDeliveryStatus('PLAYED', 'outbound'), 'read');
  assertEquals(mapDeliveryStatus('PENDING', 'outbound'), 'queued');
  assertEquals(mapDeliveryStatus('ERROR', 'outbound'), 'failed');
  assertEquals(mapDeliveryStatus(undefined, 'inbound'), 'received');
});

Deno.test('normalizes contact phone numbers and rejects non-string values', () => {
  assertEquals(normalizePhone('+1 (555) 123-4567'), '15551234567');
  assertEquals(normalizePhone(null), '');
});

Deno.test('accepts seconds and milliseconds timestamps', () => {
  assertEquals(toIsoTimestamp(1790000000), new Date(1790000000000).toISOString());
  assertEquals(toIsoTimestamp(1790000000000), new Date(1790000000000).toISOString());
});
