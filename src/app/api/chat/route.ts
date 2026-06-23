import { NextResponse } from 'next/server';
import { after } from 'next/server';
import { createJob, updateJobStatus } from '@/lib/jobs';
import { runPipelineWorker } from '@/lib/pipeline/worker';
import { runChatAgentStream } from '@/lib/pipeline/chatAgent';
import { ChatRequestSchema } from '@/lib/schemas';
import { logger } from '@/lib/logger';

export const maxDuration = 60; // Allow Vercel lambda to run up to 60s for background tasks

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const result = ChatRequestSchema.safeParse(json);
    
    if (!result.success) {
      logger.warn({ errors: result.error.issues }, 'Malformed chat request payload');
      return NextResponse.json({ error: 'Invalid request payload', details: result.error.issues }, { status: 400 });
    }

    const { message, userId, history, chatId, attachments } = result.data;
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      logger.warn('Unauthorized chat request: missing token');
      return NextResponse.json({ error: 'Auth token is required' }, { status: 401 });
    }

    let activeJobId = chatId;
    let shouldTriggerVideo = false;

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const newHistory = [...history, { role: 'user', content: message, attachments: attachments.length > 0 ? attachments : undefined }];
          
          if (!activeJobId) {
            activeJobId = await createJob(message, userId, token, { chat_history: newHistory });
          } else {
             await updateJobStatus(activeJobId, { 
               product_json: { chat_history: newHistory },
               status: 'started' 
             }, token);
          }
          
          const jobId = activeJobId as string;
          
          controller.enqueue(new TextEncoder().encode(JSON.stringify({ type: 'init', chatId: jobId }) + '\n'));

          let finalReply = "";
          let finalSources: any[] = [];
          
          const generator = runChatAgentStream(message, history, attachments, userId, token, jobId);
          for await (const event of generator) {
            controller.enqueue(new TextEncoder().encode(JSON.stringify(event) + '\n'));
            if (event.type === 'trigger_video') {
              shouldTriggerVideo = true;
            } else if (event.type === 'done') {
              finalReply = event.reply;
              finalSources = event.sources;
            }
          }

          const assistantMessage = { role: 'assistant', type: 'chat', content: finalReply, sources: finalSources, variants: [] as any[] };
          const finalHistory = [...newHistory, assistantMessage];
          
          if (shouldTriggerVideo) {
            await updateJobStatus(jobId, {
              product_json: { chat_history: finalHistory }
            }, token);
            
            after(async () => {
              await runPipelineWorker(jobId, message, token, newHistory, undefined, assistantMessage);
            });
          } else {
            await updateJobStatus(jobId, {
              product_json: { chat_history: finalHistory },
              status: 'done'
            }, token);
          }
          
          controller.close();
        } catch (e) {
          logger.error({ err: e, chatId: activeJobId }, 'Chat stream processing error');
          controller.error(e);
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to initiate chat job');
    return NextResponse.json({ error: 'Failed to create job' }, { status: 500 });
  }
}
