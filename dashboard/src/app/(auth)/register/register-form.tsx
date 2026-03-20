"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { register } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight, CheckCircle } from "lucide-react";

export default function RegisterForm(): React.ReactElement {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

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

    const result = await register(name, email, password);

    if (result.success) {
      setSuccess(true);
    } else {
      setError(result.error ?? "Registration failed");
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
              Create your account
            </h1>
            <p className="mt-2 text-sm text-text-secondary">
              Join the Orion Content Agency
            </p>
          </div>

          {success ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success-surface">
                <CheckCircle className="h-6 w-6 text-success" />
              </div>
              <h2 className="text-lg font-semibold text-text">
                Verification email sent
              </h2>
              <p className="text-sm text-text-secondary">
                We&apos;ve sent a verification link to{" "}
                <span className="font-medium text-text">{email}</span>. Please
                check your inbox and click the link to activate your account.
              </p>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary-muted transition-colors"
              >
                Back to sign in
                <ArrowRight className="h-4 w-4" />
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

                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="name"
                      className="mb-1.5 block text-sm font-medium text-text-secondary"
                    >
                      Name
                    </label>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="block w-full rounded-lg border border-border bg-surface-elevated px-4 py-2.5 text-sm text-text placeholder-text-muted transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      placeholder="Your full name"
                    />
                  </div>

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
                      placeholder="you@example.com"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="password"
                      className="mb-1.5 block text-sm font-medium text-text-secondary"
                    >
                      Password
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
                      Confirm Password
                    </label>
                    <input
                      id="confirm-password"
                      name="confirm-password"
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="block w-full rounded-lg border border-border bg-surface-elevated px-4 py-2.5 text-sm text-text placeholder-text-muted transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      placeholder="Confirm your password"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  loading={loading}
                  disabled={loading}
                >
                  {loading ? (
                    "Creating account..."
                  ) : (
                    <>
                      Create account
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-text-secondary">
                Already have an account?{" "}
                <Link
                  href="/login"
                  className="font-medium text-primary hover:text-primary-muted transition-colors"
                >
                  Sign in
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
