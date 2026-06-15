"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/**
 * Header applicativo condiviso (design system §3).
 * Logo ambra "C" + "Coach IA" + nav (Oggi / Profilo / Piano), tab attivo
 * su bg-surface-2. Riusato identico da tutte le pagine autenticate.
 */
const NAV = [
  { label: "Oggi", href: "/dashboard" },
  { label: "Profilo", href: "/profile" },
  { label: "Piano", href: "/plan" },
] as const;

export function AppHeader() {
  const pathname = usePathname();

  return (
    <header className="border-b border-border bg-base">
      <div className="app-container flex min-h-16 items-center justify-between gap-4 py-2">
        <Link
          href="/dashboard"
          className="flex min-h-10 items-center gap-2.5 rounded-[9px] focus-visible:outline-none"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-amber text-[15px] font-bold text-amber-on">
            C
          </span>
          <span className="text-[15px] font-medium text-foreground">
            Coach IA
          </span>
        </Link>

        <nav className="flex items-center gap-1" aria-label="Navigazione principale">
          {NAV.map((item) => {
            const active =
              pathname === item.href ||
              pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-10 items-center rounded-[9px] px-3 text-sm transition-colors",
                  active
                    ? "bg-surface-2 text-foreground"
                    : "text-muted hover:bg-surface-2 hover:text-foreground"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
