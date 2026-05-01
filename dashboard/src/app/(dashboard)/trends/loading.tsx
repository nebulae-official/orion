import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function TrendsLoading(): React.ReactElement {
  return (
    <div className="p-6 sm:p-8">
      {/* Header skeleton */}
      <div className="mb-8 flex items-center gap-4">
        <Skeleton className="h-12 w-12 rounded-xl" />
        <div>
          <Skeleton className="h-8 w-32 rounded-lg" />
          <Skeleton className="mt-2 h-4 w-64" />
        </div>
      </div>

      {/* Stat cards skeleton */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="mt-2 h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table skeleton */}
      <Card className="overflow-hidden p-0">
        <div className="flex flex-col gap-4 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Skeleton className="h-3 w-16" />
            <Skeleton className="mt-2 h-5 w-36" />
          </div>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-8 w-24 rounded-lg" />
            ))}
          </div>
        </div>
        <div className="flex justify-between gap-3 border-b p-4">
          <Skeleton className="h-4 w-40" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-28 rounded-lg" />
            <Skeleton className="h-8 w-28 rounded-lg" />
          </div>
        </div>
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="border-b p-4 last:border-b-0">
            <div className="flex gap-8">
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-10" />
              <Skeleton className="h-5 w-14 rounded-full" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
