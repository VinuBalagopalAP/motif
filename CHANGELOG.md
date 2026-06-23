# Changelog

All notable changes to the Motif UGC Video Generator will be documented in this file.

## [1.12.0] - 2026-06-24

### Changed (UI Decomposition Phase 3)
- **ChatFeed & VideoEditor Refactoring**: Extracted the monolithic `ChatFeed.tsx` into individual modular bubble components (`UserMessageBubble`, `VideoResultBubble`, `ChatReplyBubble`, `StatusBubble`). Refactored `VideoEditor.tsx` into specific tab components (`BackgroundTab`, `CaptionsTab`, `MemeTab`), vastly reducing file line counts and improving codebase maintainability.

## [1.11.0] - 2026-06-24

### Changed (Free Tier Hardening & Security)
- **Edge Caching for Viral Shares**: Refactored the React-based `/share/[shareId]` page into a Next.js Server Component equipped with strict `revalidate = 300` Incremental Static Regeneration (ISR). This guarantees that viral video links rely on Vercel's Edge Network CDN rather than hammering the Supabase database.
- **Polling Query Optimization**: Stripped massive relational `messages` table joins from the background UI HTTP poller (`useJobPoller`). By implementing a strict `getJobStatus()` read layer, polling payloads are reduced by over 90%, preserving Supabase CPU and bandwidth.
- **Strict API Security Validation**: Hardened all auxiliary endpoints (`/api/search-gifs`, `/api/share`, `/api/shares/[id]`) with explicit `zod` object schemas. Any malformed payload is intercepted before network egress or DB connections occur.
- **Structured Error Tracing**: Migrated basic `console.error` logs to `pino` structured format for standardized debugging.

## [1.10.0] - 2026-06-24

### Changed (Enterprise Database Normalization)
- **Database Architecture Transformation**: Executed Phase 2 of the enterprise roadmap. Stripped out the monolithic, brittle `chat_history` JSONB structure from the `video_jobs` table.
- **Relational `messages` Table**: Created a strictly normalized, fully relational `messages` table with an explicit foreign key (`job_id`) linking back to the `video_jobs` table. This completely eliminates the 60-second fetch-modify-write race conditions the Vercel background workers were facing.
- **Data Backfill**: Executed `0009_create_messages.sql` with an elegant `jsonb_array_elements` migration script to parse all legacy JSON chat histories into the new strongly-typed SQL table, preserving chronological order and user feedback without data loss.
- **Decoupled API Architecture**: The Next.js API Routes (`/api/chat`, `/api/chat/edit`, `/api/feedback`, and `/api/chat/regenerate`) now exclusively execute row-by-row `INSERT` and `UPDATE` statements on the `messages` table using dedicated `job.ts` helper methods.
- **Strict DB Typing**: Deleted `chat_history` from the loose `ProductJson` typing schema and added strict `DbMessage[]` properties to the overarching `Job` type in `src/types/index.ts`.

## [1.9.4] - 2026-06-24

### Changed
- **Massive React Re-render Optimization**: Localized the `input` string state completely within `ChatInput.tsx`. Previously, it was held in `useChatEngine.ts` causing the entire `page.tsx` component tree (including `ChatFeed`, `Sidebar`, and Modals) to completely re-render on every single keystroke. This change drastically improves typing performance during long chat sessions.
- **Dead Code Pruning**: Completed a massive codebase cleanup, deleting unused route directories (`src/app/video`), removing orphaned local types (`Message`, `ParsedArtifact`), unused hooks, and redundant imports left over from the Phase 1 UI decomposition.

## [1.9.3] - 2026-06-24

### Changed
- **Architecture Trade-offs Documented**: Updated documentation to reflect the architectural tradeoff of using HTTP polling vs. Supabase Realtime (WebSockets) for job status tracking to save initial MVP complexity.
- **UI Decomposition (Phase 1)**: Executed the structural decomposition of the `page.tsx` God Object, successfully slashing its size from ~2,250 lines to ~1,090 lines without altering business logic. Extracted major UI boundaries:
  - `ChatFeed.tsx`: Handles recursive message mapping, markdown rendering, artifact state tracking, and source citations.
  - `VideoEditor.tsx`: Encapsulates complex media playback, font/gif controls, and caption selection logic.
  - `ChatInput.tsx`: Encapsulates the massive footer textarea, file upload handling, and bottom bar.
  - `Sidebar.tsx`: Encapsulates the mobile/desktop library sidebar layout and user settings menu.
  - `Modals`: Extracted `ExportModal`, `SharedLinksModal`, `ImagePreviewModal`, `ConfirmDisableModal`, and `FeedbackModal` into a dedicated `src/components/modals/` directory.
  - `useJobPoller.ts`: Extracted the `setInterval` API polling logic out of the UI into a dedicated hook.

