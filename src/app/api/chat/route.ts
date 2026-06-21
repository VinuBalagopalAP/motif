import { NextResponse } from 'next/server';
import { after } from 'next/server';
import { createJob, updateJobStatus } from '@/lib/jobs';
import { runPipelineWorker } from '@/lib/pipeline/worker';
import { runChatAgentStream } from '@/lib/pipeline/chatAgent';

export const maxDuration = 60; // Allow Vercel lambda to run up to 60s for background tasks

export async function POST(req: Request) {
  try {
    const { message, userId, history = [], chatId, attachments = [] } = await req.json();
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!message || !userId || !token) {
      return NextResponse.json({ error: 'Message, userId, and auth token are required' }, { status: 400 });
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
          
          controller.enqueue(new TextEncoder().encode(JSON.stringify({ type: 'init', chatId: activeJobId }) + '\n'));

          let finalReply = "";
          let finalSources: any[] = [];
          
          const generator = runChatAgentStream(message, history, attachments, userId, token, activeJobId);
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
            await updateJobStatus(activeJobId, {
              product_json: { chat_history: finalHistory }
            }, token);
            
            after(async () => {
              await runPipelineWorker(activeJobId, message, token, newHistory, undefined, assistantMessage);
            });
          } else {
            await updateJobStatus(activeJobId, {
              product_json: { chat_history: finalHistory },
              status: 'done'
            }, token);
          }
          
          controller.close();
        } catch (e) {
          console.error('Chat stream error:', e);
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
    return NextResponse.json({ error: 'Failed to create job' }, { status: 500 });
  }
}
