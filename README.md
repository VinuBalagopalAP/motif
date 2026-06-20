# Motif - AI UGC Video Generator 🎬✨

A highly optimized, serverless Next.js application that automatically generates TikTok/Reels-style meme videos from a single product prompt and URL.

## 🌟 Key Features

### 🧠 Unshackled LLM Logic
Powered by Gemini 2.5 Flash, the AI acts as a creative director. It scrapes the target website, analyzes the product, and invents **custom, dynamic search queries** for the background video, GIF reaction, and background music. It no longer relies on hardcoded datasets.

### ⚡ Parallelized Media Fetching
The pipeline simultaneously fetches assets from multiple APIs using `Promise.all` to significantly boost speed:
- **Pexels API**: Fetches high-quality, vertical background videos. Randomizes selection from the top 15 results for immense visual variety.
- **Giphy API**: Fetches relevant transparent reaction meme stickers.
- **iTunes Search API**: A brilliant hack! Uses the completely free Apple iTunes Search API to fetch high-quality 30-second `.m4a` music previews perfectly tailored to the AI's requested "audio mood" (e.g., "lofi chill beat", "upbeat pop").

### 🎥 Deterministic Rendering with Remotion
The backend orchestration produces a lightweight JSON `RenderSpec` instead of heavily encoding an MP4 via FFmpeg on a serverless function (which easily hits Vercel timeouts). 
The browser UI natively mounts **Remotion**, seamlessly rendering the video using React components at a smooth 60fps.
*Note: Uses `@remotion/gif` to mathematically sync transparent animated GIFs to the video timeline, allowing perfect play/pause functionality.*

### 🛡️ Secure State Management (Supabase)
Integrated with a PostgreSQL database via **Supabase**.
- Employs strict Row-Level Security (RLS) policies.
- Background workers safely execute database updates by temporarily assuming the user's secure authentication token, preventing silent permission drops.
- Polling mechanism instantly streams live UI updates (e.g., "Scraping site", "Writing hooks").

### 💬 Threaded Chat Sessions
The app features a fully threaded, ChatGPT-style chat interface that seamlessly blends pure text conversation with complex video generation tasks.
- **Intent Classification**: Uses Gemini to dynamically determine if a message is casual chat or a video request on every single turn.
- **Persistent Normal Chats**: All normal conversations are permanently saved to your Library as active threads.
- **In-Chat Video Generation**: Requesting a video inside an ongoing chat drops the generated Remotion video player directly inline within the conversation feed, without breaking the session.
- **Perfect Session Rehydration**: Clicking a thread from the sidebar instantly reconstructs your entire conversation history, re-rendering all text bubbles and inline video players perfectly.

### 📱 Responsive & Premium UI
Built with vanilla CSS to ensure absolute structural control. Features a beautiful dark mode aesthetic, smooth micro-animations, glassmorphism elements, and full mobile-responsiveness (hiding the sidebar and adjusting controls natively). Includes a custom-designed Motif favicon.

---

## 🛠️ The Generation Pipeline

1. **Intent Classification**: The LLM evaluates if the message is a casual chat or a video request. Chat messages are resolved synchronously and bypass the DB.
2. **Extraction**: Regex cleanly extracts the URL from the user's free-text prompt.
3. **Scraping**: Fetches live `<title>`, `<meta>`, and `<h1>`/`<p>` tags from the target site.
3. **Concept Generation**: Gemini receives the scraped data and constructs a JSON payload containing the viral hook text, visual queries, and audio vibes.
4. **Asset Selection**: The server concurrently hits Pexels, Giphy, and iTunes to assemble the visual and auditory layers. 
5. **Rendering**: The client UI natively mounts the resulting JSON payload into the Remotion Player.

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
GEMINI_API_KEY=...
GEMINI_API_KEY_2=...
GEMINI_API_KEY_3=...
GEMINI_API_KEY_4=...

# (Optional but recommended for dynamic assets)
PEXELS_API_KEY=...
GIPHY_API_KEY=...
```
*(Note: No iTunes API key is needed as the search endpoint is completely free!)*

3. Start the development server:
```bash
npm run dev
```

## ⚠️ Notes on Rate Limits
Because the **Google Gemini Free Tier** is strictly limited to 15 requests per minute, rapid conversational testing can exhaust a single key quickly. 

To solve this, the pipeline has a built-in **Automated Key Rotation System**. It will sequentially cycle through up to 4 API keys provided in your `.env.local`. If one key throws a `429 Too Many Requests` error, the system instantly catches it and seamlessly falls back to the next available key without interrupting the video generation. If all keys are exhausted, the app will gracefully tell the user to wait a moment.

## 🚧 Known Limitations & Trade-offs (For Evaluators)
Because this project was built without a budget for enterprise AI video generation (like Runway Gen-2, Luma Dream Machine, or Sora), the visual layer relies heavily on **Free Stock Footage APIs** (Pexels & Giphy). 
- **Generic Visuals vs. Prompt Specificity**: Even if the LLM generates a hyper-specific, perfect background query (e.g., "Gmail inbox interface layout"), Pexels will likely return generic stock footage (e.g., "a person typing on a laptop with Photoshop open"). The pipeline is extremely intelligent at *writing* the queries, but the visual accuracy is ultimately bottlenecked by the stock library's real-world footage inventory.
- **Why Not FFmpeg?**: A traditional video-generation pipeline would use a cloud server running FFmpeg to render out a flat `.mp4` file. However, running FFmpeg inside a Next.js serverless Vercel function (which has a 10s execution limit and 50MB memory limit) is a severe anti-pattern that crashes under load. I specifically chose the **Remotion** approach to demonstrate a scalable, zero-cost, enterprise-grade architecture that bypasses heavy cloud-rendering costs entirely.

## 📝 Changelog
To see the history of optimizations, bug fixes, and feature additions (such as the in-place prompt editor and iTunes API integration), please see the [CHANGELOG.md](CHANGELOG.md).
