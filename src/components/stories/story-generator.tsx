"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Dices, MessageSquareText, PenLine, Sparkles, Users } from "lucide-react";
import { Avatar, Button, Chip, ErrorState, Field, Input, Segmented, Select, Textarea, useToast } from "@/components/ui";
import { CharacterPicker, IntensityPicker, ProgressSteps, TagInput, type PickableCharacterItem } from "@/components/content/pickers";
import type { RecentChatItem } from "@/components/comics/comic-generator";
import { COMIC_TONES, ENDINGS, GENRES, POVS, STORY_LENGTHS, TAGS, TENSES, THEMES } from "@/lib/constants";
import { api, ApiClientError } from "@/lib/offline/client";
import { cn, timeAgo } from "@/lib/utils";

type Source = "prompt" | "characters" | "random" | "chat";
const STEPS = ["Outlining the story", "Writing the chapters", "Polishing the prose"];
const LENGTH_HINT: Record<string, string> = { flash: "~300 words", short: "~800 words", medium: "~1,500 words, 2 chapters", long: "~3,000 words, 3 chapters" };

export function StoryGenerator({ characters, chats, maxIntensity, initialCharacterId, initialChatId }: { characters: PickableCharacterItem[]; chats: RecentChatItem[]; maxIntensity: number; initialCharacterId?: string; initialChatId?: string }) {
  const router = useRouter();
  const toast = useToast();
  const [source, setSource] = React.useState<Source>(initialChatId ? "chat" : initialCharacterId ? "characters" : "prompt");
  const [prompt, setPrompt] = React.useState("");
  const [characterIds, setCharacterIds] = React.useState<string[]>(initialCharacterId ? [initialCharacterId] : []);
  const [chatId, setChatId] = React.useState(initialChatId ?? "");
  const [title, setTitle] = React.useState("");
  const [genre, setGenre] = React.useState<string>("romance");
  const [tone, setTone] = React.useState<string>("sensual");
  const [pov, setPov] = React.useState<string>("second");
  const [tense, setTense] = React.useState<string>("present");
  const [length, setLength] = React.useState<string>("short");
  const [intensity, setIntensity] = React.useState(Math.min(2, maxIntensity));
  const [endingType, setEndingType] = React.useState<string>("open");
  const [tags, setTags] = React.useState<string[]>([]);
  const [step, setStep] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const canSubmit = source === "random" || (source === "prompt" && prompt.trim().length > 3) || (source === "characters" && characterIds.length > 0) || (source === "chat" && !!chatId);

  async function generate() {
    setError(null);
    setStep(0);
    const t1 = setTimeout(() => setStep(1), 1200);
    try {
      const res = await api<{ id: string }>("/api/stories/generate", {
        method: "POST",
        json: { source, prompt: prompt.trim() || undefined, characterIds: characterIds.length ? characterIds : undefined, chatId: chatId || undefined, title: title.trim() || undefined, genre, tone, pov, tense, length, intensity, endingType, tags },
      });
      clearTimeout(t1);
      setStep(2);
      toast.push("Your story is ready. It's private until you publish it.", "success");
      router.push(`/stories/${res.id}`);
    } catch (err) {
      clearTimeout(t1);
      setError(err instanceof ApiClientError ? err.message : err instanceof Error ? err.message : "Generation failed");
    }
  }

  if (step !== null && !error) {
    return (
      <div className="card fade-up space-y-5 p-5">
        <div>
          <h2 className="text-xl">Writing your story</h2>
          <p className="text-xs text-muted">{genre} · {tone} · {LENGTH_HINT[length]}</p>
        </div>
        <ProgressSteps steps={STEPS} active={step} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {error && <ErrorState title="Couldn't generate" description={error} onRetry={() => { setError(null); setStep(null); }} />}

      <Segmented
        value={source}
        onChange={setSource}
        className="w-full"
        options={[
          { value: "prompt", label: <span className="inline-flex items-center gap-1"><PenLine className="h-3.5 w-3.5" /> Prompt</span> },
          { value: "characters", label: <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> Characters</span> },
          { value: "chat", label: <span className="inline-flex items-center gap-1"><MessageSquareText className="h-3.5 w-3.5" /> From chat</span> },
          { value: "random", label: <span className="inline-flex items-center gap-1"><Dices className="h-3.5 w-3.5" /> Surprise me</span> },
        ]}
      />

      <div className="card space-y-4 p-4">
        {source === "random" && <p className="text-sm text-fg-2">We&apos;ll pick a premise for you. Feature characters below to make it theirs.</p>}
        {(source === "prompt" || source === "characters") && (
          <Field label={source === "prompt" ? "Premise" : "Premise (optional)"} required={source === "prompt"} hint="What happens, where, and how it should feel. Every character must be an adult.">
            <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} maxLength={3000} placeholder="Snowed in at a mountain estate, a guest finds the host has been leaving books on their pillow." className="min-h-[120px]" />
          </Field>
        )}
        {source === "chat" && (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted">Pick a chat</p>
            {chats.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line p-3 text-sm text-muted">No chats yet. Start one from Explore first.</p>
            ) : (
              <ul className="max-h-60 space-y-1.5 overflow-y-auto pr-1" role="listbox">
                {chats.map((c) => (
                  <li key={c.id}>
                    <button type="button" role="option" aria-selected={chatId === c.id} onClick={() => setChatId(c.id)} className={cn("flex w-full items-center gap-2 rounded-xl border p-2 text-left transition focus-ring", chatId === c.id ? "border-accent bg-accent-soft" : "border-line bg-surface-2 hover:border-line-2")}>
                      <Avatar name={c.character.name} seed={c.character.avatarSeed} src={c.character.avatarUrl} size={34} rounded="rounded-lg" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-fg">{c.title}</span>
                        <span className="block text-[11px] text-muted">{c.messageCount} messages · {timeAgo(c.lastMessageAt)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-muted">The recent conversation becomes the premise, and the character&apos;s memory of you carries over.</p>
          </div>
        )}
        {source !== "chat" && (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted">Featured characters {source === "characters" ? "" : "(optional)"}</p>
            <CharacterPicker characters={characters} value={characterIds} onChange={setCharacterIds} max={3} />
          </div>
        )}
      </div>

      <div className="card space-y-4 p-4">
        <Field label="Title (optional)"><Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Leave blank to let the story name itself" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Genre">
            <Select value={genre} onChange={(e) => setGenre(e.target.value)}>{GENRES.map((g) => <option key={g} value={g}>{g}</option>)}</Select>
          </Field>
          <Field label="Tone">
            <Select value={tone} onChange={(e) => setTone(e.target.value)}>{[...COMIC_TONES, "tender", "slow burn", "witty"].map((t) => <option key={t} value={t}>{t}</option>)}</Select>
          </Field>
          <Field label="Point of view">
            <Select value={pov} onChange={(e) => setPov(e.target.value)}>{POVS.map((p) => <option key={p} value={p}>{p} person</option>)}</Select>
          </Field>
          <Field label="Tense">
            <Select value={tense} onChange={(e) => setTense(e.target.value)}>{TENSES.map((t) => <option key={t} value={t}>{t}</option>)}</Select>
          </Field>
          <Field label="Length" hint={LENGTH_HINT[length]}>
            <Select value={length} onChange={(e) => setLength(e.target.value)}>{STORY_LENGTHS.map((l) => <option key={l} value={l}>{l}</option>)}</Select>
          </Field>
          <Field label="Ending">
            <Select value={endingType} onChange={(e) => setEndingType(e.target.value)}>{ENDINGS.map((e) => <option key={e} value={e}>{e}</option>)}</Select>
          </Field>
        </div>
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">Intensity</p>
          <IntensityPicker value={intensity} onChange={setIntensity} max={maxIntensity} />
          {maxIntensity < 3 && <p className="mt-1 text-xs text-muted">Capped by your content preferences.</p>}
        </div>
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">Tags</p>
          <TagInput value={tags} onChange={setTags} suggestions={[...THEMES, ...TAGS]} />
        </div>
        <div className="flex flex-wrap gap-1"><Chip size="sm" tone="gold">Private draft</Chip><span className="text-[11px] text-muted">Nothing is public until you publish it.</span></div>
      </div>

      <div className="glass sticky bottom-[calc(4.5rem+var(--safe-bottom))] rounded-2xl p-3">
        <Button className="w-full" size="lg" disabled={!canSubmit} onClick={generate}><Sparkles className="h-4 w-4" /> Write the story</Button>
      </div>
    </div>
  );
}
