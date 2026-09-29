"use client";
import * as React from "react";
import { Button, ErrorState, Skeleton, useToast } from "@/components/ui";
import { ChipPicker } from "@/components/create/editor-fields";
import { TAGS, THEMES } from "@/lib/constants";
import { api } from "@/lib/offline/client";
import { useResource } from "./use-resource";

const OPTIONS = Array.from(new Set<string>([...TAGS, ...THEMES]));

export function HiddenTagsEditor() {
  const toast = useToast();
  const { data, loading, error, reload } = useResource<{ tags: string[] }>("/api/me/hidden-tags");
  if (loading) return <Skeleton className="h-64 w-full !rounded-2xl" />;
  if (error || !data) return <ErrorState description={error ?? undefined} onRetry={reload} />;
  return <Editor initial={data.tags} onSaved={() => toast.push("Hidden tags saved", "success")} />;
}

function Editor({ initial, onSaved }: { initial: string[]; onSaved: () => void }) {
  const toast = useToast();
  const [tags, setTags] = React.useState(initial);
  const [saving, setSaving] = React.useState(false);
  const dirty = JSON.stringify(tags) !== JSON.stringify(initial);
  async function save() {
    setSaving(true);
    try {
      await api("/api/me/hidden-tags", { method: "PUT", json: { tags } });
      onSaved();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Could not save", "error");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="card space-y-4 p-4">
      <p className="text-sm text-muted">Characters carrying any of these tags are removed from Explore, Encounter and recommendations. Add your own words too.</p>
      <ChipPicker label="Hidden tags" options={OPTIONS} value={tags} onChange={setTags} allowCustom max={100} />
      <Button onClick={save} loading={saving} disabled={!dirty}>Save</Button>
    </div>
  );
}
