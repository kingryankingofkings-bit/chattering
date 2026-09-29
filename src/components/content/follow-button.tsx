"use client";
import * as React from "react";
import { UserCheck, UserPlus } from "lucide-react";
import { Button, useToast } from "@/components/ui";
import { api } from "@/lib/offline/client";

export function FollowButton({ userId, initial, size = "sm", className }: { userId: string; initial: boolean; size?: "sm" | "md"; className?: string }) {
  const [on, setOn] = React.useState(initial);
  const [loading, setLoading] = React.useState(false);
  const toast = useToast();
  async function toggle() {
    const next = !on;
    setOn(next);
    setLoading(true);
    try {
      await api(`/api/users/${userId}/follow`, { method: next ? "POST" : "DELETE" });
    } catch (err) {
      setOn(!next);
      toast.push(err instanceof Error ? err.message : "Could not update follow", "error");
    } finally {
      setLoading(false);
    }
  }
  return (
    <Button variant={on ? "secondary" : "outline"} size={size} onClick={toggle} loading={loading} aria-pressed={on} className={className}>
      {on ? <UserCheck className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
      {on ? "Following" : "Follow"}
    </Button>
  );
}
