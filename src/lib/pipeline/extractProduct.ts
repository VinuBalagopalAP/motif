import { GoogleGenerativeAI } from "@google/generative-ai";
import Anthropic from '@anthropic-ai/sdk';
import { logApiHit, incrementGeminiCount } from './logger';

export async function extractProduct(message: string, history: any[] = []) {
  const keys = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3
  ].filter(Boolean) as string[];

  const historyText = history.map((m: any) => `${m.role}: ${m.content}`).join('\n');

  const prompt = `
Extract the product details from the following conversation.
Find the most recently discussed product or URL. If a URL is present, extract it. Otherwise omit it.

Chat History:
${historyText}

Latest Message: "${message}"

Respond strictly with a JSON object in this format (no markdown code blocks):
{
  "name": "Product Name",
  "url": "https://example.com"
}
`;

  let lastError: any;

  // Try Claude first if API key is available
  if (process.env.CLAUDE_API) {
    try {
      const anthropic = new Anthropic({ apiKey: process.env.CLAUDE_API });
      logApiHit('Claude API (extractProduct)', 1);
      const msg = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 512,
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
      logApiHit('Gemini API (extractProduct)', currentCallCount);
      const result = await model.generateContent(prompt);
      const text = result.response.text().replace(/\`\`\`json/g, "").replace(/\`\`\`/g, "").trim();
      return JSON.parse(text);
    } catch (err: any) {
      lastError = err;
      console.warn("Gemini API failed with a key, trying next key if available. Error:", err.message);
      continue;
    }
  }

  throw lastError;
}
