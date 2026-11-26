import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizeNardoBackgroundColor } from "./wallet-background.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

function b64url(value: Uint8Array | string) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function pemBytes(pem: string) {
  const raw = atob(pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, ""));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}
async function accessToken(email: string, privateKey: string) {
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64url(JSON.stringify({alg:"RS256",typ:"JWT"}))}.${b64url(JSON.stringify({
    iss: email, scope: "https://www.googleapis.com/auth/wallet_object.issuer",
    aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600,
  }))}`;
  const key = await crypto.subtle.importKey("pkcs8", pemBytes(privateKey), {name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"}, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned)));
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method:"POST", headers:{"Content-Type":"application/x-www-form-urlencoded"},
    body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion:`${unsigned}.${b64url(sig)}`}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) throw new Error("Authentification Google Wallet impossible.");
  return String(data.access_token);
}
const hex = (value: unknown, fallback: string) =>
  typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
const localized = (value: string) => ({defaultValue:{language:"fr-FR",value}});

type GoogleWalletFieldKey = "balance" | "accountName" | "accountId" | "reward" | "tier" | "venue" | "offer" | "program";
const GOOGLE_FIELD_PATHS: Record<GoogleWalletFieldKey, string> = {
  balance: "object.textModulesData['wallet-balance']",
  accountName: "object.accountName",
  accountId: "object.accountId",
  reward: "object.textModulesData['wallet-reward']",
  tier: "object.textModulesData['wallet-tier']",
  venue: "object.textModulesData['wallet-venue']",
  offer: "object.textModulesData['wallet-offer']",
  program: "object.textModulesData['wallet-program']",
};

const GOOGLE_CARD_LAYOUTS: Record<string, GoogleWalletFieldKey[][]> = {
  "google-balance-ledger": [["balance"], ["accountName", "accountId"], ["reward"]],
  "google-stamp-journey": [["balance", "reward"], ["accountName", "accountId"]],
  "google-member-profile": [["accountName"], ["accountId", "balance"], ["tier"]],
  "google-scan-first": [["accountId"], ["balance", "accountName"]],
  "google-reward-board": [["reward"], ["balance", "accountName"], ["accountId"]],
  "google-tier-club": [["tier"], ["accountName", "balance"], ["accountId"]],
  "google-venue-guide": [["venue"], ["accountName", "balance"], ["accountId"]],
  "google-offer-pass": [["offer"], ["balance", "accountName"], ["accountId"]],
};

function fieldSelector(fieldPath: string) {
  return { fields: [{ fieldPath }] };
}

function templateItem(fieldPath: string) {
  return { firstValue: fieldSelector(fieldPath) };
}

function normalizeGoogleRows(value: unknown, fallback: GoogleWalletFieldKey[][]): GoogleWalletFieldKey[][] {
  if (!Array.isArray(value)) return fallback;
  const valid = new Set(Object.keys(GOOGLE_FIELD_PATHS));
  const rows = value.slice(0, 3).flatMap(row => {
    if (!Array.isArray(row)) return [];
    const fields = row.slice(0, 3).filter((field): field is GoogleWalletFieldKey => typeof field === "string" && valid.has(field));
    return fields.length ? [fields] : [];
  });
  return rows.length ? rows : fallback;
}

function googleClassTemplate(designKey: string, design: Record<string, unknown>) {
  const fallback = GOOGLE_CARD_LAYOUTS[designKey] || GOOGLE_CARD_LAYOUTS["google-balance-ledger"];
  const layouts = design.googleTemplateLayouts && typeof design.googleTemplateLayouts === "object"
    ? design.googleTemplateLayouts as Record<string, unknown>
    : {};
  const rows = normalizeGoogleRows(layouts[designKey], fallback);
  const fieldRows = rows.map(row => row.map(field => GOOGLE_FIELD_PATHS[field]));
  const cardRowTemplateInfos = fieldRows.map(fields => fields.length === 1
    ? { oneItem: { item: templateItem(fields[0]) } }
    : fields.length === 2
      ? { twoItems: { startItem: templateItem(fields[0]), endItem: templateItem(fields[1]) } }
      : { threeItems: { startItem: templateItem(fields[0]), middleItem: templateItem(fields[1]), endItem: templateItem(fields[2]) } });
  const allFields = Array.from(new Set(fieldRows.flat()));
  const barcodeTop = allFields.includes(GOOGLE_FIELD_PATHS.accountId)
    ? GOOGLE_FIELD_PATHS.accountId
    : allFields[0] || GOOGLE_FIELD_PATHS.balance;
  return {
    cardTemplateOverride: { cardRowTemplateInfos },
    listTemplateOverride: {
      firstRowOption: { fieldOption: fieldSelector(fieldRows[0][0]) },
      secondRowOption: fieldSelector("object.accountName"),
    },
    cardBarcodeSectionDetails: {
      firstTopDetail: { fieldSelector: fieldSelector(barcodeTop) },
      firstBottomDetail: { fieldSelector: fieldSelector("object.accountId") },
    },
    detailsTemplateOverride: {
      detailsItemInfos: allFields.slice(0, 6).map(fieldPath => ({ item: templateItem(fieldPath) })),
    },
  };
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", {headers:cors});
  if (request.method !== "POST") return reply({success:false,error:"Méthode non autorisée"},405);
  try {
    const auth = request.headers.get("Authorization") || "";
    if (!auth.startsWith("Bearer ")) return reply({success:false,error:"Session requise"},401);
    const url = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const issuer = (Deno.env.get("GOOGLE_WALLET_ISSUER_ID") || Deno.env.get("WALLET_ISSUER_ID") || "").trim();
    const raw = Deno.env.get("GOOGLE_WALLET_SERVICE_ACCOUNT_JSON") || Deno.env.get("GOOGLE_WALLET_SERVICE_ACCOUNT") || Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON") || "";
    if (!url || !serviceKey || !issuer || !raw) return reply({success:false,error:"Configuration Wallet Staging incomplète."},503);

    const admin = createClient(url, serviceKey, {auth:{autoRefreshToken:false,persistSession:false}});
    const {data:{user},error:userError} = await admin.auth.getUser(auth.slice(7));
    if (userError || !user) return reply({success:false,error:"Session invalide"},401);
    const {data:profile} = await admin.from("profiles").select("role").eq("id",user.id).maybeSingle();

    const body = await request.json().catch(() => ({}));
    const establishmentId = String(body.establishment_id || "");
    const designKey = String(body.design_key || "").toLowerCase();
    const displayName = String(body.display_name || "").trim().slice(0,40);
    const design = body.design_config && typeof body.design_config === "object" ? body.design_config : {};
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(establishmentId)
      || !/^[a-z0-9][a-z0-9_-]{1,39}$/.test(designKey) || !displayName) {
      return reply({success:false,error:"Établissement ou modèle invalide."},400);
    }
    const {data:ownsPlace,error:ownershipError} = await admin.rpc("user_owns_establishment",{target_establishment_id:establishmentId});
    if (profile?.role !== "admin" && (ownershipError || ownsPlace !== true)) {
      return reply({success:false,error:"Vous ne pouvez publier des designs que pour votre propre établissement."},403);
    }
    const {data:place,error:placeError} = await admin.from("establishments").select("id,name,logo_url").eq("id",establishmentId).maybeSingle();
    if (placeError || !place) return reply({success:false,error:"Établissement introuvable."},404);

    let account: {client_email?:string;private_key?:string};
    try { account = JSON.parse(raw); } catch { return reply({success:false,error:"Compte de service Google invalide."},503); }
    if (!account.client_email || !account.private_key) return reply({success:false,error:"Compte de service Google incomplet."},503);
    const token = await accessToken(account.client_email,account.private_key);
    const classId = `${issuer}.kelyani_${establishmentId.replace(/-/g,"")}_${designKey}`;
    const logo = typeof design.logoUrl === "string" && design.logoUrl.startsWith("https://")
      ? design.logoUrl
      : typeof place.logo_url === "string" && place.logo_url.startsWith("https://")
        ? place.logo_url : "https://www.kelyani.com/kelyani-wallet-logo.png";
    const httpsImage = (value: unknown) =>
      typeof value === "string" && /^https:\/\//i.test(value) ? value : "";
    const heroImage = httpsImage(design.heroImageUrl);
    const websiteUrl = httpsImage(design.websiteUrl) || "https://www.kelyani.com";
    const phoneNumber = typeof design.phoneNumber === "string" ? design.phoneNumber.trim().slice(0, 30) : "";
    const address = typeof design.address === "string" ? design.address.trim().slice(0, 100) : "";
    const customMessage = typeof design.customMessage === "string" ? design.customMessage.trim().slice(0, 80) : "";
    const classBody = {
      id:classId, issuerName:"KELYANI",
      programName:String(design.cardTitle || displayName).slice(0,20),
      programLogo:{sourceUri:{uri:logo},contentDescription:localized("Logo du programme de fidélité")},
      ...(heroImage ? { heroImage:{sourceUri:{uri:heroImage},contentDescription:localized("Visuel principal de la carte")} } : {}),
      hexBackgroundColor:normalizeNardoBackgroundColor(design.backgroundColor,"#050505"),
      classTemplateInfo:googleClassTemplate(designKey, design),
      homepageUri:{uri:websiteUrl,description:"Découvrir l'établissement"},
      ...(phoneNumber ? {linksModuleData:{uris:[{uri:"tel:"+phoneNumber,description:"Téléphone"}]}} : {}),
      textModulesData:[
        ...(customMessage ? [{id:"wallet-message",header:"Bienvenue",body:customMessage}] : []),
        ...(address ? [{id:"wallet-address",header:"Adresse",body:address}] : []),
      ],
      reviewStatus:"UNDER_REVIEW",
    };
    const endpoint = `https://walletobjects.googleapis.com/walletobjects/v1/loyaltyClass/${encodeURIComponent(classId)}`;
    const get = await fetch(endpoint,{headers:{Authorization:`Bearer ${token}`}});
    let reviewStatus = "UNDER_REVIEW";
    let created = false;
    if (get.status === 404) {
      const insert = await fetch("https://walletobjects.googleapis.com/walletobjects/v1/loyaltyClass",{
        method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify(classBody),
      });
      const result = await insert.json().catch(() => ({}));
      if (!insert.ok) return reply({success:false,stage:"google_class_create",google_status:insert.status,error:result.error?.message || "Google a refusé la création de la classe."},502);
      reviewStatus = String(result.reviewStatus || "UNDER_REVIEW");
      created = true;
    } else {
      const current = await get.json().catch(() => ({}));
      if (!get.ok) return reply({success:false,stage:"google_class_read",google_status:get.status,error:current.error?.message || "Impossible de lire la classe Google."},502);
      reviewStatus = String(current.reviewStatus || "UNDER_REVIEW");
      const patch = await fetch(endpoint,{method:"PATCH",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({
        issuerName:classBody.issuerName,programName:classBody.programName,programLogo:classBody.programLogo,
        heroImage:classBody.heroImage || null,
        hexBackgroundColor:classBody.hexBackgroundColor,homepageUri:classBody.homepageUri,
        classTemplateInfo:classBody.classTemplateInfo,
        textModulesData:classBody.textModulesData,
        linksModuleData:classBody.linksModuleData || {uris:[]},
        reviewStatus:"UNDER_REVIEW",
      })});
      const updated = await patch.json().catch(() => ({}));
      if (!patch.ok) return reply({success:false,stage:"google_class_update",google_status:patch.status,error:updated.error?.message || "Google a refusé la mise à jour."},502);
      reviewStatus = String(updated.reviewStatus || reviewStatus);
    }

    const approved = reviewStatus.toUpperCase() === "APPROVED";
    const {data:saved,error:saveError} = await admin.from("loyalty_wallet_design_catalog").upsert({
      establishment_id:establishmentId,design_key:designKey,display_name:displayName,design_config:design,
      publication_status:approved ? "published" : "pending_validation",
      google_class_id:classId,google_review_status:reviewStatus,
      published_at:approved ? new Date().toISOString() : null,updated_at:new Date().toISOString(),
    },{onConflict:"establishment_id,design_key"}).select("id").single();
    if (saveError || !saved) return reply({success:false,stage:"catalog_save",error:"Classe Google traitée mais modèle non enregistré dans le catalogue."},500);
    return reply({
      success:true,design_id:saved.id,class_id:classId,review_status:reviewStatus,
      publication_status:approved ? "published" : "pending_validation",created,
      message:approved ? "Modèle publié et disponible pour les clients." : "Modèle enregistré. Il sera proposé aux clients après validation de sa classe par Google.",
    });
  } catch (error) {
    console.error("google-wallet-publish-design failed",error instanceof Error ? error.message : "unknown");
    return reply({success:false,error:"Impossible de publier ce modèle Wallet."},500);
  }
});

