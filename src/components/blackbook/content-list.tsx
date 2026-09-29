"use client";
import * as React from "react";
import Link from "next/link";
import { BookOpen, Images, Layers } from "lucide-react";
import { Button, EmptyState, ErrorState, Segmented, Skeleton } from "@/components/ui";
import { FeedSentinel } from "@/components/feed/feed-sentinel";
import { useInfiniteFeed } from "@/components/feed/use-infinite-feed";
import type { ComicItem, ImageItem, StoryItem } from "@/lib/blackbook";
import { timeAgo } from "@/lib/utils";
import { AddToCollectionButton } from "./add-to-collection";

type Kind = "comics" | "stories" | "images";
type Item = (ComicItem | StoryItem | ImageItem) & { id: string };

const META: Record<Kind, { icon: React.ComponentType<{ className?: string }>; noun: string; route: string; target: "COMIC" | "STORY" | "IMAGE"; create: string }> = {
  comics: { icon: Layers, noun: "comics", route: "/comics", target: "COMIC", create: "/comics" },
  stories: { icon: BookOpen, noun: "stories", route: "/stories", target: "STORY", create: "/stories" },
  images: { icon: Images, noun: "images", route: "/gallery", target: "IMAGE", create: "/gallery" },
};

function StatusPill({ status, visibility }: { status: string; visibility: string }) {
  const published = status === "PUBLISHED";
  return <span className={`rounded-md border px-1.5 text-[10px] font-semibold uppercase ${published ? "border-success/30 bg-success/15 text-success" : "border-line bg-surface-2 text-muted"}`}>{published ? visibility.toLowerCase() : "draft"}</span>;
}

export function ContentList({ kind, blur }: { kind: Kind; blur?: boolean }) {
  const [mode, setMode] = React.useState<"mine" | "favorites">("mine");
  const feed = useInfiniteFeed<Item>(`/api/me/${kind}${mode === "favorites" ? "?favorites=1" : ""}`);
  const m = META[kind];
  const Icon = m.icon;

  return (
    <div className="space-y-3">
      <Segmented value={mode} onChange={setMode} options={[{ value: "mine", label: "Mine" }, { value: "favorites", label: "Favorites" }]} />
      {feed.error && feed.items.length === 0 ? (
        <ErrorState description={feed.error} onRetry={feed.refresh} />
      ) : feed.loading ? (
        kind === "images" ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="aspect-[3/4] w-full" />)}</div>
        ) : (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full !rounded-2xl" />)}</div>
        )
      ) : feed.items.length === 0 ? (
        <EmptyState icon={<Icon className="h-8 w-8" />} title={mode === "mine" ? `No ${m.noun} yet` : `No favorite ${m.noun}`} description={mode === "mine" ? `Everything you make in ${m.noun === "images" ? "Gallery" : m.noun[0].toUpperCase() + m.noun.slice(1)} shows up here.` : `Favorite ${m.noun} from the feed to keep them close.`} action={<Button href={m.create} variant="secondary">Open {m.noun === "images" ? "Gallery" : m.noun[0].toUpperCase() + m.noun.slice(1)}</Button>} />
      ) : kind === "images" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {(feed.items as ImageItem[]).map((it) => (
            <div key={it.id} className="card card-hover group relative overflow-hidden">
              <Link href={`${m.route}/${it.id}`} className="block focus-ring">
                <div className={`relative w-full bg-surface-2 ${it.orientation === "landscape" ? "aspect-[4/3]" : it.orientation === "square" ? "aspect-square" : "aspect-[3/4]"}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={it.url} alt={it.title || "Generated image"} className={`h-full w-full object-cover ${blur ? "blur-nsfw group-hover:filter-none" : ""}`} loading="lazy" />
                  <div className="absolute left-2 top-2"><StatusPill status={it.status} visibility={it.visibility} /></div>
                </div>
                <div className="p-2">
                  <p className="truncate text-xs text-fg">{it.title || "Untitled"}</p>
                  <p className="text-[11px] text-muted">{timeAgo(it.createdAt)}</p>
                </div>
              </Link>
              <div className="absolute right-2 top-2"><AddToCollectionButton targetType="IMAGE" targetId={it.id} iconOnly className="h-8 w-8 rounded-lg bg-black/50" variant="ghost" /></div>
            </div>
          ))}
        </div>
      ) : (
        <ul className="space-y-2">
          {feed.items.map((it) => {
            const comic = "coverUrl" in it ? (it as ComicItem) : null;
            const story = "wordCount" in it ? (it as StoryItem) : null;
            return (
              <li key={it.id} className="card card-hover fade-up flex gap-3 p-3">
                <Link href={`${m.route}/${it.id}`} className="flex min-w-0 flex-1 gap-3 focus-ring rounded-xl">
                  {comic && (
                    <div className="h-20 w-14 shrink-0 overflow-hidden rounded-lg bg-surface-2">
                      {comic.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={comic.coverUrl} alt="" className={`h-full w-full object-cover ${blur ? "blur-nsfw" : ""}`} loading="lazy" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-muted"><Layers className="h-5 w-5" /></div>
                      )}
                    </div>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2"><span className="truncate font-display text-base leading-tight text-fg">{it.title || "Untitled"}</span><StatusPill status={it.status} visibility={it.visibility} /></span>
                    {story && story.summary && <span className="mt-0.5 line-clamp-2 text-xs text-fg-2">{story.summary}</span>}
                    <span className="mt-1 block text-[11px] text-muted">{comic ? `${comic.pageCount} page${comic.pageCount === 1 ? "" : "s"}` : `${story?.wordCount ?? 0} words`} · updated {timeAgo("updatedAt" in it ? it.updatedAt : it.createdAt)}</span>
                  </span>
                </Link>
                <AddToCollectionButton targetType={m.target} targetId={it.id} iconOnly className="h-8 w-8 shrink-0 rounded-lg" variant="ghost" />
              </li>
            );
          })}
        </ul>
      )}
      <FeedSentinel onVisible={feed.loadMore} loading={feed.loadingMore} done={feed.done} />
    </div>
  );
}
