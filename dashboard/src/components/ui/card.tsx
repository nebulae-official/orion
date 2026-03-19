import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function Card({ className, ...props }, ref): React.ReactElement {
    return (
      <div
        ref={ref}
        className={cn("glass-card luminous-border rounded-xl p-6", className)}
        {...props}
      />
    );
  }
);

const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function CardHeader({ className, ...props }, ref): React.ReactElement {
    return (
      <div
        ref={ref}
        className={cn("mb-4 flex flex-col gap-1.5", className)}
        {...props}
      />
    );
  }
);

const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  function CardTitle({ className, ...props }, ref): React.ReactElement {
    return (
      <h3
        ref={ref}
        className={cn("text-lg font-semibold text-text", className)}
        {...props}
      />
    );
  }
);

const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function CardContent({ className, ...props }, ref): React.ReactElement {
    return (
      <div
        ref={ref}
        className={cn("text-sm text-text-secondary", className)}
        {...props}
      />
    );
  }
);

export { Card, CardHeader, CardTitle, CardContent };
