"use client";
import { createBrowserClient } from "@supabase/ssr";
import { useQuery } from "@tanstack/react-query";
export const authConfigured = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
export function browserAuth() {
  if (!authConfigured) throw new Error("Supabase is not configured.");
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
export function useAccount() {
  return useQuery({
    queryKey: ["account"],
    queryFn: async () => {
      if (!authConfigured) return null;
      const { data, error } = await browserAuth().auth.getUser();
      if (error) return null;
      return data.user;
    },
    staleTime: 30000,
  });
}
