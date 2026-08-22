import { type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { DISCLAIMER } from "@/lib/predict";
import { ShieldCheck, Menu, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Brand({ className = "" }: { className?: string }) {
  return (
    <Link to="/" className={`flex items-center gap-3 ${className}`}>
      <span className="flex size-10 items-center justify-center rounded-md border border-primary/30 bg-primary text-primary-foreground">
        <ShieldCheck className="size-5" aria-hidden="true" />
      </span>
      <span className="leading-tight">
        <span className="block font-display text-lg font-bold tracking-tight">FNDVS</span>
        <span className="block text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Fake News Verification
        </span>
      </span>
    </Link>
  );
}

const links = [
  { to: "/", label: "Home" },
  { to: "/submit", label: "Verify a claim" },
  { to: "/sources", label: "Official sources" },
  { to: "/history", label: "Records" },
  { to: "/dashboard", label: "Insights" },
  { to: "/dwm", label: "DWM Analytics" },
  { to: "/help", label: "Help" },
] as const;

export function TricolourRule() {
  return (
    <div className="flex h-1 w-full" aria-hidden="true">
      <span className="h-full flex-1 bg-[oklch(0.68_0.16_55)]" />
      <span className="h-full flex-1 bg-card" />
      <span className="h-full flex-1 bg-[oklch(0.55_0.13_155)]" />
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="bg-primary text-primary-foreground">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-1.5 text-[11px] font-medium tracking-wide">
          <span className="uppercase">
            Public interest demonstration portal · Media & information literacy
          </span>
          <span className="opacity-85">Independent academic project — not a government website</span>
        </div>
      </div>
      <TricolourRule />

      <header className="sticky top-0 z-40 border-b border-border bg-background/92 backdrop-blur">
        <div className="mx-auto flex h-[68px] w-full max-w-6xl items-center justify-between gap-3 px-4">
          <Brand />
          <nav className="hidden items-center gap-1 lg:flex">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent ${
                  pathname === l.to ? "bg-accent text-accent-foreground" : "text-muted-foreground"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Button size="sm" asChild className="hidden sm:inline-flex">
              <Link to="/submit">Verify now</Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild className="lg:hidden">
                <Button variant="outline" size="icon" aria-label="Open menu">
                  <Menu className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {links.map((l) => (
                  <DropdownMenuItem key={l.to} asChild>
                    <Link to={l.to}>{l.label}</Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border bg-card">
        <TricolourRule />
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 md:grid-cols-3">
          <div>
            <Brand />
            <p className="mt-4 max-w-sm text-sm text-muted-foreground">{DISCLAIMER}</p>
          </div>
          <div>
            <p className="eyebrow">Portal</p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {links.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="hover:text-foreground">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="eyebrow">Report misinformation</p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                <a
                  href="https://pib.gov.in/factcheck.aspx"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1.5 hover:text-foreground"
                >
                  PIB Fact Check <ExternalLink className="size-3" aria-hidden="true" />
                </a>
              </li>
              <li>
                <a
                  href="https://cybercrime.gov.in/"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1.5 hover:text-foreground"
                >
                  National Cyber Crime Portal <ExternalLink className="size-3" aria-hidden="true" />
                </a>
              </li>
              <li>
                <a
                  href="https://www.meity.gov.in/"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1.5 hover:text-foreground"
                >
                  MeitY advisories <ExternalLink className="size-3" aria-hidden="true" />
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border">
          <p className="mx-auto w-full max-w-6xl px-4 py-4 text-xs text-muted-foreground">
            FNDVS — academic demonstration. Classification is produced by a documented mock
            analysis engine, not a trained production model. English text only. No sign-in, no
            personal data collected; your records stay in this browser.
          </p>
        </div>
      </footer>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="text-3xl font-bold sm:text-4xl">{title}</h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
