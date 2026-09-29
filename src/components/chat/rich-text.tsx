import * as React from "react";

/** Minimal roleplay markup: *action* → italic muted, "quotes" kept, paragraphs on blank lines. */
export function RichText({ text, className }: { text: string; className?: string }) {
  const paras = text.split(/\n{2,}/);
  return (
    <div className={className}>
      {paras.map((p, i) => (
        <p key={i} className={i > 0 ? "mt-2" : undefined}>
          {p.split(/(\*[^*\n]+\*)/g).map((seg, j) =>
            seg.startsWith("*") && seg.endsWith("*") && seg.length > 2 ? (
              <em key={j} className="text-fg-2/80">{seg.slice(1, -1)}</em>
            ) : (
              <React.Fragment key={j}>{seg.split("\n").map((line, k) => (k === 0 ? line : [<br key={k} />, line]))}</React.Fragment>
            ),
          )}
        </p>
      ))}
    </div>
  );
}
