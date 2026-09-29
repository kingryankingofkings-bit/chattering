import Link from "next/link";
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-10">
        <Link href="/" className="mb-8 self-center font-display text-4xl tracking-tight">
          Chatter<span className="text-accent-2">ing</span>
        </Link>
        {children}
        <p className="mt-8 text-center text-[11px] leading-relaxed text-muted">
          Adults only (18+). Every character is fictional. By continuing you agree to the{" "}
          <Link href="/legal/terms" className="underline">Terms</Link>, <Link href="/legal/privacy" className="underline">Privacy Policy</Link>,{" "}
          <Link href="/legal/guidelines" className="underline">Community Guidelines</Link> and <Link href="/legal/content-policy" className="underline">Content Policy</Link>.
        </p>
      </div>
    </div>
  );
}
