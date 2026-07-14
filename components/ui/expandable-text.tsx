"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface ExpandableTextProps {
  text: string;
  className?: string;
}

export function ExpandableText({ text, className }: ExpandableTextProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <p
        className={cn(
          "text-sm leading-relaxed text-foreground whitespace-pre-wrap transition-all duration-300",
          !expanded && "line-clamp-3",
          className
        )}
      >
        {text}
      </p>
      <button
        type="button"
        aria-label={expanded ? "Comprimi testo" : "Espandi testo"}
        onClick={() => setExpanded((v) => !v)}
        className="mt-1.5 text-xs text-muted hover:text-secondary transition-colors cursor-pointer"
      >
        {expanded ? "Mostra meno ↑" : "Leggi tutto ↓"}
      </button>
    </div>
  );
}
