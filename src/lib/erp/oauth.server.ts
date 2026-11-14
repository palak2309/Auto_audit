// Server-only: OAuth config + token exchange for each accounting provider.
// Credentials are read from the database first (entered by the admin via the
// app UI), then fall back to environment variables.
import { decryptJson, encryptJson } from "./crypto.server";

export interface OAuthConfig {
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
  clientId: string;
  clientSecret: string;
  extraAuthParams?: Record<string, string>;
}

export interface StoredTokens {
  access_token: string;
  refresh_token?: string | undefined;
  expires_at: number;
  api_domain?: string | undefined;
  auth_server?: string | undefined; // e.g. "https://accounts.zoho.com" — used for token refresh
  realm_id?: string | undefined;
  tenant_id?: string | undefined;
  organization_id?: string | undefined;
}

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.length > 0 ? v : undefined;
}

/**
 * Build an OAuthConfig from explicit credentials (DB-stored or env).
 * `extra` holds provider-specific options such as Zoho's data center.
 */
function buildConfig(
  provider: string,
  clientId: string,
  clientSecret: string,
  extra: Record<string, string> = {},
): OAuthConfig | null {
  switch (provider) {
    case "xero":
      return {
        clientId,
        clientSecret,
        authorizeUrl: "https://login.xero.com/identity/connect/authorize",
        tokenUrl: "https://identity.xero.com/connect/token",
        scope:
          "openid profile email offline_access accounting.transactions.read accounting.contacts.read accounting.settings.read",
      };
    case "quickbooks":
      return {
        clientId,
        clientSecret,
        authorizeUrl: "https://appcenter.intuit.com/connect/oauth2",
        tokenUrl: "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
        scope: "com.intuit.quickbooks.accounting",
      };
    case "zoho_books": {
      const dc = extra["dc"] ?? "com";
      return {
        clientId,
        clientSecret,
        authorizeUrl: `https://accounts.zoho.${dc}/oauth/v2/auth`,
        tokenUrl: `https://accounts.zoho.${dc}/oauth/v2/token`,
        // ZohoBooks.fullaccess.all is the correct scope granting read access to
        // organisations, bills, invoices, contacts, and payments.
        // The non-existent scope "ZohoBooks.fullaccess.READ" produces HTTP 401 code 57.
        scope: "ZohoBooks.fullaccess.all",
        extraAuthParams: { access_type: "offline", prompt: "consent" },
      };
    }
    default:
      return null;
  }
}

/** Synchronous env-var-only config — used as a fallback when no DB credentials exist. */
function envConfig(provider: string): OAuthConfig | null {
  switch (provider) {
    case "xero": {
      const clientId = env("XERO_CLIENT_ID");
      const clientSecret = env("XERO_CLIENT_SECRET");
      if (!clientId || !clientSecret) return null;
      return buildConfig(provider, clientId, clientSecret);
    }
    case "quickbooks": {
      const clientId = env("QUICKBOOKS_CLIENT_ID");
      const clientSecret = env("QUICKBOOKS_CLIENT_SECRET");
      if (!clientId || !clientSecret) return null;
      return buildConfig(provider, clientId, clientSecret);
    }
    case "zoho_books": {
      const clientId = env("ZOHO_BOOKS_CLIENT_ID");
      const clientSecret = env("ZOHO_BOOKS_CLIENT_SECRET");
      if (!clientId || !clientSecret) return null;
      return buildConfig(provider, clientId, clientSecret, { dc: env("ZOHO_BOOKS_DC") ?? "com" });
    }
    default:
      return null;
  }
}

export function envProviderConfigured(provider: string): boolean {
  return envConfig(provider) !== null;
}

/** Read a single provider's credentials from the database (encrypted). */
async function dbConfig(provider: string): Promise<OAuthConfig | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("erp_provider_config")
    .select("client_id, client_secret_ciphertext, extra_config")
    .eq("provider", provider)
    .maybeSingle();
  if (!data) return null;
  const clientId = data.client_id as string;
  const clientSecret = decryptJson<string>(data.client_secret_ciphertext as string);
  const extra = (data.extra_config as Record<string, string> | null) ?? {};
  return buildConfig(provider, clientId, clientSecret, extra);
}

/** Return all provider IDs that have credentials stored in the database. */
export async function dbConfiguredProviderIds(): Promise<string[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("erp_provider_config").select("provider");
  return (data ?? []).map((r) => r.provider as string);
}

/** Save a provider's OAuth credentials to the database (encrypted). */
export async function saveDbConfig(
  provider: string,
  clientId: string,
  clientSecret: string,
  extra: Record<string, string> = {},
  configuredBy?: string,
): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("erp_provider_config").upsert(
    {
      provider,
      client_id: clientId,
      client_secret_ciphertext: encryptJson(clientSecret),
      extra_config: extra,
      configured_by: configuredBy ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "provider" },
  );
  if (error) throw new Error(error.message);
}

