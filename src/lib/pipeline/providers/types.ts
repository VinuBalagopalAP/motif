export interface ChatSource {
  url: string;
  title: string;
}

export type ChatEvent = 
  | { type: 'status'; message: string }
  | { type: 'text'; text: string }
  | { type: 'trigger_video' }
  | { type: 'done'; sources: ChatSource[]; reply: string };

export interface LLMProvider {
  /**
   * Generates a JSON response for the given prompt, primarily used by the background worker.
   */
  generateJson(prompt: string): Promise<any>;

  /**
   * Streams a conversational chat response, interacting with the user and triggering tools.
   */
  streamChat(
    message: string,
    history: any[],
    attachments: any[],
    systemPrompt: string,
    userId?: string,
    token?: string,
    activeJobId?: string
  ): AsyncGenerator<ChatEvent, void, unknown>;
}
