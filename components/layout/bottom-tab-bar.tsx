"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Mountain, Settings, SquareUser, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

const TABS = [
  { label: "Oggi", href: "/dashboard", icon: Sparkles, tourId: undefined },
  { label: "Piano", href: "/plan", icon: CalendarDays, tourId: "tour-tab-plan" },
  { label: "Profilo", href: "/profile", icon: SquareUser, tourId: "tour-tab-profile" },
  { label: "Percorso", href: "/terrain", icon: Mountain, tourId: undefined },
  { label: "Impostazioni", href: "/settings/profile", icon: Settings, tourId: undefined },
] as const;

/**
 * Tab bar fissa in basso (design CurveLoad): sostituisce la nav in header
 * sulle schermate già ridisegnate. Le altre rotte restano su AppHeader
 * finché non vengono ridisegnate a loro volta.
 */
export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navigazione principale"
      className="fixed inset-x-0 bottom-0 z-40 border-t"
      style={{
        background: "color-mix(in srgb, var(--bg-base) 70%, transparent)",
        borderColor: "var(--glass-border)",
        backdropFilter: "blur(24px) saturate(1.8)",
        WebkitBackdropFilter: "blur(24px) saturate(1.8)",
        boxShadow: "0 -1px 0 0 color-mix(in srgb, var(--foreground) 4%, transparent)",
      }}
    >
      <div
        style={{ paddingBottom: "calc(0.625rem + env(safe-area-inset-bottom))" }}
        className="mx-auto flex max-w-[640px] items-center justify-around px-2 pt-2.5"
      >
        {TABS.map((tab) => {
          const active =
            pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              id={tab.tourId}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl px-3 py-1.5 text-[10px] font-semibold transition-all duration-200",
                active
                  ? "text-brand"
                  : "text-muted hover:text-secondary"
              )}
              style={active ? {
                background: "color-mix(in srgb, var(--brand) 12%, transparent)",
                boxShadow: "0 0 12px -4px color-mix(in srgb, var(--brand) 40%, transparent)",
              } : undefined}
            >
              <Icon className="h-[18px] w-[18px]" aria-hidden />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
