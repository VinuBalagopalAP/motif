import Anthropic from '@anthropic-ai/sdk';
import { LLMProvider, ChatEvent, ChatSource } from './types';
import { fetchAsBase64, fetchAndParseDataFile } from './utils';
import { logApiHit } from '../logger';
import { getUserMemories, saveUserMemory } from '../../memories';

export class ClaudeProvider implements LLMProvider {
  private anthropic: Anthropic;
  private primaryModel = 'claude-sonnet-4-6';
  private fallbackModel = 'claude-3-5-sonnet-20241022';

  constructor() {
    if (!process.env.CLAUDE_API) {
      throw new Error("CLAUDE_API is missing.");
    }
    this.anthropic = new Anthropic({
      apiKey: process.env.CLAUDE_API,
      defaultHeaders: { 'anthropic-beta': 'pdfs-2024-09-25' }
    });
  }

  async generateJson(prompt: string): Promise<any> {
    const messages: any[] = [{ role: "user", content: prompt }];
    
    let response;
    try {
      response = await this.anthropic.messages.create({
        model: this.primaryModel,
        max_tokens: 1024,
        messages
      });
    } catch (e: any) {
      if (e.status === 401 || e.status === 403) throw e; // Let the router catch auth errors and trip circuit breaker
      console.warn(`${this.primaryModel} failed in generateJson, falling back to ${this.fallbackModel}. Error:`, e.message);
      response = await this.anthropic.messages.create({
        model: this.fallbackModel,
        max_tokens: 1024,
        messages
      });
    }

    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
    const text = textBlock ? textBlock.text.replace(/\`\`\`json/g, "").replace(/\`\`\`/g, "").trim() : "{}";
    return JSON.parse(text);
  }

  private async toAnthropicMessages(history: any[], message: string, newAttachments: any[] = []): Promise<Anthropic.MessageParam[]> {
    const messages: Anthropic.MessageParam[] = [];

    for (const turn of history) {
      if (turn.role === 'user') {
        const text = (turn.content || '').trim();
        const atts = turn.attachments || [];
        
        if (atts.length > 0) {
          const contentBlocks: Anthropic.ContentBlockParam[] = [];
          for (const att of atts) {
            if (att.type === 'text/csv' || att.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
              const csvData = await fetchAndParseDataFile(att.url);
              if (csvData) {
                contentBlocks.push({ type: 'text', text: `<data_file name="${att.name}">\n${csvData}\n</data_file>` });
              }
            } else {
              const base64 = await fetchAsBase64(att.url);
              if (base64) {
                if (att.type.startsWith('image/')) {
                  contentBlocks.push({ type: 'image', source: { type: 'base64', media_type: att.type as any, data: base64 } });
                } else if (att.type === 'application/pdf') {
                  contentBlocks.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } });
                }
              }
            }
          }
          if (text) contentBlocks.push({ type: 'text', text });
          if (contentBlocks.length > 0) messages.push({ role: 'user', content: contentBlocks });
        } else if (text) {
          messages.push({ role: 'user', content: text });
        }
      } else if (turn.role === 'assistant') {
        const text = turn.type === 'video' ? '[Generated a video]' : (turn.content || '').trim();
        if (text) messages.push({ role: 'assistant', content: text });
      }
    }

    if (newAttachments && newAttachments.length > 0) {
      const contentBlocks: Anthropic.ContentBlockParam[] = [];
      for (const att of newAttachments) {
        if (att.type === 'text/csv' || att.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
          const csvData = await fetchAndParseDataFile(att.url);
          if (csvData) {
            contentBlocks.push({ type: 'text', text: `<data_file name="${att.name}">\n${csvData}\n</data_file>` });
          }
        } else {
          const base64 = await fetchAsBase64(att.url);
          if (base64) {
            if (att.type.startsWith('image/')) {
              contentBlocks.push({ type: 'image', source: { type: 'base64', media_type: att.type as any, data: base64 } });
            } else if (att.type === 'application/pdf') {
              contentBlocks.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } });
            }
          }
        }
      }
      if (message.trim()) contentBlocks.push({ type: 'text', text: message.trim() });
      if (contentBlocks.length > 0) messages.push({ role: 'user', content: contentBlocks });
    } else {
      messages.push({ role: 'user', content: message });
    }

    return messages;
  }

  private extractSources(content: Anthropic.ContentBlock[]): ChatSource[] {
    const byUrl = new Map<string, string>();
    for (const block of content) {
      if (block.type === 'text' && Array.isArray((block as any).citations)) {
        for (const c of (block as any).citations) {
          if (c?.url && !byUrl.has(c.url)) {
            byUrl.set(c.url, c.title || c.url);
          }
        }
      }
    }
    if (byUrl.size === 0) {
      for (const block of content) {
        if ((block as any).type === 'web_search_tool_result') {
          const results = (block as any).content;
          if (Array.isArray(results)) {
            for (const r of results) {
              if (r?.url && !byUrl.has(r.url)) byUrl.set(r.url, r.title || r.url);
            }
          }
        }
      }
    }
    return Array.from(byUrl.entries()).map(([url, title]) => ({ url, title }));
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
    const messages = await this.toAnthropicMessages(history, message, attachments);
    const tools: any[] = [
      { type: 'web_search_20260209', name: 'web_search', max_uses: 5 },
      { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 5 },
      {
        name: 'save_memory',
        description: 'Save an important fact, preference, brand guideline, or user detail to the persistent memory database. Use this proactively when the user shares something that should be remembered for all future conversations.',
        input_schema: {
          type: 'object',
          properties: {
            fact: { type: 'string', description: 'A clear, standalone sentence stating the fact to remember.' }
          },
          required: ['fact']
        }
      },
      {
        name: 'generate_ugc_video',
        description: 'Trigger the generation of a short-form UGC-style video for a given product or URL. Use this tool whenever the user shares a product URL or asks for a video.',
        input_schema: { type: 'object', properties: {}, required: [] }
      }
    ];

    logApiHit('Claude API (ClaudeProvider)');

    let continuations = 0;
    let fullReply = "";
    const allContent: Anthropic.ContentBlock[] = [];

    while (continuations < 5) {
      let messageResponse: any;
      
      for (const modelName of [this.primaryModel, this.fallbackModel]) {
        try {
          const stream = this.anthropic.messages.stream({
            model: modelName,
            max_tokens: 4096,
            system: systemPrompt,
            tools,
            messages
          });

          for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              fullReply += event.delta.text;
              yield { type: 'text', text: event.delta.text };
            } else if (event.type === 'content_block_start' && event.content_block.type === 'tool_use') {
              const name = event.content_block.name;
              if (name === 'web_search') {
                yield { type: 'status', message: 'Searching the web...' };
              } else if (name === 'web_fetch') {
                yield { type: 'status', message: 'Reading sources...' };
              } else {
                yield { type: 'status', message: 'Using tools...' };
              }
            }
          }

          messageResponse = await stream.finalMessage();
          break; // successfully got response, break out of model fallback loop
        } catch (err: any) {
          if (err.status === 401 || err.status === 403) throw err; // Route it back to LLMRouter to trip circuit breaker
          if (fullReply !== "") throw err; // Cannot fallback cleanly if already streamed parts
          console.warn(`${modelName} failed in ClaudeProvider, trying next... Error:`, err.message);
        }
      }

      if (!messageResponse) {
        throw new Error("Both Claude models failed in ClaudeProvider, or response was empty.");
      }

      allContent.push(...messageResponse.content);

      if (messageResponse.stop_reason === 'pause_turn') {
        messages.push({ role: 'assistant', content: messageResponse.content });
        continuations++;
      } else if (messageResponse.stop_reason === 'tool_use') {
        messages.push({ role: 'assistant', content: messageResponse.content });

        const toolUses = messageResponse.content.filter((b: any) => b.type === 'tool_use');
        const toolResults: any[] = [];

        for (const block of toolUses) {
          if (block.name === 'save_memory' && userId && token) {
            const fact = (block.input as any).fact;
            if (fact !== undefined) {
              yield { type: 'status', message: 'Saving memory...' };
              try {
                await saveUserMemory(userId, fact, activeJobId || null, token);
                toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: 'Memory saved successfully.' });
              } catch (e) {
                toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: 'Failed to save memory.', is_error: true });
              }
            }
          } else if (block.name === 'generate_ugc_video') {
            yield { type: 'status', message: 'Triggering video generation...' };
            yield { type: 'trigger_video' };
            toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: 'Video generation pipeline started in the background.' });
          } else {
            toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: 'Unknown or unhandled tool.', is_error: true });
          }
        }

        if (toolResults.length > 0) {
          messages.push({ role: 'user', content: toolResults });
          continuations++;
        } else {
          break;
        }
      } else {
        break;
      }
    }

    yield { type: 'done', sources: this.extractSources(allContent), reply: fullReply };
  }
}
