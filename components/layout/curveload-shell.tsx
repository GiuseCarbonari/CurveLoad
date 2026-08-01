import { Suspense } from "react";
import { AppHeader } from "@/components/layout/app-header";
import { BottomTabBar } from "@/components/layout/bottom-tab-bar";
import { AppTour } from "@/components/layout/app-tour";
import { WhatsNew } from "@/components/layout/whats-new";
import { cn } from "@/lib/utils";

/**
 * Shell mobile-first del design CurveLoad: intestazione fissa in alto +
 * colonna singola centrata (max 640px) + tab bar fissa in basso. Usata
 * dalle schermate già ridisegnate; le altre restano su AppShell finché
 * non vengono rifatte.
 */
export function CurveLoadShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="min-h-screen font-body">
      <AppHeader />
      <main
        style={{
          paddingLeft: "max(1.25rem, env(safe-area-inset-left))",
          paddingRight: "max(1.25rem, env(safe-area-inset-right))",
        }}
        className={cn(
          "mx-auto flex w-full max-w-[640px] flex-col gap-5 px-5 pb-28 pt-6 sm:px-6",
          className
        )}
      >
        {children}
      </main>
      <BottomTabBar />
      <Suspense>
        <AppTour />
      </Suspense>
      <WhatsNew />
    </div>
  );
}
