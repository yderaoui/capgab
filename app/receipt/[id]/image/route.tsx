import { ImageResponse } from "next/og";
import { readReceipt } from "@/lib/database";
import { money, shorten } from "@/lib/utils";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const r = await readReceipt(id);
  if (!r)
    return new Response(
      "Receipt unavailable. Demo receipts expire when the server restarts.",
      { status: 404 },
    );
  const a = r.content.analysis;
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "#080b10",
        color: "#f3f5f7",
        padding: 55,
        display: "flex",
        flexDirection: "column",
        fontFamily: "sans-serif",
        borderTop: "5px solid #b5ff39",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 25,
        }}
      >
        <span style={{ color: "#b5ff39", fontWeight: 800 }}>CAPGAP</span>
        <span style={{ color: "#8d98a8", fontSize: 17 }}>
          {r.content.mode === "demo"
            ? "DEMO / SIMULATED DATA"
            : "HISTORICAL EVIDENCE RECEIPT"}
        </span>
      </div>
      <div
        style={{
          display: "flex",
          marginTop: 40,
          fontSize: 43,
          fontWeight: 700,
        }}
      >
        ${a.token.symbol}
        <span
          style={{
            fontSize: 18,
            color: "#8d98a8",
            marginLeft: 25,
            marginTop: 18,
          }}
        >
          {shorten(a.token.mint)}
        </span>
      </div>
      <div style={{ display: "flex", marginTop: 40, gap: 80 }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 18, color: "#8d98a8" }}>
            Displayed position
          </span>
          <span style={{ fontSize: 49, marginTop: 12 }}>
            {money(a.values.displayedValue)}
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 18, color: "#8d98a8" }}>
            Quoted expected proceeds
          </span>
          <span style={{ fontSize: 49, marginTop: 12, color: "#b5ff39" }}>
            {money(a.values.exitValue)}
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 18, color: "#8d98a8" }}>The gap</span>
          <span style={{ fontSize: 49, marginTop: 12, color: "#ffba49" }}>
            {a.values.gapPercent == null
              ? "Unknown"
              : `${Number(a.values.gapPercent).toFixed(2)}%`}
          </span>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          marginTop: 40,
          borderTop: "1px solid #303a47",
          paddingTop: 25,
          fontSize: 16,
          color: "#8d98a8",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <span>
          {r.content.issuedAt} · DexScreener / GeckoTerminal /{" "}
          {a.quote.router ?? "Quote unavailable"}
        </span>
        <span>
          Historical estimate. Not guaranteed execution. Source prices are not
          cryptographically verified.
        </span>
        <span style={{ fontSize: 13 }}>
          {new URL(request.url).origin}/receipt/{id}
        </span>
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
      headers: {
        "Content-Disposition": `attachment; filename="capgap-${id}.png"`,
      },
    },
  );
}
