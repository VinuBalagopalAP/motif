# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Motif is a serverless Next.js 16 (App Router, React 19) app that turns a single product prompt + URL into a TikTok/Reels-style UGC video. It exposes a ChatGPT-style threaded chat where each message is dynamically classified as either plain chat or a video-generation request. Videos are *not* encoded server-side — the backend produces a JSON `RenderSpec` that the browser renders live with Remotion.

## Commands

```bash
npm run dev      # Start dev server (next dev)
npm run build    # Production build
npm run start    # Serve production build
npm run lint     # ESLint (eslint-config-next)
```

There is no test suite. Path alias `@/*` maps to `src/*`.

Required env vars in `.env.local` (see README for full list):
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `CLAUDE_API` — Anthropic API key; if set, Claude is tried first for LLM calls (see below)
- `GEMINI_API_KEY` plus optional `GEMINI_API_KEY_2..4` (Gemini fallback + key rotation, see below)
- `PEXELS_API_KEY`, `GIPHY_API_KEY` (optional — pipeline falls back to `trend-pack.json` without them; iTunes needs no key)

## Architecture

### The "RenderSpec" pattern (most important concept)
The server never runs FFmpeg (deliberate — it crashes inside Vercel's serverless limits). Instead the pipeline assembles a plain JSON `RenderSpec` (interface defined in `src/lib/jobs.ts`) describing background video/image, overlay text, GIF overlay, and audio. The client mounts this spec into `<Player>` (`@remotion/player`) using the `UgcVideo` component (`src/remotion/UgcVideo.tsx`), rendering at 60fps in-browser. Any change to the spec shape must be kept in sync across `jobs.ts` (interface), `pickAssets.ts` (producer), and `UgcVideo.tsx` (consumer).

### Request flow
1. Client (`src/app/page.tsx`) POSTs to `/api/chat` with `message`, `userId`, `history`, optional `chatId`, and a Supabase `Authorization: Bearer <token>` header.
2. `/api/chat/route.ts` runs `classifyMessage` **synchronously** to decide `chat` vs `ugc`.
   - **chat**: runs the web-capable `runChatAgent` (`chatAgent.ts`, see below), resolved immediately, appended to history (with `sources`), persisted, returned in the same response (no background work).
   - **ugc**: kicks off `runPipelineWorker` via Next's `after()` and returns a `jobId` for polling.
3. The client polls `GET /api/jobs/[id]` on an interval until the job `status` becomes `done` or `error`, then re-reads history.

### The pipeline worker (`src/lib/pipeline/worker.ts`)
`runPipelineWorker` is a sequential state machine that writes its `status` to the DB at each step so the UI can show live progress: `classifyMessage` → URL regex extract → `scrapeSite` (cheerio) → `generateConcept` (Gemini, single combined prompt) → `pickAssets`. Note: the in-memory `jobQueue`/`enqueueJob` at the top of this file is legacy and **not used in production** — routes call `runPipelineWorker` directly inside `after()` because in-memory queues don't survive serverless invocations. `export const maxDuration = 60` on every route keeps the lambda alive until the worker finishes.

### LLM provider chain (Claude primary → Gemini fallback → key rotation)
`classifyMessage.ts` and `generateConcepts.ts` follow the same provider chain (model `claude-sonnet-4-6`):
1. **Claude first** — if `process.env.CLAUDE_API` is set, try Anthropic (`@anthropic-ai/sdk`) once. On any error, log a warning and fall through to Gemini.
2. **Gemini fallback with key rotation** — build a key list from `GEMINI_API_KEY`..`GEMINI_API_KEY_4` and loop: on any failure (esp. `429`) catch and retry with the next key. Gemini free tier is 15 req/min, so this matters during rapid testing. Model is `gemini-2.5-flash`.

Both are prompted for strict JSON; the response text strips ```` ```json ```` fences before `JSON.parse`. When editing one prompt, edit the **same prompt string** that feeds both providers — the prompt is built once at the top of each function and passed to whichever provider runs.

### Web-capable chat agent (`src/lib/pipeline/chatAgent.ts`)
`runChatAgent(message, history)` powers the conversational **chat** path (not the UGC pipeline). It calls Claude (`claude-sonnet-4-6`) with the server-side `web_search_20260209` + `web_fetch_20260209` tools (each capped at `max_uses: 5`), so Claude decides when to search the web or fetch a pasted link and returns a cited answer — no scraping infra. It handles the `pause_turn` server-tool continuation loop (capped at 5), concatenates `text` blocks into `reply`, and dedupes citation URLs into `sources: {url, title}[]`. Returns `null` when `CLAUDE_API` is unset or Claude errors, so `route.ts` falls back to the Gemini classifier reply (no web). `sources` are persisted in the `chat_history` entry (`{role:'assistant', type:'chat', content, sources}`) and rendered as a link list under the chat bubble in `page.tsx`. Streaming and feeding research into the video pipeline are deliberately deferred.

### Asset fetching (`src/lib/pipeline/pickAssets.ts`)
Fetches Pexels (vertical video), Giphy (sticker), and iTunes (30s music preview) concurrently via `Promise.all`, each randomly selecting from up to 15 results for variety. Every fetch degrades gracefully to `src/lib/trend-pack.json` on missing key / error / rate limit, guaranteeing a video always renders.

### Persistence & chat threading (Supabase)
- A single `video_jobs` row **is an entire chat session**. Full conversation history lives in `product_json.chat_history` (nested JSON array of `{role, type, content|render_spec}`). Threads are rehydrated by reading this array — there is no separate messages table. This was chosen to add threading without schema migrations.
- RLS is enabled (`supabase/migrations/0002_add_auth.sql`); users only see their own rows. **Background workers must pass the user's JWT** — `jobs.ts#getScopedClient(token)` builds a per-request client with the `Authorization` header so RLS-protected writes succeed. Forgetting the token causes silent write failures. The module-level `supabase` client (anon, `src/lib/supabase.ts`) is only for unauthenticated/client contexts.
- Auth state is provided client-side by `src/components/AuthProvider.tsx` (`useAuth()`); `/login` handles sign-in.

### API routes
- `POST /api/chat` — main entry; classify + create/continue job.
- `GET /api/jobs/[id]` — poll job status (token-scoped).
- `POST /api/chat/regenerate` — reset a job's outputs and re-run the worker with the original message.
- `POST /api/chat/edit` — replace a job's message in-place (clears outputs) and re-run, so editing a prompt doesn't create duplicate library entries.

### UI
`src/app/page.tsx` (~600 lines) is the whole chat UI: sidebar library, message feed with inline Remotion `<Player>`, polling loop, and edit/regenerate actions. Styling is vanilla CSS (`src/app/globals.css`) plus Tailwind v4 via PostCSS — dark-mode, glassmorphism, mobile-responsive.
