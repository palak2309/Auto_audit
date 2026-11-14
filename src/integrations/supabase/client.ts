import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    // New Supabase API keys are opaque strings, not bearer JWTs.
    if (
      isNewSupabaseApiKey(supabaseKey) &&
      headers.get("Authorization") === `Bearer ${supabaseKey}`
    ) {
      headers.delete("Authorization");
    }

    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

function createSupabaseClient() {
  // Use import.meta.env for client-side (Vite build-time replacement)
  // Fall back to process.env for SSR (server-side rendering)
  const env =
    typeof import.meta !== "undefined" && import.meta.env
      ? import.meta.env
      : ({} as Record<string, string | undefined>);
  const procEnv =
    typeof process !== "undefined" && process.env
      ? process.env
      : ({} as Record<string, string | undefined>);

  const SUPABASE_URL =
    env["VITE_SUPABASE_URL"] || procEnv["VITE_SUPABASE_URL"] || procEnv["SUPABASE_URL"];

  const SUPABASE_PUBLISHABLE_KEY =
    env["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
    env["VITE_SUPABASE_ANON_KEY"] ||
    procEnv["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
    procEnv["SUPABASE_PUBLISHABLE_KEY"] ||
    procEnv["VITE_SUPABASE_ANON_KEY"] ||
    procEnv["SUPABASE_ANON_KEY"];

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    // Return inert dummy client in development when env is not configured so the app does not
    // crash into an unhandled error boundary or accidentally connect to an unintended external database.
    return createClient<Database>(
      "https://placeholder.supabase.co",
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy.dummy",
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: {
      fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY),
    },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";
export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});
