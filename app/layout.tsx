import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import { Shell } from "@/components/layout/shell";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "CAPGAP — Know what your bag is really worth.",
    template: "%s | CAPGAP",
  },
  description:
    "Compare Solana market data, measure quoted exit liquidity, and capture timestamped evidence. No wallet required.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <Shell>{children}</Shell>
        </Providers>
      </body>
    </html>
  );
}
