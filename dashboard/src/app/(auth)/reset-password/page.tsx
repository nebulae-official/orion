"use client";

import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { resetPassword } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import { Suspense } from "react";
import {
  AuthCard,
  AuthCardHeading,
  AuthShell,
  AuthStatusLine,
} from "../auth-shell";

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
              className="mb-1.5 block text-[12.5px] font-medium text-text-secondary"
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
              className="block w-full rounded-lg border border-white/[0.08] bg-surface-elevated px-3.5 py-[11px] text-sm text-text outline-none placeholder:text-text-muted transition-[border-color,box-shadow,background] focus:border-primary focus:ring-1 focus:ring-primary"
              placeholder="At least 8 characters"
            />
          </div>

          <div>
            <label
              htmlFor="confirm-password"
              className="mb-1.5 block text-[12.5px] font-medium text-text-secondary"
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
              className="block w-full rounded-lg border border-white/[0.08] bg-surface-elevated px-3.5 py-[11px] text-sm text-text outline-none placeholder:text-text-muted transition-[border-color,box-shadow,background] focus:border-primary focus:ring-1 focus:ring-primary"
              placeholder="Confirm your new password"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className={cn(
            "inline-flex w-full items-center justify-center gap-2.5 rounded-[10px] bg-primary-muted px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_-8px_rgba(124,58,237,0.5)] transition-all hover:-translate-y-0.5 hover:brightness-110",
            loading && "cursor-not-allowed opacity-60",
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
    <AuthShell
      topPrompt="Remembered your credentials?"
      topHref="/login"
      topLinkText="Sign in ->"
    >
      <AuthCard>
        <AuthStatusLine />
        <AuthCardHeading
          eyebrow="Credential Reset"
          title="Set new password."
          subtitle="Choose a new mission key for your Orion account."
        />

        <Suspense fallback={<div className="h-48" />}>
          <ResetPasswordForm />
        </Suspense>
      </AuthCard>
    </AuthShell>
  );
}
