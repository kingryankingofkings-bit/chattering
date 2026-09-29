import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/** Sub-page frame: back link + title. Server-safe. */
export function BlackbookPage({ title, subtitle, action, children, back = "/blackbook", backLabel = "Blackbook" }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode; back?: string; backLabel?: string }) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Link href={back} className="inline-flex items-center gap-1 rounded text-xs text-muted hover:text-fg focus-ring">
          <ArrowLeft className="h-3.5 w-3.5" /> {backLabel}
        </Link>
        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl leading-tight">{title}</h1>
            {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
          </div>
          {action}
        </div>
      </div>
      {children}
    </div>
  );
}
