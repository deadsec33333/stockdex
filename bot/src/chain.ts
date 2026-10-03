// Robinhood Chain clients. Everything on-chain goes through here.
import { createPublicClient, createWalletClient, defineChain, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { config } from './config.js';

export const robinhoodChain = defineChain({
  id: config.chain.id,
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [config.chain.rpcUrl] } },
  blockExplorers: { default: { name: 'Blockscout', url: config.chain.explorer } },
});

export const publicClient = createPublicClient({ chain: robinhoodChain, transport: http(config.chain.rpcUrl) });

export function wallet(privateKey: `0x${string}`) {
  const account = privateKeyToAccount(privateKey);
  return { account, client: createWalletClient({ account, chain: robinhoodChain, transport: http(config.chain.rpcUrl) }) };
}

export const txUrl = (hash: string) => `${config.chain.explorer}/tx/${hash}`;
export const tokenUrl = (address: string) => `${config.chain.explorer}/token/${address}`;
