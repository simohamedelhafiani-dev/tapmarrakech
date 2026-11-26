export function resolveGoogleWalletClassId(
  walletDesign: Record<string, unknown>,
  issuerId: string,
  configuredClassId: string,
  requestedDesignId: string,
): string | null {
  if (requestedDesignId) {
    const classId = typeof walletDesign.googleClassId === "string" ? walletDesign.googleClassId.trim() : "";
    const approved = String(walletDesign.googleClassStatus ?? "").toUpperCase() === "APPROVED";
    if (!approved || !classId.startsWith(`${issuerId}.`)) return null;
    return classId;
  }
  const classId = String(walletDesign.googleClassId || configuredClassId).trim();
  return classId.startsWith(`${issuerId}.`) ? classId : null;
}
