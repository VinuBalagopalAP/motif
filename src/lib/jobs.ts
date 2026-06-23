import { createClient } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { Job } from '@/types';

// Helper to get a scoped client for RLS
function getScopedClient(token?: string) {
  if (!token) return supabase;
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
}

export async function getJob(id: string, token?: string): Promise<Job | null> {
  const client = getScopedClient(token);
  const { data, error } = await client
    .from('video_jobs')
    .select('*, messages(*)')
    .eq('id', id)
    .single();

  if (error || !data) return null;
  return data as Job;
}

export async function createJob(message: string, userId: string, token: string, productJson?: any): Promise<string | null> {
  const client = getScopedClient(token);
  const { data, error } = await client
    .from('video_jobs')
    .insert([{ message, status: 'started', user_id: userId, product_json: productJson }])
    .select('id')
    .single();

  if (error || !data) {
    console.error("Failed to create job:", error);
    return null;
  }
  return data.id;
}

export async function updateJobStatus(id: string, updates: Partial<Job>, token?: string): Promise<void> {
  const client = getScopedClient(token);
  const { error } = await client
    .from('video_jobs')
    .update(updates)
    .eq('id', id);

  if (error) {
    console.error("Failed to update job status:", error);
  }
}

export async function insertMessage(msg: Partial<import('@/types').DbMessage>, token?: string): Promise<string | null> {
  const client = getScopedClient(token);
  const { data, error } = await client
    .from('messages')
    .insert([msg])
    .select('id')
    .single();

  if (error || !data) {
    console.error("Failed to insert message:", error);
    return null;
  }
  return data.id;
}

export async function updateMessage(id: string, updates: Partial<import('@/types').DbMessage>, token?: string): Promise<void> {
  const client = getScopedClient(token);
  const { error } = await client
    .from('messages')
    .update(updates)
    .eq('id', id);

  if (error) {
    console.error("Failed to update message:", error);
  }
}
