import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-white shadow-sm hover:bg-primary-muted focus-visible:ring-primary",
  secondary:
    "bg-surface text-text-secondary border border-border shadow-sm hover:bg-surface-hover focus-visible:ring-border",
  danger:
    "bg-danger text-white shadow-sm hover:bg-danger/80 focus-visible:ring-danger",
  ghost:
    "text-text-secondary hover:bg-surface-hover focus-visible:ring-border",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "rounded-md px-3 py-1.5 text-xs",
  md: "rounded-lg px-4 py-2 text-sm",
  lg: "rounded-lg px-5 py-2.5 text-base",
};

/**
 * Reusable Button component with variant, size, and loading support.
 *
 * Variants: `primary`, `secondary`, `danger`, `ghost`
 * Sizes: `sm`, `md`, `lg`
 */
const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    loading = false,
    disabled,
    className,
    children,
    ...props
  },
  ref
): React.ReactElement {
  const isDisabled = disabled || loading;

  return (
    <button
      ref={ref}
      disabled={isDisabled}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        variantStyles[variant],
        sizeStyles[size],
        isDisabled && "cursor-not-allowed opacity-60",
        className
      )}
      {...props}
    >
      {loading && (
        <svg
          className="h-4 w-4 animate-spin"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      )}
      {children}
    </button>
  );
});

export { Button };
export type { ButtonProps, ButtonVariant, ButtonSize };
