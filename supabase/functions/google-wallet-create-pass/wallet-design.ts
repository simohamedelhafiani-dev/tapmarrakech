export function resolveGoogleWalletClassId(
  walletDesign: Record<string, unknown>,
  issuerId: string,
  configuredClassId: string,
  requestedDesignId: string,
): string | null {
  // Pass issuance must always be tied to an explicitly selected design.
  // The public design RPC enforces publication + Google approval before this helper is reached.
  if (!requestedDesignId) return null;

  const classId = typeof walletDesign.googleClassId === "string" ? walletDesign.googleClassId.trim() : "";
  const approved = String(walletDesign.googleClassStatus ?? "").toUpperCase() === "APPROVED";
  if (!approved || !classId.startsWith(`${issuerId}.`)) return null;
  return classId;
}