### Fixed
- **History Hydration Crashes**: Fixed a critical `TypeError: Cannot read properties of undefined (reading 'type')` crash in `page.tsx` during history loading. Added defensive optional chaining (`activeVariant?.type`) around all history variant map functions to safely handle empty or malformed variant arrays.
- **Duplicate Type Declarations**: Identified redundant `Message` interface declarations between `src/types/index.ts` and `page.tsx` for future consolidation.

### Added (Enterprise Foundation)
- **Error Boundaries**: Implemented Next.js `error.tsx` and `global-error.tsx` to catch unexpected UI rendering crashes gracefully.
- **Zod Schema Validation**: Introduced strict runtime request validation in `/api/chat/route.ts` using `zod` to prevent malformed payloads from executing.
- **Structured Logging (Pino)**: Added `pino` for robust, structured JSON logging (`logger.error`, `logger.warn`) in the backend, replacing weak `console.log` statements.
- **Testing Infrastructure (Vitest)**: Initialized `vitest` and added a foundational unit test suite for the `schemas.ts` to unblock future TDD efforts.

## [1.9.2] - 2026-06-23

### Changed
- **Senior Engineer Architecture Review**: Identified `ChatInterface.tsx` as misleading dead code since the Next.js App Router relies completely on `page.tsx`. Initiated a rigorous, component-by-component teardown of the 2,248-line `page.tsx` monolith to adhere to strict Single Responsibility Principles required by enterprise teams.

### Fixed
- **Strict TypeScript Compliance**: Added missing typing definitions to `src/types/index.ts` (e.g., `ChatHistoryMessage.attachments`, `variants`, `userFeedback`) to satisfy strict build requirements.
- **Next.js Production Build**: Fixed several type-casting errors inside `page.tsx` conditional rendering blocks that were causing `npm run build` to fail in production.
- **Undefined property crashes**: Added defensive optional chaining to the stream endpoints and `page.tsx` so the app doesn't crash when `product_json` or `lastUserMsg.content` are undefined during partial regenerations.

### Removed
- **Dead Code**: Completely eliminated the unused `src/components/ChatInterface.tsx`, its unused stub sub-components, and redundant hooks (`useChatManager`, `useJobPolling`) to clean up the workspace structure.

## [1.9.1] - 2026-06-22

### Fixed
- **Stacked/Double Meme Issue**: Fixed a bug where changing a meme simply added the new GIF on top of the old one by giving the Remotion `<Gif>` component a React `key={spec.gifOverlay.url}` to enforce unmounting.
- **Missing Preview / Refresh Required**: The UI polling loop successfully injected the completed video spec but forgot to change the variant `type` from `'chat'` to `'video'`. This kept the video player hidden until a refresh loaded the correct type from the database.
- **`.webp` EncodingError**: Updated the asset pipeline to strictly filter out `.webp` fallbacks from Klipy so the Remotion `<Gif>` component never crashes.
- **Image Switch EncodingError**: Radically improved background media switching in `UgcVideo.tsx` by unconditionally mounting *both* the image and video backgrounds (when available) and swapping their CSS `opacity`. This instantly makes background switching seamless and completely eliminates the browser's `EncodingError` caused by aborted image decodes when unmounting.
- **Memory Leak in UI**: Fixed a stray `window.addEventListener('unhandledrejection')` that was leaking outside of a `useEffect` on every render.

## [1.9.0] - 2026-06-22

### Added
- **Dual background pre-generation (Issue 4)**: The pipeline now fetches **both** image (Unsplash → Pollinations) and video (Pexels + Coverr) backgrounds in parallel on every generation. Both are stored as `background_image` and `background_video` in the render spec. Switching the "AI Image" ↔ "Stock Video" tab is now **instant** — no API call required. A `✓ Both ready` badge shows when both are available. The "Stock Video" button shows `(fetch)` hint if video wasn't pre-fetched.
- **Scroll Fade UX (Issue 2)**: Added a CSS `mask-image` gradient on the chat scroll area so messages fade out gracefully at the bottom instead of abruptly being cut off by the floating input bar. `pb-0` prevents double-padding.

