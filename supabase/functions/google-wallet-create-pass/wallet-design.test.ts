import { resolveGoogleWalletClassId } from "./wallet-design.ts";

function assertEquals(actual: unknown, expected: unknown) {
  if (actual !== expected) throw new Error(`Expected ${String(expected)}, received ${String(actual)}`);
}

Deno.test("selected Google Wallet design requires an approved class for the configured issuer", () => {
  assertEquals(resolveGoogleWalletClassId({
    googleClassId: "issuer123.kelyani_design_a",
    googleClassStatus: "APPROVED",
  }, "issuer123", "issuer123.default", "design-a"), "issuer123.kelyani_design_a");
});

Deno.test("Apple-ready or pending Google designs cannot fall back to the demo class", () => {
  assertEquals(resolveGoogleWalletClassId({
    googleClassId: null,
    googleClassStatus: null,
    appleReady: true,
  }, "issuer123", "issuer123.default", "design-apple-only"), null);
  assertEquals(resolveGoogleWalletClassId({
    googleClassId: "issuer123.kelyani_pending",
    googleClassStatus: "UNDER_REVIEW",
  }, "issuer123", "issuer123.default", "design-pending"), null);
});

Deno.test("selected design cannot point to a different Google Wallet issuer", () => {
  assertEquals(resolveGoogleWalletClassId({
    googleClassId: "otherissuer.kelyani_design",
    googleClassStatus: "APPROVED",
  }, "issuer123", "issuer123.default", "design-other-issuer"), null);
});

Deno.test("pass issuance fails closed when no published design was selected", () => {
  assertEquals(resolveGoogleWalletClassId({
    googleClassId: "issuer123.legacy_unpublished",
    googleClassStatus: "APPROVED",
  }, "issuer123", "issuer123.default", ""), null);
  assertEquals(resolveGoogleWalletClassId({}, "issuer123", "issuer123.default", ""), null);
});
