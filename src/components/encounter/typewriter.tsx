"use client";
import * as React from "react";

/** Reveals text progressively; click/tap or reduced-motion shows it all at once. */
export function Typewriter({ text, speed = 14, className }: { text: string; speed?: number; className?: string }) {
  const [shown, setShown] = React.useState(0);
  const reduced = React.useRef(false);
  React.useEffect(() => {
    reduced.current = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced.current) {
      setShown(text.length);
      return;
    }
    setShown(0);
    let i = 0;
    const id = setInterval(() => {
      i += 2;
      setShown(i);
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);
  const done = shown >= text.length;
  return (
    <button type="button" onClick={() => setShown(text.length)} disabled={done} className={`block w-full cursor-text text-left focus-ring rounded-lg ${className ?? ""}`} aria-label={done ? undefined : "Skip animation"} aria-live="polite">
      <span className="sr-only">{text}</span>
      <span aria-hidden className="whitespace-pre-wrap">
        {text.slice(0, shown)}
        {!done && <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-accent-2 align-middle" />}
      </span>
    </button>
  );
}
