import { LLMProvider, ChatEvent } from './types';
import { CircuitBreaker } from './CircuitBreaker';
import { ClaudeProvider } from './ClaudeProvider';
import { GeminiProvider } from './GeminiProvider';

export class LLMRouter {
  private claude: LLMProvider;
  private gemini: LLMProvider;

  constructor() {
    this.claude = new ClaudeProvider();
    this.gemini = new GeminiProvider();
  }

  async generateJson(prompt: string): Promise<any> {
    if (CircuitBreaker.isClaudeRevoked()) {
      return this.gemini.generateJson(prompt);
    }

    try {
      return await this.claude.generateJson(prompt);
    } catch (err: any) {
      if (err.status === 401 || err.status === 403) {
        CircuitBreaker.reportApiFailure(err.status);
        return this.gemini.generateJson(prompt);
      }
      throw err;
    }
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
    
    if (CircuitBreaker.isClaudeRevoked()) {
      yield { type: 'status', message: 'Claude API revoked, using Gemini...' };
      yield* this.gemini.streamChat(message, history, attachments, systemPrompt, userId, token, activeJobId);
      return;
    }

    try {
      yield* this.claude.streamChat(message, history, attachments, systemPrompt, userId, token, activeJobId);
    } catch (err: any) {
      if (err.status === 401 || err.status === 403) {
        CircuitBreaker.reportApiFailure(err.status);
        yield { type: 'status', message: 'Switching model...' };
        yield* this.gemini.streamChat(message, history, attachments, systemPrompt, userId, token, activeJobId);
      } else {
        throw err;
      }
    }
  }
}

// Export a singleton instance
export const llmRouter = new LLMRouter();