### Changed
- **`UgcVideo.tsx`**: Background rendering now reads `spec.activeBgType` (set by instant tab switch) and resolves the correct `background_image` or `background_video` URL from the pre-fetched spec fields, with full backward compatibility for older specs.
- **Media Type tabs**: Tab buttons now call `updateSpec()` directly to switch `activeBgType` and `background` locally. Only the "Regenerate Media" button triggers an API call.
- **`worker.ts`**: Background partial regenerations now also update `background_image`, `background_video`, and `activeBgType` in the spec so the dual-background system stays fresh.
- **Removed `pendingBgTypes` state**: No longer needed since switching is handled by local spec mutation.

### Fixed
- **Critical: Video card not appearing without refresh (Issue 3)**: Root-caused the polling logic in `page.tsx`. When a video job finished, `setMessages` only updated `variants` if they already existed. For fresh generations where `variants` was `undefined`, the spec was silently dropped and the Remotion Player never rendered. Fix: if `status === 'done'` and `variants` is empty, bootstrap a new `variants` array from `job.render_spec_json` directly in the poller.
- **Meme always the same (Issue 5)**: The Supabase `cached_assets` table returned the same single Giphy URL every time (cache had only 1 option stored). Fix: bypass the gif cache entirely for pipeline auto-selection — always do a fresh parallel Giphy/Klipy/API League fetch. Cache is still used for the user-facing meme search panel in the UI.
- **4 versions on refresh (Issue 6)**: Each background tab switch triggered a `handlePartialRegenerate` call which appended a new entry to `chat_history`, making 4 versions appear on reload. Fix: `partialTarget === 'background'` now updates the existing last video message in `chat_history` in-place instead of appending a new variant.

## [1.8.0] - 2026-06-22

### Added
- **Unsplash API Integration**: The background image pipeline now queries Unsplash (`UNSPLASH_ACCESS_KEY`) for high-quality, `portrait`-oriented stock photography matched to the AI's detailed aesthetic composition prompt. Picks randomly from the top 5 results for variety.
- **Pollinations AI Fallback**: When Unsplash returns no usable results (e.g., overly niche product queries), the pipeline automatically generates the exact background image via Pollinations AI at no cost, ensuring 100% background coverage.
- **Enhanced AI Composition Prompts**: Upgraded the `generateConcepts` system prompt with strict `9:16` cinematic composition rules — Visual Hierarchy (Primary 30-60% / Secondary 20-30% / Tertiary 5-15% attention), rule-of-thirds focus, negative space guidance, and thumbnail legibility constraints. Background prompts are now significantly more detailed and accurate.
- **Inline Caption Refresh Button**: Replaced the bulky "Roll New Caption" bottom button with a compact inline refresh icon (↻) directly next to the "Caption Content" panel header for a cleaner editor UI.

### Changed
- **Background Tab Toggle (Non-Destructive)**: Switching between "AI Image" and "Stock Video" in the Background tab no longer mutates the active `render_spec` immediately. The selection is held in a local `pendingBgTypes` state and only applied when the user explicitly clicks "Regenerate Media", preventing the Remotion player from going black mid-edit.
- **Removed Auto-Play**: The Remotion `<Player>` no longer auto-plays on load. Users must explicitly click play, preventing jarring auto-playback on page load or when switching chat threads.
- **Unconstrained Meme/GIF Layout**: Removed the hardcoded `width: 70%` / `height: 40%` container box around the GIF overlay in `UgcVideo.tsx`. Memes now render at their natural aspect ratio (capped at 900px max), looking far more natural and less squished.
- **State Polling Fix**: The polling loop in `page.tsx` now syncs the active `variants` array when a job finishes (`status: 'done'`), so the Remotion player reflects the newly generated `render_spec_json` without requiring a manual page refresh.
- **Removed Roll Buttons**: Removed the "Roll New Caption" and "Roll New Meme" secondary action buttons from the main video controls bar, replacing them with the inline refresh icon described above.
- **Updated `trend-pack.json`**: Added `imagePrompt` and renamed `query` → `backgroundQuery` in the fallback backgrounds list to match the LLM output schema and support the new Unsplash pipeline.

