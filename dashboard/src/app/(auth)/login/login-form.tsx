"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { login } from "@/lib/auth";
import { GATEWAY_URL } from "@/lib/config";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight, Github, Chrome } from "lucide-react";

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
              Welcome to Orion
            </h1>
            <p className="mt-2 text-sm text-text-secondary">
              Sign in to the Content Agency dashboard
            </p>
          </div>

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
                  className="mb-1.5 block text-sm font-medium text-text-secondary"
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
                  className="block w-full rounded-lg border border-border bg-surface-elevated px-4 py-2.5 text-sm text-text placeholder-text-muted transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Enter your email or username"
                />
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-text-secondary"
                  >
                    Password
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-xs text-primary hover:text-primary-muted transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-lg border border-border bg-surface-elevated px-4 py-2.5 text-sm text-text placeholder-text-muted transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Enter your password"
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
                "Signing in..."
              ) : (
                <>
                  Sign in
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center gap-4">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-text-muted">or continue with</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* OAuth buttons */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                window.location.href = `${GATEWAY_URL}/api/v1/auth/oauth/github?redirect=${encodeURIComponent(redirect)}`;
              }}
            >
              <Github className="h-4 w-4" />
              GitHub
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                window.location.href = `${GATEWAY_URL}/api/v1/auth/oauth/google?redirect=${encodeURIComponent(redirect)}`;
              }}
            >
              <Chrome className="h-4 w-4" />
              Google
            </Button>
          </div>

          {/* Create account link */}
          <p className="mt-6 text-center text-sm text-text-secondary">
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="font-medium text-primary hover:text-primary-muted transition-colors"
            >
              Create an account
            </Link>
          </p>
        </div>

        {/* Subtle brand footer */}
        <p className="mt-6 text-center text-xs text-text-dim">
          Orion Digital Twin Content Agency
        </p>
      </div>
    </div>
  );
}
