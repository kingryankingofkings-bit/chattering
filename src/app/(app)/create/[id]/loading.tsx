import { Skeleton } from "@/components/ui";
export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-3 w-2/3" />
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full !rounded-2xl" />
      ))}
    </div>
  );
}
