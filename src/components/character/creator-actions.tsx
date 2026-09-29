"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Ban, UserMinus, UserPlus } from "lucide-react";
import { Button, Sheet, useToast } from "@/components/ui";
import { api } from "@/lib/offline/client";

export function FollowButton({ creatorId, initial, allowFollows = true, size = "sm", onChange }: { creatorId: string; initial: boolean; allowFollows?: boolean; size?: "sm" | "md"; onChange?: (following: boolean) => void }) {
  const [following, setFollowing] = React.useState(initial);
  const [prevInitial, setPrevInitial] = React.useState(initial);
  const [loading, setLoading] = React.useState(false);
  const toast = useToast();
  if (prevInitial !== initial) {
    setPrevInitial(initial);
    setFollowing(initial);
  }
  async function toggle() {
    const next = !following;
    setLoading(true);
    try {
      await api(`/api/users/${creatorId}/follow`, { method: next ? "POST" : "DELETE" });
      setFollowing(next);
      onChange?.(next);
      toast.push(next ? "Following creator" : "Unfollowed", "success");
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Could not update follow", "error");
    } finally {
      setLoading(false);
    }
  }
  if (!allowFollows && !following) return null;
  return (
    <Button variant={following ? "secondary" : "outline"} size={size} loading={loading} onClick={toggle} aria-pressed={following}>
      {following ? <UserMinus className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
      {following ? "Following" : "Follow"}
    </Button>
  );
}

/**
 * Block (or unblock) a creator. Blocking hides all their characters from feeds.
 * `afterBlock` runs on success (e.g. navigate away or reroll).
 */
export function BlockCreatorButton({ creatorId, creatorName, initial = false, afterBlock, size = "sm", variant = "ghost" }: { creatorId: string; creatorName: string; initial?: boolean; afterBlock?: () => void; size?: "sm" | "md"; variant?: "ghost" | "danger" | "secondary" | "outline" }) {
  const [blocked, setBlocked] = React.useState(initial);
  const [prevInitial, setPrevInitial] = React.useState(initial);
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const toast = useToast();
  const router = useRouter();
  if (prevInitial !== initial) {
    setPrevInitial(initial);
    setBlocked(initial);
  }

  async function confirm() {
    setLoading(true);
    try {
      await api(`/api/users/${creatorId}/block`, { method: blocked ? "DELETE" : "POST" });
      const next = !blocked;
      setBlocked(next);
      setOpen(false);
      toast.push(next ? `Blocked ${creatorName}. Their characters won't appear for you anymore.` : `Unblocked ${creatorName}.`, "success");
      if (next) afterBlock?.();
      else router.refresh();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Could not update block", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button variant={blocked ? "secondary" : variant} size={size} onClick={() => setOpen(true)}>
        <Ban className="h-3.5 w-3.5" /> {blocked ? "Unblock creator" : "Block creator"}
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title={blocked ? "Unblock creator?" : "Block creator?"}>
        <div className="space-y-4">
          <p className="text-sm text-muted">
            {blocked
              ? `${creatorName}'s characters will show up in Explore and Encounters again.`
              : `You won't see ${creatorName}'s characters in Explore, Encounters or recommendations, and you'll stop following them. You can undo this from their profile.`}
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant={blocked ? "primary" : "danger"} className="flex-1" loading={loading} onClick={confirm}>
              {blocked ? "Unblock" : "Block"}
            </Button>
          </div>
        </div>
      </Sheet>
    </>
  );
}
