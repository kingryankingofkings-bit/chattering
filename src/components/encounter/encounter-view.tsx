"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Dices, RotateCcw, SearchX, Sparkles } from "lucide-react";
import { Button, EmptyState, ErrorState, useToast } from "@/components/ui";
import type { RollResult, SavedEncounterItem } from "@/lib/encounter";
import { api } from "@/lib/offline/client";
import type { ChatContext } from "@/lib/types";
import { defaultEncounterPrefs, PreferencesPanel, splitTri, type EncounterPrefs } from "./preferences-panel";
import { ResultCard, ResultSkeleton } from "./result-card";
import { SaveSheet } from "./save-sheet";
import { SavedEncounters } from "./saved-encounters";

export type EncounterUserPrefs = { maxIntensity: number; hardLimits: string; excludedThemes: string[]; preferredThemes: string[]; blurNsfw: boolean };

type Phase = { kind: "idle" } | { kind: "rolling" } | { kind: "result"; result: RollResult; loadedFrom: string | null } | { kind: "empty" } | { kind: "error"; message: string };
type Mode = "match" | "surprise";

export function EncounterView({ userPrefs, initialSaved }: { userPrefs: EncounterUserPrefs; initialSaved: SavedEncounterItem[] }) {
  const router = useRouter();
  const toast = useToast();
  const [prefs, setPrefs] = React.useState<EncounterPrefs>(() => defaultEncounterPrefs(userPrefs));
  const [panelOpen, setPanelOpen] = React.useState(false);
  const [phase, setPhase] = React.useState<Phase>({ kind: "idle" });
  const [mode, setMode] = React.useState<Mode>("match");
  const [saved, setSaved] = React.useState<SavedEncounterItem[]>(initialSaved);
  const [saveOpen, setSaveOpen] = React.useState(false);
  const [starting, setStarting] = React.useState<string | null>(null);
  const [rerolling, setRerolling] = React.useState(false);
  const reqId = React.useRef(0);
  const resultRef = React.useRef<HTMLDivElement>(null);

  const current = phase.kind === "result" ? phase.result : null;

  const roll = React.useCallback(
    async (m: Mode, excludeCharacterIds: string[] = []) => {
      const id = ++reqId.current;
      setMode(m);
      if (excludeCharacterIds.length) setRerolling(true);
      else setPhase({ kind: "rolling" });
      const themes = splitTri(prefs.themes);
      const tags = splitTri(prefs.tags);
      const preferences =
        m === "surprise"
          ? { surprise: true, excludeThemes: themes.exclude, excludeTags: tags.exclude, intensity: prefs.intensity, hardLimits: prefs.hardLimits }
          : { surprise: false, themes: themes.include, tags: tags.include, genderPresentation: prefs.gender, excludeThemes: themes.exclude, excludeTags: tags.exclude, intensity: prefs.intensity, hardLimits: prefs.hardLimits };
      try {
        const res = await api<RollResult | { match: null; message: string }>("/api/encounter/roll", { method: "POST", json: { preferences, excludeCharacterIds } });
        if (id !== reqId.current) return;
        if ("match" in res && res.match === null) setPhase({ kind: "empty" });
        else setPhase({ kind: "result", result: res as RollResult, loadedFrom: null });
        setPanelOpen(false);
        requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
      } catch (err) {
        if (id !== reqId.current) return;
        setPhase({ kind: "error", message: err instanceof Error ? err.message : "Could not roll an encounter" });
      } finally {
        if (id === reqId.current) setRerolling(false);
      }
    },
    [prefs],
  );

  const reroll = () => void roll(mode, current ? [current.character.id] : []);

  function reset() {
    reqId.current++;
    setPhase({ kind: "idle" });
    setPrefs(defaultEncounterPrefs(userPrefs));
    setRerolling(false);
    setPanelOpen(false);
  }

  async function startChat(characterId: string, context: ChatContext, key: string) {
    setStarting(key);
    try {
      const { id } = await api<{ id: string }>("/api/chats", { method: "POST", json: { characterId, context } });
      router.push(`/chat/${id}`);
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Could not start chat", "error");
      setStarting(null);
    }
  }

  function contextFor(item: SavedEncounterItem): ChatContext {
    return { version: 1, scenarioTitle: item.data.scenarioTitle, setting: item.data.setting, hook: item.data.hook, intensity: item.data.intensity, hardLimits: prefs.hardLimits, origin: "encounter" };
  }

  function loadSaved(item: SavedEncounterItem) {
    if (!item.character) return;
    reqId.current++;
    setRerolling(false);
    setPhase({
      kind: "result",
      loadedFrom: item.name,
      result: {
        character: item.character,
        scenario: { id: item.id, title: item.data.scenarioTitle, setting: item.data.setting, hook: item.data.hook, intensity: item.data.intensity, themes: item.data.themes, tags: item.data.tags },
        openingMessage: item.data.openingMessage,
        hardLimits: prefs.hardLimits,
        context: contextFor(item),
        seed: 0,
      },
    });
    requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  async function refreshSaved() {
    try {
      const r = await api<{ items: SavedEncounterItem[] }>("/api/encounters");
      setSaved(r.items);
    } catch {
      /* keep the optimistic list */
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl">Random Encounter</h1>
          <p className="text-xs text-muted">A stranger, a scene, an opening line. Say yes or roll again.</p>
        </div>
        <Button variant="ghost" size="sm" onClick={reset} aria-label="Reset encounter and preferences">
          <RotateCcw className="h-3.5 w-3.5" /> Reset
        </Button>
      </header>

      <PreferencesPanel value={prefs} onChange={setPrefs} maxIntensity={userPrefs.maxIntensity} lockedThemes={userPrefs.excludedThemes} open={panelOpen} onToggle={() => setPanelOpen((o) => !o)} />

      <div className="grid grid-cols-2 gap-2">
        <Button size="lg" loading={phase.kind === "rolling" && mode === "match"} disabled={phase.kind === "rolling"} onClick={() => void roll("match")}>
          <Dices className="h-4 w-4" /> Match
        </Button>
        <Button size="lg" variant="gold" loading={phase.kind === "rolling" && mode === "surprise"} disabled={phase.kind === "rolling"} onClick={() => void roll("surprise")}>
          <Sparkles className="h-4 w-4" /> Surprise me
        </Button>
      </div>

      <div ref={resultRef} className="scroll-mt-20">
        {phase.kind === "rolling" && <ResultSkeleton />}
        {phase.kind === "empty" && (
          <EmptyState
            icon={<SearchX className="h-8 w-8" />}
            title="Nobody matches those preferences"
            description="Loosen your filters — drop a tag or two, or raise the intensity — and roll again. Excluded themes and hidden tags always stay excluded."
            action={
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setPanelOpen(true)}>Adjust preferences</Button>
                <Button size="sm" variant="gold" onClick={() => void roll("surprise")}>Surprise me instead</Button>
              </div>
            }
          />
        )}
        {phase.kind === "error" && <ErrorState title="The dice slipped" description={phase.message} onRetry={() => void roll(mode)} />}
        {phase.kind === "result" && (
          <ResultCard
            result={phase.result}
            blur={userPrefs.blurNsfw}
            rerolling={rerolling}
            starting={starting === "current"}
            loadedFrom={phase.loadedFrom}
            onReroll={reroll}
            onSave={() => setSaveOpen(true)}
            onStartChat={() => void startChat(phase.result.character.id, phase.result.context, "current")}
            onBlocked={() => {
              setSaved((s) => s.filter((it) => it.character?.creator.id !== phase.result.character.creator.id));
              void roll(mode, [phase.result.character.id]);
            }}
          />
        )}
        {phase.kind === "idle" && (
          <div className="card flex flex-col items-center gap-2 px-6 py-10 text-center">
            <Dices className="h-8 w-8 text-accent-2" aria-hidden />
            <p className="text-base">Ready when you are.</p>
            <p className="max-w-sm text-sm text-muted"><strong className="text-fg-2">Match</strong> uses your preferences. <strong className="text-fg-2">Surprise me</strong> ignores them — but never your exclusions or hard limits.</p>
          </div>
        )}
      </div>

      <SavedEncounters items={saved} startingId={starting} onLoad={loadSaved} onStartChat={(it) => it.character && void startChat(it.character.id, contextFor(it), it.id)} onDeleted={(id) => setSaved((s) => s.filter((x) => x.id !== id))} />

      <SaveSheet open={saveOpen} onClose={() => setSaveOpen(false)} result={current} onSaved={() => void refreshSaved()} />
    </div>
  );
}
