import { llmRouter } from './providers/LLMRouter';
import { SYSTEM_PROMPT } from './providers/utils';
import { ChatEvent } from './providers/types';

export { type ChatEvent, type ChatSource } from './providers/types';

export async function* runChatAgentStream(
  message: string,
  history: any[] = [],
  attachments: any[] = [],
  userId?: string,
  token?: string,
  activeJobId?: string
): AsyncGenerator<ChatEvent, void, unknown> {
  // Ensure we check for undefined
  const safeUserId = userId ?? undefined;
  const safeToken = token ?? undefined;
  const safeActiveJobId = activeJobId ?? undefined;

  yield* llmRouter.streamChat(
    message,
    history,
    attachments,
    SYSTEM_PROMPT,
    safeUserId,
    safeToken,
    safeActiveJobId
  );
}
