import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Defaults so the site works the moment it is deployed, with no environment variables to set.
// The anon key is a public, read-only key: row level security decides what it can see.
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://woidhlyawfsueclegdju.supabase.co';
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndvaWRobHlhd2ZzdWVjbGVnZGp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxMDcxMzEsImV4cCI6MjEwNTY4MzEzMX0.cwRyC7qJJ5RyMuO8ydABGDPkjIVaWwWfdQn2vqQmJlY';

// The Pons build shares this database with the Solana build; its tables carry a prefix.
const PREFIX = process.env.NEXT_PUBLIC_TABLE_PREFIX ?? 'pons_';
export const T = (name: string) => `${PREFIX}${name}`;

let client: SupabaseClient | null = null;
export function getSupabase() {
  if (!URL || !KEY) return null;
  if (!client) client = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store', signal: init?.signal ?? AbortSignal.timeout(12000) }) } });
  return client;
}
