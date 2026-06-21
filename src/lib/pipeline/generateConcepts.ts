import { GoogleGenerativeAI } from "@google/generative-ai";
import Anthropic from '@anthropic-ai/sdk';
import trendPack from "../trend-pack.json";
import { logApiHit, incrementGeminiCount } from './logger';
import { getCachedTrend, saveCachedTrend } from './cache';

export async function generateConcept(message: string, scrapedData: any, productName: string, history: any[] = [], bypassCache: boolean = false) {
  const keys = [
    process.env.CLAUDE_API,
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY_4
  ].filter(Boolean) as string[];

  // Define the niche based on product name and scraped description
  const niche = productName.length > 3 ? productName : (scrapedData.title || "general");

  if (!bypassCache) {
    const cachedData = await getCachedTrend(niche);
    if (cachedData) {
      console.log(`[CACHE HIT] Found fresh trending data for niche: ${niche}`);
      return cachedData;
    }
  }

  const historyText = history.map((m: any) => `${m.role}: ${m.content}`).join('\n');

  const prompt = `
You are a creative, Gen-Z social media marketer making a viral, highly-engaging TikTok/Reels style UGC video.
YOU HAVE LIVE INTERNET ACCESS. You MUST use your web search tools to find:
1. Real, CREATIVE, currently trending TikTok/Reels hooks related to this product's niche.
2. A viral, recognizable reaction meme (e.g. side-eye, reality TV moments, confused math lady).

Chat History Context:
${historyText}

Latest User Message: "${message}"
Product Name: ${productName}
Scraped Website Title: ${scrapedData.title || "N/A"}
Scraped Website Description: ${scrapedData.description || "N/A"}

Create a short 5-10s trending video concept for the product mentioned. 
- Use proven viral frameworks (e.g., "GRWM", "Things I wish I knew sooner", "Unpopular Opinion", "POV").
- Avoid corporate marketing speak entirely.
- Speak natively to Gen-Z and Millennials using authentic, lowercase internet language.
- Utilize strong psychological triggers: FOMO, curiosity gaps, or extreme relatability based on the core pain point.

Respond strictly with a JSON object in this format (no markdown code blocks):
{
  "productName": "Extracted name of the product",
  "durationSec": 6,
  "aspectRatio": "9:16",
  "backgroundQuery": "A highly aesthetic, generic B-roll query for Pexels. DO NOT search for literal product actions (e.g., 'woman applying serum'). Pexels free tier fails at this. INSTEAD, search for pure vibes (e.g., 'aesthetic morning coffee', 'sunlight window', 'neon gym', 'calm ocean waves')",
  "imagePrompt": "A highly detailed, Midjourney-style prompt for an AI image generator to create the perfect background. MUST follow strict rules: 1. Strict 9:16 portrait aspect ratio. 2. Visual Hierarchy: Primary Subject (30-60% attention, near rule-of-thirds, sharp focus), Secondary Elements (20-30%, supporting narrative), Tertiary Elements (5-15%, blurred/low saturation for depth). 3. Composition: Cinematic depth with foreground/mid/background layers, leaving 20-40% negative space to prevent overcrowding. 4. Thumbnail Legibility: Must be instantly recognizable within 2 seconds. Include exact photography terms (e.g., 'Cinematic vertical shot, dark moody office desk, neon lighting, highly detailed, 8k resolution, photorealistic background').",
  "fallbackBackgroundQuery": "A 1-2 word extremely broad aesthetic fallback query (e.g., 'aesthetic', 'sunset', 'water', 'city')",
  "overlayText": {
    "top": "The exact trending hook you found on the internet (e.g. 'pov: you finally found...')",
    "bottom": "a clever punchline or call to action that seals the deal."
  },
  "gifQuery": "A 2-4 word query to find a specific, highly viral internet reaction meme on Giphy (e.g., 'side eye meme', 'nene leakes meme', 'cat typing fast'). DO NOT use generic things like 'butterfly'.",
  "audioQuery": "A 2-4 word search query to find a trending background music track on iTunes"
}
`;

  let lastError: any;

  // Try Claude first if API key is available
  if (process.env.CLAUDE_API) {
    try {
      const anthropic = new Anthropic({ apiKey: process.env.CLAUDE_API });
      logApiHit('Claude API (generateConcepts)', 1);

      const messages: any[] = [{ role: "user", content: prompt }];
      let response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        messages
      });

      const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
      const text = textBlock ? textBlock.text.replace(/\`\`\`json/g, "").replace(/\`\`\`/g, "").trim() : "{}";
      const resultJson = JSON.parse(text);
      await saveCachedTrend(niche, resultJson);
      return resultJson;
    } catch (err: any) {
      lastError = err;
      console.warn("Claude API failed, falling back to Gemini. Error:", err.message);
    }
  }

  // Fallback to Gemini Rotation System
  if (keys.length === 0 && !process.env.CLAUDE_API) throw new Error("No API keys are set.");

  for (const apiKey of keys) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        tools: [{ googleSearch: {} } as any]
      });
      const currentCallCount = incrementGeminiCount();
      logApiHit('Gemini API (generateConcepts)', currentCallCount);
      const result = await model.generateContent(prompt);
      const text = result.response.text().replace(/\`\`\`json/g, "").replace(/\`\`\`/g, "").trim();
      const resultJson = JSON.parse(text);
      await saveCachedTrend(niche, resultJson);
      return resultJson;
    } catch (err: any) {
      lastError = err;
      console.warn("Gemini API failed with a key, trying next key if available. Error:", err.message);
      continue;
    }
  }

  throw lastError || new Error("All API attempts failed.");
}
