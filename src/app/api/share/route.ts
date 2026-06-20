import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { jobId, messages, shareType = 'entire' } = await req.json();

    if (!jobId || !messages) {
      return NextResponse.json({ error: 'Missing jobId or messages' }, { status: 400 });
    }

    // Persist shareType in the first message to identify this share's type later
    if (messages.length > 0) {
      messages[0]._shareType = shareType;
    }

    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    // Fetch all existing shares for this job_id
    const { data: existingShares, error: fetchError } = await client
      .from('shared_chats')
      .select('id, messages_json')
      .eq('original_job_id', jobId)
      .eq('user_id', user.id);

    let existingShare = null;
    if (existingShares && existingShares.length > 0) {
      existingShare = existingShares.find(share => {
        const shareMsgs = share.messages_json as any[];
        if (!shareMsgs || shareMsgs.length === 0) return false;
        
        const existingShareType = shareMsgs[0]._shareType || 'entire'; // fallback for old ones
        const incomingLastMsgId = messages[messages.length - 1]?.id;
        const existingLastMsgId = shareMsgs[shareMsgs.length - 1]?.id;

        if (existingShareType !== shareType) return false;
        
        if (shareType === 'entire') return true;
        
        // if both are single, they must be for the exact same message to overwrite
        if (shareType === 'single') return existingLastMsgId === incomingLastMsgId;
        
        return false;
      });
    }

    if (existingShare) {
      // Update the messages_json if it exists to keep it fresh
      const { error: updateError } = await client
        .from('shared_chats')
        .update({ messages_json: messages })
        .eq('id', existingShare.id);

      if (updateError) {
        console.error('Error updating share link:', updateError);
        return NextResponse.json({ error: 'Failed to update share link' }, { status: 500 });
      }
      
      return NextResponse.json({ shareId: existingShare.id });
    }

    // Create a new snapshot in shared_chats if it doesn't exist
    const { data, error } = await client
      .from('shared_chats')
      .insert({
        original_job_id: jobId,
        user_id: user.id,
        messages_json: messages,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating share link:', error);
      return NextResponse.json({ error: 'Failed to create share link' }, { status: 500 });
    }

    return NextResponse.json({ shareId: data.id });
  } catch (error) {
    console.error('Error in /api/share:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
