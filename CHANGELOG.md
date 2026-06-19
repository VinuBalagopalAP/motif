# Changelog

All notable changes to the Motif UGC Video Generator will be documented in this file.

## [v1.0] - 2026-06-19

### Added
- **In-place Prompt Editing**: Users can now click the edit icon on their chat bubble to modify the prompt and instantly regenerate the video in-place, without creating duplicate video entries in the library.
- **Dedicated Regenerate Route**: Built a `/api/chat/regenerate` endpoint to safely reset database states and re-queue jobs without side effects.
- **iTunes Search API Integration**: Completely free, high-quality background music! The AI now invents a dynamic audio mood query, fetches top 15 matching `.m4a` audio previews from iTunes, and randomly selects one for the background track.
- **Autoplaying GIF Support**: Integrated the `@remotion/gif` plugin. Replaced standard HTML `<Img>` tags with `<Gif>` components so animated meme stickers properly pause and play in sync with the video player's timeline.
- **Dynamic Search Keyword Engine**: The LLM prompt was unshackled. Instead of being forced to pick from a rigid, hardcoded list of 4 backgrounds, the AI now invents its own highly specific 2-4 word search queries tailored precisely to the user's input.
- **Custom App Favicon**: Added a sleek, modern, neon-green "M" app icon to replace the default Vercel/Next.js logo.

### Fixed
- **Vercel Serverless Background Job Terminations**: Implemented Next.js's new `after()` API and explicitly set `export const maxDuration = 60;` across all generation endpoints. This explicitly forces Vercel's ephemeral serverless instances to stay alive until the background AI pipeline completely finishes, solving infinite loading states in the deployed production app.
- **Supabase Row-Level Security Bug**: Fixed a critical bug where the background queue worker was silently failing to save AI output to the database because it lacked the user's authentication token. The token is now safely passed through the queue to authorize updates.
- **Gemini Free-tier Rate Limits & API Speeds**: Refactored the backend architecture to merge "product extraction" and "concept generation" into a single LLM prompt, cutting Google API usage perfectly in half.
- **Repeated Video Assets**: Updated the Pexels and Giphy API fetching logic to request `limit=15` results instead of `limit=1`, and randomly select from the pool. This introduces massive visual variety even for similar AI queries.
- **Mobile Responsiveness**: Adjusted CSS styling to ensure the edit button is properly visible on mobile devices without requiring a mouse hover.
- **Parallel Fetching Bottlenecks**: Refactored `pickAssets.ts` to use `Promise.all` to fetch videos, GIFs, and audio simultaneously, shaving ~3 seconds off the total pipeline generation time.