### Fixed
- **JSX Syntax Error**: Removed an extra stray `</div>` closing tag introduced when removing the Roll buttons, which was causing a cascade of TypeScript/JSX compilation errors.

## [1.7.0] - 2026-06-22

### Added
- **Interactive Typography Controls**: Upgraded the video editor UI in `page.tsx` to include rich typography controls for the Top Hook and Bottom CTA text. Users can now tweak font families, colors, opacity, and Y-axis positioning in real-time.
- **Google Fonts Integration**: Integrated `@remotion/google-fonts` to support a curated selection of premium Google Fonts (Montserrat, Roboto, Bangers, Permanent Marker, Anton, Oswald, Playfair Display) seamlessly within the Remotion player.
- **Link/Unlink Fonts Toggle**: Added a UI toggle allowing users to link typography styles across both text hooks or style them completely independently.
- **Custom Font Uploads**: Users can now upload their own `.ttf` and `.otf` font files. Fonts are securely stored in a dedicated, public Supabase `fonts` bucket. The Remotion player uses the `FontFace` API and `delayRender` to dynamically load the custom font and prevent invisible text flashes (FOIT).
- **Coverr API Backgrounds**: Integrated the Coverr API (`api.coverr.co`) to source high-end, premium cinematic stock footage.
- **Advanced Meme Caching**: Introduced a global caching layer via Supabase `cached_assets` and `cached_trends` to prevent rate-limiting on external APIs and drastically speed up generation for repeated trending concepts.
- **Enhanced GIF Ecosystem**: Added powerful integrations for `Klipy` and `API League` to supplement Giphy, running all 3 requests in parallel (upon cache miss) to pull the top 15 most relevant reaction stickers.
- **Partial Message Regeneration**: Deployed a new `/api/chat/regenerate-partial` endpoint allowing the AI to surgically repair and regenerate specific chunks of the conversation flow.

### Changed
- **Streamlined Classification**: Refactored the internal pipeline, deprecating the isolated `classifyMessage.ts` module by folding intent classification natively into the `chatAgent` extraction layer, saving a redundant LLM round-trip.
- **Pooled Asset Variety**: Refactored the `pickAssets` pipeline to execute Pexels and Coverr searches simultaneously using `Promise.allSettled`. Results are pooled together and randomly selected to maximize the visual variety of generated memes.
- **Auto-sizing Text Areas**: Upgraded to `react-textarea-autosize` for all prompt inputs, providing a buttery-smooth multi-line typing experience compared to standard textareas.

### Fixed
- **Export UI Clarity**: Added a helpful tip to the export modal informing users that they can simply screen-record the web player to save the result.
- **Supabase DB Synchronization**: Created automated SQL migrations (`0006`, `0007`, `0008`) to reliably sync remote tables and buckets instead of relying on manual dashboard configuration.

## [1.6.0] - 2026-06-21

### Added
- **Persistent Memory (Fact Extraction)**: Motif now acts like ChatGPT's Memory system! The AI can proactively extract personal preferences, brand guidelines, and rules that the user shares and save them persistently.
- **Dynamic Context Injection**: Whenever a new chat is started, the user's isolated facts are fetched from the new `user_memories` table and seamlessly injected into the `SYSTEM_PROMPT`. This guarantees the AI respects the user's brand tone and color palettes across *all* future conversations.

### Changed
- **Claude Tool-Use Pipeline**: Upgraded the NDJSON streaming backend to successfully intercept, pause, and execute the custom `save_memory` server tool mid-stream, storing facts directly into Supabase via RLS policies before resuming the chat.

## [1.5.0] - 2026-06-21

### Added
- **Interactive Data Analysis**: Motif is no longer just a video generator—it's a powerful data analysis engine. The agent can now natively process spreadsheets and generate dynamic, interactive charts.
- **Spreadsheet Support**: The file uploader now fully supports `.csv` and `.xlsx` files. The backend uses the `xlsx` library to natively parse spreadsheets into clean markdown tables for Claude to analyze.
- **Recharts Integration**: When analyzing data, Claude is explicitly instructed to build beautiful React visualizations using the `recharts` library. 
- **Beautiful Markdown Tables**: Integrated the `remark-gfm` plugin into `<ReactMarkdown>` to cleanly render markdown tables with borders and padding instead of broken raw text.

