import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function TrendsLoading(): React.ReactElement {
  return (
    <div className="p-8">
      {/* Header skeleton */}
      <div className="mb-8 flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <div>
          <Skeleton className="h-8 w-32 rounded-lg" />
          <Skeleton className="mt-2 h-4 w-64" />
        </div>
      </div>

      {/* Stat cards skeleton */}
      <div className="mb-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="mt-2 h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters skeleton */}
      <div className="mb-6 flex gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-md" />
        ))}
      </div>

      {/* Table skeleton */}
      <Card className="overflow-hidden p-0">
        <div className="border-b p-4">
          <div className="flex gap-8">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-28" />
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
