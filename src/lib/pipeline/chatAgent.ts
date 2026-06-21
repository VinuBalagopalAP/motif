import Anthropic from '@anthropic-ai/sdk';
import { logApiHit } from './logger';

export interface ChatSource {
  url: string;
  title: string;
}

export interface ChatAgentResult {
  reply: string;
  sources: ChatSource[];
}

// Converts the app's chat_history (free-form objects) into Anthropic message turns.
// User turns -> user text. Assistant chat turns -> assistant text. Assistant video
// turns (no text) -> a short placeholder so the conversation stays coherent.
async function fetchAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer).toString('base64');
  } catch (e) {
    console.error('Failed to fetch attachment:', e);
    return null;
  }
}

async function toAnthropicMessages(history: any[], message: string, newAttachments: any[] = []): Promise<Anthropic.MessageParam[]> {
  const messages: Anthropic.MessageParam[] = [];

  for (const turn of history) {
    if (turn.role === 'user') {
      const text = (turn.content || '').trim();
      const atts = turn.attachments || [];
      
      if (atts.length > 0) {
        const contentBlocks: Anthropic.ContentBlockParam[] = [];
        for (const att of atts) {
          const base64 = await fetchAsBase64(att.url);
          if (base64) {
            if (att.type.startsWith('image/')) {
              contentBlocks.push({ type: 'image', source: { type: 'base64', media_type: att.type as any, data: base64 } });
            } else if (att.type === 'application/pdf') {
              contentBlocks.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } });
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
      const base64 = await fetchAsBase64(att.url);
      if (base64) {
        if (att.type.startsWith('image/')) {
          contentBlocks.push({ type: 'image', source: { type: 'base64', media_type: att.type as any, data: base64 } });
        } else if (att.type === 'application/pdf') {
          contentBlocks.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } });
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

const SYSTEM_PROMPT = `You are a helpful, friendly AI assistant inside Motif, an app that can also generate UGC-style marketing videos.

Behave like a capable general assistant (think ChatGPT, Claude, or Kimi):
- Hold natural conversations and answer questions directly.
- When the user shares a URL, asks you to look something up, or asks about current events, prices, news, or anything where up-to-date or factual information matters, USE the web_search and web_fetch tools rather than answering from memory. Fetch any link the user provides.
- You can research a topic across multiple sources and then lay out a clear, structured plan or summary.
- Always ground factual claims in what you found, and let the citations speak for your sources.

ARTIFACTS (CRITICAL):
If the user asks you to write code, build a React component, generate a long document, or create a standalone data table, you MUST wrap the content in an XML artifact block.
Format:
<artifact identifier="unique-id-like-filename" type="code | react | markdown | document" title="Human Readable Title">
  // Your code or markdown content here
</artifact>
Do not use markdown code blocks inside the artifact tag if the artifact is already code. Just put the raw content inside the XML tag. You can still use markdown outside the artifact for conversational text.

Only mention that Motif can generate UGC videos if the user explicitly asks what you do or how you can help. For casual small talk (e.g. "hi", "how are you"), just chat naturally without searching the web or mentioning videos.`;

// Extracts {url, title} pairs from the citations attached to the assistant's text blocks.
// Falls back to the raw web_search result URLs when the model produced no inline citations.
function extractSources(content: Anthropic.ContentBlock[]): ChatSource[] {
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

/**
 * Runs a web-capable chat turn using Claude's server-side web_search + web_fetch tools.
 * Returns null when CLAUDE_API is unset or Claude errors, so the caller can fall back
 * to the Gemini reply (no web access), mirroring classifyMessage/generateConcepts.
 */
export async function runChatAgent(message: string, history: any[] = [], attachments: any[] = []): Promise<ChatAgentResult | null> {
  if (!process.env.CLAUDE_API) return null;

  try {
    const anthropic = new Anthropic({ 
      apiKey: process.env.CLAUDE_API,
      defaultHeaders: { 'anthropic-beta': 'pdfs-2024-09-25' }
    });
    const messages = await toAnthropicMessages(history, message, attachments);

    const tools: any[] = [
      { type: 'web_search_20260209', name: 'web_search', max_uses: 5 },
      { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 5 },
    ];

    logApiHit('Claude API (chatAgent)');

    let response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools,
      messages
    });

    // Server tools run an internal loop; if it hits the iteration cap the turn pauses.
    // Re-send the accumulated turn to let Claude continue. Cap continuations to be safe.
    let continuations = 0;
    while (response.stop_reason === 'pause_turn' && continuations < 5) {
      messages.push({ role: 'assistant', content: response.content });
      response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools,
        messages
      });
      continuations++;
    }

    const reply = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('')
      .trim();

    if (!reply) return null;

    return { reply, sources: extractSources(response.content) };
  } catch (err: any) {
    console.warn('Claude chat agent failed, falling back to Gemini. Error:', err.message);
    return null;
  }
}

export type ChatEvent = 
  | { type: 'status'; message: string }
  | { type: 'text'; text: string }
  | { type: 'done'; sources: ChatSource[]; reply: string };

export async function* runChatAgentStream(message: string, history: any[] = [], attachments: any[] = []): AsyncGenerator<ChatEvent, void, unknown> {
  if (!process.env.CLAUDE_API) return;

  const anthropic = new Anthropic({ 
    apiKey: process.env.CLAUDE_API,
    defaultHeaders: { 'anthropic-beta': 'pdfs-2024-09-25' }
  });
  
  const messages = await toAnthropicMessages(history, message, attachments);
  const tools: any[] = [
    { type: 'web_search_20260209', name: 'web_search', max_uses: 5 },
    { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 5 },
  ];

  logApiHit('Claude API (chatAgentStream)');

  yield { type: 'status', message: 'Analyzing request...' };

  let continuations = 0;
  let fullReply = "";
  const allContent: Anthropic.ContentBlock[] = [];

  while (continuations < 5) {
    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
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

    const messageResponse = await stream.finalMessage();
    allContent.push(...messageResponse.content);
    
    if (messageResponse.stop_reason === 'pause_turn') {
      messages.push({ role: 'assistant', content: messageResponse.content });
      continuations++;
    } else {
      break;
    }
  }

  yield { type: 'done', sources: extractSources(allContent), reply: fullReply };
}
