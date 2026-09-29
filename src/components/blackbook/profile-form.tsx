"use client";
import * as React from "react";
import { Upload } from "lucide-react";
import { Avatar, Button, ErrorState, Field, Input, Skeleton, Textarea, Toggle, useToast } from "@/components/ui";
import { THEMES } from "@/lib/constants";
import type { MeDto } from "@/lib/blackbook";
import type { NotificationPrefs, UserPrefs } from "@/lib/types";
import { api, ApiClientError } from "@/lib/offline/client";
import { ChipPicker } from "@/components/create/editor-fields";
import { useResource } from "./use-resource";

type Me = { user: MeDto; prefs: UserPrefs; notificationPrefs: NotificationPrefs };

export function ProfileForm() {
  const { data, loading, error, reload } = useResource<Me>("/api/me");
  if (loading) return <div className="space-y-4" aria-busy="true">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-44 w-full !rounded-2xl" />)}</div>;
  if (error || !data) return <ErrorState description={error ?? undefined} onRetry={reload} />;
  return <Loaded me={data} />;
}

function Loaded({ me }: { me: Me }) {
  const toast = useToast();
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = React.useState(me.user.displayName);
  const [bio, setBio] = React.useState(me.user.bio);
  const [avatarMediaId, setAvatarMediaId] = React.useState(me.user.avatarMediaId);
  const [prefs, setPrefs] = React.useState(me.prefs);
  const [saving, setSaving] = React.useState<string | null>(null);
  const [fieldError, setFieldError] = React.useState<{ field?: string; message: string } | null>(null);
  const [uploading, setUploading] = React.useState(false);

  const fail = (err: unknown) => {
    const body = err instanceof ApiClientError ? (err.body as { field?: string } | null) : null;
    setFieldError({ field: body?.field, message: err instanceof Error ? err.message : "Could not save" });
    toast.push(err instanceof Error ? err.message : "Could not save", "error");
  };
  async function saveProfile() {
    setSaving("profile");
    setFieldError(null);
    try {
      await api("/api/me", { method: "PUT", json: { displayName, bio, avatarMediaId } });
      toast.push("Profile saved", "success");
    } catch (err) {
      fail(err);
    } finally {
      setSaving(null);
    }
  }
  async function savePrefs(patch: Partial<UserPrefs>, label: string) {
    setSaving(label);
    setFieldError(null);
    try {
      const res = await api<{ prefs: UserPrefs }>("/api/me/prefs", { method: "PUT", json: patch });
      setPrefs(res.prefs);
      toast.push("Saved", "success");
    } catch (err) {
      fail(err);
    } finally {
      setSaving(null);
    }
  }
  async function upload(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api<{ mediaId: string }>("/api/uploads", { method: "POST", body: fd });
      setAvatarMediaId(res.mediaId);
      await api("/api/me", { method: "PUT", json: { avatarMediaId: res.mediaId } });
      toast.push("Photo updated", "success");
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Upload failed", "error");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }
  const err = (f: string) => (fieldError?.field === f ? fieldError.message : undefined);

  return (
    <div className="space-y-4">
      <section className="card space-y-4 p-4">
        <h2 className="text-lg">Profile</h2>
        <div className="flex items-center gap-4">
          <Avatar name={displayName || "?"} seed={me.user.id} src={avatarMediaId ? `/api/media/${avatarMediaId}` : null} size={80} rounded="rounded-full" />
          <div className="space-y-1">
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" aria-label="Upload profile photo" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            <Button variant="secondary" size="sm" loading={uploading} onClick={() => fileRef.current?.click()}>
              <Upload className="h-3.5 w-3.5" /> Change photo
            </Button>
            <p className="text-xs text-muted">PNG, JPEG, WebP or SVG up to 4MB. Shown on your public profile.</p>
          </div>
        </div>
        <Field label="Display name" required error={err("displayName")}>
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={40} />
        </Field>
        <Field label="Bio" hint="Stored encrypted; shown only if your profile is public." error={err("bio")}>
          <Textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={600} placeholder="A line or two about what you like to write." />
        </Field>
        <Button onClick={saveProfile} loading={saving === "profile"} disabled={displayName.trim().length < 2}>Save profile</Button>
      </section>

      <section className="card space-y-4 p-4">
        <h2 className="text-lg">Content preferences</h2>
        <div className="space-y-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted">Maximum intensity</span>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Maximum intensity">
            {[1, 2, 3].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={prefs.maxIntensity === n} onClick={() => setPrefs((p) => ({ ...p, maxIntensity: n }))} className={`rounded-xl border p-2.5 text-xs transition focus-ring ${prefs.maxIntensity === n ? "border-accent/50 bg-accent-soft text-fg" : "border-line bg-surface-2 text-muted hover:border-line-2"}`}>
                {n === 1 ? "Suggestive" : n === 2 ? "Explicit" : "Intense"}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted">Characters and content above this level are hidden, and chats are capped here.</p>
        </div>
        <Toggle checked={prefs.blurNsfw} onChange={(v) => setPrefs((p) => ({ ...p, blurNsfw: v }))} label="Blur explicit artwork" description="Tap to reveal images on cards and in the gallery." />
        <Toggle checked={prefs.spoilerCovers} onChange={(v) => setPrefs((p) => ({ ...p, spoilerCovers: v }))} label="Spoiler covers on comics and stories" />
        <ChipPicker label="Preferred themes" options={THEMES} value={prefs.preferredThemes} onChange={(v) => setPrefs((p) => ({ ...p, preferredThemes: v }))} max={15} hint="Nudges recommendations toward these." />
        <ChipPicker label="Excluded themes" options={THEMES} value={prefs.excludedThemes} onChange={(v) => setPrefs((p) => ({ ...p, excludedThemes: v }))} allowCustom max={30} hint="Never shown to you." error={err("excludedThemes")} />
        <Field label="Hard limits" hint="Encrypted. Added to every chat as things the character must never include." error={err("hardLimits")}>
          <Textarea value={prefs.hardLimits} onChange={(e) => setPrefs((p) => ({ ...p, hardLimits: e.target.value }))} maxLength={1000} placeholder="e.g. degradation, blood, cheating plots" />
        </Field>
        <Button onClick={() => savePrefs({ maxIntensity: prefs.maxIntensity, blurNsfw: prefs.blurNsfw, spoilerCovers: prefs.spoilerCovers, preferredThemes: prefs.preferredThemes, excludedThemes: prefs.excludedThemes, hardLimits: prefs.hardLimits }, "content")} loading={saving === "content"}>Save preferences</Button>
      </section>

      <section className="card space-y-2 p-4">
        <h2 className="text-lg">Privacy</h2>
        <Toggle checked={prefs.showPublicProfile} onChange={(v) => setPrefs((p) => ({ ...p, showPublicProfile: v }))} label="Public profile" description="Let others open your creator page." />
        <Toggle checked={prefs.allowFollows} onChange={(v) => setPrefs((p) => ({ ...p, allowFollows: v }))} label="Allow follows" />
        <Toggle checked={prefs.discoverableCreations} onChange={(v) => setPrefs((p) => ({ ...p, discoverableCreations: v }))} label="Discoverable creations" description="Show your published work in Explore and feeds." />
        <div className="pt-2">
          <Button onClick={() => savePrefs({ showPublicProfile: prefs.showPublicProfile, allowFollows: prefs.allowFollows, discoverableCreations: prefs.discoverableCreations }, "privacy")} loading={saving === "privacy"}>Save privacy</Button>
        </div>
      </section>
    </div>
  );
}
