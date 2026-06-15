"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/**
 * Header applicativo condiviso (design system §3).
 * Logo ambra "C" + "Coach IA" + nav (Oggi / Profilo / Piano).
 * La pagina attiva usa un indicatore sottile per mantenere il chrome leggero.
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
      <div className="app-container flex min-h-14 items-center justify-between gap-3">
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
                  "relative flex min-h-10 items-center px-2.5 text-[13px] transition-colors after:absolute after:inset-x-2.5 after:bottom-0 after:h-px after:origin-center after:scale-x-0 after:bg-amber after:transition-transform sm:px-3 sm:after:inset-x-3",
                  active
                    ? "text-foreground after:scale-x-100"
                    : "text-muted hover:text-foreground"
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