### Changed
- **Sandpack UX Overhaul**: Completely rebuilt the Artifact Canvas. It now features a sleek **[Preview] | [Code]** tab bar, allowing users to seamlessly toggle between the interactive chart and the raw React code.
- **Sleek Streaming UI**: Overhauled the `<artifact>` tag parser. When the AI is generating code, it now renders a sleek, pulsing "Generating [Title]... [Writing Code]" accordion block instead of dumping raw code vomit into the chat stream.
- **Proportional Panel Layout**: Adjusted the Chat feed to use dynamic flex percentages (`md:w-[45%] max-w-[600px]`). The Sidebar, Chat, and Canvas now perfectly distribute across wide monitors without cramping.

### Fixed
- **Flawless DOM Stability**: Inactive Canvas tabs are now hidden via CSS (`display: none`) rather than unmounted, preventing the Sandpack bundler from crashing or losing state when switching views.
- **CodeMirror Scroll Fixes**: Bypassed Sandpack's notoriously buggy Flexbox height inheritance by injecting explicit `calc(100vh - 57px)` bounds. The Code editor now perfectly wraps long lines and scrolls vertically without clipping.

## [1.4.0] - 2026-06-21

### Added
- **Real-Time NDJSON Streaming Architecture**: Radically upgraded the `/api/chat` route and Anthropic Agent to stream LLM tokens natively using `application/x-ndjson`. The UI now updates character-by-character for a snappy, ChatGPT-like conversational experience.
- **Multi-Step Reasoning Indicators**: When the Agent executes native server-side tools (like browsing the web or reading sources), the chat bubble now renders a beautiful pulsating "Searching the web..." status right inside the message until the tool finishes.
- **Non-Destructive Chat Editing**: Overhauled the prompt editing system for regular text chats. Editing a chat message no longer overrides the global `jobId`. Instead, it cleanly branches your conversation, truncates the local history to that specific point, and fires off a fresh stream.

### Fixed
- **Streaming Variant Regeneration**: Fixed a major bug where regenerating a Chat message would fallback to generating a video skeleton and require a manual page refresh. `api/chat/regenerate` now correctly streams the NDJSON payload back to the client, allowing real-time character-by-character UI updates for variants.
- **Typing Lockout Bug**: Fixed a UX oversight where the chat `textarea` would become completely disabled while the AI was generating a response in the background. Users can now seamlessly queue up their next thought or copy text from the input box while a generation is active.
- **Stream Buffering Issues**: Fixed a critical Next.js App Router bug where Vercel/Nginx would aggressively buffer `ReadableStream` responses for up to 20 seconds. Added explicit `X-Accel-Buffering: no` and `no-transform` Cache-Control headers to forcefully disable HTTP buffering.
- **Claude Beta Header Rejection**: Fixed an Anthropic `invalid_request_error` (`betas: Extra inputs are not permitted`) inside `classifyMessage.ts` by correctly binding the `pdfs-2024-09-25` flag to the SDK `defaultHeaders` rather than the JSON body.
- **Build Error Fix**: Fixed a TypeScript build error by adding the missing `sources` property to the `Message` type in the chat interface, enabling successful Vercel deployments.

## [1.3.0] - 2026-06-21

### Added
- **Transient Local State**: The canvas code views are rendered exclusively in local browser session state. This ensures massive code artifacts do not bloat the backend database history while remaining fully visible and manageable.

### Changed
- **Interactive Split-Pane Canvas**: Extracted the rich artifact rendering system into a dedicated, slide-out split-pane layout to ensure a clean chat feed.
- **Sandpack Integration**: Replaced standard code blocks with `@codesandbox/sandpack-react` to deliver a true "IDE feel", featuring robust syntax highlighting, line numbers, and intelligent wrapping.
- **Clean Read-Only Mode**: Forced the Sandpack code editor into a strict read-only mode to prevent accidental keystrokes, keeping the UI strictly focused as a clean viewer with one-click Copy and Close controls.

## [1.2.0] - 2026-06-21

