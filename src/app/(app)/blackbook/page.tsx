import Link from "next/link";
import { BookHeart, Bell, ChevronRight, CreditCard, Dices, EyeOff, FolderHeart, Heart, History, Images, KeyRound, Layers, PenSquare, ShieldOff, BookOpen, UserRound, Users, UsersRound } from "lucide-react";
import { Avatar } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { cardInclude, canView, toCard, viewerMarks } from "@/lib/characters";
import { toMe } from "@/lib/blackbook";
import { PinnedRow, SignOutButton } from "@/components/blackbook/hub";

export const dynamic = "force-dynamic";

export default async function BlackbookPage() {
  const user = (await getCurrentUser())!;
  const me = toMe(user);
  const uid = user.id;
  const [favorites, chats, created, encounters, following, followers, comics, stories, images, collections, personas, blocked, hidden, pinnedRows] = await Promise.all([
    prisma.favorite.count({ where: { userId: uid } }),
    prisma.chat.count({ where: { userId: uid, isPreview: false, archived: false } }),
    prisma.character.count({ where: { ownerId: uid } }),
    prisma.savedEncounter.count({ where: { userId: uid } }),
    prisma.follow.count({ where: { followerId: uid } }),
    prisma.follow.count({ where: { creatorId: uid } }),
    prisma.comic.count({ where: { authorId: uid } }),
    prisma.story.count({ where: { authorId: uid } }),
    prisma.generatedImage.count({ where: { ownerId: uid } }),
    prisma.collection.count({ where: { userId: uid } }),
    prisma.persona.count({ where: { userId: uid } }),
    prisma.block.count({ where: { userId: uid } }),
    prisma.hiddenTag.count({ where: { userId: uid } }),
    prisma.pinnedCharacter.findMany({ where: { userId: uid }, orderBy: { position: "asc" }, include: { character: { include: cardInclude } } }),
  ]);
  const visiblePinned = pinnedRows.filter((r) => canView(r.character, uid));
  const marks = await viewerMarks(uid, visiblePinned.map((r) => r.characterId));
  const pinned = visiblePinned.map((r) => toCard(r.character, { id: uid, ...marks }));

  const groups: { title: string; links: { href: string; label: string; icon: React.ComponentType<{ className?: string }>; count?: number }[] }[] = [
    {
      title: "Library",
      links: [
        { href: "/blackbook/favorites", label: "Favorites", icon: Heart, count: favorites },
        { href: "/blackbook/recent", label: "Recent chats", icon: History, count: chats },
        { href: "/blackbook/created", label: "Created characters", icon: PenSquare, count: created },
        { href: "/blackbook/encounters", label: "Saved encounters", icon: Dices, count: encounters },
        { href: "/blackbook/collections", label: "Collections", icon: FolderHeart, count: collections },
      ],
    },
    {
      title: "Creations",
      links: [
        { href: "/blackbook/comics", label: "Comics", icon: Layers, count: comics },
        { href: "/blackbook/stories", label: "Stories", icon: BookOpen, count: stories },
        { href: "/blackbook/images", label: "Images", icon: Images, count: images },
      ],
    },
    {
      title: "People",
      links: [
        { href: "/blackbook/following", label: "Following", icon: Users, count: following },
        { href: "/blackbook/personas", label: "Personas", icon: UserRound, count: personas },
        { href: "/blackbook/blocked", label: "Blocked", icon: ShieldOff, count: blocked },
        { href: "/blackbook/hidden-tags", label: "Hidden tags", icon: EyeOff, count: hidden },
      ],
    },
    {
      title: "Settings",
      links: [
        { href: "/blackbook/profile", label: "Profile & preferences", icon: BookHeart },
        { href: "/blackbook/notifications", label: "Notifications", icon: Bell },
        { href: "/blackbook/subscription", label: "Subscription", icon: CreditCard },
        { href: "/blackbook/account", label: "Account & data", icon: KeyRound },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <Link href="/blackbook/profile" className="card card-hover flex items-center gap-4 p-4 focus-ring">
        <Avatar name={me.displayName} seed={me.id} src={me.avatarUrl} size={64} rounded="rounded-full" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl leading-tight">{me.displayName}</h1>
          {me.bio ? <p className="line-clamp-2 text-xs text-fg-2">{me.bio}</p> : <p className="text-xs text-muted">Add a bio</p>}
          <p className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-muted">
            <span><span className="text-fg">{created}</span> characters</span>
            <span><span className="text-fg">{followers}</span> followers</span>
            <span><span className="text-fg">{following}</span> following</span>
            {me.subscriptionTier === "PLUS" && <span className="text-gold">Plus</span>}
          </p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />
      </Link>

      <PinnedRow initial={pinned} />

      {groups.map((g) => (
        <section key={g.title} className="space-y-2">
          <h2 className="px-1 text-xs font-medium uppercase tracking-wider text-muted">{g.title}</h2>
          <ul className="card divide-y divide-line overflow-hidden">
            {g.links.map(({ href, label, icon: Icon, count }) => (
              <li key={href}>
                <Link href={href} className="flex items-center gap-3 px-4 py-3 text-sm transition hover:bg-surface-2 focus-ring">
                  <Icon className="h-4 w-4 shrink-0 text-accent-2" aria-hidden />
                  <span className="flex-1 text-fg">{label}</span>
                  {count !== undefined && <span className="text-xs text-muted">{count}</span>}
                  <ChevronRight className="h-4 w-4 text-muted" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <div className="flex items-center gap-2 text-xs text-muted"><UsersRound className="h-3.5 w-3.5" aria-hidden /> Member since {new Date(me.createdAt).toLocaleDateString()}</div>
      <SignOutButton />
    </div>
  );
}
