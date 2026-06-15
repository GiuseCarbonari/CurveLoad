import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Componente Button standard di shadcn/ui (copiato, non generato:
// shadcn funziona per copia dei sorgenti nel progetto).
const buttonVariants = cva(
  "inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-[9px] text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-amber text-amber-on hover:bg-amber-hover",
        destructive:
          "bg-ready-skip text-foreground hover:opacity-90",
        outline:
          "border-[0.5px] border-border bg-transparent text-secondary hover:bg-surface-2 hover:text-foreground",
        secondary:
          "bg-surface-2 text-secondary hover:text-foreground",
        ghost: "text-secondary hover:bg-surface-2 hover:text-foreground",
        link: "min-h-0 text-amber underline-offset-4 hover:text-amber-hover hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-10 px-3",
        lg: "h-11 px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
