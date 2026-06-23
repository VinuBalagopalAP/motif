import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      logger.warn('Unauthorized share delete: missing token');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      logger.warn('Unauthorized share delete: invalid token');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { error } = await client
      .from('shared_chats')
      .delete()
      .eq('id', resolvedParams.id)
      .eq('user_id', user.id);

    if (error) {
      logger.error({ err: error, shareId: resolvedParams.id }, 'Error deleting share link');
      return NextResponse.json({ error: 'Failed to delete share link' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'Error in DELETE /api/shares/[id]');
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