### Added
- **Web-Capable Agentic Chat**: Fully integrated Anthropic Tool-Use to empower the chat agent with live web-searching capabilities. The assistant can now browse the internet to find data, fetch articles, and ground answers in reality, citing its sources automatically.
- **Artifact Rendering System**: The UI now supports rendering rich `<artifact>` tags directly inline. Code blocks, markdown documents, and complex reports are beautifully formatted using `react-syntax-highlighter` instead of plain text dumps.
- **Social Sharing Ecosystem**: Added the ability to instantly share your conversations publicly! You can choose to share the *entire* chat history via a new top-right button, or share *only a specific message snippet* using the in-message toolbar.
- **Manage Shared Links Dashboard**: A new dedicated dashboard in the sidebar allows you to securely track, copy, and instantly disable/delete your active public share links.
- **Variant Regeneration Engine**: Clicking "Regenerate" no longer spam-creates an infinitely long chat. It intelligently regenerates the exact message in-place. Users can page through historical variants using intuitive `< 1 / 2 >` navigation arrows.
- **Feedback Mechanism**: Added a Thumbs Up/Down rating system directly attached to the UI variants. Feedback is automatically persisted to the database, uniquely mapped to each specific variant index for high-quality data collection.
- **Keyboard Shortcuts**: Power users can now explicitly use `Cmd + Enter` (Mac) or `Ctrl + Enter` (Windows) to instantly submit prompts from the text area.

### Changed
- Refactored the `/api/share` endpoint to intelligently deduplicate shares. Pressing share multiple times on an active chat syncs the existing database row rather than polluting it with duplicates.
- Updated `layout.tsx` to explicitly define `metadataBase` to ensure OpenGraph previews map perfectly to shared links.

### Fixed
- **Safari Squeeze Bug**: Fixed a scrolling bug specific to Safari/WebKit where `padding-bottom` on overflowing containers is ignored, causing long chats to slide underneath the floating input box. Replaced the CSS padding with a guaranteed physical DOM spacer block.
- **Sidebar Animation**: Eliminated a jerky, layout-thrashing double-animation on the collapsible sidebar by refactoring it to use a perfectly smooth `width` layout shift on Desktop.
- Handled Next.js client/server mismatch errors by injecting `suppressHydrationWarning` on the root layout.

## [1.1.0] - 2026-06-20

### Added
- **Multimodal Support**: Users can now upload images and PDFs alongside their messages to give the AI visual and document context.
- **Supabase Storage Integration**: Uploaded files are securely stored in the new `chat-attachments` bucket and accessed via public URLs to keep the chat history database extremely lightweight.
- **Anthropic PDF & Vision Parsing**: Enabled the `pdfs-2024-09-25` beta flag for the `claude-3-5-sonnet` model, allowing it to natively read and analyze attached PDFs and images.
- **Gemini Vision Fallback**: Configured Gemini 2.5 Flash to accept inline base64 image data to parse uploaded visuals if Claude is unavailable.
- **Attachment Preview UI**: A sleek preview bar above the chat input allows users to see thumbnails of their images or PDFs before hitting send.
- **Next.js Optional Catch-all Routing**: Chat URLs are now dynamic (e.g., `/c/[chatId]`). The browser URL instantly updates when switching chats using shallow history pushes, enabling instant bookmarking and sharing without full page reloads.

### Changed
- Refactored `runGeneration` in the frontend to include file attachments in the `POST /api/chat` request body.
- Rewrote the Anthropic history serializer (`toAnthropicMessages`) to convert Supabase image URLs into raw Base64 buffers directly on the server before hitting the LLMs.
- Updated `classifyMessage` to support parsing image context to intelligently determine whether the user wants to generate UGC or just chat.

### Fixed
- Fixed an issue where the `betas` parameter was passed in the JSON body instead of HTTP headers for the Anthropic SDK.
- Fixed a rendering issue where loading old chat histories caused missing `type` properties, resulting in a stuck "Thinking..." loading skeleton.
- Removed the native scrollbar from the textarea input to eliminate ugly UI artifacts.
- Fixed an alignment bug in the prompt input field where the upload button awkwardly overlapped the placeholder text.

## [1.0.1] - 2026-06-20

