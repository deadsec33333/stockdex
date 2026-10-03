-- Robinhood stock tokens on Robinhood Chain (chain id 4663).
-- Tickers are bare here (TSLA, not TSLAx) because that is the on-chain symbol.
-- These addresses come from Robinhood's own asset API. Run `npm run stocks:sync` after
-- this migration: it refreshes the list from the API and marks which ones Pons actually
-- accepts as a pair token, so nothing goes live against an address the bot cannot use.
insert into stocks (symbol, name, address) values
 ('AAPL','Apple','0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9'),
 ('TSLA','Tesla','0x322F0929c4625eD5bAd873c95208D54E1c003b2d'),
 ('NVDA','Nvidia','0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC'),
 ('MSFT','Microsoft','0xe93237C50D904957Cf27E7B1133b510C669c2e74'),
 ('AMZN','Amazon','0x12f190a9F9d7D37a250758b26824B97CE941bF54'),
 ('GOOGL','Alphabet','0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3'),
 ('META','Meta','0xc0D6457C16Cc70d6790Dd43521C899C87ce02f35'),
 ('NFLX','Netflix','0xE0444EF8BF4eD74f74FD73686e2ddF4C1c5591E8'),
 ('AMD','AMD','0x86923f96303D656E4aa86D9d42D1e57ad2023fdC'),
 ('PLTR','Palantir','0x894E1EC2D74FFE5AEF8Dc8A9e84686acCB964F2A'),
 ('MSTR','Strategy','0xec262a75e413fAfD0dF80480274532C79D42da09'),
 ('QCOM','Qualcomm','0x0f17206447090e464C277571124dD2688E48AEA9'),
 ('SPCX','SpaceX','0x4a0E65A3EcceC6dBe60AE065F2e7bb85Fae35eEa'),
 ('SPY','S&P 500 ETF','0x117cc2133c37B721F49dE2A7a74833232B3B4C0C'),
 ('QQQ','Nasdaq 100 ETF','0xD5f3879160bc7c32ebb4dC785F8a4F505888de68')
on conflict (symbol) do nothing;
