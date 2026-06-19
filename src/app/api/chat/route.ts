import { NextResponse } from 'next/server';
import { after } from 'next/server';
import { createJob } from '@/lib/jobs';
import { runPipelineWorker } from '@/lib/pipeline/worker';
import { classifyMessage } from '@/lib/pipeline/classifyMessage';

export const maxDuration = 60; // Allow Vercel lambda to run up to 60s for background tasks

export async function POST(req: Request) {
  try {
    const { message, userId, history = [] } = await req.json();
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!message || !userId || !token) {
      return NextResponse.json({ error: 'Message, userId, and auth token are required' }, { status: 400 });
    }

    // Classify intent synchronously
    const classification = await classifyMessage(message, history);

    if (classification.type === 'chat') {
      return NextResponse.json({ 
        isChat: true, 
        reply: classification.reply || "Hello! I can help you generate UGC videos. Just provide a product URL." 
      });
    }

    // Creates the job in Supabase securely (RLS enforced)
    const jobId = await createJob(message, userId, token);
    if (!jobId) {
      return NextResponse.json({ error: 'Failed to create job in database' }, { status: 500 });
    }

    // Explicitly tell Vercel to wait for the worker via `after`
    after(async () => {
      // Pass the already classified UGC intent down if needed, but worker can just proceed.
      await runPipelineWorker(jobId, message, token, history, classification);
    });

    return NextResponse.json({ jobId });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create job' }, { status: 500 });
  }
}
