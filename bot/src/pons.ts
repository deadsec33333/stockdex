// Launches coins on the Pons launchpad (Robinhood Chain) and claims creator fees.
// There is no Pons API: the bot builds and signs the contract call itself, so the
// launcher wallet pays the launch fee and is recorded as the coin creator.
//
// Function shapes come from the official contracts: github.com/ponsdotdev/pons-labs
import { decodeEventLog, parseAbi, zeroAddress, type Address, type Hex } from 'viem';
import { config } from './config.js';
import { publicClient, wallet } from './chain.js';

const TOKEN_PARAMS =
  '(string name,string symbol,string logo,string description,' +
  '(string twitter,string telegram,string discord,string website,string farcaster) socials,' +
  'address creatorFeeRecipient,uint16 creatorTaxBps,bool buybackEnabled,bytes32 expectedEconomics,bytes32 salt)';

export const factoryAbi = parseAbi([
  `function launchToken(${TOKEN_PARAMS} params, uint256 launchConfigId, address pairToken) payable returns (address token, address curve)`,
  'function launchFee() view returns (uint256)',
  'function canLaunch(address launcher) view returns (bool)',
  'function approvedPairTokens(address token) view returns (bool)',
  'function previewLaunchEconomics(uint256 launchConfigId, address pairToken) view returns (bytes32)',
  'event TokenLaunched(address indexed token, address indexed curve, address indexed deployer, address pairToken, uint256 launchConfigId, uint256 graduationThreshold)',
]);

export const escrowAbi = parseAbi([
  'function claim() returns (uint256)',
  'function balanceOf(address recipient) view returns (uint256)',
  'function balanceOfToken(address recipient, address token) view returns (uint256)',
  'function claimToken(address token) returns (uint256)',
]);

const factory = { address: config.pons.factory, abi: factoryAbi } as const;

export const launcher = () => wallet(config.launcherKey());

/** Reads the factory before we spend anything. Returns a plain-English problem, or null when good to go.
 *  Anything the contract will not answer is treated as "unknown, carry on": the simulate step
 *  below is the real gate, so a renamed view here must never stop a launch that would work. */
export async function preflight(pairToken: Address): Promise<{ fee: bigint; problem: string | null }> {
  const { account } = launcher();
  const unknown = Symbol('unknown');
  const read = <T>(fn: 'canLaunch' | 'approvedPairTokens', args: readonly unknown[]) =>
    publicClient.readContract({ ...factory, functionName: fn, args: args as never }).catch(() => unknown) as Promise<T | typeof unknown>;

  const [fee, allowed, pairOk, balance] = await Promise.all([
    publicClient.readContract({ ...factory, functionName: 'launchFee' }),
    read<boolean>('canLaunch', [account.address]),
    read<boolean>('approvedPairTokens', [pairToken]),
    publicClient.getBalance({ address: account.address }),
  ]);
  let problem: string | null = null;
  if (balance < fee) problem = `launcher wallet is short on ETH (has ${balance}, launch fee is ${fee})`;
  else if (allowed === false) problem = `the factory is not accepting launches from ${account.address} right now`;
  else if (pairOk === false) problem = `${pairToken} is not an approved Pons pair token`;
  return { fee, problem };
}

export async function launchCoin(meta: {
  name: string;
  ticker: string;
  logoUri: string;        // ipfs://CID, max 512 bytes on chain
  description: string;    // max 2048 bytes on chain
  tweetUrl: string;
  pairToken: Address;     // the tokenized stock this coin trades against
}): Promise<{ token: Address; curve: Address; hash: Hex }> {
  const { account, client } = launcher();
  const { fee, problem } = await preflight(meta.pairToken);
  if (problem) throw new Error(problem);

  // Pins the economics we previewed, so an owner re-peg cannot land under our transaction.
  const expectedEconomics = await publicClient.readContract({
    ...factory, functionName: 'previewLaunchEconomics', args: [config.pons.launchConfigId, meta.pairToken],
  });

  const params = {
    name: meta.name.slice(0, 64),
    symbol: meta.ticker.slice(0, 16),
    logo: meta.logoUri.slice(0, 512),
    description: meta.description.slice(0, 2048),
    socials: { twitter: meta.tweetUrl, telegram: '', discord: '', website: config.siteUrl, farcaster: '' },
    creatorFeeRecipient: (config.creatorFeeRecipient || zeroAddress) as Address,
    creatorTaxBps: Math.min(Math.max(config.pons.creatorTaxBps, 0), 1000),
    buybackEnabled: config.pons.buybackEnabled,
    expectedEconomics,
    salt: randomSalt(),
  } as const;

  // simulate first: a revert here costs nothing, a revert on chain costs gas
  const { request } = await publicClient.simulateContract({
    ...factory, functionName: 'launchToken',
    args: [params, config.pons.launchConfigId, meta.pairToken],
    value: fee,                    // must equal launchFee() exactly, overpaying reverts
    account,
  });
  const hash = await client.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error(`launch transaction reverted (${hash})`);

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== config.pons.factory.toLowerCase()) continue;
    try {
      const ev = decodeEventLog({ abi: factoryAbi, data: log.data, topics: log.topics });
      if (ev.eventName === 'TokenLaunched') {
        const a = ev.args as unknown as { token: Address; curve: Address };
        return { token: a.token, curve: a.curve, hash };
      }
    } catch { /* not our event */ }
  }
  throw new Error(`launch went through but no TokenLaunched event was found (${hash})`);
}

/** Pulls whatever creator fees have been swept into the Pons escrow. */
export async function claimCreatorFees(): Promise<{ hash: Hex; amount: bigint }> {
  const { account, client } = launcher();
  const recipient = (config.creatorFeeRecipient || account.address) as Address;
  const amount = await publicClient.readContract({
    address: config.pons.feeEscrow, abi: escrowAbi, functionName: 'balanceOf', args: [recipient],
  });
  if (amount === 0n) throw new Error('nothing to claim yet');
  const hash = await client.writeContract({
    address: config.pons.feeEscrow, abi: escrowAbi, functionName: 'claim', chain: null, account,
  });
  await publicClient.waitForTransactionReceipt({ hash });
  return { hash, amount };
}

function randomSalt(): Hex {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return `0x${Buffer.from(b).toString('hex')}` as Hex;
}
