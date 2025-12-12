import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const KPICardSkeleton = () => {
  return (
    <Card className="relative overflow-hidden border border-border/50 bg-card">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-3 flex-1">
            <Skeleton className="h-3 w-24" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-4 w-40" />
            </div>
          </div>
          <Skeleton className="h-12 w-12 rounded-xl shrink-0" />
        </div>
      </CardContent>
    </Card>
  );
};
