# Motif - AI UGC Video Generator 🎬✨

A highly optimized, serverless Next.js application that automatically generates TikTok/Reels-style meme videos from a single product prompt and URL.

## 🌟 Key Features

### 🧠 Web-Capable Agent & Real-Time Streaming
Powered by Gemini 2.5 Flash and Claude 3.5 Sonnet, the AI acts as a creative director and web-researcher. It features fully integrated Anthropic Tool-Use capabilities, allowing it to autonomously browse the internet, cite live sources, and scrape websites to invent custom, dynamic video concepts without relying on hardcoded datasets.
- **Deep NDJSON Streaming**: The `/api/chat` architecture streams native chunked responses via a highly optimized `ReadableStream`. The UI reacts in real-time, delivering a ChatGPT-like conversational experience and rendering markdown instantaneously.
- **Multi-Step Reasoning Indicators**: As the agent executes native server-side tools (like browsing the web or reading multiple sources), the chat bubble renders beautiful, pulsating "Searching the web..." status indicators to let you see what the AI is thinking *before* it begins typing.

### ⚡ Parallelized Media Fetching & Intelligent Caching
The pipeline simultaneously fetches assets from multiple APIs using `Promise.allSettled` to significantly boost speed:
- **Coverr API**: Integrates with Coverr's API to fetch premium, cinematic, high-resolution stock video footage.
- **Pexels API**: Fetches high-quality, vertical background videos. 
*Note: The results from Coverr and Pexels are pooled together and randomly selected to ensure immense visual variety across generations.*
- **Giphy, Klipy, & API League**: Runs 3 separate meme API queries concurrently to pool the top 15 most relevant transparent reaction meme stickers.
- **Global Asset Caching**: Successful API fetches for trending GIF/Meme queries are immediately saved to a global Supabase `cached_assets` table. Subsequent generations instantly hit the cache, preventing API rate-limiting and drastically improving generation speed.
- **iTunes Search API**: A brilliant hack! Uses the completely free Apple iTunes Search API to fetch high-quality 30-second `.m4a` music previews perfectly tailored to the AI's requested "audio mood" (e.g., "lofi chill beat", "upbeat pop").

### 🎥 Deterministic Rendering with Remotion
The backend orchestration produces a lightweight JSON `RenderSpec` instead of heavily encoding an MP4 via FFmpeg on a serverless function (which easily hits Vercel timeouts). 
The browser UI natively mounts **Remotion**, seamlessly rendering the video using React components at a smooth 60fps.
*Note: Uses `@remotion/gif` to mathematically sync transparent animated GIFs to the video timeline, allowing perfect play/pause functionality.*

### 🎨 Interactive Video Typography & Custom Fonts
The video editor interface allows for rich text manipulation directly on the Remotion canvas.
- **Live Typography Controls**: Users can tweak the Top Hook and Bottom CTA text, adjusting font families, colors, opacity, and Y-axis placement in real-time.
- **Premium Google Fonts**: Integrated with `@remotion/google-fonts` to seamlessly inject beautiful typography (Montserrat, Playfair Display, Anton, etc.) into the video payload without layout shifts.
- **Upload Custom Fonts**: Users can securely upload their own custom `.ttf` or `.otf` font files. These are uploaded to a dedicated Supabase `fonts` bucket, and the Remotion player dynamically loads them via the browser `FontFace` API using `delayRender` to prevent invisible text flashes (FOIT).

### 🛡️ Secure State Management (Supabase)
Integrated with a PostgreSQL database via **Supabase**.
- Employs strict Row-Level Security (RLS) policies.
- Background workers safely execute database updates by temporarily assuming the user's secure authentication token, preventing silent permission drops.
- Polling mechanism instantly streams live UI updates (e.g., "Scraping site", "Writing hooks").

### 💬 Threaded Chat Sessions
The app features a fully threaded, ChatGPT-style chat interface that seamlessly blends pure text conversation with complex video generation tasks.
- **Intent Classification**: Uses Gemini to dynamically determine if a message is casual chat or a video request on every single turn.
- **Deep Multimodality**: Users can upload images, PDFs, and spreadsheets (`.csv`, `.xlsx`) to give the AI visual and document context natively processed by Claude 3.5 Sonnet and Gemini 2.5 Flash.
- **Interactive Data Analysis**: Uploading a spreadsheet allows Claude to natively parse the data, analyze trends, and generate fully interactive, hoverable React `recharts` directly inside the Artifact Canvas!
- **Persistent Normal Chats**: All normal conversations are permanently saved to your Library as active threads.
- **Global Persistent Memory**: Motif acts like ChatGPT's Memory! The AI proactively extracts your personal preferences, brand guidelines, and rules, saving them securely to the database and automatically injecting them into all future chats so you never have to repeat yourself.
- **In-Chat Video Generation**: Requesting a video inside an ongoing chat drops the generated Remotion video player directly inline within the conversation feed, without breaking the session.
- **Non-Destructive Editing**: Don't like how you phrased a prompt? Hit edit. The app will seamlessly branch your chat history (just like ChatGPT) and fire off a fresh generation without destroying the overall thread.
- **Partial Message Regeneration**: If the AI messes up a specific response formatting, you can trigger surgical re-generations on specific chunks of the conversation flow without discarding the full history.
- **Streaming Variant Regeneration & Feedback**: Hit Regenerate to cleanly spawn variants in-place (which stream back to you character-by-character for chat messages), and use `< >` arrows to page through them seamlessly. Provide Thumbs Up/Down feedback mapped directly to the active variant.
- **Rich Artifacts & Interactive Canvas**: Code blocks, complex data, and markdown documents are beautifully rendered using a custom XML `<artifact>` system. Clicking an artifact slides out a dedicated split-pane layout powered by `@codesandbox/sandpack-react`, delivering an IDE-grade code viewing experience.
- **Perfect Session Rehydration**: Clicking a thread from the sidebar instantly reconstructs your entire conversation history, re-rendering all text bubbles, variants, and inline video players perfectly.

