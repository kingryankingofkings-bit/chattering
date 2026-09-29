"use client";
import * as React from "react";
import { Flag } from "lucide-react";
import { Button, Field, Select, Sheet, Textarea, useToast } from "@/components/ui";
import { REPORT_REASONS, type TargetType } from "@/lib/constants";
import { api } from "@/lib/offline/client";

export function ReportButton({ targetType, targetId, label = "Report", variant = "ghost", size = "sm" }: { targetType: TargetType; targetId: string; label?: string; variant?: "ghost" | "secondary" | "outline"; size?: "sm" | "md" }) {
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState<string>(REPORT_REASONS[0]);
  const [details, setDetails] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const toast = useToast();
  async function submit() {
    setLoading(true);
    try {
      await api("/api/reports", { method: "POST", json: { targetType, targetId, reason, details } });
      toast.push("Report sent. Thank you — a moderator will review it.", "success");
      setOpen(false);
      setDetails("");
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Could not send report", "error");
    } finally {
      setLoading(false);
    }
  }
  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        <Flag className="h-3.5 w-3.5" /> {label}
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Report content">
        <div className="space-y-4">
          <p className="text-sm text-muted">Reports are confidential. Anything involving minors, real people, non-consent, incest, bestiality or illegal content is removed and the creator may lose access.</p>
          <Field label="Reason">
            <Select value={reason} onChange={(e) => setReason(e.target.value)}>
              {REPORT_REASONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </Select>
          </Field>
          <Field label="Details (optional)">
            <Textarea value={details} onChange={(e) => setDetails(e.target.value)} maxLength={1000} placeholder="What did you see?" />
          </Field>
          <Button className="w-full" loading={loading} onClick={submit}>Send report</Button>
        </div>
      </Sheet>
    </>
  );
}
