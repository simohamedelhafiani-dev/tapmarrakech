import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SignJWT } from "https://esm.sh/jose@5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { code } = await req.json();
    if (!code || String(code).trim().length < 4) {
      return new Response(JSON.stringify({ error: "Code employé obligatoire" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const jwtSecret = Deno.env.get("JWT_LEGACY_SECRET");
    if (!url || !serviceKey || !jwtSecret) throw new Error("Configuration serveur incomplète");

    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    const ip =
      req.headers.get("cf-connecting-ip") ??
      req.headers.get("x-real-ip") ??
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "";
    const fallback = req.headers.get("user-agent") ?? "unknown-client";
    const keyHash = await sha256Hex(ip ? "ip:" + ip : "fallback:" + fallback);

    const { data: limitData, error: limitError } = await admin.rpc("consume_employee_login_attempt", { p_key_hash: keyHash });
    if (limitError) {
      console.error("employee login rate-limit:", limitError);
      return new Response(JSON.stringify({ error: "Connexion temporairement indisponible." }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const limit = Array.isArray(limitData) ? limitData[0] : limitData;
    if (!limit?.allowed) {
      const retry = Number(limit?.retry_after_seconds ?? 900);
      return new Response(JSON.stringify({ error: "Trop de tentatives. Réessayez plus tard.", retry_after_seconds: retry }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": String(retry) },
      });
    }

    const { data, error } = await admin.rpc("login_employee_with_code_only", { p_code: String(code).trim() });
    if (error || !data || data.length === 0) {
      return new Response(JSON.stringify({ error: "Code employé incorrect" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await admin.rpc("clear_employee_login_rate_limit", { p_key_hash: keyHash });

    const employee = data[0];
    const now = Math.floor(Date.now() / 1000);
    const accessToken = await new SignJWT({
      role: "authenticated",
      aud: "authenticated",
      email: "employee-" + employee.employee_id + "@tapmarrakech.local",
      establishment_id: employee.establishment_id,
      employee_id: employee.employee_id,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setSubject(employee.employee_id)
      .setIssuedAt(now)
      .setExpirationTime(now + 60 * 60 * 12)
      .sign(new TextEncoder().encode(jwtSecret));

    return new Response(JSON.stringify({
      access_token: accessToken,
      refresh_token: employee.session_token,
      employee_id: employee.employee_id,
      employee_name: employee.employee_name,
      establishment_id: employee.establishment_id,
      establishment_name: employee.establishment_name,
      expires_at: employee.expires_at,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("employee-login:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erreur serveur" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
