"use client";

import { AlertCircle, RotateCcw } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.ReactElement {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-8">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-danger-surface">
          <AlertCircle className="h-8 w-8 text-danger-light" />
        </div>
        <h2 className="mb-2 font-[family-name:var(--font-display)] text-xl font-bold text-text">
          Something went wrong
        </h2>
        <p className="mb-6 text-sm text-text-secondary">
          An unexpected error occurred while loading this page. Please try again
          or contact support if the problem persists.
        </p>
        {error.digest && (
          <p className="mb-4 text-xs text-text-dim">
            Error reference: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-muted"
        >
          <RotateCcw className="h-4 w-4" />
          Try again
        </button>
      </div>
    </div>
  );
}
