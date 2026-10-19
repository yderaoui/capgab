import Link from "next/link";
export default function NotFound() {
  return (
    <div className="page-container empty-state">
      <h1>We couldn’t find that page.</h1>
      <p>Check the address or start a new token scan.</p>
      <Link className="btn btn-primary" href="/scan">
        Open scanner
      </Link>
    </div>
  );
}
