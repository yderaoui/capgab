"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Activity,
  ArrowUpRight,
  ChartNoAxesCombined,
  ChevronRight,
  FileCheck2,
  FlaskConical,
  Gauge,
  GitCompareArrows,
  LayoutDashboard,
  Menu,
  ScanLine,
  Settings2,
  ShieldCheck,
  Star,
  Bell,
  X,
  BookOpen,
  ExternalLink,
} from "lucide-react";
const links = [
  { href: "/scan", label: "Token scanner", icon: ScanLine },
  { href: "/compare", label: "Compare sources", icon: GitCompareArrows },
  { href: "/receipts", label: "Evidence receipts", icon: FileCheck2 },
  {
    href: "/leaderboard",
    label: "Provider analytics",
    icon: ChartNoAxesCombined,
  },
];
const personal = [
  { href: "/dashboard", label: "My dashboard", icon: LayoutDashboard },
  { href: "/watchlist", label: "Watchlist", icon: Star },
  { href: "/alerts", label: "Alerts", icon: Bell },
];
export function Logo() {
  return (
    <Link className="logo" href="/" aria-label="CAPGAP home">
      <span className="brand-mark">
        <i />
        <i />
        <i />
      </span>
      CAPGAP<span className="beta">BETA</span>
    </Link>
  );
}
export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const current = [
    ...links,
    ...personal,
    { href: "/settings", label: "Account settings" },
  ].find((l) => path.startsWith(l.href));
  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? "is-open" : ""}`}>
        <Logo />
        <button
          className="mobile-close"
          onClick={() => setOpen(false)}
          aria-label="Close navigation"
        >
          <X />
        </button>
        <div className="workspace-label">MARKET INTELLIGENCE</div>
        <nav aria-label="Main navigation">
          <Link
            href="/"
            onClick={() => setOpen(false)}
            className={`nav-item ${path === "/" ? "active" : ""}`}
          >
            <Gauge size={18} />
            Overview{path === "/" && <span className="nav-active-dot" />}
          </Link>
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={`nav-item ${path.startsWith(href) ? "active" : ""}`}
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="workspace-label personal-label">YOUR WORKSPACE</div>
        <nav aria-label="Personal navigation">
          {personal.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={`nav-item ${path === href ? "active" : ""}`}
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="read-only">
            <ShieldCheck size={18} />
            <div>
              Intelligence. No permissions.
              <small>No wallet connection needed.</small>
            </div>
          </div>
          <Link className="nav-item" href="/methodology">
            <BookOpen size={17} />
            Methodology
            <ArrowUpRight size={14} />
          </Link>
          <Link className="nav-item" href="/settings">
            <Settings2 size={17} />
            Settings
          </Link>
          <div className="network">
            <span className="dot" />
            Solana mainnet<span>READ ONLY</span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="mobile-toggle"
              onClick={() => setOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>
              {current?.label ??
                (path === "/"
                  ? "Overview"
                  : path.startsWith("/token")
                    ? "Token analysis"
                    : "CAPGAP")}
            </strong>
          </div>
          <div className="topbar-right">
            <span className="read-only-label">
              <ShieldCheck size={13} /> No wallet required
            </span>
            <Link href="/scan?demo=poor" className="demo-top">
              <FlaskConical size={13} />
              Explore demo
              <ArrowUpRight size={13} />
            </Link>
            <Link
              href="/settings"
              className="account-icon"
              aria-label="Account settings"
            >
              CG
            </Link>
          </div>
        </header>
        <main>{children}</main>
        <footer className="footer">
          <Logo />
          <span>Independent data. Clearer decisions.</span>
          <div>
            <Link href="/about">About</Link>
            <Link href="/methodology">Methodology</Link>
            <Link href="/docs">
              Docs
              <ExternalLink size={10} />
            </Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </div>
          <small>Quoted exits are estimates. Not financial advice.</small>
        </footer>
      </div>
    </div>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && (
          <div className="eyebrow">
            <Activity size={13} />
            {eyebrow}
          </div>
        )}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
