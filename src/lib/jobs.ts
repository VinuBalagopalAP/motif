import { createClient } from '@supabase/supabase-js';
import { supabase } from './supabase';
type JobStatus = 'queued' | 'started' | 'scraping' | 'planning' | 'picking assets' | 'done' | 'error';

export interface RenderSpec {
  durationSec: number;
  aspectRatio: "9:16";
  backgroundMode?: 'video' | 'color';
  backgroundColor?: string;
  background: {
    type: "image" | "video";
    url: string;
  };
  overlayText: {
    top: string;
    bottom?: string;
    style?: {
      fontFamily?: string;
      topFontFamily?: string;
      bottomFontFamily?: string;
      linkFonts?: boolean;
      topTextColor?: string;
      bottomTextColor?: string;
      topTextOpacity?: number;
      bottomTextOpacity?: number;
      showTopBackground?: boolean;
      showBottomBackground?: boolean;
      topY?: number;
      bottomY?: number;
      backgroundColor?: string;
    };
    showTextLayer?: boolean;
    showTopText?: boolean;
    showBottomText?: boolean;
  };
  gifOverlay: {
    url: string;
    options?: string[];
    showGifLayer?: boolean;
    style?: {
      x?: number;
      y?: number;
      scale?: number;
    };
  };
  audio: {
    url: string;
    mood: string;
  };
}

export interface Job {
  id: string;
  user_id?: string;
  message: string;
  product_json?: any;
  scraped_data_json?: any;
  render_spec_json?: RenderSpec;
  status: JobStatus;
  error?: string;
  output_url?: string;
  created_at: string;
}

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
    .select('*')
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

