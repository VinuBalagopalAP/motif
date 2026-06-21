import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query) {
    return NextResponse.json({ error: 'Query parameter "q" is required' }, { status: 400 });
  }

  try {
    // 1. Check Supabase Cache first
    const { data: cached } = await supabase
      .from('cached_assets')
      .select('data, id')
      .eq('query', query.toLowerCase())
      .eq('asset_type', 'gif')
      .single();
      
    if (cached && cached.data && Array.isArray(cached.data) && cached.data.length > 0) {
      return NextResponse.json({ options: cached.data });
    }

    // 2. Cache Miss - Fetch in parallel
    const fetchPromises = [];

    if (process.env.GIPHY_API_KEY) {
      fetchPromises.push((async () => {
        try {
          const res = await fetch(`https://api.giphy.com/v1/stickers/search?api_key=${process.env.GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=15&rating=pg-13`);
          const data = await res.json();
          return (data.data || []).map((d: any) => d.images.original.url);
        } catch { return []; }
      })());
    }

    if (process.env.KLIPY_API_KEY) {
      fetchPromises.push((async () => {
        try {
          const res = await fetch(`https://api.klipy.co/api/v1/${process.env.KLIPY_API_KEY}/stickers/search?q=${encodeURIComponent(query)}&limit=15`);
          const klipyData = await res.json();
          return (klipyData.data || []).map((d: any) => d.file?.md?.gif?.url || d.file?.md?.webp?.url).filter(Boolean);
        } catch { return []; }
      })());
    }

    if (process.env.API_LEAGUE_KEY) {
      fetchPromises.push((async () => {
        try {
          const res = await fetch(`https://api.apileague.com/search-gifs?query=${encodeURIComponent(query)}&number=15&api-key=${process.env.API_LEAGUE_KEY}`);
          const leagueData = await res.json();
          return (leagueData.images || []).map((d: any) => d.url);
        } catch { return []; }
      })());
    }

    if (fetchPromises.length > 0) {
      const results = await Promise.allSettled(fetchPromises);
      let options: string[] = [];
      results.forEach(r => {
        if (r.status === 'fulfilled' && Array.isArray(r.value)) {
          options = options.concat(r.value);
        }
      });

      // Shuffle options and take top 15
      options = options.sort(() => Math.random() - 0.5).slice(0, 15);

      if (options.length > 0) {
        // Save to cache without blocking
        supabase.from('cached_assets').insert([{
          query: query.toLowerCase(),
          asset_type: 'gif',
          data: options
        }]).then();

        return NextResponse.json({ options });
      }
    }

    return NextResponse.json({ options: [] });
  } catch (error: any) {
    console.error("Error searching GIFs:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
