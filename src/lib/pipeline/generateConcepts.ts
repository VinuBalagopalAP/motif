import { GoogleGenerativeAI } from "@google/generative-ai";
import Anthropic from '@anthropic-ai/sdk';
import trendPack from "../trend-pack.json";
import { logApiHit, incrementGeminiCount } from './logger';

export async function generateConcept(message: string, scrapedData: any) {
  const keys = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY_4
  ].filter(Boolean) as string[];

  const hooks = trendPack.hooks.join(", ");

  const prompt = `
You are a creative social media marketer making a short viral UGC video.
User Message: "${message}"
Scraped Website Title: ${scrapedData.title || "N/A"}
Scraped Website Description: ${scrapedData.description || "N/A"}

Create a short 5-10s meme-style video concept for the product mentioned.

Respond strictly with a JSON object in this format (no markdown code blocks):
{
  "productName": "Extracted name of the product",
  "durationSec": 6,
  "aspectRatio": "9:16",
  "backgroundQuery": "A highly descriptive, 2-4 word search query to find the perfect aesthetic background video on Pexels (e.g., 'person using smartphone', 'beautiful office desk', 'fitness gym working out', 'programming code')",
  "overlayText": {
    "top": "Pick or adapt a viral hook (e.g. one of: ${hooks})",
    "bottom": "the funny punchline involving the product"
  },
  "gifQuery": "A 1-2 word search query to find the perfect reaction meme GIF on Giphy (e.g., 'shocked', 'mind blown', 'crying', 'celebration', 'smirk')",
  "audioQuery": "A 2-4 word search query to find the perfect background music track on iTunes (e.g., 'lofi chill beat', 'aggressive trap instrumental', 'suspenseful cinematic', 'upbeat pop')"
}
`;

  let lastError: any;

  // Try Claude first if API key is available
  if (process.env.CLAUDE_API) {
    try {
      const anthropic = new Anthropic({ apiKey: process.env.CLAUDE_API });
      logApiHit('Claude API (generateConcepts)', 1);
      const msg = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }]
      });
      const text = (msg.content[0] as any).text.replace(/\`\`\`json/g, "").replace(/\`\`\`/g, "").trim();
      return JSON.parse(text);
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
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const currentCallCount = incrementGeminiCount();
      logApiHit('Gemini API (generateConcepts)', currentCallCount);
      const result = await model.generateContent(prompt);
      const text = result.response.text().replace(/\`\`\`json/g, "").replace(/\`\`\`/g, "").trim();
      return JSON.parse(text);
    } catch (err: any) {
      lastError = err;
      console.warn("Gemini API failed with a key, trying next key if available. Error:", err.message);
      continue;
    }
  }

  throw lastError || new Error("All API attempts failed.");
}
