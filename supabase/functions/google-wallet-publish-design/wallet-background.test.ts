import { normalizeNardoBackgroundColor } from "./wallet-background.ts";

function assertEquals(actual: unknown, expected: unknown) {
  if (actual !== expected) throw new Error(`Expected ${String(expected)}, received ${String(actual)}`);
}

Deno.test("blue-toned Wallet backgrounds are replaced with Nardo grey", () => {
  assertEquals(normalizeNardoBackgroundColor("#3B82F6"), "#686D76");
  assertEquals(normalizeNardoBackgroundColor("#0000FF"), "#686D76");
  assertEquals(normalizeNardoBackgroundColor("#003366"), "#686D76");
});

Deno.test("neutral Nardo backgrounds remain unchanged", () => {
  assertEquals(normalizeNardoBackgroundColor("#050505"), "#050505");
  assertEquals(normalizeNardoBackgroundColor("#111111"), "#111111");
  assertEquals(normalizeNardoBackgroundColor("#686D76"), "#686D76");
});

Deno.test("invalid colors use a safe neutral fallback", () => {
  assertEquals(normalizeNardoBackgroundColor("blue"), "#050505");
});
