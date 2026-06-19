import { GoogleGenerativeAI } from "@google/generative-ai";
import { logApiHit, incrementGeminiCount } from './logger';

export async function extractProduct(message: string) {
  const keys = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3
  ].filter(Boolean) as string[];

  if (keys.length === 0) throw new Error("No GEMINI_API_KEY is set.");

  const prompt = `
Extract the product details from the following message.
If a URL is present, extract it. Otherwise omit it.

Message: "${message}"

Respond strictly with a JSON object in this format (no markdown code blocks):
{
  "name": "Product Name",
  "url": "https://example.com (optional)",
  "oneLiner": "The raw message"
}
`;

  let lastError: any;

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
