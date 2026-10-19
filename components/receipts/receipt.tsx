"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, FileCheck2, FlaskConical, ShieldCheck } from "lucide-react";
import type { Receipt } from "@/lib/models";
import { useStore } from "@/lib/store";
import { money, shorten } from "@/lib/utils";
import { apiFetch, ComparisonTable, CopyButton } from "../token/analysis";
import { PageHeading } from "../layout/shell";
import { Button } from "../ui/button";
function downloadFile(text: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const el = document.createElement("a");
  el.href = url;
  el.download = name;
  el.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function verifyLocal(r: Receipt) {
  const { canonicalize } = await import("@/lib/canonical");
  const hash = Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(canonicalize(r.content)),
      ),
    ),
  )
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const der = Uint8Array.from(
    atob(r.publicKey.replace(/-----[^-]+-----/g, "").replace(/\s/g, "")),
    (c) => c.charCodeAt(0),
  );
  const key = await crypto.subtle.importKey(
    "spki",
    der,
    { name: "Ed25519" },
    false,
    ["verify"],
  );
  const signature = Uint8Array.from(atob(r.signature), (c) => c.charCodeAt(0));
  const hashBytes = Uint8Array.from(r.hash.match(/.{2}/g) ?? [], (s) =>
    parseInt(s, 16),
  );
  const signatureValid = await crypto.subtle.verify(
    "Ed25519",
    key,
    signature,
    hashBytes,
  );
  return hash === r.hash && signatureValid;
}
export function ReceiptView({ id }: { id: string }) {
  const local = useStore((s) => s.receipts.find((r) => r.content.id === id));
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 0);
    return () => clearTimeout(t);
  }, []);
  const query = useQuery({
    queryKey: ["receipt", id],
    queryFn: () => apiFetch<Receipt>(`/api/v1/receipts/${id}`),
    retry: false,
  });
  const r = ready && local ? local : query.data;
  const [verification, setVerification] = useState("Not yet checked");
  async function check() {
    if (!r) return;
    try {
      const valid = await verifyLocal(r);
      if (!valid) {
        setVerification("INVALID — content or signature has been altered.");
        return;
      }
      if (r.content.mode === "demo") {
        setVerification(
          "Signature valid · demo key is self-contained and not a trusted production identity.",
        );
        return;
      }
      const registry = await apiFetch<{ public_key: string }>(
        `/api/v1/keys/${r.keyId}`,
      );
      setVerification(
        registry.public_key === r.publicKey
          ? "VALID — content intact; public key matches the server registry."
          : "UNTRUSTED — signature valid, but key does not match the registry.",
      );
    } catch {
      setVerification(
        "Verification unavailable in this browser or signing-key registry is unreachable.",
      );
    }
  }
  if (!r)
    return (
      <div className="page-container">
        <PageHeading
          title="Evidence receipt"
          description="A historical market snapshot with independently verifiable content integrity."
        />
        {query.isLoading ? (
          <div className="skeleton" />
        ) : (
          <div className="notice">
            {query.error?.message ?? "Receipt not found."}
          </div>
        )}
      </div>
    );
  const a = r.content.analysis;
  return (
    <div className="page-container">
      <PageHeading
        eyebrow="PROOF OF MARKET REALITY"
        title="A snapshot. With the evidence."
        description={`Receipt ${r.content.id} · Captured ${new Date(r.content.issuedAt).toLocaleString()}`}
      />
      {r.content.mode === "demo" && (
        <div className="notice demo-notice">
          <FlaskConical size={16} />
          DEMO / SIMULATED DATA · Browser-local preview with an ephemeral
          signing key. Links may not survive a server restart or work in another
          browser.
        </div>
      )}
      <div className="notice">
        <ShieldCheck size={16} />
        Historical estimate. A signature establishes content integrity and
        signing identity; it does not prove that provider prices were true or
        that the quote could execute.
      </div>
      <div className="metric-grid">
        <div className="metric-card">
          <span>${a.token.symbol} · DISPLAYED VALUE</span>
          <strong>{money(a.values.displayedValue)}</strong>
          <small>{shorten(a.token.mint)}</small>
        </div>
        <div className="metric-card highlight">
          <span>QUOTED EXPECTED PROCEEDS</span>
          <strong className="lime">{money(a.values.exitValue)}</strong>
          <small>{a.values.quotedUsdc ?? "Unknown"} USDC · historical</small>
        </div>
        <div className="metric-card">
          <span>GAP AT CAPTURE</span>
          <strong className="amber">
            {a.values.gapPercent == null
              ? "Unknown"
              : `${Number(a.values.gapPercent).toFixed(2)}%`}
          </strong>
          <small>{money(a.values.dollarGap)} difference</small>
        </div>
      </div>
      <div className="receipt-actions">
        <CopyButton
          value={typeof window === "undefined" ? "" : window.location.href}
          label="Copy link"
        />
        <Button
          variant="outline"
          onClick={() =>
            downloadFile(
              JSON.stringify(r, null, 2),
              `capgap-${id}.json`,
              "application/json",
            )
          }
        >
          <Download size={14} />
          Download JSON
        </Button>
        <Button variant="outline" asChild>
          <a href={`/receipt/${id}/image`} download={`capgap-${id}.png`}>
            <Download size={14} />
            Download image
          </a>
        </Button>
        <Button onClick={check}>
          <ShieldCheck size={14} />
          Verify receipt
        </Button>
      </div>
      <div className="panel">
        <div className="panel-heading">
          <h2>Receipt integrity</h2>
          <span className="badge neutral">Ed25519 / SHA-256</span>
        </div>
        <div className="panel-body">
          <p
            role="status"
            className={
              verification.includes("INVALID") ||
              verification.includes("UNTRUSTED")
                ? "error-text"
                : verification.includes("valid") ||
                    verification.includes("VALID")
                  ? "success-text"
                  : "small-note"
            }
          >
            {verification}
          </p>
          <label className="form-label">Canonical content hash</label>
          <div className="receipt-hash">{r.hash}</div>
          <dl className="details-list">
            <div>
              <dt>Key ID</dt>
              <dd>{r.keyId}</dd>
            </div>
            <div>
              <dt>Methodology version</dt>
              <dd>{r.content.methodology}</dd>
            </div>
            <div>
              <dt>Signing algorithm</dt>
              <dd>Ed25519 over SHA-256 digest bytes</dd>
            </div>
            <div>
              <dt>Input amount</dt>
              <dd>
                {a.values.quantity} {a.token.symbol}
              </dd>
            </div>
            <div>
              <dt>Raw input atomic units</dt>
              <dd>{a.quote.inAmount}</dd>
            </div>
            <div>
              <dt>Raw output atomic USDC</dt>
              <dd>{a.quote.outAmount ?? "Unknown"}</dd>
            </div>
            <div>
              <dt>Quote collected at</dt>
              <dd>{a.quote.collectedAt}</dd>
            </div>
          </dl>
          <details style={{ marginTop: 20 }}>
            <summary className="inline-link">
              Inspect full evidence package
            </summary>
            <pre className="json-view">{JSON.stringify(r, null, 2)}</pre>
          </details>
          <label
            className="form-label"
            htmlFor="verify-upload"
            style={{ marginTop: 20 }}
          >
            Verify a downloaded receipt JSON (detects tampering locally)
          </label>
          <input
            id="verify-upload"
            type="file"
            accept="application/json,.json"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 1000000) {
                setVerification("File exceeds 1 MB.");
                return;
              }
              try {
                const uploaded = JSON.parse(await file.text()) as Receipt;
                setVerification(
                  (await verifyLocal(uploaded))
                    ? "Uploaded file: signature and hash valid. Verify the key independently before trusting identity."
                    : "Uploaded file: INVALID — tampering detected.",
                );
              } catch {
                setVerification(
                  "Uploaded file: INVALID receipt JSON or signature.",
                );
              }
            }}
          />
        </div>
      </div>
      <div className="section-spacer">
        <ComparisonTable analysis={a} />
      </div>
      <div className="panel section-spacer">
        <div className="panel-body">
          {a.limitations.map((l) => (
            <p key={l} className="small-note">
              {l}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
export function ReceiptExplorer() {
  const local = useStore((s) => s.receipts);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 0);
    return () => clearTimeout(t);
  }, []);
  const query = useQuery({
    queryKey: ["receipts"],
    queryFn: () =>
      apiFetch<{ id: string; receipt: Receipt }[]>("/api/v1/receipts"),
  });
  return (
    <div className="page-container">
      <PageHeading
        eyebrow="EVERY CLAIM NEEDS EVIDENCE"
        title="The receipt is the record."
        description="Inspect captured inputs, historical sell quotes, and signed calculations. Live receipts are immutable public records."
        action={
          <Button asChild>
            <Link href="/scan?demo=poor">Create a demo receipt</Link>
          </Button>
        }
      />
      <div className="panel">
        <div className="panel-heading">
          <h2>Public live evidence</h2>
          <span className="badge neutral">ACTUAL STORED RECEIPTS</span>
        </div>
        {query.error ? (
          <p className="error-text panel-body">{query.error.message}</p>
        ) : query.data?.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>TOKEN</th>
                  <th>CAPTURED</th>
                  <th>DISPLAYED</th>
                  <th>QUOTED EXIT</th>
                  <th>RECEIPT</th>
                </tr>
              </thead>
              <tbody>
                {query.data.map(({ id, receipt: r }) => (
                  <tr key={id}>
                    <td>${r.content.analysis.token.symbol}</td>
                    <td>{new Date(r.content.issuedAt).toLocaleString()}</td>
                    <td>{money(r.content.analysis.values.displayedValue)}</td>
                    <td>{money(r.content.analysis.values.exitValue)}</td>
                    <td>
                      <Link href={`/receipt/${id}`}>Inspect receipt ↗</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <FileCheck2 size={36} />
            <h2>No live receipts yet.</h2>
            <p>
              Live issuance requires Supabase, email sign-in, and a persistent
              server signing key. Try a clearly labeled demo preview to explore
              verification.
            </p>
            <Button asChild variant="outline">
              <Link href="/scan?demo=poor">Explore the demo</Link>
            </Button>
          </div>
        )}
      </div>
      {ready && local.length > 0 && (
        <div className="panel section-spacer">
          <div className="panel-heading">
            <h2>Your browser-local demo previews</h2>
            <span className="badge demo">DEMO</span>
          </div>
          {local
            .filter((r) => r.content.mode === "demo")
            .map((r) => (
              <Link
                className="alert-item"
                href={`/receipt/${r.content.id}`}
                key={r.content.id}
              >
                <div>
                  <strong>${r.content.analysis.token.symbol}</strong>
                  <p>
                    {new Date(r.content.issuedAt).toLocaleString()} · simulated
                    historical estimate
                  </p>
                </div>
                <span className="inline-link">Inspect ↗</span>
              </Link>
            ))}
        </div>
      )}
    </div>
  );
}
