// The bot loop: read mentions -> validate -> launch coin -> save -> reply.
import { config } from './config.js';
import { db, getState, setState } from './db.js';
import { parseLaunch } from './parse.js';
import { fetchMentions, reply, type Mention } from './x.js';
import { uploadCoinImage } from './ipfs.js';
import { launchCoin, preflight, launcher } from './pons.js';

const dayAgo = () => new Date(Date.now() - 86_400_000).toISOString();

async function countSince(filter: { x_user_id?: string }) {
  let q = db.from('launches').select('id', { count: 'exact', head: true })
    .in('status', ['launching', 'live']).gte('created_at', dayAgo());
  if (filter.x_user_id) q = q.eq('x_user_id', filter.x_user_id);
  const { count } = await q;
  return count ?? 0;
}

async function handle(m: Mention) {
  const tweetUrl = `https://x.com/${m.authorHandle}/status/${m.id}`;

  // dedupe
  const { data: existing } = await db.from('launches').select('id').eq('tweet_id', m.id).maybeSingle();
  if (existing) return;

  const parsed = parseLaunch(m.text, config.botHandle);
  // Replies cost money per post, so the bot only ever answers a successful launch.
  if (!parsed.ok) { console.log(`skipped ${m.id}: ${parsed.reason}`); return; }

  const { data: stock } = await db.from('stocks').select('*').eq('symbol', parsed.stock).eq('enabled', true).maybeSingle();

  await db.from('creators').upsert({ x_user_id: m.authorId, x_handle: m.authorHandle, avatar_url: m.authorAvatar });

  const base = { tweet_id: m.id, x_user_id: m.authorId, ticker: parsed.ticker, coin_name: parsed.name };

  if (!stock) { console.log(`skipped ${m.id}: #${parsed.stock} is not a supported stock`); return; }
  if (await countSince({ x_user_id: m.authorId }) >= config.limits.perUserPerDay ||
      await countSince({}) >= config.limits.perDay) {
    await db.from('launches').insert({ ...base, stock_symbol: stock.symbol, status: 'rejected', error: 'daily limit' });
    console.log(`skipped ${m.id}: daily limit reached`);
    return;
  }

  const { data: row, error } = await db.from('launches')
    .insert({ ...base, stock_symbol: stock.symbol, status: 'launching' }).select('id').single();
  if (error) { console.error('insert failed', error); return; }

  try {
    const imageSource = m.imageUrl ?? m.authorAvatar;
    if (!imageSource) throw new Error('no image available');

    if (config.dryRun) {
      const check = await preflight(stock.address);
      console.log(`[DRY RUN] would launch $${parsed.ticker} "${parsed.name}" paired with ${stock.symbol} for @${m.authorHandle}`);
      console.log(check.problem ? `  but it would fail: ${check.problem}` : `  preflight ok, launch fee ${check.fee} wei`);
      await db.from('launches').update({ status: 'failed', error: 'dry run' }).eq('id', row.id);
      return;
    }

    const { imageUrl, logoUri } = await uploadCoinImage({ ticker: parsed.ticker, imageSourceUrl: imageSource });

    const { token, curve, hash } = await launchCoin({
      name: parsed.name,
      ticker: parsed.ticker,
      logoUri,
      description: `Launched by @${m.authorHandle} via ${config.brand}. Paired with ${stock.symbol} (${stock.name}). Creator fees go to holders.`,
      tweetUrl,
      pairToken: stock.address,
    });

    await db.from('launches').update({
      status: 'live', token_address: token, curve_address: curve, tx_hash: hash,
      image_url: imageUrl, logo_uri: logoUri, live_at: new Date().toISOString(),
    }).eq('id', row.id);

    console.log(`LIVE $${parsed.ticker} ${token}`);
    await reply(m.id, `$${parsed.ticker} is live, paired with ${stock.symbol}.\n${config.pons.coinUrl(token)}`);
  } catch (e: any) {
    console.error(`launch failed for ${m.id}:`, e.message);
    await db.from('launches').update({ status: 'failed', error: String(e.message).slice(0, 500) }).eq('id', row.id);
  }
}

async function tick() {
  const since = await getState('since_id');
  const { mentions, newestId } = await fetchMentions(since);
  for (const m of mentions) await handle(m);   // one at a time, on purpose
  if (newestId) await setState('since_id', newestId);
  if (mentions.length) console.log(`processed ${mentions.length} mentions`);
}

console.log(`${config.brand} bot started. dryRun=${config.dryRun} replies=${config.x.replyEnabled} poll=${config.pollSeconds}s`);
console.log(`launcher wallet ${launcher().account.address} on chain ${config.chain.id}`);
for (;;) {
  try { await tick(); } catch (e: any) { console.error('tick error:', e.message); }
  await new Promise(r => setTimeout(r, config.pollSeconds * 1000));
}
