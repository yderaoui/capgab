import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
    return response;
  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (entries) => {
          entries.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          entries.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );
  // Refresh sessions in a response-capable boundary; private handlers still verify getUser and RLS.
  await client.auth.getUser();
  return response;
}
export const config = {
  matcher: [
    "/dashboard",
    "/watchlist",
    "/alerts",
    "/settings",
    "/api/v1/watchlist/:path*",
    "/api/v1/alerts/:path*",
    "/api/v1/profile",
    "/api/v1/history",
    "/api/v1/events",
  ],
};
