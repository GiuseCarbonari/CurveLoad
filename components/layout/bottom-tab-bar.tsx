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
 * Tab bar fissa in basso (design command center, Passo 7): dock a pillola
 * flottante, stesso schema del selettore Panoramica/Carico/Coach in alto
 * nel command center — contenitore di vetro rounded-full, tab attiva =
 * riquadro pieno e sollevato (non più un rettangolo tinto trasparente).
 * Sostituisce la nav in header sulle schermate già ridisegnate; le altre
 * rotte restano su AppHeader finché non vengono ridisegnate a loro volta.
 */
export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navigazione principale"
      className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div
        className="flex items-center gap-0.5 rounded-full p-1.5"
        style={{
          background: "var(--bg-surface-2)",
          border: "1px solid var(--glass-border)",
          backdropFilter: "blur(24px) saturate(1.6)",
          WebkitBackdropFilter: "blur(24px) saturate(1.6)",
          boxShadow:
            "var(--glass-shadow), inset 0 1px 0 0 color-mix(in srgb, var(--foreground) 5%, transparent)",
        }}
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
                "flex flex-col items-center gap-0.5 rounded-full px-3 py-2 text-[9.5px] font-bold uppercase tracking-[0.02em] transition-colors duration-150",
                active ? "text-foreground" : "text-muted hover:text-secondary"
              )}
              style={
                active
                  ? {
                      background: "var(--glass-nest)",
                      boxShadow:
                        "0 2px 8px -2px color-mix(in srgb, var(--foreground) 18%, transparent)",
                    }
                  : undefined
              }
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
