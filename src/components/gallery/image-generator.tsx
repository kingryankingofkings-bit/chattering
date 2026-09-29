"use client";
import * as React from "react";
import { Dices, Globe, Layers, Sparkles, Trash2 } from "lucide-react";
import { Button, Chip, ErrorState, Field, Input, Select, Textarea, Toggle, useToast } from "@/components/ui";
import { CharacterPicker, IntensityPicker, TagInput, type PickableCharacterItem } from "@/components/content/pickers";
import { PublishDialog } from "@/components/content/publish-dialog";
import { ART_STYLES, ORIENTATION_OPTS, TAGS, THEMES } from "@/lib/constants";
import type { ImageDetail } from "@/lib/images";
import { api, ApiClientError } from "@/lib/offline/client";

export type RemixSeed = { id: string; prompt: string; negativePrompt: string; style: string; seed: number; orientation: string; characterId: string | null; intensity: number };
type Result = { id: string; url: string; published: boolean };

function randomSeed() {
  return Math.floor(Math.random() * 2147483646);
}

export function ImageGenerator({ characters, maxIntensity, displayName, remix }: { characters: PickableCharacterItem[]; maxIntensity: number; displayName: string; remix?: RemixSeed | null }) {
  const toast = useToast();
  const [prompt, setPrompt] = React.useState(remix?.prompt ?? "");
  const [negative, setNegative] = React.useState(remix?.negativePrompt ?? "");
  const [style, setStyle] = React.useState<string>(remix?.style && (ART_STYLES as readonly string[]).includes(remix.style) ? remix.style : "painterly");
  const [orientation, setOrientation] = React.useState<string>(remix?.orientation ?? "portrait");
  const [intensity, setIntensity] = React.useState(Math.min(remix?.intensity ?? 2, maxIntensity));
  const [characterId, setCharacterId] = React.useState<string[]>(remix?.characterId ? [remix.characterId] : []);
  const [seed, setSeed] = React.useState<string>(remix ? String(remix.seed) : "");
  const [count, setCount] = React.useState(remix ? 1 : 2);
  const [tags, setTags] = React.useState<string[]>([]);
  const [title, setTitle] = React.useState("");
  const [showDetails, setShowDetails] = React.useState(true);
  const [allowRemix, setAllowRemix] = React.useState(true);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [results, setResults] = React.useState<Result[]>([]);
  const [publishFor, setPublishFor] = React.useState<Result | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  async function generate() {
    setError(null);
    setLoading(true);
    try {
      const res = await api<{ items: { id: string; url: string }[] }>("/api/images/generate", {
        method: "POST",
        json: { prompt: prompt.trim(), negativePrompt: negative.trim() || undefined, style, orientation, intensity, characterId: characterId[0] ?? null, seed: seed.trim() ? Number(seed) : null, count, tags, title: title.trim() || undefined, parentImageId: remix?.id ?? null, showDetails, allowRemix },
      });
      setResults((r) => [...res.items.map((i) => ({ ...i, published: false })), ...r]);
      toast.push(`${res.items.length} image${res.items.length > 1 ? "s" : ""} generated — private until you publish.`, "success");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : err instanceof Error ? err.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  }
  async function variations(id: string) {
    setBusyId(id);
    try {
      const res = await api<{ items: { id: string; url: string }[] }>(`/api/images/${id}/variations`, { method: "POST", json: { count: 2 } });
      setResults((r) => [...res.items.map((i) => ({ ...i, published: false })), ...r]);
      toast.push("Variations added", "success");
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Could not generate variations", "error");
    } finally {
      setBusyId(null);
    }
  }
  async function remove(id: string) {
    setBusyId(id);
    try {
      await api(`/api/images/${id}`, { method: "DELETE" });
      setResults((r) => r.filter((x) => x.id !== id));
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Could not delete", "error");
    } finally {
      setBusyId(null);
    }
  }

  const seedNum = seed.trim() ? Number(seed) : null;
  const seedValid = seedNum === null || (Number.isInteger(seedNum) && seedNum >= 0 && seedNum <= 2147483646);

  return (
    <div className="space-y-5">
      {remix && (
        <p className="rounded-xl border border-gold/30 bg-gold-soft px-3 py-2 text-xs text-gold">Remixing an existing image. Its prompt, style and seed are pre-filled; the new image will link back to the original.</p>
      )}
      {error && <ErrorState title="Couldn't generate" description={error} onRetry={() => setError(null)} />}

      <div className="card space-y-4 p-4">
        <Field label="Prompt" required hint="Describe the subject, mood and setting. Adults only; no real people.">
          <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} maxLength={1500} placeholder="Vesper behind the bar, neon moth sign, rain on the window, cinematic" className="min-h-[110px]" />
        </Field>
        <Field label="Negative prompt (optional)" hint="What to avoid.">
          <Input value={negative} onChange={(e) => setNegative(e.target.value)} maxLength={600} placeholder="blurry, extra hands, text" />
        </Field>
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">Style</p>
          <div className="flex flex-wrap gap-1.5">
            {ART_STYLES.map((s) => (
              <Chip key={s} active={style === s} onClick={() => setStyle(s)}>{s}</Chip>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Orientation">
            <Select value={orientation} onChange={(e) => setOrientation(e.target.value)}>{ORIENTATION_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}</Select>
          </Field>
          <Field label="How many">
            <Select value={count} onChange={(e) => setCount(Number(e.target.value))}>{[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}</Select>
          </Field>
        </div>
        <Field label="Seed" hint="Same seed + same prompt = same image. Leave blank for random." error={seedValid ? undefined : "Seed must be a whole number between 0 and 2147483646"}>
          <div className="flex gap-2">
            <Input value={seed} onChange={(e) => setSeed(e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" placeholder="random" />
            <Button variant="secondary" onClick={() => setSeed(String(randomSeed()))} aria-label="Random seed"><Dices className="h-4 w-4" /></Button>
            {seed && <Button variant="ghost" onClick={() => setSeed("")}>Clear</Button>}
          </div>
        </Field>
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">Intensity</p>
          <IntensityPicker value={intensity} onChange={setIntensity} max={maxIntensity} />
          {maxIntensity < 3 && <p className="mt-1 text-xs text-muted">Capped by your content preferences.</p>}
        </div>
      </div>

      <div className="card space-y-4 p-4">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">Featured character (optional)</p>
          <CharacterPicker characters={characters} value={characterId} onChange={setCharacterId} single />
          <p className="text-xs text-muted">Their appearance is passed to the model so they look like themselves.</p>
        </div>
        <Field label="Title (optional)"><Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Shown on the card" /></Field>
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">Tags</p>
          <TagInput value={tags} onChange={setTags} suggestions={[...THEMES, ...TAGS, ...ART_STYLES]} />
        </div>
        <Toggle checked={showDetails} onChange={setShowDetails} label="Show generation details" description="Prompt, negative prompt, seed and model are visible to viewers once published." />
        <Toggle checked={allowRemix} onChange={setAllowRemix} label="Allow remixing" description="Others can start from your prompt and seed once published." />
      </div>

      <div className="glass sticky bottom-[calc(4.5rem+var(--safe-bottom))] z-10 rounded-2xl p-3">
        <Button className="w-full" size="lg" disabled={prompt.trim().length < 3 || !seedValid} loading={loading} onClick={generate}><Sparkles className="h-4 w-4" /> {loading ? "Generating…" : `Generate ${count > 1 ? `${count} images` : "image"}`}</Button>
        <p className="mt-2 text-center text-[11px] text-muted">Private until you publish each one.</p>
      </div>

      {(results.length > 0 || loading) && (
        <section className="space-y-2">
          <h2 className="text-lg">Results</h2>
          <div className="grid grid-cols-2 gap-3">
            {loading && Array.from({ length: count }).map((_, i) => <div key={`s${i}`} className="skeleton aspect-[3/4] w-full" />)}
            {results.map((r) => (
              <div key={r.id} className="card overflow-hidden">
                <a href={`/gallery/${r.id}`} className="block aspect-[3/4] w-full bg-surface-2 focus-ring">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.url} alt="" className="h-full w-full object-cover" />
                </a>
                <div className="flex flex-wrap gap-1 p-2">
                  <Button size="sm" variant={r.published ? "secondary" : "primary"} onClick={() => setPublishFor(r)}><Globe className="h-3.5 w-3.5" /> {r.published ? "Public" : "Publish"}</Button>
                  <Button size="sm" variant="secondary" loading={busyId === r.id} onClick={() => variations(r.id)} aria-label="Generate variations"><Layers className="h-3.5 w-3.5" /> Vary</Button>
                  <Button size="sm" variant="ghost" href={`/gallery/${r.id}`}>Open</Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(r.id)} disabled={busyId === r.id} aria-label="Delete image"><Trash2 className="h-3.5 w-3.5 text-danger" /></Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {publishFor && (
        <PublishDialog<ImageDetail>
          open
          onClose={() => setPublishFor(null)}
          kind="image"
          id={publishFor.id}
          title={title || "Untitled image"}
          displayName={displayName}
          published={publishFor.published}
          showDetails={showDetails}
          onDone={(d) => setResults((rs) => rs.map((x) => (x.id === d.id ? { ...x, published: d.status === "PUBLISHED" } : x)))}
        />
      )}
    </div>
  );
}
