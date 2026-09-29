# Chattering — engineering conventions

Stack: Next.js 16 App Router (src/), TypeScript, Tailwind 4 (theme tokens in `src/app/globals.css`), Prisma 6 + SQLite, zod 4, lucide-react.
Read `node_modules/next/dist/docs` for anything Next-specific: `params`/`searchParams` are Promises, `proxy.ts` replaces middleware, `PageProps<'/route'>`/`LayoutProps` are global types (run `npx next typegen`).

## Layout
- `src/app/(app)/<tab>/page.tsx` — server components; fetch with `prisma` directly; render client components from `src/components/<tab>/`.
- `src/app/api/**/route.ts` — JSON route handlers. Always wrap with `route()` from `@/lib/api`.
- `src/lib/*` — server helpers. `src/lib/offline/client.ts` — the client `api()` fetch helper.
- Tabs: bottom nav = `/explore`, `/encounter`, `/create`, `/blackbook`; top tabs = `/comics`, `/stories`, `/gallery`. Other routes: `/character/[id]` (profile), `/chat/[id]` (chat), `/moderation`.

## Route handler pattern
```ts
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, json, parseBody, parseQuery, pagination, route } from "@/lib/api";

export const GET = route<{ id: string }>({ policy: "read" }, async ({ req, user, params }) => { ... return json({...}); });
export const POST = route({ policy: "write" }, async ({ req, user }) => { const body = await parseBody(req, schema); ... });
```
- `route()` enforces sign-in (`user` is non-null unless `auth: false`), age verification, and rate limiting (`policy`: read | write | chat | generate | image | report | auth). Throw `new ApiError(status, message)` for client errors.
- List endpoints use cursor pagination: query `?cursor=<lastId>&limit=12` (`pagination` zod schema), response `{ items, nextCursor }`. Cursor is the last item's id: `cursor: { id }, skip: 1` with a stable `orderBy` that ends in `{ id: "desc" }`.
- Client feeds use `useInfiniteFeed<T>(url)` from `@/components/feed/use-infinite-feed` (handles offline cache) and render `<FeedSentinel>`.

## Data rules
- Private/long-form data lives in `*Enc` columns: `encryptJson`/`decryptJson`/`encryptString`/`decryptString` from `@/lib/crypto`. Never return `*Enc` values raw to the client; decrypt and shape them.
- JSON-array columns (`tags`, `themes`, ...) are JSON strings: `parseJsonArray()` from `@/lib/api`, `JSON.stringify([...])` to write.
- Every user-authored text field and every prompt goes through `checkFields()` / `checkText()` from `@/lib/safety` before storage or model calls; character ages through `checkAge()`. On failure throw `ApiError(422, result.reason, { category })`.
- Visibility: `PUBLIC | UNLISTED | PRIVATE`; moderation `status`/`modStatus`: `ACTIVE | HIDDEN | REMOVED`. Public feeds filter `visibility = PUBLIC AND status/modStatus = ACTIVE` plus blocked creators / hidden tags (see `publicCharacterWhere()` in `@/lib/characters` for the character version; content feeds should exclude `authorId in blocked`).
- Characters: `toCard()`, `cardInclude`, `viewerMarks()`, `getSheet()`, `canView()`, `toPromptCharacter()` in `@/lib/characters`. Card UI: `<CharacterCard c={card} blur={prefs.blurNsfw} />` from `@/components/character/character-card`.
- User prefs: `decryptJson<UserPrefs>(user.prefsEnc, defaultPrefs())` from `@/lib/types` (`maxIntensity`, `blurNsfw`, `excludedThemes`, `hardLimits`, ...).
- Record every model call in `Generation` (`kind`, `provider`, `model`, tokens, `durationMs`, `status`).

## AI
```ts
import { getTextProvider, getImageProvider } from "@/lib/ai";
const out = await getTextProvider().complete({ system, messages: [{ role: "user", content }], json: true, meta: { kind: "story", ... } });
const img = await getImageProvider().generate({ prompt, style, orientation, seed, characterSheet });
const media = await storeMedia({ ownerId, data: img.data, mime: img.mime, width: img.width, height: img.height, visibility: "PRIVATE" }); // @/lib/storage
```
Prompt builders live in `@/lib/ai/prompts` (`buildStoryPrompt`, `buildComicPrompt`, `buildRewritePrompt`, `buildCharacterSystemPrompt`). `meta` lets the mock provider return sensible output; real providers ignore it. Always include `SAFETY_SYSTEM_RULES` (the builders already do). Media URLs are `/api/media/<mediaId>`; media visibility must be flipped to PUBLIC when the parent content is published.

## Shared APIs (already implemented)
- `POST/DELETE /api/characters/[id]/favorite`, `POST /api/characters/[id]/rate {score}`
- `POST/DELETE /api/users/[id]/block`, `POST/DELETE /api/users/[id]/follow`
- `POST /api/reports {targetType, targetId, reason, details}` — UI: `<ReportButton targetType="CHARACTER" targetId={id} />`
- `POST /api/chats {characterId, personaId?, context?: ChatContext, preview?: boolean}` → `{ id }`, then navigate to `/chat/[id]`. `GET /api/chats?characterId=` lists the user's chats.
- `GET /api/media/[id]` streams decrypted media (owner or PUBLIC).
- `GET /api/collections`, `POST /api/collections {name}`, `POST /api/collections/[id]/items {targetType, targetId}`, `DELETE /api/collections/[id]/items?targetType=&targetId=` (Blackbook owns these).

## UI
- Primitives in `@/components/ui`: `Button` (variants primary/secondary/ghost/danger/gold/outline; `href` renders a Link), `Input`, `Textarea`, `Select`, `Field`, `Toggle`, `Chip`, `IntensityBadge`, `Avatar`, `Skeleton`, `EmptyState`, `ErrorState`, `SectionTitle`, `Spinner`, `Sheet` (bottom sheet/modal), `useToast()`, `Segmented`, `BlurGuard`, `Stars`.
- Mobile-first, dark, uncluttered. Use `card`, `glass`, `fade-up`, `masonry` CSS classes. Keep contrast accessible; every icon-only button gets `aria-label`.
- Every screen needs: loading state (skeletons), empty state, error state with retry.
- Client components fetch with `api<T>(url, { method, json })` from `@/lib/offline/client`; it throws `ApiClientError` / `OfflineError`.
