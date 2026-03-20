"use client";

import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { resetPassword } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Sparkles, ArrowRight, ArrowLeft, CheckCircle, AlertTriangle } from "lucide-react";
import { Suspense } from "react";

function ResetPasswordForm(): React.ReactElement {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!token) {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-warning-surface">
          <AlertTriangle className="h-6 w-6 text-warning-light" />
        </div>
        <h2 className="text-lg font-semibold text-text">Invalid reset link</h2>
        <p className="text-sm text-text-secondary">
          This password reset link is invalid or has expired. Please request a
          new one.
        </p>
        <Link
          href="/forgot-password"
          className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary-muted transition-colors"
        >
          Request new link
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    const result = await resetPassword(token!, password);

    if (result.success) {
      setSuccess(true);
    } else {
      setError(result.error ?? "Password reset failed");
    }
    setLoading(false);
  }

  if (success) {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success-surface">
          <CheckCircle className="h-6 w-6 text-success" />
        </div>
        <h2 className="text-lg font-semibold text-text">
          Password reset successfully
        </h2>
        <p className="text-sm text-text-secondary">
          Your password has been updated. You can now sign in with your new
          password.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary-muted transition-colors"
        >
          Sign in
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="rounded-lg border border-danger/20 bg-danger-surface px-4 py-3 text-sm text-danger-light">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-sm font-medium text-text-secondary"
            >
              New Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="block w-full rounded-lg border border-border bg-surface-elevated px-4 py-2.5 text-sm text-text placeholder-text-muted transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="At least 8 characters"
            />
          </div>

          <div>
            <label
              htmlFor="confirm-password"
              className="mb-1.5 block text-sm font-medium text-text-secondary"
            >
              Confirm New Password
            </label>
            <input
              id="confirm-password"
              name="confirm-password"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="block w-full rounded-lg border border-border bg-surface-elevated px-4 py-2.5 text-sm text-text placeholder-text-muted transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Confirm your new password"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary-muted hover:shadow-primary/30",
            loading && "cursor-not-allowed opacity-60"
          )}
        >
          {loading ? "Resetting..." : "Reset password"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-text-secondary">
        <Link
          href="/login"
          className="inline-flex items-center gap-1 font-medium text-primary hover:text-primary-muted transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to sign in
        </Link>
      </p>
    </>
  );
}

export default function ResetPasswordPage(): React.ReactElement {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-bg overflow-hidden">
      {/* Background glow effects */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/4 top-1/4 h-96 w-96 rounded-full bg-primary opacity-[0.04] blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-cyan opacity-[0.04] blur-[120px]" />
      </div>

      <div className="relative w-full max-w-md px-4">
        {/* Card */}
        <div className="rounded-2xl border border-border bg-surface p-8 shadow-2xl shadow-black/20">
          {/* Logo */}
          <div className="mb-8 text-center">
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/25">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-text">
              Set new password
            </h1>
            <p className="mt-2 text-sm text-text-secondary">
              Choose a new password for your account
            </p>
          </div>

          <Suspense fallback={<div className="h-48" />}>
            <ResetPasswordForm />
          </Suspense>
        </div>

        {/* Subtle brand footer */}
        <p className="mt-6 text-center text-xs text-text-dim">
          Orion Digital Twin Content Agency
        </p>
      </div>
    </div>
  );
}
