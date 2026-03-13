import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ContentCard } from "@/components/content-card";
import { QueueFilters } from "@/components/queue-filters";
import type { Content, ContentStatus, PaginatedResponse } from "@/types/api";

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:8000";

interface QueuePageProps {
  searchParams: Promise<{
    status?: ContentStatus;
    sort?: "date" | "score";
    page?: string;
    limit?: string;
  }>;
}

async function fetchContentList(
  token: string,
  params: {
    status?: ContentStatus;
    sort?: "date" | "score";
    page: number;
    limit: number;
  }
): Promise<PaginatedResponse<Content>> {
  const searchParams = new URLSearchParams();
  if (params.status) searchParams.set("status", params.status);
  if (params.sort) searchParams.set("sort", params.sort);
  searchParams.set("page", String(params.page));
  searchParams.set("limit", String(params.limit));

  const response = await fetch(
    `${GATEWAY_URL}/api/v1/content?${searchParams.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      next: { revalidate: 0 },
    }
  );

  if (!response.ok) {
    throw new Error(`Content fetch failed with status ${response.status}`);
  }

  return (await response.json()) as PaginatedResponse<Content>;
}

export default async function QueuePage({
  searchParams,
}: QueuePageProps): Promise<React.ReactElement> {
  const cookieStore = await cookies();
  const token = cookieStore.get("orion_token")?.value;

  if (!token) {
    redirect("/login");
  }

  const resolvedParams = await searchParams;
  const page = Number(resolvedParams.page ?? "1");
  const limit = Number(resolvedParams.limit ?? "12");
  const status = resolvedParams.status;
  const sort = resolvedParams.sort ?? "date";

  let fetchError = false;
  let data: PaginatedResponse<Content>;

  try {
    data = await fetchContentList(token, { status, sort, page, limit });
  } catch {
    fetchError = true;
    data = { items: [], page, limit, total: 0 };
  }

  const totalPages = Math.ceil(data.total / limit);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-text">Content Queue</h1>
        <p className="mt-2 text-text-secondary">
          Review and manage content in the pipeline.
        </p>
      </div>

      {fetchError && (
        <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Some data may be unavailable. Services may not be running.
        </div>
      )}

      <QueueFilters currentStatus={status} currentSort={sort} />

      {data.items.length === 0 ? (
        <div className="mt-12 text-center">
          <p className="text-text-muted">No content found.</p>
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data.items.map((content) => (
              <ContentCard key={content.id} content={content} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                (pageNum) => {
                  const params = new URLSearchParams();
                  if (status) params.set("status", status);
                  if (sort !== "date") params.set("sort", sort);
                  params.set("page", String(pageNum));
                  if (limit !== 12) params.set("limit", String(limit));

                  return (
                    <Link
                      key={pageNum}
                      href={`/queue?${params.toString()}`}
                      className={
                        pageNum === page
                          ? "rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white"
                          : "rounded-lg bg-surface px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-surface-hover"
                      }
                    >
                      {pageNum}
                    </Link>
                  );
                }
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
