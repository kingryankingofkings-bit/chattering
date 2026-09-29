"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Dices, MessageSquareText, PenLine, Sparkles, Users } from "lucide-react";
import { Avatar, Button, Chip, ErrorState, Field, Input, Segmented, Select, Textarea, useToast } from "@/components/ui";
import { CharacterPicker, IntensityPicker, ProgressSteps, TagInput, type PickableCharacterItem } from "@/components/content/pickers";
import { ART_STYLES, COMIC_TONES, ORIENTATION_OPTS, PANEL_LAYOUTS, TAGS, THEMES } from "@/lib/constants";
import { api, ApiClientError } from "@/lib/offline/client";
import { cn, timeAgo } from "@/lib/utils";

type Source = "random" | "prompt" | "characters" | "chat";
export type RecentChatItem = { id: string; title: string; messageCount: number; lastMessageAt: string; character: { id: string; name: string; avatarUrl: string | null; avatarSeed: string } };

const LAYOUT_LABEL: Record<string, string> = { "grid-4": "2×2 grid", "grid-6": "2×3 grid", "strip-3": "3-panel strip", splash: "Single splash" };
const STEPS = ["Writing the script", "Drawing the panels", "Assembling your comic"];

export function ComicGenerator({ characters, chats, maxIntensity, initialCharacterId, initialChatId }: { characters: PickableCharacterItem[]; chats: RecentChatItem[]; maxIntensity: number; initialCharacterId?: string; initialChatId?: string }) {
  const router = useRouter();
  const toast = useToast();
  const [source, setSource] = React.useState<Source>(initialChatId ? "chat" : initialCharacterId ? "characters" : "prompt");
  const [prompt, setPrompt] = React.useState("");
  const [characterIds, setCharacterIds] = React.useState<string[]>(initialCharacterId ? [initialCharacterId] : []);
  const [chatId, setChatId] = React.useState(initialChatId ?? "");
  const [title, setTitle] = React.useState("");
  const [artStyle, setArtStyle] = React.useState<string>("noir-ink");
  const [pageCount, setPageCount] = React.useState(2);
  const [panelLayout, setPanelLayout] = React.useState<string>("grid-4");
  const [tone, setTone] = React.useState<string>("sensual");
  const [orientation, setOrientation] = React.useState<string>("portrait");
  const [intensity, setIntensity] = React.useState(Math.min(2, maxIntensity));
  const [tags, setTags] = React.useState<string[]>([]);
  const [step, setStep] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const canSubmit = source === "random" || (source === "prompt" && prompt.trim().length > 3) || (source === "characters" && characterIds.length > 0) || (source === "chat" && !!chatId);

  async function generate() {
    setError(null);
    setStep(0);
    const t1 = setTimeout(() => setStep(1), 1800);
    try {
      const res = await api<{ id: string }>("/api/comics/generate", {
        method: "POST",
        json: { source, prompt: prompt.trim() || undefined, characterIds: characterIds.length ? characterIds : undefined, chatId: chatId || undefined, title: title.trim() || undefined, artStyle, pageCount, panelLayout, tone, orientation, intensity, tags },
      });
      clearTimeout(t1);
      setStep(2);
      toast.push("Your comic is ready. It's private until you publish it.", "success");
      router.push(`/comics/${res.id}`);
    } catch (err) {
      clearTimeout(t1);
      setError(err instanceof ApiClientError ? err.message : err instanceof Error ? err.message : "Generation failed");
    }
  }

  if (step !== null && !error) {
    return (
      <div className="card fade-up space-y-5 p-5">
        <div>
          <h2 className="text-xl">Making your comic</h2>
          <p className="text-xs text-muted">{pageCount} page{pageCount > 1 ? "s" : ""} · {LAYOUT_LABEL[panelLayout]} · {artStyle}</p>
        </div>
        <ProgressSteps steps={STEPS} active={step} />
        <p className="text-xs text-muted">Panels are drawn one at a time so the characters stay consistent. This can take a little while.</p>
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
        {source === "random" && <p className="text-sm text-fg-2">We&apos;ll pick a premise from our collection of adult-romance setups. You can still feature characters below.</p>}
        {(source === "prompt" || source === "characters") && (
          <Field label={source === "prompt" ? "Premise" : "Premise (optional)"} required={source === "prompt"} hint="Describe the scene, the mood and what happens. All characters must be adults.">
            <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} maxLength={2000} placeholder="A rooftop garage at midnight. She just lost her first race and wants to know how." />
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
            <p className="text-xs text-muted">The last ~20 messages are summarized into the premise. The chat itself stays private.</p>
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
        <Field label="Title (optional)">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Leave blank to let the script name it" />
        </Field>
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">Art style</p>
          <div className="flex flex-wrap gap-1.5">
            {ART_STYLES.map((s) => (
              <Chip key={s} active={artStyle === s} onClick={() => setArtStyle(s)}>{s}</Chip>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Pages">
            <Select value={pageCount} onChange={(e) => setPageCount(Number(e.target.value))}>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </Select>
          </Field>
          <Field label="Panel layout">
            <Select value={panelLayout} onChange={(e) => setPanelLayout(e.target.value)}>
              {PANEL_LAYOUTS.map((l) => (
                <option key={l} value={l}>{LAYOUT_LABEL[l]}</option>
              ))}
            </Select>
          </Field>
          <Field label="Tone">
            <Select value={tone} onChange={(e) => setTone(e.target.value)}>
              {COMIC_TONES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </Select>
          </Field>
          <Field label="Panel orientation">
            <Select value={orientation} onChange={(e) => setOrientation(e.target.value)}>
              {ORIENTATION_OPTS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </Select>
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
      </div>

      <div className="glass sticky bottom-[calc(4.5rem+var(--safe-bottom))] rounded-2xl p-3">
        <Button className="w-full" size="lg" disabled={!canSubmit} onClick={generate}>
          <Sparkles className="h-4 w-4" /> Generate comic
        </Button>
        <p className="mt-2 text-center text-[11px] text-muted">Private draft until you choose to publish.</p>
      </div>
    </div>
  );
}
