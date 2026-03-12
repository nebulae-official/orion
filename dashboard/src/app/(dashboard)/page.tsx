import Link from "next/link";
import { ListVideo, TrendingUp, CheckCircle, Clock } from "lucide-react";

export default function Home(): React.ReactElement {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-2 text-gray-500">
          Welcome to the Orion Content Agency dashboard.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardCard
          title="Content Queue"
          description="Review pending content"
          icon={<ListVideo className="h-6 w-6 text-blue-600" />}
          href="/queue"
        />
        <DashboardCard
          title="Trends"
          description="View detected trends"
          icon={<TrendingUp className="h-6 w-6 text-green-600" />}
          href="/trends"
        />
        <DashboardCard
          title="Approved"
          description="Content ready to publish"
          icon={<CheckCircle className="h-6 w-6 text-emerald-600" />}
          href="/queue?status=approved"
        />
        <DashboardCard
          title="In Review"
          description="Content awaiting review"
          icon={<Clock className="h-6 w-6 text-amber-600" />}
          href="/queue?status=review"
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
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
}): React.ReactElement {
  return (
    <Link
      href={href}
      className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="mb-3">{icon}</div>
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      <p className="mt-1 text-sm text-gray-500">{description}</p>
    </Link>
  );
}
