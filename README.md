# stockdex — Pons version

Same product as the Solana build, launching on **Pons** (the launchpad on Robinhood Chain)
instead of pump.fun. The Solana version lives in `Desktop/stockcoin-app` and is untouched.

What changed under the hood:

| | Solana version | this one |
|---|---|---|
| Launchpad | pump.fun via PumpPortal's API | Pons, contract call signed here |
| Chain | Solana | Robinhood Chain (id 4663), gas in ETH |
| Pairing asset | xStocks (AAPLx, TSLAx) | Robinhood stock tokens (plain AAPL, TSLA) |
| Coin page | pump.fun/coin/… | ponsfamily.com/launchpad/0x… |
| Explorer | Solscan | robinhoodchain.blockscout.com |
| Payouts | SOL | ETH |

## Putting the site online

Push this folder to its own GitHub repo, import that repo on Vercel, press Deploy. Nothing
else: no environment variables, no settings. The brand name, bot handle, Supabase URL and
public key are all built in, and the database tables already exist.

The site shares one Supabase project with the Solana build. Its tables carry a `pons_`
prefix (`pons_launches`, `pons_public_launches`, and so on), so the two never see each
other's data. To move it to its own project later, run the two files in
`bot/supabase/migrations/` there and set `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_URL` for the bot.

## Before it can launch anything

1. **A wallet on Robinhood Chain** with some ETH. Put its private key in
   `bot/env-values.txt` as `LAUNCHER_PRIVATE_KEY`. It pays the launch fee and is recorded
   as the creator of every coin.
2. **A sanity check before each launch.** The bot reads the launch fee, the wallet balance
   and the pair-token approval off the factory and simulates the call, so a bad setup
   costs nothing and tells you why in plain words.
3. **The Supabase service role key** in `bot/env-values.txt`. Same project as the Solana
   build, already filled in.
4. Only one bot running at a time, since both use the @stockdexapp account.

## Running it

```
cd bot
npm install
npm run stocks:sync     # pulls the live stock tokens and marks which ones Pons accepts
npm run bot             # DRY_RUN=true until you change it in env-values.txt
```

The website is the top level, same as before: `npm install && npm run dev`, and Vercel
picks it up with no configuration.

## Hand-run scripts

```
npm run fees:claim          # pull creator fees out of the Pons escrow
npm run fees:plan -- 0.5    # plan an 0.5 ETH split across holders (writes rows, sends nothing)
npm run fees:pay            # send the planned payouts
```

## Worth knowing

- Pons v2 is **unaudited** by its own documentation, and the launch fee is read from the
  contract at launch time rather than hardcoded.
- Only stock tokens Pons has approved can be used as a pair; `npm run stocks:sync` records
  which ones those are, and the bot refuses the rest instead of failing mid-launch.
- Contract addresses in `env-values.txt` come from docs.ponsfamily.com. Check them there
  before the first live launch.
# stockdexas
