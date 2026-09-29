import Link from "next/link";
import { TopTabs } from "./top-tabs";
import { Avatar } from "@/components/ui";

export function AppHeader({ user }: { user: { displayName: string; id: string; avatarMediaId: string | null } }) {
  return (
    <header className="glass sticky top-0 z-30 border-b border-line pt-[var(--safe-top)]">
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-4">
        <Link href="/explore" className="font-display text-xl tracking-tight text-fg focus-ring rounded">
          Chatter<span className="text-accent-2">ing</span>
        </Link>
        <TopTabs />
        <Link href="/blackbook" aria-label="Your Blackbook" className="focus-ring rounded-full">
          <Avatar name={user.displayName} seed={user.id} src={user.avatarMediaId ? `/api/media/${user.avatarMediaId}` : null} size={32} rounded="rounded-full" />
        </Link>
      </div>
    </header>
  );
}
