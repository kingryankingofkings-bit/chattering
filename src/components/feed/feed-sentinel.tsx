"use client";
import * as React from "react";
import { Spinner } from "@/components/ui";

export function FeedSentinel({ onVisible, loading, done }: { onVisible: () => void; loading: boolean; done: boolean }) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el || done) return;
    const io = new IntersectionObserver((entries) => entries[0]?.isIntersecting && onVisible(), { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [onVisible, done]);
  if (done) return null;
  return (
    <div ref={ref} className="flex justify-center py-6">
      {loading && <Spinner />}
    </div>
  );
}
