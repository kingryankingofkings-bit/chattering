"use client";
import { Eye, Heart, MessageCircle, MessagesSquare, Star } from "lucide-react";
import type { EngagementStats } from "@/lib/types";
import { cn, compact } from "@/lib/utils";

export function StatsBar({ stats, className, dense }: { stats: EngagementStats; className?: string; dense?: boolean }) {
  const items = [
    { icon: MessageCircle, label: "chats", value: compact(stats.chats) },
    { icon: MessagesSquare, label: "messages", value: compact(stats.messages) },
    { icon: Heart, label: "favorites", value: compact(stats.favorites) },
    { icon: Star, label: "rating", value: stats.rating === null ? "—" : `${stats.rating.toFixed(1)} (${compact(stats.ratingCount)})`, gold: true },
    { icon: Eye, label: "views", value: compact(stats.views) },
  ];
  return (
    <dl className={cn("flex flex-wrap gap-x-4 gap-y-1", dense ? "text-[11px]" : "text-xs", className)}>
      {items.map(({ icon: Icon, label, value, gold }) => (
        <div key={label} className={cn("inline-flex items-center gap-1", gold ? "text-gold" : "text-muted")}>
          <Icon className="h-3 w-3" aria-hidden />
          <dt className="sr-only">{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
