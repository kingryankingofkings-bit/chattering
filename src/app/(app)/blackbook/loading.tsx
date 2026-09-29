import { Skeleton } from "@/components/ui";
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-24 w-full !rounded-2xl" />
      <div className="flex gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[76px] w-[76px] !rounded-2xl" />)}</div>
      {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 w-full !rounded-2xl" />)}
    </div>
  );
}
