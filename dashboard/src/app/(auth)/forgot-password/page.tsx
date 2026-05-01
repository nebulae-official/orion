"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { forgotPassword } from "@/lib/auth";
import { ArrowLeft, Mail } from "lucide-react";
import {
  AuthCard,
  AuthCardHeading,
  AuthShell,
  AuthStatusLine,
} from "../auth-shell";

export default function ForgotPasswordPage(): React.ReactElement {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await forgotPassword(email);

    if (result.success) {
      setSubmitted(true);
    } else {
      // Always show success message to prevent email enumeration
      setSubmitted(true);
    }
    setLoading(false);
  }

  return (
    <AuthShell
      topPrompt="Remembered your credentials?"
      topHref="/login"
      topLinkText="Sign in ->"
    >
      <AuthCard>
        <AuthStatusLine />
        <AuthCardHeading
          eyebrow="Credential Recovery"
          title="Reset your password."
          subtitle="Enter your email and Orion will send a secure reset link."
        />

        {submitted ? (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Mail className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-text">
              Check your email
            </h2>
            <p className="text-sm text-text-secondary">
              If that email exists in our system, a password reset link has been
              sent. Please check your inbox.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary-muted transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="rounded-lg border border-danger/20 bg-danger-surface px-4 py-3 text-sm text-danger-light">
                  {error}
                </div>
              )}

              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-[12.5px] font-medium text-text-secondary"
                >
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full rounded-lg border border-white/[0.08] bg-surface-elevated px-3.5 py-[11px] text-sm text-text outline-none placeholder:text-text-muted transition-[border-color,box-shadow,background] focus:border-primary focus:ring-1 focus:ring-primary"
                  placeholder="a.khoury@orion.space"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2.5 rounded-[10px] bg-primary-muted px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_-8px_rgba(124,58,237,0.5)] transition-all hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
              >
                {loading ? "Sending..." : "Send reset link"}
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
        )}
      </AuthCard>
    </AuthShell>
  );
}
