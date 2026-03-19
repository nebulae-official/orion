import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { serverFetch } from "@/lib/api-client";
import { DEMO_MODE } from "@/lib/config";
import { demoPublishRecords } from "@/lib/demo-data";
import { cn, formatDate } from "@/lib/utils";
import type { PublishRecord } from "@/types/api";

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-warning-surface text-warning-light" },
  published: { label: "Published", className: "bg-success-surface text-success-light" },
  failed: { label: "Failed", className: "bg-danger-surface text-danger-light" },
};

export default async function PublishingPage(): Promise<React.ReactElement> {
  const cookieStore = await cookies();
  const token = cookieStore.get("orion_token")?.value;

  if (!token && !DEMO_MODE) {
    redirect("/login");
  }

  let records: PublishRecord[] = [];
  let fetchError = false;

  if (DEMO_MODE) {
    records = demoPublishRecords;
  } else {
    try {
      records = await serverFetch<PublishRecord[]>(
        "/api/v1/publisher/publish/history?limit=100",
        {},
        token
      );
    } catch {
      fetchError = true;
    }
  }

  return (
    <div className="p-8">
      <h1 className="mb-6 font-[family-name:var(--font-display)] text-2xl font-bold text-text">
        Publishing History
      </h1>

      {fetchError && (
        <div className="mb-6 rounded-xl border border-warning-surface bg-warning-surface/30 p-4 text-sm text-warning-light">
          Unable to load publishing history. Showing cached or empty results.
        </div>
      )}

      {records.length === 0 ? (
        <div className="glass-card luminous-border rounded-xl p-12 text-center">
          <p className="text-text-muted">No publishing records yet</p>
          <p className="mt-1 text-sm text-text-dim">
            Approve content and click Publish to get started
          </p>
        </div>
      ) : (
        <div className="overflow-hidden glass-card luminous-border rounded-xl">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-surface-elevated">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-muted">
                  Content
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-muted">
                  Platform
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-muted">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-muted">
                  Published
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-muted">
                  Post ID
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {records.map((record) => {
                const statusInfo =
                  STATUS_STYLES[record.status] ?? STATUS_STYLES.pending;
                return (
                  <tr key={record.id} className="transition-colors hover:bg-surface-hover">
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-text">
                      {record.content_id.slice(0, 8)}…
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-text-secondary">
                      {record.platform}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                          statusInfo.className
                        )}
                      >
                        {statusInfo.label}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-text-muted">
                      {record.published_at
                        ? formatDate(record.published_at)
                        : "—"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-text-muted">
                      {record.platform_post_id ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
