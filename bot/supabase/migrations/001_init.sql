-- Core tables for the X-post-to-coin launcher (Pons on Robinhood Chain).
-- Already applied. Tables carry a pons_ prefix so this build can share one Supabase
-- project with the Solana build; change TABLE_PREFIX if you give it its own project.

create table if not exists pons_stocks (
  symbol    text primary key,          -- e.g. AAPL (what users type after #)
  name      text not null,
  address   text not null,             -- Robinhood stock token contract on Robinhood Chain
  enabled   boolean not null default true,
  pons_approved boolean not null default true,   -- refreshed by: npm run pons_stocks:sync
  checked_at timestamptz
);

create table if not exists pons_creators (
  x_user_id     text primary key,
  x_handle      text not null,
  avatar_url    text,
  first_seen_at timestamptz not null default now()
);

do $$ begin
  create type launch_status as enum ('queued','launching','live','failed','rejected');
exception when duplicate_object then null; end $$;

create table if not exists pons_launches (
  id            bigint generated always as identity primary key,
  tweet_id      text unique not null,       -- dedupe: one launch per post
  x_user_id     text not null references pons_creators(x_user_id),
  ticker        text not null,              -- coin ticker, e.g. MOON
  coin_name     text not null,
  stock_symbol  text not null references pons_stocks(symbol),
  image_url     text,
  logo_uri      text,                       -- ipfs:// URI stored on chain
  token_address text unique,                -- the launched coin, once live
  curve_address text,                       -- its Pons bonding curve
  tx_hash       text,
  status        launch_status not null default 'queued',
  error         text,
  created_at    timestamptz not null default now(),
  live_at       timestamptz
);
create index if not exists launches_live_idx on pons_launches (status, live_at desc);
create index if not exists launches_stock_idx on pons_launches (stock_symbol);

-- Creator fee claims and holder pons_payouts
create table if not exists pons_fee_claims (
  id          bigint generated always as identity primary key,
  tx_hash     text,
  claimed_eth numeric not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists pons_payouts (
  id         bigint generated always as identity primary key,
  launch_id  bigint not null references pons_launches(id),
  holder     text not null,
  amount_eth numeric not null,
  tx_hash    text,
  status     text not null default 'planned',   -- planned | sent | failed
  created_at timestamptz not null default now()
);

-- Bot cursor so we never read the same mention twice
create table if not exists pons_bot_state (
  key   text primary key,
  value text not null
);

-- ===== Public views for the frontend =====
create or replace view pons_public_launches as
  select l.id, l.ticker, l.coin_name, l.image_url, l.token_address, l.tx_hash, l.live_at,
         l.tweet_id, c.x_handle, c.avatar_url,
         s.symbol as stock_symbol, s.name as stock_name, s.address as stock_address
  from pons_launches l
  join pons_creators c using (x_user_id)
  join pons_stocks s on s.symbol = l.stock_symbol
  where l.status = 'live';

create or replace view pons_public_stats as
  select
    (select count(*) from pons_launches where status = 'live')                        as tokens_launched,
    (select count(distinct x_user_id) from pons_launches where status = 'live')       as pons_creators,
    (select count(distinct stock_symbol) from pons_launches where status = 'live')    as pairs_used,
    (select coalesce(sum(amount_eth),0) from pons_payouts where status = 'sent')      as eth_paid_to_holders;

create or replace view pons_public_pair_stats as
  select s.symbol, s.name, s.address, count(l.id) as pons_launches
  from pons_stocks s left join pons_launches l on l.stock_symbol = s.symbol and l.status = 'live'
  where s.enabled and s.pons_approved
  group by s.symbol, s.name, s.address
  order by pons_launches desc;

-- ===== Row level security: frontend (anon key) can only read the views =====
alter table pons_stocks     enable row level security;
alter table pons_creators   enable row level security;
alter table pons_launches   enable row level security;
alter table pons_fee_claims enable row level security;
alter table pons_payouts    enable row level security;
alter table pons_bot_state  enable row level security;

create policy "public read pons stocks" on pons_stocks for select to anon using (enabled);
create policy "public read pons creators" on pons_creators for select to anon using (true);
create policy "public read live pons launches" on pons_launches for select to anon using (status = 'live');
create policy "public read sent pons payouts" on pons_payouts for select to anon using (status = 'sent');
-- no policies on pons_fee_claims / pons_bot_state = invisible to the public
