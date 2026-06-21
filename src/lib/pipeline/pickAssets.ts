import trendPack from "../trend-pack.json";
import { logApiHit } from "./logger";
import { supabase } from "../supabase";

export async function pickAssets(concept: any, bgType: 'image' | 'video' = 'image', customBgPrompt?: string) {
  let gifUrl = "";
  
  const imagePromptText = customBgPrompt || concept.imagePrompt || concept.backgroundQuery;
  const videoPromptText = customBgPrompt || concept.backgroundQuery;

  // Fetch image background (Unsplash → Pollinations fallback)
  const fetchImageBackground = async (): Promise<{ url: string, prompt: string }> => {
      if (process.env.UNSPLASH_ACCESS_KEY) {
      try {
        logApiHit('Unsplash API');
        const unsplashRes = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(imagePromptText)}&orientation=portrait&per_page=10`, {
          headers: { Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` }
        });
        if (unsplashRes.ok) {
          const unsplashData = await unsplashRes.json();
          if (unsplashData.results && unsplashData.results.length > 0) {
            const randomIndex = Math.floor(Math.random() * Math.min(5, unsplashData.results.length));
            return { url: unsplashData.results[randomIndex].urls.regular, prompt: imagePromptText };
          }
        } else {
          console.warn("Unsplash API returned error status:", unsplashRes.status);
        }
      } catch (e: any) {
        console.warn("Unsplash fetch failed", e.message);
      }
    }
    logApiHit('Pollinations API');
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(imagePromptText)}?width=1080&height=1920&nologo=true&enhance=true`;
    return { url, prompt: imagePromptText };
  };

  // Fetch video background (Pexels + Coverr)
  const fetchVideoBackground = async (): Promise<{ url: string, prompt: string } | null> => {
    const bgPromises: Promise<{ url: string, source: 'pexels' | 'coverr', duration?: number, id?: string }[]>[] = [];

    if (process.env.PEXELS_API_KEY) {
      const pexelsKey = process.env.PEXELS_API_KEY;
      bgPromises.push((async () => {
        try {
          let url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(videoPromptText)}&orientation=portrait&size=medium&per_page=15`;
          logApiHit('Pexels API');
          let res = await fetch(url, { headers: { Authorization: pexelsKey } });
          let data = await res.json();
          
          if (!data.videos || data.videos.length === 0) {
            url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(concept.fallbackBackgroundQuery || "aesthetic")}&orientation=portrait&size=medium&per_page=15`;
            res = await fetch(url, { headers: { Authorization: pexelsKey } });
            data = await res.json();
          }

          if (data.videos && data.videos.length > 0) {
            return data.videos.map((v: any) => {
              const sortedFiles = [...v.video_files].sort((a: any, b: any) => (b.width * b.height) - (a.width * a.height));
              const file = sortedFiles[0] || v.video_files[0];
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
          const url = `https://api.coverr.co/videos?query=${encodeURIComponent(videoPromptText)}&urls=true`;
          logApiHit('Coverr API');
          const res = await fetch(url, { headers: { Authorization: `Bearer ${coverrKey}` } });
          const data = await res.json();
          if (data.hits && data.hits.length > 0) {
            return data.hits.map((v: any) => ({ url: v.urls.mp4, source: 'coverr', duration: v.duration, id: v.id }));
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
        if (r.status === 'fulfilled' && Array.isArray(r.value)) pooled = pooled.concat(r.value);
      });
      const minDuration = concept.durationSec || 6;
      const poolToUse = pooled.filter(v => !v.duration || v.duration >= minDuration);
      const finalPool = poolToUse.length > 0 ? poolToUse : pooled;
      if (finalPool.length > 0) {
        const randomVideo = finalPool[Math.floor(Math.random() * finalPool.length)];
        if (randomVideo.source === 'coverr' && randomVideo.id && process.env.COVERR_API_KEY) {
          fetch(`https://api.coverr.co/videos/${randomVideo.id}/stats/downloads`, {
            method: 'PATCH', headers: { Authorization: `Bearer ${process.env.COVERR_API_KEY}` }
          }).catch(() => {});
        }
        return { url: randomVideo.url, prompt: videoPromptText };
      }
    }
    return null;
  };

  const fetchMemeGif = async (): Promise<{ url: string, options: string[] }> => {
    const query = concept.gifQuery || "trending reaction meme";
    
    // Always bypass cache for pipeline auto-selection to ensure variety
    // (Cache is only used for user-triggered meme searches in the UI)
    const fetchPromises = [];
    console.log("DEBUG: GIPHY_API_KEY exists?", !!process.env.GIPHY_API_KEY);
    console.log("DEBUG: KLIPY_API_KEY exists?", !!process.env.KLIPY_API_KEY);

    if (process.env.GIPHY_API_KEY) {
      fetchPromises.push((async () => {
        try {
          const res = await fetch(`https://api.giphy.com/v1/stickers/search?api_key=${process.env.GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=15&rating=pg-13`);
          const data = await res.json();
          return (data.data || []).map((d: any) => d.images.original.url);
        } catch(e: any) { console.error("Giphy API Error:", e); return []; }
      })());
    }

    if (process.env.KLIPY_API_KEY) {
      fetchPromises.push((async () => {
        try {
          const res = await fetch(`https://api.klipy.co/api/v1/${process.env.KLIPY_API_KEY}/stickers/search?q=${encodeURIComponent(query)}&limit=15`);
          const klipyData = await res.json();
          return (klipyData.data || []).map((d: any) => d.file?.md?.gif?.url).filter(Boolean);
        } catch(e: any) { console.error("Klipy API Error:", e); return []; }
      })());
    }

    if (process.env.API_LEAGUE_KEY) {
      fetchPromises.push((async () => {
        try {
          const res = await fetch(`https://api.apileague.com/search-gifs?query=${encodeURIComponent(query)}&number=15&api-key=${process.env.API_LEAGUE_KEY}`);
          const leagueData = await res.json();
          return (leagueData.images || []).map((d: any) => d.url);
        } catch(e: any) { console.error("API League Error:", e); return []; }
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
        }]).then(undefined, (e: any) => console.error("Supabase Cache Error:", e));

        console.log("DEBUG: Final meme options array length:", options.length);
        console.log("DEBUG: Final meme options array sample:", options.slice(0, 2));

        const randomUrl = options[Math.floor(Math.random() * options.length)];
        return { url: randomUrl, options };
      }
    }

    // Secondary fallback: If the AI generated an obscure query that returned 0 results from all APIs,
    // retry with a guaranteed broad term so the user still gets a tray of options instead of the hardcoded default.
    if (query !== "trending reaction meme" && query !== "funny meme") {
      console.log(`DEBUG: Meme APIs returned 0 results for "${query}", falling back to generic query...`);
      concept.gifQuery = "trending reaction meme";
      return fetchMemeGif(); // Recursive retry with generic query
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

  // Run background fetches (both image AND video) in parallel with meme + audio
  const [fetchedImageBg, fetchedVideoBg, fetchedGifRes, fetchedAudio] = await Promise.all([
    fetchImageBackground(),
    fetchVideoBackground(),
    fetchMemeGif(),
    fetchItunes()
  ]);

  // Determine which type was initially requested (default to image)
  const activeBgType = bgType || 'image';
  const activeBackground = activeBgType === 'video' && fetchedVideoBg
    ? { type: 'video' as const, url: fetchedVideoBg.url, prompt: fetchedVideoBg.prompt }
    : { type: 'image' as const, url: fetchedImageBg.url, prompt: fetchedImageBg.prompt };

  let gifOptions = fetchedGifRes.options || [];
  gifUrl = fetchedGifRes.url || "";
  let audioUrl = fetchedAudio || "";

  // Fallback to local background if both failed
  if (!activeBackground.url) {
    const exactMatch = trendPack.backgrounds.find((b: any) => concept.backgroundQuery?.toLowerCase().includes((b.backgroundQuery || b.query || '').toLowerCase()));
    const bg = exactMatch || trendPack.backgrounds[Math.floor(Math.random() * trendPack.backgrounds.length)] as any;
    activeBackground.url = bg.url;
    activeBackground.type = 'video';
  }

  // GIF fallback to local pack
  if (!gifUrl) {
    const query = concept.gifQuery || "trending";
    const gif = trendPack.gifs.find(g => g.query === query) || trendPack.gifs[0];
    gifUrl = gif.url;
    gifOptions = [gifUrl];
  }

  if (!audioUrl) {
    const exactAudioMatch = trendPack.audios.find(a => (concept.audioMood || concept.audioQuery || "").toLowerCase().includes(a.mood.toLowerCase()));
    const audio = exactAudioMatch || trendPack.audios[Math.floor(Math.random() * trendPack.audios.length)];
    audioUrl = audio.url;
  }

  return {
    durationSec: concept.durationSec || 6,
    aspectRatio: concept.aspectRatio || "9:16",
    // Active background (whichever type was requested)
    background: activeBackground,
    // Store both pre-fetched backgrounds for instant switching
    background_image: { type: 'image' as const, url: fetchedImageBg.url, prompt: fetchedImageBg.prompt },
    background_video: fetchedVideoBg ? { type: 'video' as const, url: fetchedVideoBg.url, prompt: fetchedVideoBg.prompt } : null,
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
      options: gifOptions,
      showGifLayer: true
    },
    audio: {
      url: audioUrl,
      mood: concept.audioQuery || "custom"
    }
  };
}
