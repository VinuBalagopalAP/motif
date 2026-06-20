# Changelog

All notable changes to the Motif UGC Video Generator will be documented in this file.

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
