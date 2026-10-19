import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/layout/shell";
const documents: Record<
  string,
  {
    title: string;
    description: string;
    sections: { heading: string; id?: string; body: React.ReactNode }[];
  }
> = {
  about: {
    title: "Your market cap isn’t your exit liquidity.",
    description:
      "CAPGAP is an independent lens on Solana market data and estimated trade execution.",
    sections: [
      {
        heading: "Know what your bag is really worth.",
        body: (
          <p>
            A price describes an observed market. It does not tell you how much
            liquidity is available for your whole position. CAPGAP compares
            provider snapshots and requests a USDC quote for the exact quantity
            you evaluate. It reports the difference with the inputs and
            limitations visible.
          </p>
        ),
      },
      {
        heading: "Built for the trenches. Powered by transparent data.",
        body: (
          <p>
            CAPGAP focuses on measurable market discrepancies. Diagnostic
            statuses follow documented rules; they do not predict future prices
            or label a token fraudulent. You can inspect a pool, switch
            references, and capture a historical evidence package.
          </p>
        ),
      },
      {
        heading: "$CAPGAP, the community brand.",
        body: (
          <p>
            The scanner is freely accessible. No token, staking, trade
            execution, or promised returns are implemented. Possible future
            community work includes public datasets, more integrations, cosmetic
            profiles, and transparent development proposals. The product is
            useful even if no token launches.
          </p>
        ),
      },
    ],
  },
  methodology: {
    title: "The numbers. With their assumptions.",
    description:
      "Methodology 1.0.0 · Transparent formulas, configurable thresholds, and explicit unknowns.",
    sections: [
      {
        heading: "Displayed value versus a quoted exit",
        body: (
          <>
            <p>
              Given quantity A, reference USD price P, quoted USDC Q, and
              USDC/USD conversion U:
            </p>
            <ul>
              <li>Displayed value = A × P</li>
              <li>Estimated exit value = Q × U</li>
              <li>Dollar gap = displayed value − estimated exit value</li>
              <li>Gap percentage = 100 × dollar gap ÷ displayed value</li>
            </ul>
            <p>
              Quantities and calculations use exact decimal strings and
              high-precision arithmetic. Atomic input conversion uses BigInt;
              positions specified in USD round down to mint precision. Missing
              inputs produce unknown results. A negative gap means the quote
              exceeds the reference displayed value.
            </p>
          </>
        ),
      },
      {
        heading: "Market terms have different meanings",
        body: (
          <ul>
            <li>
              Market price: a provider’s price for a token on a particular pool.
            </li>
            <li>
              Market cap: price multiplied by an estimate of circulating supply.
            </li>
            <li>
              FDV: price multiplied by an estimate of fully diluted supply.
            </li>
            <li>
              Pool liquidity: a pool’s reported reserves in USD; definitions can
              differ.
            </li>
            <li>
              Price impact: the provider-reported effect of the proposed trade
              size. It is distinct from our displayed-versus-quoted gap.
            </li>
            <li>
              Slippage tolerance: a parameter defining allowed price movement
              for a transaction, not a prediction.
            </li>
            <li>
              Quoted proceeds: expected output at collection time. Realized
              proceeds: what a completed sale actually delivers. CAPGAP does not
              observe realized proceeds.
            </li>
          </ul>
        ),
      },
      {
        heading: "Pool and observation matching",
        body: (
          <p>
            Direct percentage comparisons require identical pool address, token
            and counterpart mints, normalized USD units, and source observations
            within 30 seconds. Pool creation time is not observation time. When
            either source lacks observation timestamps, we display the snapshots
            side by side and mark them NOT DIRECTLY COMPARABLE. Market cap, FDV,
            reserve definitions, and volume windows need additional semantic
            alignment and are not given automatic discrepancy percentages.
          </p>
        ),
      },
      {
        heading: "Diagnostic rules",
        body: (
          <ul>
            <li>
              HIGH DISCREPANCY: exit gap at least 15%, or directly comparable
              provider deviation at least 10%.
            </li>
            <li>
              WATCH: exit gap at least 5%, comparable provider deviation at
              least 2%, or inadequate comparison evidence.
            </li>
            <li>
              DATA STALE: quote collection older than 15 seconds or reference
              retrieval/observation older than 120 seconds. Retrieval age cannot
              establish source freshness.
            </li>
            <li>
              QUOTE UNAVAILABLE: no valid quote for the actual amount into
              official Solana USDC.
            </li>
            <li>
              INSUFFICIENT DATA: required positive price, quantity, or output is
              unavailable.
            </li>
            <li>
              NORMAL: valid inputs stay below those thresholds. It does not mean
              an asset is safe.
            </li>
          </ul>
        ),
      },
      {
        heading: "Fees and USDC conversion",
        body: (
          <p>
            USDC is a separate asset. We use a recent available USD observation,
            otherwise disclose a $1 approximation. Jupiter fee rates and network
            cost fields are displayed when supplied. Missing fees remain
            unknown. We do not independently model Token-2022 transfer fees,
            hooks, or other unusual execution behavior, and do not claim quoted
            proceeds are fully net of costs. A quote minimum-output field is a
            transaction parameter, never a guarantee.
          </p>
        ),
      },
      {
        heading: "Data sources",
        id: "sources",
        body: (
          <>
            <p>
              Independent server adapters retrieve{" "}
              <a
                href="https://docs.dexscreener.com/api/reference"
                target="_blank"
                rel="noreferrer"
              >
                DexScreener
              </a>
              ,{" "}
              <a
                href="https://api.geckoterminal.com/docs/index.html"
                target="_blank"
                rel="noreferrer"
              >
                GeckoTerminal
              </a>
              , and{" "}
              <a
                href="https://developers.jup.ag/docs/api-reference/swap/order"
                target="_blank"
                rel="noreferrer"
              >
                Jupiter Swap V2 /order
              </a>
              . Jupiter receives no taker; the app discards transaction fields
              and never executes trades.
            </p>
            <p>
              Market requests are cached for 30 seconds with original retrieval
              time preserved; quotes for up to 5 seconds. CAPGAP’s 15-second
              quote-age limit is a display policy, not a claim of transaction
              validity. Mint validation via configured Solana RPC supports SPL
              Token and Token-2022 owner and decimal checks. Provider errors are
              not replaced by demo data.
            </p>
          </>
        ),
      },
      {
        heading: "Evidence and signatures",
        body: (
          <p>
            Receipt content uses recursively sorted JSON object keys, preserved
            array order, and decimal strings. SHA-256 hashes the canonical UTF-8
            JSON. Ed25519 signs those digest bytes. The public key registry
            establishes the server’s signing identity; uploaded self-contained
            keys need independent trust. A signature detects altered content. It
            does not establish truthfulness of third-party quotes. Live receipts
            are append-only and demo previews are isolated.
          </p>
        ),
      },
      {
        heading: "Historical reliability and alerts",
        body: (
          <p>
            Analytics uses stored live retrievals only, with sample sizes and
            collection dates. Same-pool agreement has no independent truth
            benchmark. Selection bias, caching, missing observations and
            incomplete coverage remain material. Live monitoring uses leased
            jobs and a target interval of 15 minutes, with bounded provider
            concurrency, retries, deduplication, and a minimum 15-minute
            cooldown. Backlogs can increase intervals. No local demo rules run
            in the background.
          </p>
        ),
      },
    ],
  },
  privacy: {
    title: "Privacy, in plain language.",
    description:
      "CAPGAP processes only the data needed for market analysis and your workspace.",
    sections: [
      {
        heading: "Data we process",
        body: (
          <p>
            Anonymous scans send public token mint addresses, position
            quantities, and selected pools to CAPGAP. Server adapters query
            market providers; your email and IP address are not sent to them.
            Request infrastructure may process IP addresses for abuse
            prevention. Account email is processed by Supabase Auth. Optional
            alerts may deliver email through Resend.
          </p>
        ),
      },
      {
        heading: "Storage and public evidence",
        body: (
          <p>
            Watchlists, scan history, alert rules, and notifications are private
            under Row Level Security. Public live receipts include evaluated
            position sizes and immutable historical snapshots: generate them
            only when you intend to share those details. Demo workspace data is
            stored in your browser and can be removed by clearing site storage.
            Demo server receipt previews are ephemeral.
          </p>
        ),
      },
      {
        heading: "Retention and control",
        body: (
          <p>
            Raw scans and provider observations have a 90-day retention job;
            monitoring logs and events have shorter retention. Public evidence
            receipts are retained as append-only records. You can remove
            watchlist items and alerts in the app, sign out, and clear browser
            data. The deployment operator must provide a verified support
            contact and account-deletion process before accepting public
            accounts. No advertising trackers are included.
          </p>
        ),
      },
    ],
  },
  terms: {
    title: "Terms of use.",
    description: "Read these limits before relying on a market estimate.",
    sections: [
      {
        heading: "Research information",
        body: (
          <p>
            CAPGAP supplies market-data comparisons and estimates for research.
            It is not investment advice, a trading service, or a guarantee of
            liquidity or transaction success. Third-party APIs can fail, lag,
            disagree, or return inaccurate information. Quotes can change
            immediately.
          </p>
        ),
      },
      {
        heading: "User responsibility",
        body: (
          <p>
            You are responsible for evaluating the data, timestamps, source
            coverage, fees, market conditions, and the suitability of any
            independent financial decision. Do not treat a diagnostic label or
            signed receipt as proof of asset safety or future performance.
          </p>
        ),
      },
      {
        heading: "Acceptable use",
        body: (
          <p>
            Do not abuse provider quotas, bypass access controls, attempt to
            alter issued evidence, or upload secrets. The service is an initial
            testing implementation. A deployment operator must finalize
            jurisdiction-specific service terms, operator identity, and contact
            details before broad public launch.
          </p>
        ),
      },
    ],
  },
  docs: {
    title: "From address to evidence.",
    description:
      "A practical guide to the CAPGAP workspace. API and deployment documentation are included in the repository.",
    sections: [
      {
        heading: "1. Scan a token",
        body: (
          <p>
            Open the <Link href="/scan">scanner</Link>, paste a valid Solana
            mint, and wait for providers. A valid address alone does not prove
            an account is a token mint; metadata and optional RPC checks add
            evidence. No pools is reported as missing data rather than a
            zero-valued token.
          </p>
        ),
      },
      {
        heading: "2. Test your position",
        body: (
          <p>
            Enter USD value or token quantity, choose a reference pool, and
            calculate. Each size requests a fresh quote for the actual atomic
            amount. Source availability, quote age, fee fields, and limitations
            appear beside the results. “Quote 5 sizes” builds sensitivity from
            separate requests.
          </p>
        ),
      },
      {
        heading: "3. Inspect the comparison",
        body: (
          <p>
            The comparison table shows both sources, including missing values.
            Source observation time and retrieval time are distinct. Do not
            interpret unmatched markets as provider errors.
          </p>
        ),
      },
      {
        heading: "4. Capture and verify",
        body: (
          <p>
            Generate a receipt to recollect and sign inputs on the server.
            Download JSON and the 1200 × 630 evidence image, inspect the hash,
            and verify. Upload a modified JSON file to test tamper detection.
            Live issuance needs email sign-in, Supabase persistence, and a
            server signing key. Demo previews expire and are not public live
            evidence.
          </p>
        ),
      },
      {
        heading: "5. Monitor",
        body: (
          <p>
            Sign in at <Link href="/settings">settings</Link>, save tokens to{" "}
            <Link href="/watchlist">your watchlist</Link>, and configure{" "}
            <Link href="/alerts">alert rules</Link>. Scheduled monitoring and
            email require operator configuration. The dashboard shows actual
            collected history and notifications; charts are withheld when
            evidence is insufficient.
          </p>
        ),
      },
    ],
  },
};
export async function generateStaticParams() {
  return Object.keys(documents).map((info) => ({ info }));
}
export default async function Page({
  params,
}: {
  params: Promise<{ info: string }>;
}) {
  const doc = documents[(await params).info];
  if (!doc) notFound();
  return (
    <div className="page-container document">
      <PageHeading
        eyebrow="CAPGAP"
        title={doc.title}
        description={doc.description}
      />
      {doc.sections.map((s) => (
        <section key={s.heading} id={s.id}>
          <h2>{s.heading}</h2>
          {s.body}
        </section>
      ))}
    </div>
  );
}
