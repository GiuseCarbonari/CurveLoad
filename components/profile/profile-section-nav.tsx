const sections = [
  { href: "#sintesi", label: "Sintesi" },
  { href: "#potenza", label: "Potenza" },
  { href: "#evento", label: "Evento" },
  { href: "#stima-gara", label: "Stima gara" },
];

export function ProfileSectionNav() {
  return (
    <nav
      aria-label="Sezioni del profilo"
      className="sticky top-0 z-20 -mx-4 overflow-x-auto border-y border-border bg-base px-4 py-2 sm:mx-0 sm:rounded-[11px] sm:border"
    >
      <div className="flex min-w-max items-center gap-1">
        {sections.map((section, index) => (
          <a
            key={section.href}
            href={section.href}
            className="inline-flex min-h-10 items-center gap-2 rounded-[9px] px-3.5 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
          >
            <span className="font-mono text-[10px] text-faint">
              {String(index + 1).padStart(2, "0")}
            </span>
            {section.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
