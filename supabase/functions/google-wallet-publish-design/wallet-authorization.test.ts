import { canPublishEstablishmentWalletDesign } from "./wallet-authorization.ts";

Deno.test("admins may publish wallet designs for any establishment", () => {
  if (!canPublishEstablishmentWalletDesign("admin", "owner-a", "admin-user")) {
    throw new Error("Expected admin publication to be allowed");
  }
});

Deno.test("an establishment owner may publish for their own establishment", () => {
  if (!canPublishEstablishmentWalletDesign("responsible", "user-a", "user-a")) {
    throw new Error("Expected owner publication to be allowed");
  }
});

Deno.test("a different authenticated user cannot publish for another establishment", () => {
  if (canPublishEstablishmentWalletDesign("responsible", "owner-a", "user-b")) {
    throw new Error("Expected cross-tenant publication to be denied");
  }
});

Deno.test("missing owner or user identity fails closed", () => {
  if (canPublishEstablishmentWalletDesign("responsible", null, "user-a")) {
    throw new Error("Missing owner must be denied");
  }
  if (canPublishEstablishmentWalletDesign("responsible", "owner-a", "")) {
    throw new Error("Missing user identity must be denied");
  }
});
