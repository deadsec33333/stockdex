# {Brand} backend: X post -> Pons coin paired with a stock token

What's here: the bot and database. Robinhood Chain (chain id 4663), Pons launchpad, gas in ETH.

## Accounts you need
1. **Supabase** (database). Free plan is fine, but it must be a *new* project: the tables differ from the Solana build.
2. **X developer account** for the bot's X account, pay per use (reading mentions and replying cost money per call).
3. **A wallet on Robinhood Chain** holding ETH. Its private key goes in `LAUNCHER_PRIVATE_KEY`; it pays each launch fee and is the coin creator. Any wallet can launch on Pons.
4. **Pinata** (free) for coin images.
5. A small server that runs 24/7 (Railway, Render or Fly.io, about 5 USD/month).

## Setup, step by step
1. Supabase: create a project, open SQL Editor, run `supabase/migrations/001_init.sql`, then `002_seed_stocks.sql`.
2. Fill in `env-values.txt` (or copy `.env.example` to `.env`). Leave `DRY_RUN=true` and `X_REPLY_ENABLED=false` for now.
3. Install: `npm install`. Test: `npm test`.
4. `npm run stocks:sync` — refreshes the stock list from Robinhood's asset API and records which tokens Pons accepts as a pair. Run it again whenever Pons opens up new ones.
5. Start the bot: `npm run bot`. Post `@YourBot $TEST #AAPL` from another account. You should see `[DRY RUN] would launch...` and either `preflight ok` or the exact reason it would fail.
6. When that works, set `X_REPLY_ENABLED=true` and check the bot replies.
7. Put some ETH in the launcher wallet, set `DRY_RUN=false`, post again. The coin should appear on ponsfamily.com and on your site.
8. Deploy the same folder to Railway/Render with the same settings, start command `npm run bot`.

## Paying holders (manual on purpose)
1. `npm run fees:claim` pulls creator fees out of the Pons escrow into the launcher wallet.
2. Move the ETH you want to distribute to your payout wallet (`PAYOUT_PRIVATE_KEY`).
3. `npm run fees:plan -- 0.5` plans how 0.5 ETH is split (nothing is sent). Check the `payouts` table.
4. `npm run fees:pay` sends it.

## Safety
The service role key and both private keys must never go into the frontend or GitHub. Daily limits are in the settings file. The bot reads `launchFee()` and `approvedPairTokens()` from the factory before every launch and simulates the call first, so a bad setup costs nothing — but check the contract addresses against docs.ponsfamily.com before the first live launch. Pons v2 is unaudited by its own documentation.
