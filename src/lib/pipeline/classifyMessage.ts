import { GoogleGenerativeAI } from "@google/generative-ai";
import Anthropic from '@anthropic-ai/sdk';
import { logApiHit, incrementGeminiCount } from './logger';

export async function classifyMessage(message: string, history: any[] = []): Promise<{ type: 'chat' | 'ugc'; reply?: string }> {
  const keys = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY_4
  ].filter(Boolean) as string[];

  const historyText = history.length > 0 
    ? "Chat History:\n" + history.map(h => `${h.role}: ${h.content}`).join("\n") + "\n\n"
    : "";

  const prompt = `
You are a helpful AI assistant for Motif, an app that generates UGC (User Generated Content) style marketing videos.

${historyText}A user has sent the following new message: "${message}"

Your task is to determine if the user wants to generate a video or just chat/ask a question.
- If the user explicitly asks to create/generate a video AND provides a specific topic, product, URL, or context, classify as "ugc".
- If the user asks to create/generate a video but DOES NOT provide any topic, product, or context (e.g., "generate a video for me", "make me a video"), classify as "chat" and politely ask them what topic, product, or URL they would like the video to be about. Do NOT guess or hallucinate a topic.
- If the user is having a general conversation, classify as "chat" and provide a natural, conversational reply. 
- IMPORTANT: ONLY explain that you can generate UGC videos IF the user explicitly asks what you do, who you are, or how you can help. If they are just making small talk (e.g. "hi", "I'm bored"), just chat with them normally like a human friend without mentioning videos at all.

Respond strictly with a JSON object in this format (no markdown code blocks):
{
  "type": "chat" | "ugc",
  "reply": "Your natural conversational response here (only required if type is 'chat')"
}
`;

  let lastError: any;

  // Try Claude first if API key is available
  if (process.env.CLAUDE_API) {
    try {
      const anthropic = new Anthropic({ apiKey: process.env.CLAUDE_API });
      logApiHit('Claude API (classifyMessage)', 1);
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
      logApiHit('Gemini API (classifyMessage)', currentCallCount);
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
