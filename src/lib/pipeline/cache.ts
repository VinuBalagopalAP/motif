import { supabase } from '../supabase';

export async function getCachedTrend(niche: string) {
  // TikTok/Reels trends die fast, so we consider data older than 7 days "stale"
  const STALE_DAYS = 7;
  const staleThreshold = new Date();
  staleThreshold.setDate(staleThreshold.getDate() - STALE_DAYS);

  const { data, error } = await supabase
    .from('cached_trends')
    .select('*')
    .eq('niche', niche.toLowerCase())
    .gte('last_fetched_at', staleThreshold.toISOString())
    .order('usage_count', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }

  // If a user gets a cache hit, we increment the usage count to prioritize it in the future
  await supabase
    .from('cached_trends')
    .update({ usage_count: data.usage_count + 1 })
    .eq('id', data.id);

  return data.trend_data;
}

export async function saveCachedTrend(niche: string, trendData: any) {
  const { error } = await supabase
    .from('cached_trends')
    .insert([
      {
        niche: niche.toLowerCase(),
        trend_data: trendData,
        usage_count: 1,
        last_fetched_at: new Date().toISOString()
      }
    ]);

  if (error) {
    console.error("Failed to save trend to cache:", error);
  }
}
