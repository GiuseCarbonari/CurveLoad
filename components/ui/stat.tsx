import { cn } from "@/lib/utils";

export function Stat({
  label,
  value,
  detail,
  accent = false,
  className,
}: {
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  accent?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 px-4 py-4 sm:px-5", className)}>
      <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-1.5 text-[26px] font-medium leading-none tracking-[-0.025em]",
          accent ? "text-amber" : "text-foreground"
        )}
      >
        {value}
      </dd>
      {detail && <p className="mt-2 text-xs text-muted">{detail}</p>}
    </div>
  );
}
