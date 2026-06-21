import trendPack from "../trend-pack.json";
import { logApiHit } from "./logger";
import { supabase } from "../supabase";

export async function pickAssets(concept: any) {
  let backgroundUrl = "";
  let gifUrl = "";
  
  // Create promises for parallel fetching
  const fetchBackgrounds = async () => {
    const bgPromises: Promise<{ url: string, source: 'pexels' | 'coverr', duration?: number, id?: string }[]>[] = [];

    if (process.env.PEXELS_API_KEY) {
      const pexelsKey = process.env.PEXELS_API_KEY;
      bgPromises.push((async () => {
        try {
          let url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(concept.backgroundQuery)}&orientation=portrait&size=medium&per_page=15`;
          logApiHit('Pexels API');
          let res = await fetch(url, { headers: { Authorization: pexelsKey } });
          let data = await res.json();
          
          if (!data.videos || data.videos.length === 0) {
            console.log(`[Pexels] 0 results for "${concept.backgroundQuery}". Falling back to "${concept.fallbackBackgroundQuery || 'aesthetic'}"`);
            url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(concept.fallbackBackgroundQuery || "aesthetic")}&orientation=portrait&size=medium&per_page=15`;
            res = await fetch(url, { headers: { Authorization: pexelsKey } });
            data = await res.json();
          }

          if (data.videos && data.videos.length > 0) {
            return data.videos.map((v: any) => {
              const file = v.video_files.find((f: any) => f.quality === 'hd') || v.video_files[0];
              return { url: file.link, source: 'pexels', duration: v.duration };
            });
          }
        } catch (e: any) {
          console.warn("Pexels fetch failed", e.message);
        }
        return [];
      })());
    }

    if (process.env.COVERR_API_KEY) {
      const coverrKey = process.env.COVERR_API_KEY;
      bgPromises.push((async () => {
        try {
          const url = `https://api.coverr.co/videos?query=${encodeURIComponent(concept.backgroundQuery)}&urls=true`;
          logApiHit('Coverr API');
          const res = await fetch(url, { headers: { Authorization: `Bearer ${coverrKey}` } });
          const data = await res.json();
          
          if (data.hits && data.hits.length > 0) {
            return data.hits.map((v: any) => {
              return { url: v.urls.mp4, source: 'coverr', duration: v.duration, id: v.id };
            });
          }
        } catch (e: any) {
          console.warn("Coverr fetch failed", e.message);
        }
        return [];
      })());
    }

    if (bgPromises.length > 0) {
      const results = await Promise.allSettled(bgPromises);
      let pooled: { url: string, source: 'pexels' | 'coverr', duration?: number, id?: string }[] = [];
      results.forEach(r => {
        if (r.status === 'fulfilled' && Array.isArray(r.value)) {
          pooled = pooled.concat(r.value);
        }
      });

      const minDuration = concept.durationSec || 6;
      const validVideos = pooled.filter(v => !v.duration || v.duration >= minDuration);
      
      const poolToUse = validVideos.length > 0 ? validVideos : pooled;

      if (poolToUse.length > 0) {
        const randomVideo = poolToUse[Math.floor(Math.random() * poolToUse.length)];
        
        if (randomVideo.source === 'coverr' && randomVideo.id && process.env.COVERR_API_KEY) {
          const coverrKey = process.env.COVERR_API_KEY;
          fetch(`https://api.coverr.co/videos/${randomVideo.id}/stats/downloads`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${coverrKey}` }
          }).catch(() => {});
        }
        
        return randomVideo.url;
      }
    }
    return null;
  };

  const fetchMemeGif = async (): Promise<{ url: string, options: string[] }> => {
    const query = concept.gifQuery || "trending reaction meme";
    
    // 1. Check Supabase Cache first
    const { data: cached } = await supabase
      .from('cached_assets')
      .select('data, id')
      .eq('query', query.toLowerCase())
      .eq('asset_type', 'gif')
      .single();
      
    if (cached && cached.data && Array.isArray(cached.data) && cached.data.length > 0) {
      logApiHit('Cache Hit (Meme)');
      const options = cached.data as string[];
      const randomUrl = options[Math.floor(Math.random() * options.length)];
      return { url: randomUrl, options };
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
      logApiHit('Parallel Meme APIs (Cache Miss)');
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

        const randomUrl = options[Math.floor(Math.random() * options.length)];
        return { url: randomUrl, options };
      }
    }

    return { url: "", options: [] };
  };

  const fetchItunes = async () => {
    try {
      logApiHit('iTunes API (Music)');
      const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(concept.audioQuery || "lofi chill")}&entity=song&limit=15`);
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        const randomTrack = data.results[Math.floor(Math.random() * data.results.length)];
        return randomTrack.previewUrl;
      }
    } catch {
      console.warn("iTunes fetch failed, falling back to local pack.");
    }
    return null;
  };

  // Run all API calls in parallel
  const [fetchedBg, fetchedGifRes, fetchedAudio] = await Promise.all([fetchBackgrounds(), fetchMemeGif(), fetchItunes()]);

  backgroundUrl = fetchedBg || "";
  let gifOptions = fetchedGifRes.options || [];
  gifUrl = fetchedGifRes.url || "";
  let audioUrl = fetchedAudio || "";

  // Fallback to local background
  if (!backgroundUrl) {
    const exactMatch = trendPack.backgrounds.find(b => concept.backgroundQuery.toLowerCase().includes(b.query.toLowerCase()));
    const bg = exactMatch || trendPack.backgrounds[Math.floor(Math.random() * trendPack.backgrounds.length)];
    backgroundUrl = bg.url;
  }

  // Fallback to local GIF
  if (!gifUrl) {
    const query = concept.gifQuery || concept.gifUrl || "trending";
    const gif = trendPack.gifs.find(g => g.query === query) || trendPack.gifs[0];
    gifUrl = gif.url;
    gifOptions = [gifUrl];
  }

  // 3. Audio (Local fallback for safety)
  if (!audioUrl) {
    const exactAudioMatch = trendPack.audios.find(a => (concept.audioMood || concept.audioQuery || "").toLowerCase().includes(a.mood.toLowerCase()));
    const audio = exactAudioMatch || trendPack.audios[Math.floor(Math.random() * trendPack.audios.length)];
    audioUrl = audio.url;
  }

  return {
    durationSec: concept.durationSec || 6,
    aspectRatio: concept.aspectRatio || "9:16",
    background: {
      type: backgroundUrl.includes(".mp4") || backgroundUrl.includes("pexels") ? "video" : "image" as "image" | "video",
      url: backgroundUrl
    },
    overlayText: {
      ...concept.overlayText,
      style: {
        fontFamily: concept.overlayText?.style?.fontFamily || "system-ui, -apple-system, sans-serif",
        textColor: concept.overlayText?.style?.textColor || "white",
        backgroundColor: concept.overlayText?.style?.backgroundColor || "rgba(234, 40, 78, 0.95)",
        showBackground: concept.overlayText?.style?.showBackground !== undefined ? concept.overlayText.style.showBackground : true
      }
    },
    gifOverlay: {
      url: gifUrl,
      options: gifOptions
    },
    audio: {
      url: audioUrl,
      mood: concept.audioQuery || "custom"
    }
  };
}
