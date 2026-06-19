import { NextResponse } from 'next/server';
import { after } from 'next/server';
import { updateJobStatus, getJob } from '@/lib/jobs';
import { enqueueJob } from '@/lib/pipeline/worker';

export const maxDuration = 60; // Allow Vercel lambda to run up to 60s for background tasks

export async function POST(req: Request) {
  try {
    const { jobId, message } = await req.json();
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!jobId || !message || !token) {
      return NextResponse.json({ error: 'Job ID, message, and auth token are required' }, { status: 400 });
    }

    // Fetch the existing job to verify ownership
    const job = await getJob(jobId, token);
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Update the message, reset the status, and clear the outputs
    await updateJobStatus(jobId, { 
      message: message,
      status: 'started',
      error: null as any,
      render_spec_json: null as any,
      output_url: null as any,
      scraped_data_json: null as any,
      product_json: null as any
    }, token);

    // Re-enqueue the job with the new message
    after(() => {
      enqueueJob(jobId, message, token).catch(console.error);
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to edit job' }, { status: 500 });
  }
}
