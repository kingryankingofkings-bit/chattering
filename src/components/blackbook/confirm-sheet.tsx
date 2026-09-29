"use client";
import { Button, Sheet } from "@/components/ui";

export function ConfirmSheet({ open, title, body, confirmLabel = "Confirm", danger, loading, onClose, onConfirm }: { open: boolean; title: string; body: React.ReactNode; confirmLabel?: string; danger?: boolean; loading?: boolean; onClose: () => void; onConfirm: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="space-y-4">
        <div className="text-sm text-fg-2">{body}</div>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button variant={danger ? "danger" : "primary"} className="flex-1" loading={loading} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </Sheet>
  );
}
