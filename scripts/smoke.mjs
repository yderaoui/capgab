const mint = "So11111111111111111111111111111111111111112";
const endpoints = [
  ["DexScreener", `https://api.dexscreener.com/token-pairs/v1/solana/${mint}`],
  [
    "GeckoTerminal",
    `https://api.geckoterminal.com/api/v2/networks/solana/tokens/${mint}/pools?include=base_token,quote_token,dex`,
  ],
  [
    "Jupiter",
    `https://api.jup.ag/swap/v2/order?inputMint=${mint}&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=100000000`,
  ],
];
let failed = false;
for (const [name, url] of endpoints) {
  try {
    const r = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers:
        name === "Jupiter" && process.env.JUPITER_API_KEY
          ? { "x-api-key": process.env.JUPITER_API_KEY }
          : {},
    });
    const data = await r.json();
    console.log(
      name,
      JSON.stringify({
        http: r.status,
        records: Array.isArray(data)
          ? data.length
          : (data.data?.length ?? null),
        inAmount: data.inAmount ?? null,
        outAmount: data.outAmount ?? null,
        router: data.router ?? null,
        transactionPresent: !!data.transaction,
      }),
    );
    if (!r.ok) failed = true;
  } catch (e) {
    console.log(name, e.message);
    failed = true;
  }
}
process.exitCode = failed ? 1 : 0;
