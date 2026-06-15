"use client";

import Link from "next/link";
import { LogOut } from "lucide-react";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const NAV = [
  { label: "Oggi", href: "/dashboard" },
  { label: "Profilo", href: "/profile" },
  { label: "Piano", href: "/plan" },
] as const;

export function AppHeader() {
  const pathname = usePathname();

  return (
    <header className="border-b border-border bg-base">
      <div className="app-container flex min-h-14 items-center justify-between gap-2">
        <Link
          href="/dashboard"
          className="flex min-h-10 items-center gap-2.5 rounded-[9px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-amber text-[15px] font-bold text-amber-on">
            C
          </span>
          <span className="hidden text-[15px] font-medium text-foreground sm:inline">
            Coach IA
          </span>
        </Link>

        <div className="flex items-center gap-1">
          <nav
            className="flex items-center gap-0.5 sm:gap-1"
            aria-label="Navigazione principale"
          >
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
                    "relative flex min-h-10 items-center px-2 text-[13px] transition-colors after:absolute after:inset-x-2 after:bottom-0 after:h-px after:origin-center after:scale-x-0 after:bg-amber after:transition-transform sm:px-3 sm:after:inset-x-3",
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

          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              title="Esci da Coach IA"
              className="inline-flex min-h-10 min-w-10 items-center justify-center gap-2 rounded-[9px] px-2 text-[13px] text-muted transition-colors hover:bg-surface-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber sm:px-3"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Esci</span>
              <span className="sr-only sm:hidden">Esci da Coach IA</span>
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
