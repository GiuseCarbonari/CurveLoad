"use client";

import Link from "next/link";
import { LogOut } from "lucide-react";

import { ThemeToggle } from "@/components/layout/theme-toggle";

export function AppHeader() {
  return (
    <header
      className="sticky top-0 z-40 flex items-center justify-between px-5 py-3 border-b"
      style={{
        background: "color-mix(in srgb, var(--bg-base) 72%, transparent)",
        borderColor: "var(--glass-border)",
        backdropFilter: "blur(24px) saturate(1.8)",
        WebkitBackdropFilter: "blur(24px) saturate(1.8)",
        boxShadow: "0 1px 0 0 color-mix(in srgb, var(--foreground) 4%, transparent)",
      }}
    >
      <Link
        href="/dashboard"
        className="flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink rounded-full"
      >
        {/* Badge: cerchio pieno inchiostro col segno lime, come il
            distintivo "G" del command center — non più un anello nudo. */}
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink">
          <svg width="16" height="16" viewBox="0 0 58 58" fill="none" aria-hidden>
            <circle
              cx="29" cy="29" r="22"
              stroke="var(--lime)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray="104 34"
              transform="rotate(-90 29 29)"
            />
          </svg>
        </span>
        <span className="font-serif text-[16px] font-bold tracking-[-0.01em] text-foreground">
          CurveLoad
        </span>
      </Link>

      <div className="flex items-center gap-1">
        <ThemeToggle />

        <form action="/api/auth/logout" method="post">
          <button
            type="submit"
            title="Esci da CurveLoad"
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs text-muted hover:text-foreground hover:bg-surface-2 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden sm:inline">Esci</span>
            <span className="sr-only sm:hidden">Esci da CurveLoad</span>
          </button>
        </form>
      </div>
    </header>
  );
}
