import Link from "next/link";

interface AuthShellProps {
  children: React.ReactNode;
  eyebrow?: string;
  topPrompt?: string;
  topHref?: string;
  topLinkText?: string;
}

function OrionMark(): React.ReactElement {
  return (
    <div className="flex items-center gap-2.5">
      <div className="auth-logo-tile flex size-9 items-center justify-center drop-shadow-[0_4px_12px_rgba(167,139,250,0.28)]">
        <svg aria-hidden="true" viewBox="0 0 100 100" className="size-9">
          <defs>
            <linearGradient
              id="auth-orion-gradient"
              x1="0"
              y1="0"
              x2="1"
              y2="1"
            >
              <stop offset="0" stopColor="#A78BFA" />
              <stop offset="1" stopColor="#22D3EE" />
            </linearGradient>
          </defs>
          <circle
            className="auth-orbit-ring"
            cx="50"
            cy="50"
            r="32"
            fill="none"
            stroke="url(#auth-orion-gradient)"
            strokeDasharray="60 22"
            strokeWidth="2.5"
            opacity="0.8"
          />
          <g className="auth-satellite-group">
            <circle cx="18" cy="50" r="5" fill="#A78BFA" />
            <circle cx="66" cy="22" r="5" fill="#22D3EE" />
            <circle cx="66" cy="78" r="5" fill="#A78BFA" />
          </g>
          <circle
            className="auth-logo-core"
            cx="50"
            cy="50"
            r="9"
            fill="url(#auth-orion-gradient)"
          />
          <circle
            cx="50"
            cy="50"
            r="14"
            fill="none"
            stroke="url(#auth-orion-gradient)"
            strokeWidth="1.8"
          />
        </svg>
      </div>
      <div className="font-[family-name:var(--font-display)] text-xl font-bold tracking-[-0.02em] text-text">
        orion
      </div>
    </div>
  );
}

export function AuthStatusLine(): React.ReactElement {
  return (
    <div className="mb-[18px] flex items-center gap-2 font-[family-name:var(--font-display)] text-[10px] font-medium uppercase tracking-[0.2em] text-success-light">
      <span className="auth-status-dot size-[7px] rounded-full bg-success-light" />
      All Systems Operational
    </div>
  );
}

export function AuthShell({
  children,
  eyebrow = "Orion OS · v2.4",
  topPrompt = "Don't have an account?",
  topHref = "/register",
  topLinkText = "Create account ->",
}: AuthShellProps): React.ReactElement {
  return (
    <main className="auth-reference-bg relative min-h-screen overflow-hidden bg-bg text-text">
      <div className="auth-starfield" aria-hidden="true" />
      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="flex items-center justify-between gap-4 px-5 py-6 sm:px-8 lg:px-10 lg:py-7">
          <OrionMark />
          <div className="text-right text-[13px] text-text-secondary">
            <span className="hidden sm:inline">{topPrompt} </span>
            <Link
              href={topHref}
              className="font-medium text-primary-light transition-colors hover:text-cyan-light"
            >
              {topLinkText}
            </Link>
          </div>
        </header>

        <section className="flex flex-1 items-center justify-center gap-10 px-5 pb-10 pt-2 sm:px-8 lg:gap-[60px] lg:px-10">
          <div className="hidden max-w-[420px] lg:block">
            <div className="mb-[18px] font-[family-name:var(--font-display)] text-[11px] font-medium uppercase tracking-[0.25em] text-primary-light">
              {eyebrow}
            </div>
            <h1 className="font-[family-name:var(--font-display)] text-[44px] font-bold leading-[1.05] tracking-[-0.02em] text-text">
              Mission control for an{" "}
              <span className="bg-gradient-to-br from-primary-light to-cyan-light bg-clip-text text-transparent">
                autonomous content agency
              </span>
              .
            </h1>
            <p className="mt-[18px] text-[15px] leading-relaxed text-text-secondary">
              Sign in to the Orion dashboard to review trends, approve scripts,
              and steer the swarm. Every action is auditable; every agent is
              observable.
            </p>
            <div className="mt-[22px] flex flex-wrap gap-1.5">
              {["Scout", "Director", "Media", "Editor", "Publisher"].map(
                (chip) => (
                  <span
                    key={chip}
                    className="rounded-full bg-primary-surface px-[11px] py-[5px] font-[family-name:var(--font-display)] text-[11px] tracking-[0.08em] text-primary-light"
                  >
                    {chip}
                  </span>
                ),
              )}
            </div>
          </div>

          <div className="w-full max-w-[420px]">{children}</div>
        </section>
      </div>
    </main>
  );
}

export function AuthCard({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="auth-reference-card rounded-[20px] border border-white/[0.08] bg-[rgba(15,22,38,0.55)] px-6 py-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_20px_60px_rgba(0,0,0,0.45),0_0_60px_-20px_rgba(124,58,237,0.35)] backdrop-blur-[28px] backdrop-saturate-[1.8] sm:px-9 sm:pb-8 sm:pt-9">
      {children}
    </div>
  );
}

export function AuthCardHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}): React.ReactElement {
  return (
    <div className="mb-6">
      <div className="font-[family-name:var(--font-display)] text-[10px] font-medium uppercase tracking-[0.2em] text-primary-light">
        {eyebrow}
      </div>
      <h2 className="mt-2.5 font-[family-name:var(--font-display)] text-[26px] font-bold tracking-[-0.01em] text-text">
        {title}
      </h2>
      <p className="mt-1.5 text-[13.5px] text-text-secondary">{subtitle}</p>
    </div>
  );
}
