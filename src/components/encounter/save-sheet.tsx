"use client";
import * as React from "react";
import { Button, Field, Input, Sheet, Toggle, useToast } from "@/components/ui";
import type { RollResult } from "@/lib/encounter";
import { api } from "@/lib/offline/client";
import type { EncounterData } from "@/lib/types";

export function SaveSheet({ open, onClose, result, onSaved }: { open: boolean; onClose: () => void; result: RollResult | null; onSaved: (id: string) => void }) {
  const [name, setName] = React.useState("");
  const [isTemplate, setIsTemplate] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [prevOpen, setPrevOpen] = React.useState(open);
  const toast = useToast();
  // Reset the form each time the sheet opens (state adjustment during render, not an effect).
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open && result) {
      setName(`${result.scenario.title} with ${result.character.name}`.slice(0, 80));
      setIsTemplate(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!result || !name.trim()) return;
    setLoading(true);
    const data: EncounterData = {
      version: 1,
      scenarioTitle: result.scenario.title,
      setting: result.scenario.setting,
      hook: result.scenario.hook,
      openingMessage: result.openingMessage,
      intensity: result.scenario.intensity,
      themes: result.scenario.themes,
      tags: result.scenario.tags,
    };
    try {
      const { id } = await api<{ id: string }>("/api/encounters", { method: "POST", json: { characterId: result.character.id, name: name.trim(), isTemplate, data } });
      toast.push(isTemplate ? "Saved as a reusable template" : "Encounter saved", "success");
      onSaved(id);
      onClose();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Could not save", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Save this encounter">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Name" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required autoFocus placeholder="Snowed in with Vesper" />
        </Field>
        <Toggle checked={isTemplate} onChange={setIsTemplate} label="Save as reusable template" description="Templates are pinned at the top of your saved encounters so you can replay the scene any time." />
        <Button type="submit" className="w-full" loading={loading} disabled={!name.trim()}>
          Save encounter
        </Button>
      </form>
    </Sheet>
  );
}
