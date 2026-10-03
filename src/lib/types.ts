export type Launch = { id: number; ticker: string; coin_name: string; image_url: string | null; token_address: string; tx_hash: string | null; live_at: string; tweet_id: string; x_handle: string; avatar_url: string | null; stock_symbol: string; stock_name: string; stock_address: string };
export type Stats = { tokens_launched: number; creators: number; pairs_used: number; eth_paid_to_holders: number };
export type Pair = { symbol: string; name: string; launches: number; address?: string };
export type Result<T> = { data: T; state: 'ready' | 'unconfigured' | 'error' };
export type LaunchPage = { launches: Launch[]; total: number };
