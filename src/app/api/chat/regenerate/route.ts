import { NextResponse } from 'next/server';
import { after } from 'next/server';
import { updateJobStatus, getJob } from '@/lib/jobs';
import { enqueueJob } from '@/lib/pipeline/worker';

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

    // Reset the job status and clear the output
    await updateJobStatus(jobId, { 
      status: 'started',
      error: null as any,
      render_spec_json: null as any,
      output_url: null as any
    }, token);

    // Re-enqueue the job
    after(() => {
      enqueueJob(jobId, job.message, token).catch(console.error);
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to regenerate job' }, { status: 500 });
  }
}
