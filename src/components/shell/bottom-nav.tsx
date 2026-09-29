"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Dices, PenSquare, BookHeart } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/encounter", label: "Encounter", icon: Dices },
  { href: "/create", label: "Create", icon: PenSquare },
  { href: "/blackbook", label: "Blackbook", icon: BookHeart },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="glass fixed inset-x-0 bottom-0 z-40 border-t border-line pb-[var(--safe-bottom)]" aria-label="Primary">
      <ul className="mx-auto flex max-w-3xl items-stretch justify-around">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <li key={href} className="flex-1">
              <Link href={href} aria-current={active ? "page" : undefined} className={cn("flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors focus-ring", active ? "text-accent-2" : "text-muted hover:text-fg-2")}>
                <span className={cn("flex h-7 w-11 items-center justify-center rounded-full transition", active && "bg-accent-soft")}>
                  <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
