import { TokenAnalysis } from "@/components/token/analysis";
import { validMint } from "@/lib/solana";
import { notFound } from "next/navigation";
export const metadata = { title: "Token analysis" };
export default async function Page({
  params,
}: {
  params: Promise<{ mint: string }>;
}) {
  const { mint } = await params;
  if (!validMint(mint)) notFound();
  return (
    <div className="page-container">
      <TokenAnalysis mint={mint} />
    </div>
  );
}
