"use client";
import * as React from "react";
import Link from "next/link";
import { Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

/* ---------- Button ---------- */
type Variant = "primary" | "secondary" | "ghost" | "danger" | "gold" | "outline";
type Size = "sm" | "md" | "lg" | "icon";
const variants: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-2 shadow-[0_8px_24px_-10px_rgba(226,58,111,.7)]",
  secondary: "bg-surface-2 text-fg hover:bg-surface-3 border border-line",
  ghost: "bg-transparent text-fg-2 hover:bg-surface-2 hover:text-fg",
  danger: "bg-danger/15 text-danger hover:bg-danger/25 border border-danger/30",
  gold: "bg-gold-soft text-gold hover:bg-gold/25 border border-gold/30",
  outline: "bg-transparent border border-line-2 text-fg hover:bg-surface-2",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs rounded-lg gap-1.5",
  md: "h-10 px-4 text-sm rounded-xl gap-2",
  lg: "h-12 px-6 text-base rounded-2xl gap-2",
  icon: "h-10 w-10 rounded-xl",
};
export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  href?: string;
};
export function Button({ variant = "primary", size = "md", loading, className, children, href, disabled, ...rest }: ButtonProps) {
  const cls = cn(
    "inline-flex items-center justify-center font-medium select-none whitespace-nowrap transition-colors focus-ring disabled:opacity-50 disabled:pointer-events-none",
    variants[variant],
    sizes[size],
    className,
  );
  if (href) {
    return (
      <Link href={href} className={cls} aria-disabled={disabled}>
        {children}
      </Link>
    );
  }
  return (
    <button className={cls} disabled={disabled || loading} {...rest}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

/* ---------- Inputs ---------- */
const fieldBase =
  "w-full rounded-xl bg-surface-2 border border-line px-3.5 py-2.5 text-sm text-fg placeholder:text-muted focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/25 transition";

export function Input({ className, ...rest }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldBase, className)} {...rest} />;
}
export function Textarea({ className, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldBase, "min-h-[96px] resize-y leading-relaxed", className)} {...rest} />;
}
export function Select({ className, children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(fieldBase, "appearance-none pr-9 bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%239b8cab%22 stroke-width=%222%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-no-repeat bg-[right_0.75rem_center]", className)} {...rest}>
      {children}
    </select>
  );
}
export function Field({ label, hint, children, error, required }: { label: string; hint?: string; children: React.ReactNode; error?: string; required?: boolean }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium uppercase tracking-wider text-muted">
        {label}
        {required && <span className="text-accent-2"> *</span>}
      </span>
      {children}
      {hint && !error && <span className="block text-xs text-muted">{hint}</span>}
      {error && <span className="block text-xs text-danger">{error}</span>}
    </label>
  );
}
export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-4 rounded-xl px-1 py-2 text-left focus-ring">
      <span>
        <span className="block text-sm text-fg">{label}</span>
        {description && <span className="block text-xs text-muted">{description}</span>}
      </span>
      <span className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", checked ? "bg-accent" : "bg-surface-3 border border-line-2")}>
        <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", checked ? "translate-x-5" : "translate-x-0.5")} />
      </span>
    </button>
  );
}

/* ---------- Chips ---------- */
export function Chip({ active, children, onClick, className, size = "md", tone = "default" }: { active?: boolean; children: React.ReactNode; onClick?: () => void; className?: string; size?: "sm" | "md"; tone?: "default" | "gold" | "accent" }) {
  const base = size === "sm" ? "h-6 px-2 text-[11px]" : "h-8 px-3 text-xs";
  const tones = {
    default: active ? "bg-accent text-white border-accent" : "bg-surface-2 text-fg-2 border-line hover:border-line-2",
    gold: active ? "bg-gold text-bg border-gold" : "bg-gold-soft text-gold border-gold/30",
    accent: "bg-accent-soft text-accent-2 border-accent/30",
  };
  const Comp = onClick ? "button" : "span";
  return (
    <Comp type={onClick ? "button" : undefined} onClick={onClick} aria-pressed={onClick ? !!active : undefined} className={cn("inline-flex items-center gap-1 rounded-full border font-medium whitespace-nowrap transition focus-ring", base, tones[tone], className)}>
      {children}
    </Comp>
  );
}

export function IntensityBadge({ level, className }: { level: number; className?: string }) {
  const map: Record<number, [string, string]> = { 1: ["Suggestive", "bg-success/15 text-success border-success/30"], 2: ["Explicit", "bg-accent-soft text-accent-2 border-accent/30"], 3: ["Intense", "bg-danger/15 text-danger border-danger/30"] };
  const [label, cls] = map[level] ?? map[2];
  return <span className={cn("inline-flex h-5 items-center rounded-md border px-1.5 text-[10px] font-semibold uppercase tracking-wide", cls, className)}>{label}</span>;
}

