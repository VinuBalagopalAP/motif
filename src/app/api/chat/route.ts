import { NextResponse } from 'next/server';
import { after } from 'next/server';
import { createJob, updateJobStatus } from '@/lib/jobs';
import { runPipelineWorker } from '@/lib/pipeline/worker';
import { classifyMessage } from '@/lib/pipeline/classifyMessage';
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

    // Classify intent synchronously
    const classification = await classifyMessage(message, history, attachments);
    
    let activeJobId = chatId;

    if (classification.type === 'chat') {
      const stream = new ReadableStream({
        async start(controller) {
          try {
            if (!activeJobId) {
              const tempHistory = [...history, { role: 'user', content: message, attachments: attachments.length > 0 ? attachments : undefined }];
              activeJobId = await createJob(message, userId, token, { chat_history: tempHistory });
            }
            
            controller.enqueue(new TextEncoder().encode(JSON.stringify({ type: 'init', chatId: activeJobId }) + '\n'));

            let finalReply = "";
            let finalSources: any[] = [];
            
            const generator = runChatAgentStream(message, history, attachments, userId, token, activeJobId);
            for await (const event of generator) {
              controller.enqueue(new TextEncoder().encode(JSON.stringify(event) + '\n'));
              if (event.type === 'done') {
                finalReply = event.reply;
                finalSources = event.sources;
              }
            }

            if (!finalReply) {
              finalReply = classification.reply || "Hello! I can help you generate UGC videos. Just provide a product URL.";
              controller.enqueue(new TextEncoder().encode(JSON.stringify({ type: 'done', reply: finalReply, sources: [] }) + '\n'));
            }

            const newHistory = [...history, { role: 'user', content: message, attachments: attachments.length > 0 ? attachments : undefined }, { role: 'assistant', type: 'chat', content: finalReply, sources: finalSources }];
            await updateJobStatus(activeJobId, {
              product_json: { chat_history: newHistory },
              status: 'done'
            }, token);
            
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
    }

    // It's a UGC request
    const newHistory = [...history, { role: 'user', content: message, attachments: attachments.length > 0 ? attachments : undefined }];
    if (activeJobId) {
      await updateJobStatus(activeJobId, { 
        product_json: { chat_history: newHistory },
        status: 'started' 
      }, token);
    } else {
      activeJobId = await createJob(message, userId, token, { chat_history: newHistory });
    }

    // Explicitly tell Vercel to wait for the worker via `after`
    after(async () => {
      await runPipelineWorker(activeJobId, message, token, newHistory, classification);
    });

    return NextResponse.json({ jobId: activeJobId, chatId: activeJobId });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create job' }, { status: 500 });
  }
}
