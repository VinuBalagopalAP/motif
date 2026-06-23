import { NextResponse } from 'next/server';
import { after } from 'next/server';
import { updateJobStatus, getJob } from '@/lib/jobs';
import { runPipelineWorker } from '@/lib/pipeline/worker';

export const maxDuration = 60; // Allow Vercel lambda to run up to 60s for background tasks

export async function POST(req: Request) {
  try {
    const { jobId, partialTarget, bgType, bgPrompt } = await req.json(); // partialTarget: 'caption' | 'gif' | 'background'
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!jobId || !token || !partialTarget) {
      return NextResponse.json({ error: 'Job ID, target, and auth token are required' }, { status: 400 });
    }

    const job = await getJob(jobId, token);
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const history = job.product_json?.chat_history || [];
    if (history.length === 0) {
      return NextResponse.json({ error: 'No history found' }, { status: 400 });
    }

    // Pop the last assistant message
    const lastMsg = history[history.length - 1];
    let assistantMessage: any = null;
    let newHistory = [...history];

    if (lastMsg.role === 'assistant') {
      assistantMessage = newHistory.pop();
    } else {
      return NextResponse.json({ error: 'Last message is not assistant' }, { status: 400 });
    }

    // Get the exact last RenderSpec
    const lastVariant = assistantMessage.variants[assistantMessage.variants.length - 1];
    if (!lastVariant || lastVariant.type !== 'video' || !lastVariant.render_spec) {
      return NextResponse.json({ error: 'Cannot partially regenerate a non-video variant' }, { status: 400 });
    }

    const existingRenderSpec = lastVariant.render_spec;

    const lastUserMsg = newHistory[newHistory.length - 1];

    await updateJobStatus(jobId, { 
      status: 'started',
      error: null as any
    }, token);

    // Re-run the video pipeline worker with partialTarget and existingRenderSpec
    after(async () => {
      await runPipelineWorker(jobId, lastUserMsg.content || '', token, newHistory, null, assistantMessage, partialTarget, existingRenderSpec, bgType, bgPrompt);
    });

    return NextResponse.json({ success: true, type: 'video' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to partially regenerate job' }, { status: 500 });
  }
}
