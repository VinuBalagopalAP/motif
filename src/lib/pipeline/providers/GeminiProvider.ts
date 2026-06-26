import { GoogleGenerativeAI } from '@google/generative-ai';
import { LLMProvider, ChatEvent } from './types';
import { logApiHit, incrementGeminiCount } from '../logger';
import { saveUserMemory } from '../../memories';

export class GeminiProvider implements LLMProvider {
  private genAI: GoogleGenerativeAI;

  constructor() {
    const geminiKeys = [
      process.env.GEMINI_API_KEY,
      process.env.GEMINI_API_KEY_2,
      process.env.GEMINI_API_KEY_3,
      process.env.GEMINI_API_KEY_4
    ].filter(Boolean) as string[];

    if (geminiKeys.length === 0) {
      throw new Error("No Gemini API keys are available in the environment.");
    }
    
    // For simplicity in this provider, we'll just use the first available key.
    // In a more robust system we could implement the rotation logic here.
    this.genAI = new GoogleGenerativeAI(geminiKeys[0]);
  }

  async generateJson(prompt: string): Promise<any> {
    const model = this.genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      tools: [{ googleSearch: {} } as any]
    });
    
    const currentCallCount = incrementGeminiCount();
    logApiHit('Gemini API (GeminiProvider generateJson)', currentCallCount);
    
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    
    const cleanedText = text ? text.replace(/\`\`\`json/g, "").replace(/\`\`\`/g, "").trim() : "{}";
    return JSON.parse(cleanedText);
  }

  async *streamChat(
    message: string,
    history: any[],
    attachments: any[],
    systemPrompt: string,
    userId?: string,
    token?: string,
    activeJobId?: string
  ): AsyncGenerator<ChatEvent, void, unknown> {
    const model = this.genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      tools: [
        { functionDeclarations: [
            {
              name: "save_memory",
              description: "Save an important fact, preference, brand guideline, or user detail to the persistent memory database.",
              parameters: { type: "OBJECT" as any, properties: { fact: { type: "STRING" as any, description: "Fact to remember" } }, required: ["fact"] }
            },
            {
              name: "generate_ugc_video",
              description: "Trigger the generation of a short-form UGC-style video for a given product or URL. Use this tool whenever the user shares a product URL or asks for a video.",
              parameters: { type: "OBJECT" as any, properties: {} }
            }
          ]
        }
      ],
      systemInstruction: systemPrompt
    });

    const geminiContents = history.map(m => {
       let text = "";
       if (typeof m.content === 'string') text = m.content;
       else if (Array.isArray(m.content)) {
          text = m.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n');
       }
       return {
         role: m.role === 'assistant' ? 'model' : 'user',
         parts: [{ text }]
       };
    });

    // Add the final user message
    geminiContents.push({ role: 'user', parts: [{ text: message }] });

    const currentCallCount = incrementGeminiCount();
    logApiHit('Gemini API (GeminiProvider streamChat)', currentCallCount);

    const resultStream = await model.generateContentStream({ contents: geminiContents });
    let fullReply = "";

    for await (const chunk of resultStream.stream) {
      const calls = typeof chunk.functionCalls === 'function' ? chunk.functionCalls() : undefined;
      if (calls && calls.length > 0) {
        for (const call of calls) {
          if (call.name === 'generate_ugc_video') {
            yield { type: 'status', message: 'Triggering video generation...' };
            yield { type: 'trigger_video' };
          } else if (call.name === 'save_memory' && userId && token) {
            const fact = call.args ? (call.args as any).fact : undefined;
            if (fact !== undefined) {
              yield { type: 'status', message: 'Saving memory...' };
              try {
                await saveUserMemory(userId, fact, activeJobId || null, token);
              } catch (e) {
                console.error("Failed to save memory during Gemini fallback");
              }
            }
          }
        }
      }

      try {
        const text = chunk.text();
        if (text) {
           fullReply += text;
           yield { type: 'text', text };
        }
      } catch (e) {
        // chunk.text() throws if it's purely a function call chunk with no text
      }
    }

    yield { type: 'done', sources: [], reply: fullReply };
  }
}
