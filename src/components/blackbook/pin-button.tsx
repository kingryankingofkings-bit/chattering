"use client";
import * as React from "react";
import { Pin, PinOff } from "lucide-react";
import { Button, useToast } from "@/components/ui";
import { api } from "@/lib/offline/client";

export function PinButton({ characterId, pinned, onChange, size = "sm" }: { characterId: string; pinned: boolean; onChange?: (pinned: boolean) => void; size?: "sm" | "md" }) {
  const toast = useToast();
  const [loading, setLoading] = React.useState(false);
  async function toggle() {
    setLoading(true);
    try {
      if (pinned) await api(`/api/me/pinned/${characterId}`, { method: "DELETE" });
      else await api("/api/me/pinned", { method: "POST", json: { characterId } });
      onChange?.(!pinned);
      toast.push(pinned ? "Unpinned" : "Pinned to your Blackbook", "success");
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Could not update pin", "error");
    } finally {
      setLoading(false);
    }
  }
  return (
    <Button variant={pinned ? "gold" : "secondary"} size={size} loading={loading} onClick={toggle} aria-pressed={pinned}>
      {pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />} {pinned ? "Unpin" : "Pin"}
    </Button>
  );
}
