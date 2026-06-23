import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { msgId, jobId, messageIndex, variantIndex, isPositive } = await req.json();

    if (!jobId || messageIndex === undefined || variantIndex === undefined || isPositive === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data, error } = await client
      .from('chat_feedback')
      .upsert({
        job_id: jobId,
        message_index: messageIndex,
        variant_index: variantIndex,
        user_id: user.id,
        is_positive: isPositive,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'job_id,message_index,variant_index,user_id' })
      .select('id')
      .single();

    if (msgId) {
      await client.from('messages').update({ user_feedback: isPositive ? 'up' : 'down' }).eq('id', msgId);
    }

    if (error) {
      console.error('Error saving feedback:', error);
      return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 });
    }

    return NextResponse.json({ feedbackId: data.id });
  } catch (error) {
    console.error('Error in /api/feedback POST:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { feedbackId, reason } = await req.json();

    if (!feedbackId || !reason) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { error } = await client
      .from('chat_feedback')
      .update({ reason, updated_at: new Date().toISOString() })
      .eq('id', feedbackId)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error updating feedback reason:', error);
      return NextResponse.json({ error: 'Failed to update feedback reason' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in /api/feedback PUT:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
