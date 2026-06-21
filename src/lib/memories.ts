import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function getClient(token?: string) {
  const options = token
    ? {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    : {};
  return createClient(supabaseUrl, supabaseAnonKey, options);
}

export async function getUserMemories(userId: string, token: string) {
  const supabase = getClient(token);
  const { data, error } = await supabase
    .from('user_memories')
    .select('fact')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Failed to fetch user memories:', error);
    return [];
  }
  
  return data.map(m => m.fact);
}

export async function saveUserMemory(userId: string, fact: string, jobId: string | null, token: string) {
  const supabase = getClient(token);
  const { error } = await supabase
    .from('user_memories')
    .insert({
      user_id: userId,
      fact,
      source_job_id: jobId || null
    });

  if (error) {
    console.error('Failed to save user memory:', error);
    throw new Error('Database insert failed');
  }
}
