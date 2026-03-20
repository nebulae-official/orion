"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { forgotPassword } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowLeft, Mail } from "lucide-react";

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
              Reset your password
            </h1>
            <p className="mt-2 text-sm text-text-secondary">
              Enter your email and we&apos;ll send you a reset link
            </p>
          </div>

          {submitted ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-lg font-semibold text-text">Check your email</h2>
              <p className="text-sm text-text-secondary">
                If that email exists in our system, a password reset link has
                been sent. Please check your inbox.
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
                    className="mb-1.5 block text-sm font-medium text-text-secondary"
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
                    className="block w-full rounded-lg border border-border bg-surface-elevated px-4 py-2.5 text-sm text-text placeholder-text-muted transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="Enter your email"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  loading={loading}
                  disabled={loading}
                >
                  {loading ? "Sending..." : "Send reset link"}
                </Button>
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
        </div>

        {/* Subtle brand footer */}
        <p className="mt-6 text-center text-xs text-text-dim">
          Orion Digital Twin Content Agency
        </p>
      </div>
    </div>
  );
}