### 🔗 Social Sharing Ecosystem
Your chats are built for virality.
- Share an **isolated message snippet** or an **entire conversation history** with one click.
- Links are automatically deduplicated and synced in real-time.
- Manage your privacy using the built-in **Shared Links Dashboard** to copy URLs or revoke public access instantly.

### 📱 Responsive & Premium UI
Built with vanilla CSS to ensure absolute structural control. Features a beautiful dark mode aesthetic, smooth micro-animations, glassmorphism elements, and full mobile-responsiveness (hiding the sidebar and adjusting controls natively). Includes a custom-designed Motif favicon.

---

## 🛠️ The Generation Pipeline

1. **Intelligent Extraction**: The `chatAgent` pipeline natively evaluates the prompt to extract the target URL and product name while classifying if it's a casual chat or a generation request.
2. **Scraping**: The backend fetches live `<title>`, `<meta>`, and `<h1>`/`<p>` tags from the target site to ground the AI in reality. (Skipped during surgical partial regenerations).
3. **Concept Generation**: The LLM receives the scraped data and constructs a dynamic JSON payload containing the viral hook text, visual search queries, and audio vibes.
4. **Asset Selection & Caching**: The server checks the global Supabase `cached_assets` first. On a cache miss, it concurrently hits Pexels, Coverr, Giphy, Klipy, API League, and iTunes via `Promise.allSettled` to assemble the visual and auditory layers.
5. **Rendering**: The client UI natively mounts the resulting JSON payload into the Remotion Player, fetching any uploaded custom fonts via the `FontFace` API.

*(Emergency Fallback: If any 3rd-party API crashes or hits rate limits, the app instantly and gracefully falls back to a curated local `trend-pack.json` to guarantee 100% video output reliability).*

---

## 🚀 Setup Instructions

1. Clone the repository and install dependencies:
```bash
npm install
```

2. Copy the `.env.example` file to `.env.local` and add your keys:
```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
CLAUDE_API=...
GEMINI_API_KEY=...
GEMINI_API_KEY_2=...
GEMINI_API_KEY_3=...
GEMINI_API_KEY_4=...

# (Optional but recommended for dynamic assets)
PEXELS_API_KEY=...
COVERR_API_KEY=...
GIPHY_API_KEY=...
KLIPY_API_KEY=...
API_LEAGUE_KEY=...
```
*(Note: No iTunes API key is needed as the search endpoint is completely free!)*

3. Start the development server:
```bash
npm run dev
```

## ⚠️ Notes on Rate Limits
Because this app is designed to run on free or low-tier API keys, you may encounter rate limits during rapid conversational testing:
- **Anthropic Claude 3.5 Sonnet**: Used for complex web-searching and chat. If you exhaust your Claude API limits (or if it throws an error), the system will **automatically and instantly fall back to Gemini 2.5 Flash** for chat generation, ensuring uninterrupted user experience.
- **Google Gemini 2.5 Flash**: Used as the primary video orchestration engine (and chat fallback). The Free Tier is strictly limited to 15 requests per minute. To solve this bottleneck, the pipeline has a built-in **Automated Key Rotation System**. It will sequentially cycle through up to 4 Gemini API keys provided in your `.env.local`. If one key throws a `429 Too Many Requests` error, the system instantly catches it and seamlessly reroutes to the next available key.
- **Media Asset APIs (Giphy, Pexels, Coverr)**: Free tiers on media APIs often have strict hourly rate limits. To aggressively combat this, Motif employs a **Global Asset Caching** layer via Supabase. Successful API fetches for trending meme queries are saved to the database. Subsequent requests for the same query bypass the API entirely and instantly fetch from the cache. Furthermore, the meme pipeline simultaneously hits Giphy, Klipy, and API League, gracefully falling back if any single API hits a rate limit.

## 🚧 Known Limitations & Trade-offs (For Evaluators)
Because this project was built without a budget for enterprise AI video generation (like Runway Gen-2, Luma Dream Machine, or Sora), the visual layer relies entirely on **Free Stock Footage APIs** (Pexels, Coverr, Giphy, Klipy). 
- **Generic Visuals vs. Prompt Specificity**: Even if the LLM generates a hyper-specific, perfect background query (e.g., "Gmail inbox interface layout"), the stock APIs will likely return generic footage (e.g., "a person typing on a laptop with Photoshop open"). The pipeline is extremely intelligent at *writing* the queries, and the addition of **Coverr** helps inject high-end cinematic variety, but visual accuracy is ultimately bottlenecked by real-world stock library inventory.
- **Why Not FFmpeg?**: A traditional video-generation pipeline would use a cloud server running FFmpeg to render out a flat `.mp4` file. However, running FFmpeg inside a Next.js serverless Vercel function (which has a 10s execution limit and 50MB memory limit) is a severe anti-pattern that crashes under load. I specifically chose the **Remotion** approach to demonstrate a scalable, zero-cost, enterprise-grade architecture that bypasses heavy cloud-rendering costs entirely.

## 📝 Changelog
To see the history of optimizations, bug fixes, and feature additions (such as the in-place prompt editor and iTunes API integration), please see the [CHANGELOG.md](CHANGELOG.md).
