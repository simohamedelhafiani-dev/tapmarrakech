import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function base64url(value: Uint8Array | string): string {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\\+/g, "-").replace(/\\//g, "_");
}

function pemToBytes(pem: string): Uint8Array {
  const base64 = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\\s/g, "");
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function signJwt(claims: Record<string, unknown>, privateKey: string): Promise<string> {
  const unsigned = `${base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${base64url(JSON.stringify(claims))}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToBytes(privateKey),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned),
  ));
  return `${unsigned}.${base64url(signature)}`;
}

function localized(value: string, language = "fr-FR") {
  return { defaultValue: { language, value } };
}

async function getWalletAccessToken(clientEmail: string, privateKey: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const assertion = await signJwt({
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/wallet_object.issuer",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }, privateKey);

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || typeof payload.access_token !== "string") {
    console.error("Google Wallet OAuth failed", response.status, payload.error || "unknown");
    throw new Error("Le compte de service Google Wallet n'a pas pu obtenir un jeton d'accès.");
  }
  return payload.access_token;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ success: false, error: "Méthode non autorisée" }, 405);

  try {
    const body = await request.json().catch(() => ({}));
    const accessToken = typeof body.access_token === "string" ? body.access_token : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(accessToken)) {
      return json({ success: false, error: "Lien de carte invalide" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const issuerId = (Deno.env.get("GOOGLE_WALLET_ISSUER_ID") || Deno.env.get("WALLET_ISSUER_ID") || "").trim();
    const classId = (Deno.env.get("GOOGLE_WALLET_CLASS_ID") || (issuerId ? `${issuerId}.kelyani_loyalty_demo_v1` : "")).trim();
    const serviceAccountRaw =
      Deno.env.get("GOOGLE_WALLET_SERVICE_ACCOUNT_JSON") ||
      Deno.env.get("GOOGLE_WALLET_SERVICE_ACCOUNT") ||
      Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON") || "";

    if (!supabaseUrl || !anonKey || !issuerId || !classId || !serviceAccountRaw) {
      return json({ success: false, error: "Configuration Wallet incomplète. Contactez l'établissement." }, 503);
    }
    if (!classId.startsWith(`${issuerId}.`)) {
      return json({ success: false, error: "La classe Google Wallet ne correspond pas à l'émetteur configuré." }, 503);
    }

    let serviceAccount: { client_email?: string; private_key?: string };
    try {
      serviceAccount = JSON.parse(serviceAccountRaw);
    } catch {
      return json({ success: false, error: "Configuration du compte de service invalide" }, 503);
    }
    if (!serviceAccount.client_email || !serviceAccount.private_key) {
      return json({ success: false, error: "Compte de service incomplet" }, 503);
    }

    const publicClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const [
      { data: cardRows, error: cardError },
      { data: designRows },
      { data: programRows },
      { data: walletDesignResult, error: walletDesignError },
    ] = await Promise.all([
      publicClient.rpc("get_public_loyalty_card", { p_access_token: accessToken }),
      publicClient.rpc("get_public_loyalty_card_config", { p_access_token: accessToken }),
      publicClient.rpc("get_public_loyalty_program_context", { p_access_token: accessToken }),
      publicClient.rpc("get_public_loyalty_wallet_config", { p_access_token: accessToken }),
    ]);

    if (cardError || !cardRows?.[0]) {
      return json({ success: false, error: "Carte de fidélité introuvable ou expirée" }, 404);
    }
    if (walletDesignError) {
      console.error("Google Wallet design lookup failed", walletDesignError.message);
      return json({ success: false, error: "Impossible de charger le design Wallet de cet établissement" }, 500);
    }

    const card = cardRows[0];
    const design = designRows?.[0] ?? {};
    const program = programRows?.[0] ?? {};
    const walletDesign = walletDesignResult && typeof walletDesignResult === "object"
      ? walletDesignResult as Record<string, unknown>
      : {};
    const clientName = [card.first_name, card.last_name].filter(Boolean).join(" ").slice(0, 20) || "Client KELYANI";
    const loyaltyNumber = String(card.loyalty_number || card.customer_id).slice(0, 20);
    const balance = Math.max(0, Math.floor(Number(card.points_balance || 0)));
    const stamps = Math.max(0, Math.floor(Number(program.stamps_balance ?? card.stamps_balance ?? 0)));
    const mode = String(program.program_type || "POINTS_REWARD");
    const progress = mode === "STAMP"
      ? `${stamps}/${Number(program.stamp_goal || 10)}`
      : String(balance);
    const appBaseUrl = (Deno.env.get("APP_BASE_URL") || "https://www.kelyani.com").replace(/\/+$/, "");
    const qrValue = `${appBaseUrl}/loyalty/${encodeURIComponent(accessToken)}`;
    const objectSuffix = `kelyani_${String(card.establishment_id).replace(/-/g, "")}_${String(card.customer_id).replace(/-/g, "")}`;
    const objectId = `${issuerId}.${objectSuffix}`;

    // Verify the existing Loyalty Class before issuing a save link. A DRAFT class
    // cannot be used to create a Loyalty Object; never change its review status here.
    const googleAccessToken = await getWalletAccessToken(serviceAccount.client_email, serviceAccount.private_key);
    const classResponse = await fetch(
      `https://walletobjects.googleapis.com/walletobjects/v1/loyaltyClass/${encodeURIComponent(classId)}`,
      { headers: { Authorization: `Bearer ${googleAccessToken}` } },
    );
    const classPayload = await classResponse.json().catch(() => ({}));
    if (classResponse.status === 404) {
      return json({ success: false, error: "La classe KELYANI est introuvable dans cet émetteur Google Wallet." }, 409);
    }
    if (!classResponse.ok) {
      console.error("Google Wallet class lookup failed", classResponse.status, classPayload.error?.message || "unknown");
      return json({ success: false, error: "Google Wallet ne permet pas de vérifier la classe. Vérifiez les droits du compte de service." }, 502);
    }
    if (String(classPayload.reviewStatus || "").toUpperCase() !== "APPROVED") {
      return json({
        success: false,
        code: "WALLET_CLASS_NOT_APPROVED",
        review_status: classPayload.reviewStatus || "UNKNOWN",
        error: "La classe KELYANI n'est pas encore approuvée par Google. Son statut actuel est " + String(classPayload.reviewStatus || "inconnu") + ". Soumettez-la à validation depuis la console Google Wallet.",
      }, 409);
    }

    const loyaltyObject = {
      id: objectId,
      classId,
      state: "ACTIVE",
      accountName: clientName,
      accountId: loyaltyNumber,
      loyaltyPoints: {
        label: mode === "STAMP" ? "Tampons" : "Points",
        balance: { string: progress },
      },
      barcode: {
        type: "QR_CODE",
        value: qrValue,
        alternateText: "Présentez ce QR code à l'établissement",
      },
      textModulesData: [
        { id: "establishment", header: "Établissement", body: String(card.establishment_name || "KELYANI").slice(0, 40) },
        { id: "customer", header: "Titulaire", body: clientName },
        { id: "loyalty-number", header: "Numéro client", body: loyaltyNumber },
        ...(walletDesign.footerText
          ? [{ id: "wallet-footer", header: "KELYANI", body: String(walletDesign.footerText).slice(0, 80) }]
          : []),
      ],
      ...(typeof walletDesign.logoUrl === "string" && walletDesign.logoUrl.startsWith("https://")
        ? { imageModulesData: [{ mainImage: { sourceUri: { uri: String(walletDesign.logoUrl) }, contentDescription: localized("Logo KELYANI") } }] }
        : {}),
      linksModuleData: {
        uris: [{ uri: "https://www.kelyani.com", description: "Découvrir KELYANI" }],
      },
      notifyPreference: "NOTIFY",
    };

    const now = Math.floor(Date.now() / 1000);
    const saveJwt = await signJwt({
      iss: serviceAccount.client_email,
      aud: "google",
      typ: "savetowallet",
      iat: now,
      origins: [],
      payload: { loyaltyObjects: [loyaltyObject] },
    }, serviceAccount.private_key);

    return json({
      success: true,
      save_url: `https://pay.google.com/gp/v/save/${saveJwt}`,
      pass_id: objectId,
      class_id: classId,
      message: "Lien Google Wallet prêt. Le client peut ajouter sa carte après approbation de la classe.",
    });
  } catch (error) {
    console.error("google-wallet-create-pass failed", error instanceof Error ? error.message : "unknown error");
    return json({ success: false, error: "Impossible de préparer la carte Google Wallet pour le moment" }, 500);
  }
});
