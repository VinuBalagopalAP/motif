import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const ShareRequestSchema = z.object({
  jobId: z.string().uuid(),
  messages: z.array(z.any()).min(1),
  shareType: z.enum(['entire', 'single']).default('entire')
});

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      logger.warn('Unauthorized share request: missing token');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      logger.warn('Unauthorized share request: invalid token');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const json = await req.json();
    const parseResult = ShareRequestSchema.safeParse(json);

    if (!parseResult.success) {
      logger.warn({ issues: parseResult.error.issues }, 'Invalid share request payload');
      return NextResponse.json({ error: 'Invalid request payload', details: parseResult.error.issues }, { status: 400 });
    }

    const { jobId, messages, shareType } = parseResult.data;

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
        logger.error({ err: updateError, jobId }, 'Error updating share link');
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
      logger.error({ err: error, jobId }, 'Error creating share link');
      return NextResponse.json({ error: 'Failed to create share link' }, { status: 500 });
    }

    return NextResponse.json({ shareId: data.id });
  } catch (error) {
    logger.error({ err: error }, 'Error in /api/share POST');
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
