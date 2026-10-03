import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { getCoin } from '@/lib/data';
import { CoinImage, CopyButton, EmptyState } from '@/components/ui';
import { date } from '@/lib/format';
export const dynamic = 'force-dynamic'; export const metadata = { title: 'Coin details' };
const explorer = 'https://robinhoodchain.blockscout.com';
export default async function Coin({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params; const result = await getCoin(address);
  if (result.state !== 'ready') return <section className="container page-section"><EmptyState state={result.state} /></section>;
  const coin = result.data; if (!coin) notFound();
  const links = [['View on Pons', `https://www.ponsfamily.com/launchpad/${encodeURIComponent(coin.token_address)}`], ['Token explorer', `${explorer}/token/${encodeURIComponent(coin.token_address)}`], ...(coin.tx_hash ? [['Launch transaction', `${explorer}/tx/${encodeURIComponent(coin.tx_hash)}`]] : []), ['Original post', `https://x.com/${encodeURIComponent(coin.x_handle)}/status/${encodeURIComponent(coin.tweet_id)}`]];
  return <section className="container page-section"><Link className="text-link back-link" href="/explore"><ArrowLeft size={16} />Back to Explore</Link><div className="coin-detail"><CoinImage url={coin.image_url} ticker={coin.ticker} large /><div className="coin-info"><span className="eyebrow">A COMMUNITY-CREATED COIN</span><h1>{coin.coin_name}</h1><p className="coin-ticker">${coin.ticker}</p><dl><div><dt>Created by</dt><dd><a href={`https://x.com/${encodeURIComponent(coin.x_handle)}`} target="_blank" rel="noopener noreferrer">@{coin.x_handle}<ArrowUpRight size={14} /></a></dd></div><div><dt>Launched</dt><dd><time dateTime={coin.live_at}>{date(coin.live_at)} · {new Date(coin.live_at).toISOString().slice(11, 16)} UTC</time></dd></div><div><dt>Stock pairing</dt><dd><a href={`${explorer}/token/${encodeURIComponent(coin.stock_address)}`} target="_blank" rel="noopener noreferrer"><span className="pair-badge">{coin.stock_symbol}</span><ArrowUpRight size={14} /></a></dd></div></dl><div className="mint-box"><span className="eyebrow">TOKEN ADDRESS</span><code>{coin.token_address}</code><CopyButton text={coin.token_address} label="Copy address" /></div><div className="coin-links">{links.map(([label, href], i) => <a className={i === 0 ? 'button primary' : 'button secondary'} href={href} key={label} target="_blank" rel="noopener noreferrer">{label}<ArrowUpRight size={16} /></a>)}</div></div></div><div className="notice"><strong>Explore with care.</strong><p>This listing is not an endorsement. Pairing does not establish stock backing or redemption rights. Memecoins can lose all their value. <Link href="/docs#risks">Read the full disclaimer.</Link></p></div></section>;
}
