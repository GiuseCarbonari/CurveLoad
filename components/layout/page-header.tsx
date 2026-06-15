import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between",
        className
      )}
    >
      <div className="max-w-2xl">
        {eyebrow && (
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
            {eyebrow}
          </p>
        )}
        <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.025em] text-foreground sm:text-[32px]">
          {title}
        </h1>
        {description && (
          <div className="mt-2 text-sm leading-relaxed text-secondary">
            {description}
          </div>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
