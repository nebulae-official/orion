import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ContentCard, ContentCardSkeleton } from "@/components/content-card";
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

  try {
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
      return { items: [], page: params.page, limit: params.limit, total: 0 };
    }

    return (await response.json()) as PaginatedResponse<Content>;
  } catch {
    return { items: [], page: params.page, limit: params.limit, total: 0 };
  }
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

  const data = await fetchContentList(token, { status, sort, page, limit });
  const totalPages = Math.ceil(data.total / limit);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Content Queue</h1>
        <p className="mt-2 text-gray-500">
          Review and manage content in the pipeline.
        </p>
      </div>

      <QueueFilters currentStatus={status} currentSort={sort} />

      {data.items.length === 0 ? (
        <div className="mt-12 text-center">
          <p className="text-gray-400">No content found.</p>
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
                    <a
                      key={pageNum}
                      href={`/queue?${params.toString()}`}
                      className={
                        pageNum === page
                          ? "rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white"
                          : "rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100"
                      }
                    >
                      {pageNum}
                    </a>
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
