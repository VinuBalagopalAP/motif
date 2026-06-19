import { NextResponse } from 'next/server';
import { after } from 'next/server';
import { createJob } from '@/lib/jobs';
import { enqueueJob } from '@/lib/pipeline/worker';

export const maxDuration = 60; // Allow Vercel lambda to run up to 60s for background tasks

export async function POST(req: Request) {
  try {
    const { message, userId } = await req.json();
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!message || !userId || !token) {
      return NextResponse.json({ error: 'Message, userId, and auth token are required' }, { status: 400 });
    }

    // Creates the job in Supabase securely (RLS enforced)
    const jobId = await createJob(message, userId, token);
    if (!jobId) {
      return NextResponse.json({ error: 'Failed to create job in database' }, { status: 500 });
    }

    // Add to the queue and explicitly tell Vercel to wait for it via `after`
    after(() => {
      enqueueJob(jobId, message, token).catch(console.error);
    });

    return NextResponse.json({ jobId });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create job' }, { status: 500 });
  }
}
