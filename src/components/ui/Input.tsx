import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "rk-control h-8 w-full px-2.5 text-sm font-sans",
      "text-[var(--text-primary)] placeholder:text-[var(--text-muted)]",
      "focus-visible:outline-none",
      "disabled:opacity-100",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";
