import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function KpiCardsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="surface-panel rounded-2xl">
          <CardContent className="space-y-2 p-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-12" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <Card className="surface-panel rounded-2xl">
      <CardContent className="space-y-3 p-4">
        <Skeleton className="h-8 w-full" />
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <KpiCardsSkeleton />
      <Skeleton className="h-20 w-full rounded-xl" />
      <TableSkeleton />
    </div>
  );
}
