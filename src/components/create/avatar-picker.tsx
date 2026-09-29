"use client";
import * as React from "react";
import { Shuffle, Sparkles, Trash2, Upload } from "lucide-react";
import { Avatar, Button, Field, Select, Sheet, Textarea, useToast } from "@/components/ui";
import { ART_STYLES } from "@/lib/constants";
import { api } from "@/lib/offline/client";

/** Upload or generate an avatar. Emits the private mediaId; publishing flips it public server-side. */
export function AvatarPicker({ name, seed, mediaId, appearance, onChange, onShuffle }: { name: string; seed: string; mediaId: string | null; appearance: string; onChange: (mediaId: string | null) => void; onShuffle: () => void }) {
  const toast = useToast();
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [genOpen, setGenOpen] = React.useState(false);
  const [prompt, setPrompt] = React.useState("");
  const [style, setStyle] = React.useState<string>("painterly");
  const [generating, setGenerating] = React.useState(false);

  async function upload(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api<{ mediaId: string; url: string }>("/api/uploads", { method: "POST", body: fd });
      onChange(res.mediaId);
      toast.push("Avatar uploaded", "success");
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Upload failed", "error");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function generate() {
    setGenerating(true);
    try {
      const res = await api<{ mediaId: string; url: string }>("/api/characters/avatar", { method: "POST", json: { prompt: prompt.trim() || appearance || name, style } });
      onChange(res.mediaId);
      setGenOpen(false);
      toast.push("Avatar generated", "success");
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Generation failed", "error");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <Avatar name={name || "?"} seed={seed} src={mediaId ? `/api/media/${mediaId}` : null} size={144} className="mx-auto sm:mx-0" />
      <div className="flex-1 space-y-2">
        <p className="text-xs text-muted">Upload a PNG, JPEG, WebP or SVG up to 4MB, or generate a portrait from the appearance you describe. Fictional adults only.</p>
        <div className="flex flex-wrap gap-2">
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} aria-label="Upload avatar image" />
          <Button type="button" variant="secondary" size="sm" loading={uploading} onClick={() => fileRef.current?.click()}>
            <Upload className="h-3.5 w-3.5" /> Upload
          </Button>
          <Button type="button" variant="gold" size="sm" onClick={() => { setPrompt(appearance); setGenOpen(true); }}>
            <Sparkles className="h-3.5 w-3.5" /> Generate
          </Button>
          {!mediaId && (
            <Button type="button" variant="ghost" size="sm" onClick={onShuffle}>
              <Shuffle className="h-3.5 w-3.5" /> Shuffle look
            </Button>
          )}
          {mediaId && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
              <Trash2 className="h-3.5 w-3.5" /> Remove
            </Button>
          )}
        </div>
      </div>
      <Sheet open={genOpen} onClose={() => setGenOpen(false)} title="Generate avatar">
        <div className="space-y-4">
          <Field label="Describe the look" hint="Adult, fictional. Hair, eyes, outfit, mood, lighting.">
            <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} maxLength={1000} placeholder="Silver-haired bartender in a velvet vest, amused smirk, neon reflections" />
          </Field>
          <Field label="Style">
            <Select value={style} onChange={(e) => setStyle(e.target.value)}>
              {ART_STYLES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
          </Field>
          <Button className="w-full" loading={generating} onClick={generate} disabled={prompt.trim().length < 3 && !(appearance || name)}>
            <Sparkles className="h-4 w-4" /> Generate portrait
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
