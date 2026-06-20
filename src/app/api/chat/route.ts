import { NextResponse } from 'next/server';
import { after } from 'next/server';
import { createJob, updateJobStatus } from '@/lib/jobs';
import { runPipelineWorker } from '@/lib/pipeline/worker';
import { classifyMessage } from '@/lib/pipeline/classifyMessage';
import { runChatAgent } from '@/lib/pipeline/chatAgent';

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
      // Web-capable agent (Claude server tools); falls back to the classifier reply when
      // CLAUDE_API is unset or Claude errors.
      const agent = await runChatAgent(message, history, attachments);
      const reply = agent?.reply || classification.reply || "Hello! I can help you generate UGC videos. Just provide a product URL.";
      const sources = agent?.sources || [];
      const newHistory = [...history, { role: 'user', content: message, attachments: attachments.length > 0 ? attachments : undefined }, { role: 'assistant', type: 'chat', content: reply, sources }];

      if (activeJobId) {
        await updateJobStatus(activeJobId, {
          product_json: { chat_history: newHistory },
          status: 'done'
        }, token);
      } else {
        activeJobId = await createJob(message, userId, token, { chat_history: newHistory });
      }

      return NextResponse.json({
        isChat: true,
        reply: reply,
        sources: sources,
        chatId: activeJobId
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
