import Link from "next/link";
import { ListVideo, TrendingUp, CheckCircle, Clock } from "lucide-react";

export default function Home(): React.ReactElement {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-text">
          Dashboard
        </h1>
        <p className="mt-2 text-text-secondary">
          Welcome to the Orion Content Agency dashboard.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardCard
          title="Content Queue"
          description="Review pending content"
          icon={<ListVideo className="h-6 w-6 text-primary-light" />}
          href="/queue"
          accent="hover:border-primary/30"
        />
        <DashboardCard
          title="Trends"
          description="View detected trends"
          icon={<TrendingUp className="h-6 w-6 text-cyan-light" />}
          href="/trends"
          accent="hover:border-cyan/30"
        />
        <DashboardCard
          title="Approved"
          description="Content ready to publish"
          icon={<CheckCircle className="h-6 w-6 text-success-light" />}
          href="/queue?status=approved"
          accent="hover:border-success/30"
        />
        <DashboardCard
          title="In Review"
          description="Content awaiting review"
          icon={<Clock className="h-6 w-6 text-gold-light" />}
          href="/queue?status=review"
          accent="hover:border-gold/30"
        />
      </div>
    </div>
  );
}

function DashboardCard({
  title,
  description,
  icon,
  href,
  accent,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  accent: string;
}): React.ReactElement {
  return (
    <Link
      href={href}
      className={`rounded-xl border border-border bg-surface p-6 shadow-lg shadow-black/10 transition-all duration-300 hover:bg-surface-elevated ${accent}`}
    >
      <div className="mb-3">{icon}</div>
      <h2 className="text-lg font-semibold text-text">{title}</h2>
      <p className="mt-1 text-sm text-text-secondary">{description}</p>
    </Link>
  );
}
