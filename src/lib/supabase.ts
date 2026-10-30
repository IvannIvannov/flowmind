import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;

const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as
  | string
  | undefined;

function requiredConfig(value: string | undefined, name: string): string {
  if (!value?.trim()) {
    throw new Error(`Missing Supabase configuration: ${name}`);
  }

  return value.trim();
}

export const supabase: SupabaseClient = createClient(
  requiredConfig(supabaseUrl, "VITE_SUPABASE_URL"),
  requiredConfig(supabasePublishableKey, "VITE_SUPABASE_PUBLISHABLE_KEY"),
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
