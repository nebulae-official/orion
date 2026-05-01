"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { login } from "@/lib/auth";
import { GATEWAY_URL } from "@/lib/config";
import { ArrowRight, Check, Chrome, Github } from "lucide-react";
import {
  AuthCard,
  AuthCardHeading,
  AuthShell,
  AuthStatusLine,
} from "../auth-shell";

export default function LoginForm(): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await login(email, password);

    if (result.success) {
      router.push(redirect);
      router.refresh();
    } else {
      setError(result.error ?? "Login failed");
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <AuthCard>
        <AuthStatusLine />
        <AuthCardHeading
          eyebrow="Operator Sign-In"
          title="Welcome back."
          subtitle="Authenticate to open the Orion OS dashboard."
        />

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="rounded-lg border border-danger/20 bg-danger-surface px-4 py-3 text-sm text-danger-light">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-[12.5px] font-medium text-text-secondary"
              >
                Email or Username
              </label>
              <input
                id="email"
                name="email"
                type="text"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full rounded-lg border border-white/[0.08] bg-surface-elevated px-3.5 py-[11px] text-sm text-text outline-none placeholder:text-text-muted transition-[border-color,box-shadow,background] focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="a.khoury@orion.space"
              />
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="block text-[12.5px] font-medium text-text-secondary"
                >
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-[11.5px] font-medium text-primary-light transition-colors hover:text-cyan-light"
                >
                  Forgot?
                </Link>
              </div>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full rounded-lg border border-white/[0.08] bg-surface-elevated px-3.5 py-[11px] text-sm text-text outline-none placeholder:text-text-muted transition-[border-color,box-shadow,background] focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="Enter mission key"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 text-[12.5px] text-text-secondary">
            <span className="flex size-4 items-center justify-center rounded border border-white/[0.14] bg-surface-elevated text-primary-light">
              <Check className="size-[11px] stroke-[3]" />
            </span>
            Keep me signed in on this device
          </div>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2.5 rounded-[10px] bg-primary-muted px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_-8px_rgba(124,58,237,0.5)] transition-all hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
          >
            {loading ? (
              "Signing in..."
            ) : (
              <>
                Sign in
                <ArrowRight className="size-3.5" />
              </>
            )}
          </button>
        </form>

        <div className="my-[22px] flex items-center gap-3 font-[family-name:var(--font-display)] text-[11px] uppercase tracking-[0.18em] text-text-muted before:h-px before:flex-1 before:bg-gradient-to-r before:from-transparent before:via-white/15 before:to-transparent after:h-px after:flex-1 after:bg-gradient-to-r after:from-transparent after:via-white/15 after:to-transparent">
          Or continue with
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2.5 rounded-[10px] border border-white/[0.08] bg-transparent px-3.5 py-2.5 text-[13.5px] font-medium text-text transition-all hover:border-white/[0.14] hover:bg-surface-elevated"
            onClick={() => {
              window.location.href = `${GATEWAY_URL}/api/v1/auth/oauth/github?redirect=${encodeURIComponent(redirect)}`;
            }}
          >
            <Github className="size-4" />
            GitHub
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2.5 rounded-[10px] border border-white/[0.08] bg-transparent px-3.5 py-2.5 text-[13.5px] font-medium text-text transition-all hover:border-white/[0.14] hover:bg-surface-elevated"
            onClick={() => {
              window.location.href = `${GATEWAY_URL}/api/v1/auth/oauth/google?redirect=${encodeURIComponent(redirect)}`;
            }}
          >
            <Chrome className="size-4" />
            Google
          </button>
        </div>

        <p className="mt-[22px] text-center text-[12.5px] text-text-secondary">
          By continuing, you accept the{" "}
          <Link
            href="/terms"
            className="font-medium text-primary-light transition-colors hover:text-cyan-light"
          >
            Operator Terms
          </Link>{" "}
          and{" "}
          <Link
            href="/privacy"
            className="font-medium text-primary-light transition-colors hover:text-cyan-light"
          >
            Privacy Policy
          </Link>
          .
        </p>
      </AuthCard>
    </AuthShell>
  );
}
