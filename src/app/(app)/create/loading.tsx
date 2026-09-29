import { Skeleton } from "@/components/ui";
export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <div className="flex items-end justify-between">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-8 w-32" />
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="card flex gap-3 p-3">
          <Skeleton className="h-[72px] w-[72px] !rounded-2xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