/* ---------- Avatar ---------- */
export function Avatar({ name, seed, src, size = 48, className, rounded = "rounded-2xl" }: { name: string; seed?: string; src?: string | null; size?: number; className?: string; rounded?: string }) {
  const s = seed ?? name;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  const hue2 = (hue + 50) % 360;
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <div
      className={cn("relative shrink-0 overflow-hidden flex items-center justify-center font-display text-white/90", rounded, className)}
      style={{ width: size, height: size, background: `linear-gradient(135deg, hsl(${hue} 60% 38%), hsl(${hue2} 70% 22%))`, fontSize: size * 0.36 }}
      aria-hidden
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}

/* ---------- Layout bits ---------- */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden />;
}
export function EmptyState({ icon, title, description, action }: { icon?: React.ReactNode; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      {icon && <div className="text-accent-2 opacity-80">{icon}</div>}
      <h3 className="text-lg">{title}</h3>
      {description && <p className="max-w-sm text-sm text-muted">{description}</p>}
      {action}
    </div>
  );
}
export function ErrorState({ title = "Something went wrong", description, onRetry }: { title?: string; description?: string; onRetry?: () => void }) {
  return (
    <div className="card flex flex-col items-center gap-3 border-danger/30 px-6 py-10 text-center">
      <h3 className="text-lg text-danger">{title}</h3>
      {description && <p className="max-w-sm text-sm text-muted">{description}</p>}
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
export function SectionTitle({ title, action, subtitle }: { title: string; action?: React.ReactNode; subtitle?: string }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-xl leading-tight">{title}</h2>
        {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-5 w-5 animate-spin text-accent-2", className)} aria-label="Loading" />;
}

/* ---------- Sheet / Modal ---------- */
export function Sheet({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title?: string; children: React.ReactNode; wide?: boolean }) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-label="Close" onClick={onClose} />
      <div className={cn("glass fade-up relative max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl p-5 pb-[calc(1.25rem+var(--safe-bottom))] sm:rounded-3xl", wide ? "sm:max-w-2xl" : "sm:max-w-md")}>
        <div className="mb-4 flex items-center justify-between">
          {title ? <h2 className="text-lg">{title}</h2> : <span />}
          <button onClick={onClose} className="rounded-full p-1.5 text-muted hover:bg-surface-2 hover:text-fg focus-ring" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---------- Toast ---------- */
type Toast = { id: number; message: string; tone: "info" | "error" | "success" };
const ToastCtx = React.createContext<{ push: (message: string, tone?: Toast["tone"]) => void }>({ push: () => {} });
export function useToast() {
  return React.useContext(ToastCtx);
}
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const push = React.useCallback((message: string, tone: Toast["tone"] = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);
  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-[calc(0.75rem+var(--safe-top))] z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={cn("glass fade-up pointer-events-auto max-w-sm rounded-xl px-4 py-2.5 text-sm shadow-lg", t.tone === "error" && "border-danger/40 text-danger", t.tone === "success" && "border-success/40 text-success")}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------- Segmented tabs ---------- */
export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: React.ReactNode }[]; className?: string }) {
  return (
    <div className={cn("scrollbar-none flex gap-1 overflow-x-auto rounded-xl bg-surface-2 p-1", className)} role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={o.value === value} onClick={() => onChange(o.value)} className={cn("h-8 shrink-0 rounded-lg px-3 text-xs font-medium transition focus-ring", o.value === value ? "bg-surface-3 text-fg shadow" : "text-muted hover:text-fg-2")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Blur guard ---------- */
export function BlurGuard({ enabled, children, label = "Tap to reveal", className }: { enabled: boolean; children: React.ReactNode; label?: string; className?: string }) {
  const [revealed, setRevealed] = React.useState(false);
  if (!enabled) return <>{children}</>;
  return (
    <div className={cn("relative overflow-hidden", className)}>
      <div className={cn("blur-nsfw h-full w-full", revealed && "revealed")}>{children}</div>
      {!revealed && (
        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setRevealed(true); }} className="absolute inset-0 flex items-center justify-center bg-black/30 text-xs font-medium text-white focus-ring">
          <span className="rounded-full bg-black/60 px-3 py-1.5">{label}</span>
        </button>
      )}
    </div>
  );
}

export function Stars({ value, onChange, size = 16 }: { value: number; onChange?: (v: number) => void; size?: number }) {
  return (
    <div className="inline-flex items-center gap-0.5" role={onChange ? "radiogroup" : undefined} aria-label={`Rating ${value.toFixed(1)} of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" disabled={!onChange} onClick={() => onChange?.(n)} className={cn("focus-ring rounded", onChange && "hover:scale-110")} aria-label={`${n} star${n > 1 ? "s" : ""}`}>
          <svg width={size} height={size} viewBox="0 0 24 24" fill={n <= Math.round(value) ? "var(--color-gold)" : "none"} stroke="var(--color-gold)" strokeWidth="1.5">
            <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </button>
      ))}
    </div>
  );
}
