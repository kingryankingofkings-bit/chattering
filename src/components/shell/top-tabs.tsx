"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Images, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/comics", label: "Comics", icon: Layers },
  { href: "/stories", label: "Stories", icon: BookOpen },
  { href: "/gallery", label: "Gallery", icon: Images },
] as const;

export function TopTabs() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1 rounded-full bg-surface-2/70 p-1" aria-label="Content">
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn("flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition focus-ring", active ? "bg-accent text-white" : "text-fg-2 hover:text-fg")}>
            <Icon className="h-3.5 w-3.5" />
            <span className={cn(!active && "sr-only sm:not-sr-only")}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
