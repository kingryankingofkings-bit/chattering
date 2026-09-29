import { describe, expect, it } from "vitest";
import { MockTextProvider } from "@/lib/ai/text/mock";
import { MockImageProvider } from "@/lib/ai/image/mock";

describe("mock providers", () => {
  const text = new MockTextProvider();
  it("answers in character and drops out of scene on stop", async () => {
    const reply = await text.complete({ system: "", messages: [{ role: "user", content: "hello there" }], meta: { kind: "chat", characterName: "Vesper" } });
    expect(reply.text.length).toBeGreaterThan(20);
    const stop = await text.complete({ system: "", messages: [{ role: "user", content: "stop" }], meta: { kind: "chat", characterName: "Vesper" } });
    expect(stop.text).toMatch(/out of scene/i);
  });
  it("returns valid JSON for story and comic scripts", async () => {
    const story = JSON.parse((await text.complete({ system: "", messages: [{ role: "user", content: "premise" }], json: true, meta: { kind: "story", length: "medium" } })).text);
    expect(story.chapters.length).toBe(2);
    const comic = JSON.parse((await text.complete({ system: "", messages: [{ role: "user", content: "premise" }], json: true, meta: { kind: "comic", pageCount: 2, panelsPerPage: 3 } })).text);
    expect(comic.pages).toHaveLength(2);
    expect(comic.pages[0].panels).toHaveLength(3);
  });
  it("streams deltas that concatenate to the full text", async () => {
    const gen = text.stream({ system: "", messages: [{ role: "user", content: "hi" }], meta: { kind: "chat" } });
    let acc = "";
    let r = await gen.next();
    while (!r.done) { acc += r.value; r = await gen.next(); }
    expect(acc).toBe(r.value.text);
  });
  it("renders deterministic SVG images", async () => {
    const img = new MockImageProvider();
    const a = await img.generate({ prompt: "moth and lantern", style: "neon", orientation: "portrait", seed: 7 });
    const b = await img.generate({ prompt: "moth and lantern", style: "neon", orientation: "portrait", seed: 7 });
    expect(a.mime).toBe("image/svg+xml");
    expect(a.data.equals(b.data)).toBe(true);
    expect(a.width).toBe(768);
  });
});
