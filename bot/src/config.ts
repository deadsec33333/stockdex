import { config as loadEnv } from 'dotenv';
// settings come from .env; env-values.txt works too, so the file never has to be renamed
loadEnv();
loadEnv({ path: 'env-values.txt' });

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name} (see .env.example)`);
  return v;
}
const opt = (name: string, def = '') => process.env[name] ?? def;
const bool = (name: string, def: boolean) => (process.env[name] ?? String(def)).toLowerCase() === 'true';
const num = (name: string, def: number) => Number(process.env[name] ?? def);

export const config = {
  brand: opt('BRAND_NAME', 'YourBrand'),
  botHandle: opt('BOT_HANDLE', 'YourBotHandle'),
  siteUrl: opt('SITE_URL', 'https://example.com'),
  x: {
    bearer: () => req('X_BEARER_TOKEN'),
    botUserId: () => opt('X_BOT_USER_ID'), // optional: looked up from BOT_HANDLE when empty
    apiKey: () => req('X_API_KEY'),
    apiSecret: () => req('X_API_SECRET'),
    accessToken: () => req('X_ACCESS_TOKEN'),
    accessSecret: () => req('X_ACCESS_SECRET'),
    replyEnabled: bool('X_REPLY_ENABLED', false),
  },
  supabase: { url: () => req('SUPABASE_URL'), key: () => req('SUPABASE_SERVICE_ROLE_KEY') },
  pinataJwt: () => req('PINATA_JWT'),

  // Robinhood Chain + the Pons launchpad
  chain: {
    id: num('CHAIN_ID', 4663),
    rpcUrl: opt('RPC_URL', 'https://rpc.mainnet.chain.robinhood.com'),
    explorer: opt('EXPLORER_URL', 'https://robinhoodchain.blockscout.com'),
  },
  pons: {
    // Pons v2 factory on Robinhood Chain. Confirm against docs.ponsfamily.com before going live.
    factory: opt('PONS_FACTORY', '0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e') as `0x${string}`,
    feeEscrow: opt('PONS_FEE_ESCROW', '0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e') as `0x${string}`,
    launchConfigId: BigInt(opt('PONS_LAUNCH_CONFIG_ID', '0')),
    creatorTaxBps: num('CREATOR_TAX_BPS', 100),       // 100 = 1%, max 1000 (10%)
    buybackEnabled: bool('BUYBACK_ENABLED', false),
    coinUrl: (token: string) => `https://www.ponsfamily.com/launchpad/${token}`,
  },
  // launcher wallet: pays the launch fee and is recorded as the coin creator
  launcherKey: () => req('LAUNCHER_PRIVATE_KEY') as `0x${string}`,
  // where creator fees are sent; empty = the launcher wallet
  creatorFeeRecipient: opt('CREATOR_FEE_RECIPIENT') as `0x${string}` | '',
  payoutKey: () => req('PAYOUT_PRIVATE_KEY') as `0x${string}`,

  dryRun: bool('DRY_RUN', true),
  limits: {
    perUserPerDay: num('MAX_LAUNCHES_PER_USER_PER_DAY', 3),
    perDay: num('MAX_LAUNCHES_PER_DAY', 50),
  },
  pollSeconds: num('POLL_SECONDS', 30),
};
