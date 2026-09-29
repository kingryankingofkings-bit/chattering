"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Copy, Download, MessageCircle, Trash2 } from "lucide-react";
import { Button, Sheet, useToast } from "@/components/ui";
import { api } from "@/lib/offline/client";

/** Shared owner actions: duplicate, export, delete (with confirm) and test chat. */
export function useCharacterActions() {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = React.useState<string | null>(null);

  const duplicate = async (id: string) => {
    setBusy("duplicate");
    try {
      const res = await api<{ id: string }>(`/api/characters/${id}/duplicate`, { method: "POST" });
      toast.push("Copy created", "success");
      router.push(`/create/${res.id}`);
      router.refresh();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Could not duplicate", "error");
    } finally {
      setBusy(null);
    }
  };

  const exportJson = (id: string) => {
    const a = document.createElement("a");
    a.href = `/api/characters/${id}/export`;
    a.download = "";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const remove = async (id: string) => {
    setBusy("delete");
    try {
      await api(`/api/characters/${id}`, { method: "DELETE" });
      toast.push("Character deleted", "success");
      return true;
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Could not delete", "error");
      return false;
    } finally {
      setBusy(null);
    }
  };

  const testChat = async (id: string) => {
    setBusy("test");
    try {
      const res = await api<{ id: string }>("/api/chats", { method: "POST", json: { characterId: id, preview: true } });
      router.push(`/chat/${res.id}`);
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Could not start a test chat", "error");
      setBusy(null);
    }
  };

  return { busy, duplicate, exportJson, remove, testChat };
}

export function DeleteCharacterSheet({ open, name, onClose, onConfirm, loading }: { open: boolean; name: string; onClose: () => void; onConfirm: () => void; loading?: boolean }) {
  return (
    <Sheet open={open} onClose={onClose} title="Delete character?">
      <div className="space-y-4">
        <p className="text-sm text-fg-2">
          <span className="font-medium text-fg">{name || "This character"}</span> will be permanently deleted, along with every chat anyone has had with them and their saved encounters. This can&apos;t be undone.
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Keep</Button>
          <Button variant="danger" className="flex-1" loading={loading} onClick={onConfirm}>
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

export function ActionsSheet({ open, onClose, onDuplicate, onExport, onDelete, onTestChat, busy }: { open: boolean; onClose: () => void; onDuplicate: () => void; onExport: () => void; onDelete: () => void; onTestChat?: () => void; busy: string | null }) {
  return (
    <Sheet open={open} onClose={onClose} title="Character actions">
      <div className="space-y-2">
        {onTestChat && (
          <Button variant="secondary" className="w-full justify-start" loading={busy === "test"} onClick={onTestChat}>
            <MessageCircle className="h-4 w-4" /> Test chat
          </Button>
        )}
        <Button variant="secondary" className="w-full justify-start" loading={busy === "duplicate"} onClick={onDuplicate}>
          <Copy className="h-4 w-4" /> Duplicate
        </Button>
        <Button variant="secondary" className="w-full justify-start" onClick={onExport}>
          <Download className="h-4 w-4" /> Export JSON
        </Button>
        <Button variant="danger" className="w-full justify-start" onClick={onDelete}>
          <Trash2 className="h-4 w-4" /> Delete
        </Button>
      </div>
    </Sheet>
  );
}
