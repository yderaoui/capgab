import { address } from "@solana/addresses";
import { z } from "zod";
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const SOL_MINT = "So11111111111111111111111111111111111111112";
export function validMint(value: string): boolean {
  try {
    return address(value) === value;
  } catch {
    return false;
  }
}
export const mintSchema = z
  .string()
  .trim()
  .refine(
    validMint,
    "Enter a valid Solana mint address (32-byte base58 public key).",
  );
export function toAtomic(amount: string, decimals: number): string {
  if (
    !Number.isInteger(decimals) ||
    decimals < 0 ||
    decimals > 255 ||
    !/^\d+(\.\d+)?$/.test(amount)
  )
    throw new Error("Invalid token amount or decimals.");
  const [whole, fraction = ""] = amount.split(".");
  if (fraction.length > decimals && /[1-9]/.test(fraction.slice(decimals)))
    throw new Error(`Amount exceeds ${decimals} token decimals.`);
  return (
    BigInt(whole) * 10n ** BigInt(decimals) +
    BigInt(fraction.slice(0, decimals).padEnd(decimals, "0") || "0")
  ).toString();
}
export function fromAtomic(amount: string, decimals: number): string {
  if (
    !/^\d+$/.test(amount) ||
    !Number.isInteger(decimals) ||
    decimals < 0 ||
    decimals > 255
  )
    throw new Error("Invalid atomic amount.");
  if (!decimals) return BigInt(amount).toString();
  const s = BigInt(amount)
    .toString()
    .padStart(decimals + 1, "0");
  return (
    `${s.slice(0, -decimals)}.${s.slice(-decimals)}`.replace(/\.?0+$/, "") ||
    "0"
  );
}
