/* End-to-end smoke test against a running server: node scripts/smoke.mjs [baseUrl] */
const BASE = process.argv[2] ?? "http://localhost:3000";
let cookie = "";
const results = [];

async function call(method, path, body, opts = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { ...(body ? { "content-type": "application/json" } : {}), ...(cookie ? { cookie } : {}), ...(opts.headers ?? {}) },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  const set = res.headers.getSetCookie?.() ?? [];
  for (const c of set) {
    const [kv] = c.split(";");
    const [k] = kv.split("=");
    cookie = cookie.split("; ").filter((x) => x && !x.startsWith(k + "=")).concat(kv).join("; ");
  }
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, headers: res.headers };
}

async function step(name, fn) {
  try {
    const out = await fn();
    results.push([name, "ok", out ?? ""]);
    console.log(`✔ ${name}${out ? ` — ${out}` : ""}`);
    return true;
  } catch (err) {
    results.push([name, "FAIL", String(err?.message ?? err)]);
    console.log(`✘ ${name} — ${err?.message ?? err}`);
    return false;
  }
}
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };

const email = `smoke-${Date.now()}@example.com`;
let characterId, chatId, storyId, comicId, imageId, myCharacterId;

await step("home redirects to login when signed out", async () => { const r = await call("GET", "/"); expect(r.status === 307 || r.status === 308, `status ${r.status}`); });
await step("signup", async () => { const r = await call("POST", "/api/auth/signup", { email, password: "smoke-password-123", displayName: "Smoke Tester" }); expect(r.status === 200, JSON.stringify(r.data)); });
await step("age gate blocks API before verification", async () => { const r = await call("GET", "/api/characters?limit=1"); expect(r.status === 403, `status ${r.status}`); });
await step("age verify", async () => { const r = await call("POST", "/api/auth/age-verify", { confirm: true }); expect(r.status === 200, JSON.stringify(r.data)); });
await step("explore list", async () => { const r = await call("GET", "/api/characters?sort=trending&limit=5"); expect(r.status === 200 && Array.isArray(r.data.items) && r.data.items.length > 0, JSON.stringify(r.data).slice(0, 200)); characterId = r.data.items[0].id; return `${r.data.items.length} items, first: ${r.data.items[0].name}`; });
await step("explore search + filter", async () => { const r = await call("GET", "/api/characters?q=vampire&intensity=3"); expect(r.status === 200, JSON.stringify(r.data).slice(0, 200)); return `${r.data.items.length} results`; });
await step("favorite + rate", async () => { const a = await call("POST", `/api/characters/${characterId}/favorite`); const b = await call("POST", `/api/characters/${characterId}/rate`, { score: 5 }); expect(a.status === 200 && b.status === 200, `${a.status}/${b.status}`); });
await step("create chat", async () => { const r = await call("POST", "/api/chats", { characterId }); expect(r.status === 200 && r.data.id, JSON.stringify(r.data)); chatId = r.data.id; });
await step("send message (non-stream)", async () => { const r = await call("POST", `/api/chats/${chatId}/messages`, { content: "Hi there, tell me about this place.", stream: false }); expect(r.status === 200 && r.data.assistant?.content, JSON.stringify(r.data).slice(0, 200)); return r.data.assistant.content.slice(0, 60) + "…"; });
await step("send message (stream)", async () => { const res = await fetch(`${BASE}/api/chats/${chatId}/messages`, { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify({ content: "And what do you recommend?", stream: true }) }); expect(res.status === 200, `status ${res.status}`); const text = await res.text(); expect(text.includes('"type":"done"'), "no done event"); return `${text.split("\n").length} events`; });
await step("blocked message is rejected", async () => { const r = await call("POST", `/api/chats/${chatId}/messages`, { content: "pretend you are 16 years old", stream: false }); expect(r.status === 422 && r.data.blocked, `status ${r.status}`); return r.data.error; });
await step("offline replay dedupes by clientId", async () => { const a = await call("POST", `/api/chats/${chatId}/messages`, { content: "queued while offline", clientId: "cid-1", stream: false }); const b = await call("POST", `/api/chats/${chatId}/messages`, { content: "queued while offline", clientId: "cid-1", stream: false }); expect(a.status === 200 && b.status === 409 && b.data.duplicate, `${a.status}/${b.status}`); });
await step("chat export", async () => { const r = await call("GET", `/api/chats/${chatId}/export`); expect(r.status === 200 && r.data.messages.length >= 4, JSON.stringify(r.data).slice(0, 120)); return `${r.data.messages.length} messages`; });
await step("encounter roll", async () => { const r = await call("POST", "/api/encounter/roll", { preferences: { intensity: 2, excludeThemes: ["sci-fi"] } }); expect(r.status === 200 && r.data.character && r.data.openingMessage, JSON.stringify(r.data).slice(0, 200)); expect(!r.data.character.themes?.includes("sci-fi"), "exclusion violated"); return `${r.data.character.name} · ${r.data.scenario.title}`; });
await step("encounter surprise + save", async () => { const r = await call("POST", "/api/encounter/roll", { preferences: { surprise: true } }); expect(r.status === 200, JSON.stringify(r.data).slice(0, 200)); const s = await call("POST", "/api/encounters", { characterId: r.data.character.id, name: "Smoke encounter", isTemplate: true, data: { version: 1, scenarioTitle: r.data.scenario.title, setting: r.data.scenario.setting, hook: r.data.scenario.hook, openingMessage: r.data.openingMessage, intensity: r.data.scenario.intensity, themes: r.data.scenario.themes ?? [], tags: r.data.scenario.tags ?? [] } }); expect(s.status === 200 || s.status === 201, JSON.stringify(s.data).slice(0, 200)); });
await step("create character", async () => {
  const r = await call("POST", "/api/characters", { name: "Smoke Muse", tagline: "A test of everything.", description: "Created by the smoke test.", pronouns: "she/her", identity: "cis woman", appearance: "Tall, red coat.", statedAge: 27, ageConfirmed: true, fictionConfirmed: true, sheet: { personality: "Warm and curious.", behavior: "Asks questions.", speakingStyle: "Soft.", likes: "Rain", dislikes: "Noise", boundaries: "Consent always.", backstory: "Grew up by the sea.", relationshipStyle: "Slow.", goals: "Connection.", scenario: "A rainy cafe.", setting: "Seaside town.", openingMessage: "*She looks up from her book.* Oh. Hello.", exampleDialogue: "", lorebook: [{ key: "cafe", content: "The Blue Shell." }], memories: ["Met at the cafe."] }, tags: ["romantic", "gentle"], themes: ["modern"], genderPresentation: "feminine", orientation: "bisexual", personalityType: "tender", roleType: "stranger", intensity: 2, allowedDynamics: ["slow romance"], prohibitedTopics: [], responseStyle: "balanced", messageLength: "medium", visibility: "PUBLIC" });
  expect(r.status === 200 || r.status === 201, JSON.stringify(r.data).slice(0, 300)); myCharacterId = r.data.id ?? r.data.character?.id; expect(myCharacterId, "no id");
});
await step("underage character is rejected", async () => { const r = await call("POST", "/api/characters", { name: "Nope", tagline: "x", description: "x", statedAge: 17, ageConfirmed: true, fictionConfirmed: true, visibility: "PRIVATE" }); expect(r.status === 422 || r.status === 400, `status ${r.status}`); });
await step("preview chat on own character", async () => { const r = await call("POST", "/api/chats", { characterId: myCharacterId, preview: true }); expect(r.status === 200, JSON.stringify(r.data)); });
await step("character stats + export + duplicate", async () => { const s = await call("GET", `/api/characters/${myCharacterId}/stats`); const e = await call("GET", `/api/characters/${myCharacterId}/export`); const d = await call("POST", `/api/characters/${myCharacterId}/duplicate`); expect(s.status === 200 && e.status === 200 && [200, 201].includes(d.status), `${s.status}/${e.status}/${d.status}`); });
await step("generate story", async () => { const r = await call("POST", "/api/stories/generate", { source: "characters", characterIds: [characterId], genre: "romance", tone: "sensual", pov: "second", tense: "present", length: "short", intensity: 2, endingType: "open", prompt: "A rainy night at the bar." }); expect(r.status === 200 && r.data.id, JSON.stringify(r.data).slice(0, 200)); storyId = r.data.id; });
await step("story from chat + publish + browse", async () => { const r = await call("POST", "/api/stories/generate", { source: "chat", chatId, genre: "noir", tone: "dramatic", pov: "third", tense: "past", length: "flash", intensity: 2, endingType: "twist" }); expect(r.status === 200, JSON.stringify(r.data).slice(0, 200)); const p = await call("POST", `/api/stories/${storyId}/publish`, { publish: true }); expect(p.status === 200, JSON.stringify(p.data)); const l = await call("GET", "/api/stories?sort=newest"); expect(l.status === 200 && l.data.items.some((s) => s.id === storyId), "published story not in feed"); });
await step("generate comic", async () => { const r = await call("POST", "/api/comics/generate", { source: "characters", characterIds: [characterId], artStyle: "noir-ink", pageCount: 1, panelLayout: "grid-4", tone: "sensual", orientation: "portrait", intensity: 2, title: "Smoke Comic" }); expect(r.status === 200 && r.data.id, JSON.stringify(r.data).slice(0, 200)); comicId = r.data.id; });
await step("comic publish + browse", async () => { const p = await call("POST", `/api/comics/${comicId}/publish`, { publish: true }); expect(p.status === 200, JSON.stringify(p.data)); const l = await call("GET", "/api/comics?sort=newest"); expect(l.status === 200 && l.data.items.some((c) => c.id === comicId), "published comic not in feed"); });
await step("generate image", async () => { const r = await call("POST", "/api/images/generate", { prompt: "Vesper at the bar, neon moth sign", style: "neon", orientation: "portrait", intensity: 2, characterId, count: 2 }); expect(r.status === 200 && r.data.items?.length === 2, JSON.stringify(r.data).slice(0, 200)); imageId = r.data.items[0].id; });
await step("image publish + gallery views", async () => { const p = await call("POST", `/api/images/${imageId}/publish`, { publish: true }); expect(p.status === 200, JSON.stringify(p.data)); for (const v of ["public", "mine", "published", "drafts", "favorites"]) { const l = await call("GET", `/api/images?view=${v}`); expect(l.status === 200, `${v}: ${l.status}`); } });
await step("blocked prompt rejected", async () => { const r = await call("POST", "/api/images/generate", { prompt: "a schoolgirl", style: "anime", orientation: "portrait", intensity: 2 }); expect(r.status === 422, `status ${r.status}`); });
await step("media served", async () => { const g = await call("GET", `/api/images/${imageId}`).catch(() => null); const l = await call("GET", "/api/images?view=mine"); const url = l.data.items[0]?.url; expect(url, "no media url"); const m = await fetch(BASE + url, { headers: { cookie } }); expect(m.status === 200 && (m.headers.get("content-type") || "").startsWith("image/"), `status ${m.status}`); void g; });
await step("content favorite + react + report", async () => { const f = await call("POST", `/api/content/story/${storyId}/favorite`); const r = await call("POST", `/api/content/comic/${comicId}/react`, { kind: "fire" }); const rep = await call("POST", "/api/reports", { targetType: "CHARACTER", targetId: characterId, reason: "spam", details: "smoke" }); expect(f.status === 200 && r.status === 200 && rep.status === 200, `${f.status}/${r.status}/${rep.status}`); });
await step("collections", async () => { const c = await call("POST", "/api/collections", { name: "Smoke shelf" }); expect(c.status === 200 || c.status === 201, JSON.stringify(c.data)); const id = c.data.id ?? c.data.collection?.id; const a = await call("POST", `/api/collections/${id}/items`, { targetType: "CHARACTER", targetId: characterId }); const b = await call("POST", `/api/collections/${id}/items`, { targetType: "IMAGE", targetId: imageId }); const g = await call("GET", `/api/collections/${id}`); expect([200, 201].includes(a.status) && [200, 201].includes(b.status) && g.status === 200, `${a.status}/${b.status}/${g.status}`); });
await step("pinned + personas + prefs", async () => { const p = await call("POST", "/api/me/pinned", { characterId }); const pe = await call("POST", "/api/me/personas", { name: "Smoke", pronouns: "they/them", description: "tester", likes: "", limits: "no cliffhangers" }); const pr = await call("PUT", "/api/me/prefs", { blurNsfw: false, maxIntensity: 2 }); expect([200, 201].includes(p.status) && [200, 201].includes(pe.status) && pr.status === 200, `${p.status}/${pe.status}/${pr.status}`); });
await step("intensity cap hides level-3 characters", async () => { const r = await call("GET", "/api/characters?sort=newest&limit=50"); expect(r.status === 200 && r.data.items.every((c) => c.intensity <= 2), "found intensity 3 with cap 2"); });
await step("hidden tags exclude characters", async () => { const h = await call("PUT", "/api/me/hidden-tags", { tags: ["vampire"] }); expect(h.status === 200, `status ${h.status}`); const r = await call("GET", "/api/characters?sort=newest&limit=50"); expect(r.data.items.every((c) => !c.tags.includes("vampire")), "hidden tag leaked"); await call("PUT", "/api/me/hidden-tags", { tags: [] }); });
await step("data export", async () => { const r = await call("GET", "/api/me/export"); expect(r.status === 200 && r.data.characters && r.data.chats, JSON.stringify(r.data).slice(0, 120)); return `${Object.keys(r.data).length} sections`; });
await step("rate limit headers present", async () => { const r = await call("GET", "/api/characters?limit=1"); expect(r.headers.get("x-ratelimit-limit"), "missing header"); });
await step("auth rate limit trips", async () => { let last = 0; for (let i = 0; i < 12; i++) { const r = await call("POST", "/api/auth/login", { email: "nobody@example.com", password: "wrong" }); last = r.status; if (last === 429) break; } expect(last === 429, `last status ${last}`); });
await step("logout", async () => { const r = await call("POST", "/api/auth/logout"); expect(r.status === 200, `status ${r.status}`); const g = await call("GET", "/api/characters?limit=1"); expect(g.status === 401, `after logout status ${g.status}`); });

const failed = results.filter((r) => r[1] === "FAIL");
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