export async function oauthConfig(provider: string): Promise<OAuthConfig | null> {
  return (await dbConfig(provider)) ?? envConfig(provider);
}

export async function providerConfigured(provider: string): Promise<boolean> {
  return (await oauthConfig(provider)) !== null;
}

export function redirectUri(origin: string): string {
  return `${origin}/api/public/erp/callback`;
}

export async function buildAuthorizeUrl(
  provider: string,
  state: string,
  origin: string,
): Promise<string> {
  const cfg = await oauthConfig(provider);
  if (!cfg) throw new Error(`${provider} is not configured`);
  const url = new URL(cfg.authorizeUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", cfg.clientId);
  url.searchParams.set("redirect_uri", redirectUri(origin));
  url.searchParams.set("scope", cfg.scope);
  url.searchParams.set("state", state);
  for (const [k, v] of Object.entries(cfg.extraAuthParams ?? {})) url.searchParams.set(k, v);
  return url.toString();
}

async function postToken(
  cfg: OAuthConfig,
  body: URLSearchParams,
): Promise<Record<string, unknown>> {
  const res = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      Authorization: `Basic ${Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64")}`,
    },
    body,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Token request failed [${res.status}]: ${text}`);
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`Token request returned non-JSON response: ${text.slice(0, 300)}`);
  }
  if (parsed["error"]) {
    const desc = parsed["error_description"] ? `: ${parsed["error_description"]}` : "";
    throw new Error(`OAuth token error [${parsed["error"]}]${desc}`);
  }
  return parsed;
}

function toStored(raw: Record<string, unknown>, previous?: StoredTokens): StoredTokens {
  const accessToken = raw["access_token"];
  if (typeof accessToken !== "string" || !accessToken.trim() || accessToken === "undefined") {
    throw new Error(
      `OAuth token response did not contain a valid access_token. Raw response: ${JSON.stringify(raw).slice(0, 300)}`,
    );
  }
  const expiresIn = Number(raw["expires_in"] ?? 3600);
  const rawApiDomain = raw["api_domain"] as string | undefined;
  const apiDomain = rawApiDomain && rawApiDomain.length > 0 ? rawApiDomain : previous?.api_domain;
  return {
    access_token: accessToken.trim(),
    refresh_token: (raw["refresh_token"] as string | undefined) ?? previous?.refresh_token,
    expires_at: Date.now() + (expiresIn - 60) * 1000,
    api_domain: apiDomain,
    auth_server: previous?.auth_server, // carry forward — set explicitly after exchange
    realm_id: previous?.realm_id,
    tenant_id: previous?.tenant_id,
    organization_id: previous?.organization_id,
  };
}

export async function exchangeCode(
  provider: string,
  code: string,
  origin: string,
  accountsServer?: string | undefined,
): Promise<StoredTokens> {
  const cfg = await oauthConfig(provider);
  if (!cfg) throw new Error(`${provider} is not configured`);
  let tokenUrl = cfg.tokenUrl;
  if (provider === "zoho_books" && accountsServer) {
    tokenUrl = `${accountsServer.replace(/\/+$/, "")}/oauth/v2/token`;
  }
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri(origin),
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
  });
  const overriddenCfg = { ...cfg, tokenUrl };
  return toStored(await postToken(overriddenCfg, body));
}

export async function refreshTokens(provider: string, tokens: StoredTokens): Promise<StoredTokens> {
  const cfg = await oauthConfig(provider);
  if (!cfg) throw new Error(`${provider} is not configured`);
  if (!tokens.refresh_token) throw new Error("No refresh token stored — reconnect the account");
  // For Zoho: use the auth_server stored during OAuth if available, so refresh
  // goes to the correct regional accounts server (e.g. accounts.zoho.in vs .com).
  let tokenUrl = cfg.tokenUrl;
  if (provider === "zoho_books" && tokens.auth_server) {
    tokenUrl = `${tokens.auth_server}/oauth/v2/token`;
  }
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: tokens.refresh_token,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
  });
  const overriddenCfg = { ...cfg, tokenUrl };
  return toStored(await postToken(overriddenCfg, body), tokens);
}

export async function validTokens(provider: string, tokens: StoredTokens) {
  if (tokens.expires_at > Date.now()) return { tokens, refreshed: false as const };
  return { tokens: await refreshTokens(provider, tokens), refreshed: true as const };
}

export const packTokens = encryptJson;
export function unpackTokens(cipher: string): StoredTokens {
  return decryptJson<StoredTokens>(cipher);
}
