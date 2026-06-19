import trendPack from "../trend-pack.json";
import { logApiHit } from "./logger";

export async function pickAssets(concept: any) {
  let backgroundUrl = "";
  let gifUrl = "";
  
  // Create promises for parallel fetching
  const fetchPexels = async () => {
    if (process.env.PEXELS_API_KEY) {
      try {
        let url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(concept.backgroundQuery)}&orientation=portrait&size=medium&per_page=15`;
        logApiHit('Pexels API');
        const res = await fetch(url, {
          headers: { Authorization: process.env.PEXELS_API_KEY }
        });
        const data = await res.json();
        if (data.videos && data.videos.length > 0) {
          const randomVideo = data.videos[Math.floor(Math.random() * data.videos.length)];
          const videoFiles = randomVideo.video_files;
          return videoFiles.find((f: any) => f.quality === 'hd')?.link || videoFiles[0].link;
        }
      } catch {
        console.warn("Pexels fetch failed, falling back to local pack.");
      }
    }
    return null;
  };

  const fetchGiphy = async () => {
    if (process.env.GIPHY_API_KEY) {
      try {
        logApiHit('Giphy API');
        const res = await fetch(`https://api.giphy.com/v1/stickers/search?api_key=${process.env.GIPHY_API_KEY}&q=${encodeURIComponent(concept.gifQuery)}&limit=15&rating=g`);
        const data = await res.json();
        if (data.data && data.data.length > 0) {
          const randomSticker = data.data[Math.floor(Math.random() * data.data.length)];
          return randomSticker.images.original.url;
        }
      } catch {
        console.warn("Giphy fetch failed, falling back to local pack.");
      }
    }
    return null;
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
  const [fetchedBg, fetchedGif, fetchedAudio] = await Promise.all([fetchPexels(), fetchGiphy(), fetchItunes()]);

  backgroundUrl = fetchedBg || "";
  gifUrl = fetchedGif || "";
  let audioUrl = fetchedAudio || "";

  // Fallback to local background
  if (!backgroundUrl) {
    const exactMatch = trendPack.backgrounds.find(b => concept.backgroundQuery.toLowerCase().includes(b.query.toLowerCase()));
    const bg = exactMatch || trendPack.backgrounds[Math.floor(Math.random() * trendPack.backgrounds.length)];
    backgroundUrl = bg.url;
  }

  // Fallback to local GIF
  if (!gifUrl) {
    const gif = trendPack.gifs.find(g => g.query === concept.gifQuery) || trendPack.gifs[0];
    gifUrl = gif.url;
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
    overlayText: concept.overlayText,
    gifOverlay: {
      url: gifUrl
    },
    audio: {
      url: audioUrl,
      mood: concept.audioQuery || "custom"
    }
  };
}
