"use client";
import * as React from "react";
import { Globe, Lock } from "lucide-react";
import { Button, Sheet, useToast } from "@/components/ui";
import { api, ApiClientError } from "@/lib/offline/client";

type Kind = "comic" | "story" | "image";

const CONTENT_LABEL: Record<Kind, string> = {
  comic: "every page: all panels, captions, dialogue and sound effects",
  story: "every chapter and passage of the story",
  image: "the image itself at full resolution",
};
const MEDIA_LABEL: Record<Kind, string> = {
  comic: "the cover and every panel image",
  story: "no images (stories have no media)",
  image: "the image file, which becomes viewable by anyone with the link",
};

/**
 * Publish / keep-private confirmation. Publishing flips status=PUBLISHED, visibility=PUBLIC
 * and makes the referenced media public; unpublishing reverses all of it.
 */
export function PublishDialog<T>({ open, onClose, kind, id, title, displayName, published, showDetails, onDone }: { open: boolean; onClose: () => void; kind: Kind; id: string; title: string; displayName: string; published: boolean; showDetails?: boolean; onDone: (detail: T) => void }) {
  const [agree, setAgree] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const toast = useToast();
  const endpoint = kind === "comic" ? `/api/comics/${id}/publish` : kind === "story" ? `/api/stories/${id}/publish` : `/api/images/${id}/publish`;

  async function go(publish: boolean) {
    setLoading(true);
    try {
      const detail = await api<T>(endpoint, { method: "POST", json: { publish } });
      toast.push(publish ? "Published. It's now visible to everyone." : "Kept private. Only you can see it now.", "success");
      onDone(detail);
      onClose();
    } catch (err) {
      toast.push(err instanceof ApiClientError ? err.message : "Could not update", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={published ? "Keep private?" : "Publish this?"}>
      {published ? (
        <div className="space-y-4">
          <p className="text-sm text-fg-2">
            <Lock className="mr-1 inline h-4 w-4 text-accent-2" aria-hidden />
            Unpublishing removes <strong>{title || "this"}</strong> from public feeds and search, hides it from anyone who isn&apos;t you, and makes {kind === "story" ? "it" : "its media"} private again. Existing links stop working.
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button className="flex-1" loading={loading} onClick={() => go(false)}>Keep private</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-fg-2">
            <Globe className="mr-1 inline h-4 w-4 text-accent-2" aria-hidden />
            Publishing makes the following visible to <strong>everyone on Chattering</strong>, including people who don&apos;t follow you:
          </p>
          <ul className="space-y-1.5 rounded-xl border border-line bg-surface-2 p-3 text-sm text-fg-2">
            <li>• The title: <span className="text-fg">{title || "Untitled"}</span></li>
            <li>• The content: {CONTENT_LABEL[kind]}</li>
            <li>• Media: {MEDIA_LABEL[kind]}</li>
            <li>• Its tags, style and intensity rating</li>
            <li>• Your display name: <span className="text-fg">{displayName}</span></li>
            {showDetails && <li>• Generation details (prompt, negative prompt, style, seed and model), because &ldquo;show details&rdquo; is on</li>}
          </ul>
          <p className="text-xs text-muted">You can keep it private again at any time. Everything else stays encrypted and private until you publish it.</p>
          <label className="flex items-start gap-2 text-sm text-fg-2">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]" />
            <span>I confirm every character is a fictional adult and this follows the community guidelines.</span>
          </label>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={onClose}>Not yet</Button>
            <Button className="flex-1" disabled={!agree} loading={loading} onClick={() => go(true)}>Publish</Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
