import { Suspense } from "react";
import { Scanner } from "@/components/scanner/scanner";
export const metadata = { title: "Token scanner" };
export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="page-container">
          <div className="skeleton" />
        </div>
      }
    >
      <Scanner />
    </Suspense>
  );
}
