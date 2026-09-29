"use client";
import * as React from "react";
import { Pencil, Plus, Star, Trash2, UserRound } from "lucide-react";
import { Button, EmptyState, ErrorState, Field, Input, Sheet, Skeleton, Textarea, Toggle, useToast } from "@/components/ui";
import type { PersonaDto } from "@/lib/personas";
import { api, ApiClientError } from "@/lib/offline/client";
import { ConfirmSheet } from "./confirm-sheet";
import { useResource } from "./use-resource";

const blank = { name: "", pronouns: "", description: "", likes: "", limits: "", isDefault: false };
type Form = typeof blank;

export function PersonasManager() {
  const toast = useToast();
  const { data, loading, error, reload, setData } = useResource<{ items: PersonaDto[] }>("/api/me/personas");
  const [editing, setEditing] = React.useState<{ id: string | null; form: Form } | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [fieldError, setFieldError] = React.useState<{ field?: string; message: string } | null>(null);
  const [confirm, setConfirm] = React.useState<PersonaDto | null>(null);

  const update = (patch: Partial<Form>) => setEditing((e) => (e ? { ...e, form: { ...e.form, ...patch } } : e));
  const err = (f: string) => (fieldError?.field === f ? fieldError.message : undefined);

  async function save() {
    if (!editing) return;
    setSaving(true);
    setFieldError(null);
    try {
      const res = await api<{ persona: PersonaDto }>(editing.id ? `/api/me/personas/${editing.id}` : "/api/me/personas", { method: editing.id ? "PUT" : "POST", json: editing.form });
      setData((d) => {
        const list = (d?.items ?? []).map((p) => (res.persona.isDefault ? { ...p, isDefault: false } : p));
        const idx = list.findIndex((p) => p.id === res.persona.id);
        if (idx >= 0) list[idx] = res.persona;
        else list.push(res.persona);
        return { items: list.sort((a, b) => Number(b.isDefault) - Number(a.isDefault)) };
      });
      setEditing(null);
      toast.push(editing.id ? "Persona saved" : "Persona created", "success");
    } catch (e) {
      const body = e instanceof ApiClientError ? (e.body as { field?: string } | null) : null;
      setFieldError({ field: body?.field, message: e instanceof Error ? e.message : "Could not save" });
      toast.push(e instanceof Error ? e.message : "Could not save", "error");
    } finally {
      setSaving(false);
    }
  }
  async function makeDefault(p: PersonaDto) {
    try {
      const res = await api<{ persona: PersonaDto }>(`/api/me/personas/${p.id}`, { method: "PUT", json: { name: p.name, pronouns: p.pronouns, description: p.description, likes: p.likes, limits: p.limits, isDefault: true } });
      setData((d) => (d ? { items: d.items.map((x) => (x.id === p.id ? res.persona : { ...x, isDefault: false })) } : d));
      toast.push(`${p.name} is now your default`, "success");
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Could not update", "error");
    }
  }
  async function remove() {
    if (!confirm) return;
    setSaving(true);
    try {
      await api(`/api/me/personas/${confirm.id}`, { method: "DELETE" });
      setConfirm(null);
      toast.push("Persona deleted", "success");
      void reload();
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Could not delete", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">Personas are who <em>you</em> are in a scene. They&apos;re encrypted and shared with the character only inside your chats.</p>
      <Button size="sm" onClick={() => { setFieldError(null); setEditing({ id: null, form: { ...blank } }); }}>
        <Plus className="h-4 w-4" /> New persona
      </Button>
      {loading ? (
        <div className="space-y-2" aria-busy="true">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full !rounded-2xl" />)}</div>
      ) : error || !data ? (
        <ErrorState description={error ?? undefined} onRetry={reload} />
      ) : data.items.length === 0 ? (
        <EmptyState icon={<UserRound className="h-8 w-8" />} title="No personas yet" description="Create one so characters know your name, pronouns and limits." />
      ) : (
        <ul className="space-y-2">
          {data.items.map((p) => (
            <li key={p.id} className="card fade-up space-y-2 p-3">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm text-fg"><span className="truncate">{p.name}</span>{p.pronouns && <span className="text-xs text-muted">{p.pronouns}</span>}{p.isDefault && <span className="inline-flex items-center gap-0.5 rounded-md border border-gold/30 bg-gold-soft px-1.5 text-[10px] font-semibold uppercase text-gold"><Star className="h-2.5 w-2.5" fill="currentColor" /> default</span>}</p>
                  {p.description && <p className="mt-0.5 line-clamp-2 text-xs text-fg-2">{p.description}</p>}
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Edit ${p.name}`} onClick={() => { setFieldError(null); setEditing({ id: p.id, form: { name: p.name, pronouns: p.pronouns, description: p.description, likes: p.likes, limits: p.limits, isDefault: p.isDefault } }); }}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-danger" aria-label={`Delete ${p.name}`} onClick={() => setConfirm(p)}><Trash2 className="h-4 w-4" /></Button>
              </div>
              {!p.isDefault && <Button variant="ghost" size="sm" onClick={() => makeDefault(p)}><Star className="h-3.5 w-3.5" /> Make default</Button>}
            </li>
          ))}
        </ul>
      )}
      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? "Edit persona" : "New persona"}>
        {editing && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Name" required error={err("name")}><Input value={editing.form.name} onChange={(e) => update({ name: e.target.value })} maxLength={60} autoFocus /></Field>
              <Field label="Pronouns" error={err("pronouns")}><Input value={editing.form.pronouns} onChange={(e) => update({ pronouns: e.target.value })} maxLength={40} placeholder="they/them" /></Field>
            </div>
            <Field label="Description" hint="How characters see you: looks, vibe, backstory." error={err("description")}><Textarea value={editing.form.description} onChange={(e) => update({ description: e.target.value })} maxLength={2000} /></Field>
            <Field label="Likes" error={err("likes")}><Textarea value={editing.form.likes} onChange={(e) => update({ likes: e.target.value })} maxLength={1000} rows={2} className="min-h-[60px]" /></Field>
            <Field label="Limits" hint="Things characters must never do with this persona." error={err("limits")}><Textarea value={editing.form.limits} onChange={(e) => update({ limits: e.target.value })} maxLength={1000} rows={2} className="min-h-[60px]" /></Field>
            <Toggle checked={editing.form.isDefault} onChange={(v) => update({ isDefault: v })} label="Default persona" description="Used automatically in new chats." />
            <Button className="w-full" loading={saving} disabled={!editing.form.name.trim()} onClick={save}>{editing.id ? "Save" : "Create"}</Button>
          </div>
        )}
      </Sheet>
      <ConfirmSheet open={!!confirm} title="Delete persona?" body={<>“{confirm?.name}” will be removed. Existing chats keep working without it.</>} confirmLabel="Delete" danger loading={saving} onClose={() => setConfirm(null)} onConfirm={remove} />
    </div>
  );
}
