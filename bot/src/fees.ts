// Creator fees -> holders.
//   npm run fees:claim   pull Pons creator fees out of the fee escrow into the launcher wallet
//   npm run fees:plan    split an amount of ETH across holders of every live coin (writes 'planned' rows, sends nothing)
//   npm run fees:pay     send the planned payouts from the payout wallet (real money, run by hand)
//
// Split rule (v1, simple and transparent): the ETH you pass to fees:plan is divided equally between live coins,
// then inside each coin pro rata by balance among holders, skipping contracts (the bonding curve, the pool,
// the locker) and anyone below MIN_SHARE_ETH.
import { formatEther, parseEther, type Address } from 'viem';
import { config } from './config.js';
import { publicClient, wallet, txUrl } from './chain.js';
import { claimCreatorFees } from './pons.js';
import { db } from './db.js';

const MIN_SHARE_ETH = 0.0002;

/** Holder list from the chain explorer; Robinhood Chain runs Blockscout. */
async function holdersOf(token: string): Promise<{ owner: Address; amount: bigint }[]> {
  const out: { owner: Address; amount: bigint }[] = [];
  let next = `${config.chain.explorer}/api/v2/tokens/${token}/holders`;
  for (let page = 0; page < 20 && next; page++) {
    const res = await fetch(next);
    if (!res.ok) throw new Error(`explorer ${res.status} listing holders of ${token}`);
    const body: any = await res.json();
    for (const h of body.items ?? []) out.push({ owner: h.address?.hash as Address, amount: BigInt(h.value ?? 0) });
    next = body.next_page_params
      ? `${config.chain.explorer}/api/v2/tokens/${token}/holders?${new URLSearchParams(body.next_page_params)}`
      : '';
  }
  return out.filter(h => h.owner && h.amount > 0n);
}

/** Contracts hold the curve and pool supply; only wallets get paid. */
async function isWallet(address: Address) {
  const code = await publicClient.getCode({ address });
  return !code || code === '0x';
}

async function plan(totalEth: number) {
  const { data: coins } = await db.from('launches').select('id, ticker, token_address').eq('status', 'live');
  if (!coins?.length) return console.log('no live coins');
  const perCoin = totalEth / coins.length;

  for (const c of coins) {
    const all = await holdersOf(c.token_address!);
    const holders: { owner: Address; amount: bigint }[] = [];
    for (const h of all) if (await isWallet(h.owner)) holders.push(h);
    const supply = holders.reduce((s, h) => s + h.amount, 0n);
    if (supply === 0n) { console.log(`$${c.ticker}: no wallet holders yet`); continue; }

    const rows = holders
      .map(h => ({
        launch_id: c.id,
        holder: h.owner,
        amount_eth: +(perCoin * Number(h.amount) / Number(supply)).toFixed(8),
      }))
      .filter(r => r.amount_eth >= MIN_SHARE_ETH);
    if (rows.length) await db.from('payouts').insert(rows);
    console.log(`$${c.ticker}: ${rows.length} holders planned, ${perCoin.toFixed(5)} ETH`);
  }
}

async function pay() {
  const { account, client } = wallet(config.payoutKey());
  const { data: rows } = await db.from('payouts').select('*').eq('status', 'planned').limit(500);
  for (const r of rows ?? []) {
    try {
      const hash = await client.sendTransaction({
        account, chain: null, to: r.holder as Address, value: parseEther(String(r.amount_eth)),
      });
      await publicClient.waitForTransactionReceipt({ hash });
      await db.from('payouts').update({ status: 'sent', tx_hash: hash }).eq('id', r.id);
    } catch (e: any) {
      await db.from('payouts').update({ status: 'failed' }).eq('id', r.id);
      console.error(`payout ${r.id} failed: ${e.message}`);
    }
  }
  console.log(`processed ${rows?.length ?? 0} payouts`);
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === 'claim') {
  const { hash, amount } = await claimCreatorFees();
  await db.from('fee_claims').insert({ tx_hash: hash, claimed_eth: Number(formatEther(amount)) });
  console.log(`claimed ${formatEther(amount)} ETH, ${txUrl(hash)}`);
} else if (cmd === 'plan') {
  const eth = Number(arg);
  if (!(eth > 0)) throw new Error('usage: npm run fees:plan -- 0.5   (ETH to distribute)');
  await plan(eth);
} else if (cmd === 'pay') {
  await pay();
} else {
  console.log('usage: claim | plan <ETH> | pay');
}
