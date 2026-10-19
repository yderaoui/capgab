import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export function money(
  value: string | null | undefined,
  compact = false,
): string {
  if (value == null) return "Unknown";
  const n = Number(value);
  if (!Number.isFinite(n)) return "Unknown";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: n > 0 && n < 0.01 ? 8 : 2,
    ...(compact ? { notation: "compact" as const } : {}),
  }).format(n);
}
export function shorten(s: string) {
  return s.length > 15 ? `${s.slice(0, 6)}…${s.slice(-5)}` : s;
}
