"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { register } from "@/lib/auth";
import { ArrowRight, CheckCircle } from "lucide-react";
import {
  AuthCard,
  AuthCardHeading,
  AuthShell,
  AuthStatusLine,
} from "../auth-shell";

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
    <AuthShell
      topPrompt="Already have access?"
      topHref="/login"
      topLinkText="Sign in ->"
    >
      <AuthCard>
        <AuthStatusLine />
        <AuthCardHeading
          eyebrow="Operator Access"
          title="Create your account."
          subtitle="Join Orion OS and activate your content command center."
        />

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
                    className="mb-1.5 block text-[12.5px] font-medium text-text-secondary"
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
                    className="block w-full rounded-lg border border-white/[0.08] bg-surface-elevated px-3.5 py-[11px] text-sm text-text outline-none placeholder:text-text-muted transition-[border-color,box-shadow,background] focus:border-primary focus:ring-1 focus:ring-primary"
                    placeholder="Amina Khoury"
                  />
                </div>

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

                <div>
                  <label
                    htmlFor="password"
                    className="mb-1.5 block text-[12.5px] font-medium text-text-secondary"
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
                    className="block w-full rounded-lg border border-white/[0.08] bg-surface-elevated px-3.5 py-[11px] text-sm text-text outline-none placeholder:text-text-muted transition-[border-color,box-shadow,background] focus:border-primary focus:ring-1 focus:ring-primary"
                    placeholder="At least 8 characters"
                  />
                </div>

                <div>
                  <label
                    htmlFor="confirm-password"
                    className="mb-1.5 block text-[12.5px] font-medium text-text-secondary"
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
                    className="block w-full rounded-lg border border-white/[0.08] bg-surface-elevated px-3.5 py-[11px] text-sm text-text outline-none placeholder:text-text-muted transition-[border-color,box-shadow,background] focus:border-primary focus:ring-1 focus:ring-primary"
                    placeholder="Confirm your password"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2.5 rounded-[10px] bg-primary-muted px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_-8px_rgba(124,58,237,0.5)] transition-all hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
              >
                {loading ? (
                  "Creating account..."
                ) : (
                  <>
                    Create account
                    <ArrowRight className="size-3.5" />
                  </>
                )}
              </button>
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
      </AuthCard>
    </AuthShell>
  );
}
