// Refreshes the stock list: pulls every Robinhood stock token live on this chain,
// then asks the Pons factory which of them it will actually accept as a pair token.
//   npm run stocks:sync
import type { Address } from 'viem';
import { config } from './config.js';
import { publicClient } from './chain.js';
import { factoryAbi } from './pons.js';
import { db } from './db.js';

type Asset = {
  tokenSymbol?: string; tokenName?: string; name?: string; status?: string;
  deployments?: { chainId?: number; contractAddress?: string }[];
};

const assets = async (): Promise<Asset[]> => {
  const res = await fetch('https://api.robinhood.com/rhj/assets');
  if (!res.ok) throw new Error(`Robinhood asset API ${res.status}`);
  const body: any = await res.json();
  return (Array.isArray(body) ? body : body.assets ?? body.results ?? body.data ?? []) as Asset[];
};

const approved = (token: Address) =>
  publicClient.readContract({ address: config.pons.factory, abi: factoryAbi, functionName: 'approvedPairTokens', args: [token] })
    .catch(() => false);

const list = await assets();
let seen = 0, usable = 0;

for (const a of list) {
  const symbol = (a.tokenSymbol ?? '').toUpperCase();
  const deployment = a.deployments?.find(d => d.chainId === config.chain.id && d.contractAddress);
  if (!symbol || !deployment) continue;
  if (a.status && a.status.toLowerCase() !== 'active') continue;
  seen++;

  const address = deployment.contractAddress as Address;
  const ponsApproved = await approved(address);
  if (ponsApproved) usable++;

  await db.from('stocks').upsert({
    symbol,
    name: (a.tokenName ?? a.name ?? symbol).replace(/\s*•\s*Robinhood Token$/i, ''),
    address,
    pons_approved: ponsApproved,
    checked_at: new Date().toISOString(),
  });
}

console.log(`${seen} stock tokens on chain ${config.chain.id}, ${usable} of them accepted by Pons as a pair token`);
if (!usable) console.log('none approved: either the factory address is wrong or Pons has not opened pair tokens to you yet');
