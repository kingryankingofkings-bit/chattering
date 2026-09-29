# Chattering

A polished, mobile-first, adults-only (18+) AI companion app: fictional adult characters, roleplay chat, generated stories, comics and images. Dark, private, uncluttered.

Four bottom tabs — **Explore · Random Encounter · Create · Blackbook** — and three top content tabs — **Comics · Stories · Gallery**.

## Quick start

Everything below runs **inside the cloned project folder**. Commands are the same in PowerShell, cmd and bash.

```bash
git clone https://github.com/kingryankingofkings-bit/chattering.git
cd chattering
npm install
npm run setup     # writes .env with fresh keys, creates ./data/chattering.db, seeds demo content
npm run dev       # http://localhost:3000
```

`npm run setup` is safe to re-run. If you prefer to do it by hand: copy `.env.example` to `.env`, fill `APP_ENCRYPTION_KEYS` (`v1:` + 32 random bytes base64) and `SESSION_SECRET`, then `npx prisma migrate deploy` and `npm run db:seed`.

Sign up (the first account becomes ADMIN and can open `/moderation`). Seeded creators use the password `demo-password-1234` (e.g. `nocturne@chattering.example`).

By default the AI adapters are **mock** providers that run entirely offline, so every flow (chat, stories, comics, images) works end to end with no API keys. Switch providers in `.env`:

| Variable | Values |
| --- | --- |
| `AI_TEXT_PROVIDER` | `mock` · `openai-compatible` (OpenAI, OpenRouter, vLLM, Ollama, LM Studio…) · `anthropic` |
| `AI_IMAGE_PROVIDER` | `mock` (deterministic SVG art) · `openai-compatible` (Images API shape) |

Adapters live in `src/lib/ai/` behind the `TextProvider` / `ImageProvider` interfaces; add a provider by implementing one class and registering it in `src/lib/ai/index.ts`. The app never talks to a vendor SDK directly.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` / `npm run build` / `npm start` | Next.js |
| `npm run lint` / `npm run typecheck` / `npm test` | ESLint, `tsc --noEmit`, Vitest |
| `npm run db:migrate` | apply Prisma migrations (`prisma migrate deploy`) |
| `npm run db:seed` | seed demo data (idempotent) |
| `npm run rotate-keys` | re-encrypt every encrypted column and media blob under the active key |

## Architecture

```
src/app/(app)/{explore,encounter,create,blackbook,comics,stories,gallery,character,chat,creator,moderation,appeals}
src/app/(auth)/{login,signup,age-gate}      src/app/legal/[slug]
src/app/api/**                              JSON route handlers (all wrapped by lib/api.ts `route()`)
src/lib/ai/                                 provider interfaces, mock + OpenAI-compatible + Anthropic adapters, prompt builders
src/lib/{auth,crypto,rate-limit,safety,storage,chat,characters,moderation,migrate-data}.ts
src/lib/offline/                            IndexedDB cache, outbox, client fetch helper
src/components/**                           UI primitives and per-tab components
public/sw.js                                service worker (app shell + read-API + media caching)
prisma/schema.prisma, prisma/migrations     SQLite schema and migrations
docs/CONVENTIONS.md                         engineering conventions
```

### Privacy, safety and security

- **Sign-in and 18+ gate** before any adult content (`src/proxy.ts` + `getCurrentUser()`); every character carries a stated age ≥ 18 plus explicit "adult" and "fictional" confirmations.
- **Content policy enforcement**: `src/lib/safety.ts` screens every user-authored field, prompt and chat message for minors/minor-coded content, real people/deepfakes, non-consent, incest, bestiality and trafficking before storage or any model call; the same rules are injected into every system prompt. Reports, a moderation queue (`/moderation`), hide/remove/restore/warn actions, auto-hide on repeated severe reports, creator blocking, hidden tags, intensity caps, blur/spoiler controls and appeals (`/appeals`).
- **Encryption**: chats, character sheets, personas, prompts, story/comic bodies, report details and every media blob are encrypted at rest with AES-256-GCM (`src/lib/crypto.ts`) under versioned keys, so keys can be rotated without downtime. Session tokens are stored hashed (HMAC), passwords with bcrypt, cookies are `httpOnly`/`SameSite=Lax`/`Secure`. Security headers and a CSP are applied to every response.
- **Rate limiting**: sliding-window limits per user (or per IP when signed out) with per-route policies (auth, chat, generate, image, report, read, write) and standard `X-RateLimit-*` / `Retry-After` headers. The store is pluggable (`setRateLimitStore`) for Redis in multi-instance deployments.
- **Private by default**: everything a user creates is `PRIVATE`/`DRAFT` until they publish, and the publish dialog spells out what becomes public. Data export and account deletion live in Blackbook › Account.

### Offline mode and local persistence

- `public/sw.js` caches the app shell and static assets (cache-first), read APIs (network-first with cache fallback) and media (cache-first). It registers in production builds.
- `src/lib/offline/idb.ts` keeps recently opened chats, messages and feed pages in IndexedDB; the chat screen renders from it when offline.
- Messages composed offline go to an **outbox** with a client id and replay when connectivity returns (`OfflineProvider`); the server de-duplicates by `(chatId, clientId)`.

### Data migration between model/app versions

- Schema changes go through Prisma migrations. Encrypted JSON blobs carry a `version` and are upgraded lazily on read (`src/lib/migrate-data.ts`), so records written by older versions keep working.
- Every generation records `provider` and `model` (`Generation`, plus per-record fields) so content can be traced or regenerated when providers change.
- `npm run rotate-keys` re-encrypts all data when the encryption key changes.

## Deploying

Set `NODE_ENV=production`, real keys in `.env`, run `npm run build && npm run db:migrate && npm start`. To move from SQLite to Postgres, change the datasource provider in `prisma/schema.prisma` and create a new migration; no application code depends on SQLite. Media is stored on local disk under `MEDIA_DIR`; `src/lib/storage.ts` is the only file to change for S3.
