export function canPublishEstablishmentWalletDesign(
  role: unknown,
  establishmentOwnerId: unknown,
  userId: string,
): boolean {
  if (role === "admin") return true;
  return typeof establishmentOwnerId === "string"
    && establishmentOwnerId.length > 0
    && userId.length > 0
    && establishmentOwnerId === userId;
}
