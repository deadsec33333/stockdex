import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';

export const db = createClient(config.supabase.url(), config.supabase.key(), { auth: { persistSession: false } });

// The Pons build shares its database with the Solana build; its tables carry a prefix.
const PREFIX = process.env.TABLE_PREFIX ?? 'pons_';
export const t = (name: string) => `${PREFIX}${name}`;

export async function getState(key: string): Promise<string | undefined> {
  const { data } = await db.from(t('bot_state')).select('value').eq('key', key).maybeSingle();
  return data?.value;
}
export async function setState(key: string, value: string) {
  await db.from(t('bot_state')).upsert({ key, value });
}
