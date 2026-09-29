"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Field, Input } from "@/components/ui";
import { api, ApiClientError } from "@/lib/offline/client";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const params = useSearchParams();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [confirm18, setConfirm18] = React.useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const payload = Object.fromEntries(fd.entries());
    if (mode === "signup" && !confirm18) return setError("You must confirm you are 18 or older.");
    setLoading(true);
    try {
      await api(`/api/auth/${mode}`, { method: "POST", json: payload });
      router.replace(mode === "signup" ? "/age-gate" : params.get("next") || "/explore");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-4 p-6">
      <div>
        <h1 className="text-2xl">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
        <p className="mt-1 text-sm text-muted">{mode === "login" ? "Your chats, characters and collections are waiting." : "Private by default. Adults only."}</p>
      </div>
      {mode === "signup" && (
        <Field label="Display name" required>
          <Input name="displayName" required minLength={2} maxLength={32} autoComplete="nickname" placeholder="What should we call you?" />
        </Field>
      )}
      <Field label="Email" required>
        <Input name="email" type="email" required autoComplete="email" placeholder="you@example.com" />
      </Field>
      <Field label="Password" required hint={mode === "signup" ? "At least 10 characters." : undefined}>
        <Input name="password" type="password" required minLength={mode === "signup" ? 10 : 1} autoComplete={mode === "signup" ? "new-password" : "current-password"} placeholder="••••••••••" />
      </Field>
      {mode === "signup" && (
        <label className="flex items-start gap-3 text-sm text-fg-2">
          <input type="checkbox" checked={confirm18} onChange={(e) => setConfirm18(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]" />
          <span>I confirm I am at least 18 years old and it is legal for me to view adult content where I live.</span>
        </label>
      )}
      {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{error}</p>}
      <Button type="submit" size="lg" className="w-full" loading={loading}>
        {mode === "login" ? "Sign in" : "Create account"}
      </Button>
      <p className="text-center text-sm text-muted">
        {mode === "login" ? (
          <>No account? <Link href="/signup" className="text-accent-2 underline">Sign up</Link></>
        ) : (
          <>Already a member? <Link href="/login" className="text-accent-2 underline">Sign in</Link></>
        )}
      </p>
    </form>
  );
}
