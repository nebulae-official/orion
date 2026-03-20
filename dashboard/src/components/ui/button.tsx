import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "ghost";
type ButtonSize = "sm" | "md" | "lg" | "icon";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  default:
    "bg-primary text-white hover:bg-primary/90 focus-visible:ring-primary",
  secondary:
    "border border-border bg-surface-elevated text-text-secondary hover:bg-surface-hover hover:text-text focus-visible:ring-border",
  destructive:
    "bg-danger text-white hover:bg-danger/90 focus-visible:ring-danger",
  outline:
    "border border-border bg-transparent text-text-secondary hover:bg-primary-surface hover:text-primary focus-visible:ring-primary",
  ghost:
    "text-text-secondary hover:bg-surface-hover hover:text-text focus-visible:ring-border",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "rounded-lg px-3 py-1.5 text-xs",
  md: "rounded-lg px-4 py-2 text-sm",
  lg: "rounded-xl px-5 py-2.5 text-base",
  icon: "rounded-lg h-9 w-9",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "default",
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
