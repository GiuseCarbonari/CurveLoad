import { cn } from "@/lib/utils";

export function MetricStrip({
  children,
  className,
  columns = 6,
}: {
  children: React.ReactNode;
  className?: string;
  columns?: 3 | 4 | 6;
}) {
  const columnClass = {
    3: "sm:grid-cols-3",
    4: "sm:grid-cols-4",
    6: "sm:grid-cols-3 lg:grid-cols-6",
  }[columns];

  return (
    <dl
      className={cn(
        "grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border",
        columnClass,
        "[&>*]:bg-surface",
        className
      )}
    >
      {children}
    </dl>
  );
}