### Added
- **Threaded Chat Sessions**: Overhauled the core architecture to support a true ChatGPT-style threaded interface without requiring database schema migrations. A single `video_job` now acts as an entire chat session, storing full conversational history in a nested JSON array.
- **Persistent Normal Chats**: Normal, pure-text chats are now permanently saved to the database (previously they were strictly ephemeral and bypassed the database).
- **In-Chat Video Generation**: Requesting a video inside an ongoing conversation no longer breaks the session or spawns a disconnected job. The backend pipeline generates the video and seamlessly drops the Remotion video player directly inline within your active chat thread.
- **Perfect Session Rehydration**: Refreshing the page or clicking a thread from the Library instantly reads the nested `chat_history` JSON and reconstructs the entire back-and-forth conversation, re-rendering all text bubbles and video players in exact chronological order.
- **Automated API Key Rotation**: Built a resilient fallback mechanism that seamlessly cycles through up to 4 Gemini API keys (`GEMINI_API_KEY` to `GEMINI_API_KEY_4`). If the free-tier rate limit (15 requests per minute) is exceeded, the system catches the `429` error and instantly reroutes the request to the next available key to prevent pipeline crashes.


## [1.0.0] - 2026-06-20

### Added
- **In-place Prompt Editing**: Users can now click the edit icon on their chat bubble to modify the prompt and instantly regenerate the video in-place, without creating duplicate video entries in the library.
- **Dedicated Regenerate Route**: Built a `/api/chat/regenerate` endpoint to safely reset database states and re-queue jobs without side effects.
- **iTunes Search API Integration**: Completely free, high-quality background music! The AI now invents a dynamic audio mood query, fetches top 15 matching `.m4a` audio previews from iTunes, and randomly selects one for the background track.
- **Autoplaying GIF Support**: Integrated the `@remotion/gif` plugin. Replaced standard HTML `<Img>` tags with `<Gif>` components so animated meme stickers properly pause and play in sync with the video player's timeline.
- **Dynamic Search Keyword Engine**: The LLM prompt was unshackled. Instead of being forced to pick from a rigid, hardcoded list of 4 backgrounds, the AI now invents its own highly specific 2-4 word search queries tailored precisely to the user's input.
- **Conversational Chat Interface**: The system now handles natural back-and-forth conversations (like ChatGPT) by preserving chat history and dynamically switching between text responses and video generation based on user intent.
- **Intent Classification**: Added an LLM pre-processing step that classifies whether the user wants a video or is just chatting. Pure chat messages are resolved synchronously and bypass the database to keep the Library sidebar clean.
- **Context Retention**: The API now passes previous chat history into the LLM, allowing the bot to remember what was just discussed instead of treating every prompt like a brand-new conversation.
- **Custom App Favicon**: Added a sleek, modern, neon-green "M" app icon to replace the default Vercel/Next.js logo.

### Fixed
- **Vercel Serverless Background Job Terminations**: Completely bypassed the broken Node.js in-memory queue which failed in serverless environments. Implemented Next.js's new `after()` API to directly `await` the pipeline worker, and explicitly set `export const maxDuration = 60;`. This forces Vercel's ephemeral instances to stay alive until the video generation is fully complete, solving the "In queue..." infinite hanging bug in production.
- **Supabase Row-Level Security Bug**: Fixed a critical bug where the background queue worker was silently failing to save AI output to the database because it lacked the user's authentication token. The token is now safely passed through the queue to authorize updates.
- **Gemini Free-tier Rate Limits & API Speeds**: Refactored the backend architecture to merge "product extraction" and "concept generation" into a single LLM prompt, cutting Google API usage perfectly in half.
- **Repeated Video Assets**: Updated the Pexels and Giphy API fetching logic to request `limit=15` results instead of `limit=1`, and randomly select from the pool. This introduces massive visual variety even for similar AI queries.
- **Mobile Responsiveness**: Adjusted CSS styling to ensure the edit button is properly visible on mobile devices without requiring a mouse hover.
- **Topic Hallucination Prevention**: Fixed an issue where the AI would invent random product topics (like "BrainyBoost App") if the user vaguely asked "generate a video". It will now pause and politely ask the user for a specific topic or URL.
- **UI Auto-Scrolling Bug**: Fixed an issue where the chat window would fail to scroll to the newest messages because it was clipping behind the absolute-positioned footer. Replaced `scrollIntoView` with a `scrollHeight` calculation on the main container.
- **Parallel Fetching Bottlenecks**: Refactored `pickAssets.ts` to use `Promise.all` to fetch videos, GIFs, and audio simultaneously, shaving ~3 seconds off the total pipeline generation time.
