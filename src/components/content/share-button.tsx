"use client";
import * as React from "react";
import { Link2 } from "lucide-react";
import { Button, useToast } from "@/components/ui";

/** Copies a permitted public link. Only enabled when the item is published. */
export function ShareButton({ path, enabled, size = "sm", variant = "ghost" }: { path: string; enabled: boolean; size?: "sm" | "md"; variant?: "ghost" | "secondary" | "outline" }) {
  const toast = useToast();
  async function copy() {
    if (!enabled) {
      toast.push("Publish it first to get a shareable link.");
      return;
    }
    const url = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.push("Link copied", "success");
    } catch {
      toast.push(`Copy this link: ${url}`);
    }
  }
  return (
    <Button variant={variant} size={size} onClick={copy} aria-label="Copy link" title={enabled ? "Copy link" : "Publish first to share"}>
      <Link2 className="h-3.5 w-3.5" /> Share
    </Button>
  );
}
