import { NextResponse } from 'next/server';
import { after } from 'next/server';
import { updateJobStatus, getJob } from '@/lib/jobs';
import { runPipelineWorker } from '@/lib/pipeline/worker';
import { runChatAgent } from '@/lib/pipeline/chatAgent';

export const maxDuration = 60; // Allow Vercel lambda to run up to 60s for background tasks

export async function POST(req: Request) {
  try {
    const { jobId } = await req.json();
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!jobId || !token) {
      return NextResponse.json({ error: 'Job ID and auth token are required' }, { status: 400 });
    }

    // Fetch the existing job to get the original message
    const job = await getJob(jobId, token);
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const history = job.product_json?.chat_history || [];
    if (history.length === 0) {
      return NextResponse.json({ error: 'No history found' }, { status: 400 });
    }

    // Pop the last assistant message to get its variants
    const lastMsg = history[history.length - 1];
    let assistantMessage: any = null;
    let newHistory = [...history];

    if (lastMsg.role === 'assistant') {
      assistantMessage = newHistory.pop();
    } else {
      assistantMessage = { role: 'assistant', variants: [] };
    }

    // Ensure it has a variants array
    if (!assistantMessage.variants) {
      assistantMessage.variants = [{
        type: assistantMessage.type,
        content: assistantMessage.content,
        render_spec: assistantMessage.render_spec,
        sources: assistantMessage.sources
      }];
    }

    // Get the last user message
    const lastUserMsg = newHistory[newHistory.length - 1];
    if (!lastUserMsg || lastUserMsg.role !== 'user') {
      return NextResponse.json({ error: 'No user message found' }, { status: 400 });
    }

    // Check what type of generation this is based on the LAST variant
    const lastVariant = assistantMessage.variants[assistantMessage.variants.length - 1];
    const isChat = lastVariant?.type === 'chat';

    // Reset the job status
    await updateJobStatus(jobId, { 
      status: 'started',
      error: null as any
    }, token);

    if (isChat) {
      // Re-run the chat agent
      after(async () => {
        try {
          const agent = await runChatAgent(lastUserMsg.content, newHistory, lastUserMsg.attachments);
          const reply = agent?.reply || "Hello! I can help you generate UGC videos.";
          const sources = agent?.sources || [];
          
          assistantMessage.variants.push({ type: 'chat', content: reply, sources });
          newHistory.push(assistantMessage);

          await updateJobStatus(jobId, {
            product_json: { ...job.product_json, chat_history: newHistory },
            status: 'done'
          }, token);
        } catch (e) {
          console.error("Regenerate chat error", e);
          await updateJobStatus(jobId, { status: 'error', error: "Failed to regenerate chat" }, token);
        }
      });
    } else {
      // Re-run the video pipeline worker
      after(async () => {
        // Pass the assistantMessage object directly to the worker so it can append to it
        await runPipelineWorker(jobId, lastUserMsg.content, token, newHistory, null, assistantMessage);
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to regenerate job' }, { status: 500 });
  }
}
