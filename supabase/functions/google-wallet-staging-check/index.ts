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

function pemToBytes(pem: string): Uint8Array {
  const base64 = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function base64url(input: Uint8Array | string): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function createAccessToken(serviceAccount: { client_email: string; private_key: string }) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/wallet_object.issuer",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${claims}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToBytes(serviceAccount.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  ));
  const assertion = `${unsigned}.${base64url(signature)}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const result = await response.json();
  if (!response.ok || !result.access_token) {
    throw new Error(result.error_description || result.error || "Google OAuth token request failed");
  }
  return String(result.access_token);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ success: false, error: "Méthode non autorisée" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ success: false, stage: "supabase_config", error: "Configuration Supabase serveur incomplète" }, 500);
    }

    const authorization = request.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return json({ success: false, error: "Session requise" }, 401);

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user }, error: userError } = await adminClient.auth.getUser(authorization.slice(7));
    if (userError || !user) return json({ success: false, error: "Session invalide" }, 401);

    const { data: profile } = await adminClient.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profile?.role !== "admin") return json({ success: false, error: "Accès réservé à l'administrateur" }, 403);

    const issuerId = Deno.env.get("GOOGLE_WALLET_ISSUER_ID") || Deno.env.get("WALLET_ISSUER_ID") || "";
    const serviceAccountRaw =
      Deno.env.get("GOOGLE_WALLET_SERVICE_ACCOUNT_JSON") ||
      Deno.env.get("GOOGLE_WALLET_SERVICE_ACCOUNT") ||
      Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON") ||
      "";

    if (!issuerId || !serviceAccountRaw) {
      return json({
        success: false,
        stage: "secret_presence",
        issuerIdPresent: Boolean(issuerId),
        serviceAccountPresent: Boolean(serviceAccountRaw),
        error: "Secrets Google Wallet introuvables sous les noms attendus",
      }, 503);
    }

    let serviceAccount: { client_email?: string; private_key?: string };
    try {
      serviceAccount = JSON.parse(serviceAccountRaw);
    } catch {
      return json({ success: false, stage: "service_account_json", error: "Le secret du compte de service n'est pas un JSON valide" }, 422);
    }
    if (!serviceAccount.client_email || !serviceAccount.private_key) {
      return json({ success: false, stage: "service_account_fields", error: "Le JSON doit contenir client_email et private_key" }, 422);
    }

    const token = await createAccessToken({
      client_email: serviceAccount.client_email,
      private_key: serviceAccount.private_key,
    });

    const apiResponse = await fetch(
      `https://walletobjects.googleapis.com/walletobjects/v1/genericClass?issuerId=${encodeURIComponent(issuerId)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const apiBody = await apiResponse.json().catch(() => ({}));
    if (!apiResponse.ok) {
      const googleMessage = apiBody?.error?.message || "Google Wallet API access check failed";
      return json({
        success: false,
        stage: "issuer_api_access",
        oauth: "ok",
        issuerIdPresent: true,
        serviceAccountEmail: serviceAccount.client_email,
        googleStatus: apiResponse.status,
        error: googleMessage,
      }, apiResponse.status === 403 ? 403 : 502);
    }

    return json({
      success: true,
      stage: "complete",
      oauth: "ok",
      walletApi: "reachable",
      issuerIdPresent: true,
      serviceAccountEmail: serviceAccount.client_email,
      message: "Authentification Google et accès à l'API Wallet confirmés. Aucun pass n'a été créé ni modifié.",
    });
  } catch (error) {
    console.error("google-wallet-staging-check failed", error instanceof Error ? error.message : "unknown error");
    return json({
      success: false,
      stage: "unexpected",
      error: error instanceof Error ? error.message : "Erreur interne",
    }, 500);
  }
});
