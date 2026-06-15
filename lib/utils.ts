import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Helper standard shadcn/ui: combina classi condizionali (clsx) e
// risolve i conflitti tra utility Tailwind (twMerge).
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
