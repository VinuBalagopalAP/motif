import { saveCachedTrend, getCachedTrend } from './cache';
import { llmRouter } from './providers/LLMRouter';
import trendPack from '../trend-pack.json';

export async function generateConcept(
  message: string, 
  scrapedData: any, 
  niche: string, 
  history: any[] = [], 
  bypassCache: boolean = false,
  onStatusUpdate?: (status: string) => Promise<void>
): Promise<any> {
  if (!bypassCache) {
    const cached = await getCachedTrend(niche);
    if (cached) {
      console.log(`Cache hit for niche: ${niche}`);
      return cached;
    }
  }

  const hooks = trendPack.hooks.join(", ");
  
  const systemPrompt = `
You are a creative social media marketer making a short viral UGC video.
User Message: "${message}"
Scraped Website Title: ${scrapedData?.title || "N/A"}
Scraped Website Description: ${scrapedData?.description || "N/A"}

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

  try {
    const result = await llmRouter.generateJson(systemPrompt);
    await saveCachedTrend(niche, result);
    return result;
  } catch (err: any) {
    console.error("Pipeline failed completely:", err.message);
    throw err;
  }
}
