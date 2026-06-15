import { cn } from "@/lib/utils";

export function SectionHeader({
  label,
  title,
  description,
  action,
  className,
}: {
  label?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:justify-between",
        className
      )}
    >
      <div>
        {label && (
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
            {label}
          </p>
        )}
        {title && (
          <h2 className="mt-1 text-lg font-medium tracking-[-0.015em] text-foreground">
            {title}
          </h2>
        )}
        {description && (
          <p className="mt-1 text-sm text-secondary">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0 self-stretch sm:self-auto">{action}</div>}
    </div>
  );
}
