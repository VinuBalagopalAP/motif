import React, { useState } from 'react';

interface MemeTabProps {
  activeRenderSpec: any;
  updateSpec: (updater: (spec: any) => void) => void;
}

export function MemeTab({ activeRenderSpec, updateSpec }: MemeTabProps) {
  const [gifSearchQuery, setGifSearchQuery] = useState("");
  const [isSearchingGif, setIsSearchingGif] = useState(false);

  const handleSearchGif = async () => {
    if (!gifSearchQuery.trim()) return;
    setIsSearchingGif(true);
    try {
      const res = await fetch(`/api/search-gifs?q=${encodeURIComponent(gifSearchQuery)}`);
      if (!res.ok) throw new Error('Failed to search GIFs');
      const data = await res.json();
      if (data.options && data.options.length > 0) {
        updateSpec(spec => {
          if (!spec.gifOverlay) spec.gifOverlay = { url: "" };
          spec.gifOverlay.options = data.options;
          spec.gifOverlay.url = data.options[0]; // Auto-select first result
        });
      }
    } catch (e) {
      console.error("Failed to search gifs", e);
    }
    setIsSearchingGif(false);
  };

  return (
    <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
      {/* Meme Options & Search Panel */}
      <div className="w-full p-4 bg-white border border-gray-200 rounded-[16px] text-sm shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
        <div className="font-semibold text-gray-700 mb-3 flex items-center justify-between">
          <span>Meme Options</span>
        </div>

        {/* Search Input */}
        <div className="flex items-center gap-2 mb-4">
          <input
            type="text"
            placeholder="Search new meme..."
            value={gifSearchQuery}
            onChange={(e) => setGifSearchQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSearchGif(); }}
            className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#08c225]/20"
          />
          <button
            onClick={() => handleSearchGif()}
            disabled={isSearchingGif || !gifSearchQuery.trim()}
            className="px-3 py-2 bg-[#08c225] text-white rounded-lg text-sm font-semibold hover:bg-[#00b33c] disabled:opacity-50 transition-colors"
          >
            {isSearchingGif ? '...' : 'Search'}
          </button>
        </div>

        {/* Options Carousel */}
        {activeRenderSpec.gifOverlay?.options && activeRenderSpec.gifOverlay.options.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
            {activeRenderSpec.gifOverlay.options.map((optUrl: string, idx: number) => (
              <button
                key={idx}
                onClick={() => updateSpec(spec => { if (!spec.gifOverlay) spec.gifOverlay = { url: "" }; spec.gifOverlay.url = optUrl; })}
                className={`shrink-0 w-16 h-16 rounded-xl overflow-hidden transition-all ${activeRenderSpec.gifOverlay?.url === optUrl ? 'border-2 border-[#08c225] scale-105' : 'border border-gray-100 hover:border-gray-300'}`}
              >
                <img src={optUrl} alt="meme option" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Styling Panel & Meme Toggle */}
      <div className="w-full p-4 bg-white border border-gray-200 rounded-[16px] text-sm shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
        <div className="font-semibold text-gray-700 mb-4 flex items-center justify-between">
          <span>Meme Position</span>
          <label className="flex items-center gap-2 text-xs font-medium text-gray-500 cursor-pointer">
            <input type="checkbox" checked={activeRenderSpec.gifOverlay?.showGifLayer !== false} onChange={(e) => updateSpec(spec => { if (!spec.gifOverlay) spec.gifOverlay = { url: "" }; spec.gifOverlay.showGifLayer = e.target.checked; })} className="rounded border-gray-300 text-[#08c225] focus:ring-[#08c225]" /> Show
          </label>
        </div>

        <div className="flex flex-col gap-3 bg-gray-50 p-3 rounded-xl border border-gray-100">
          <div className="flex items-center gap-3 px-1">
            <span className="text-[10px] w-6 text-gray-400 font-bold uppercase tracking-wider">Left</span>
            <input type="range" min="-400" max="400" value={activeRenderSpec.gifOverlay?.style?.x ?? 0} onChange={(e) => updateSpec(spec => { if (!spec.gifOverlay.style) spec.gifOverlay.style = {}; spec.gifOverlay.style.x = parseInt(e.target.value); })} className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#08c225]" />
          </div>
          <div className="flex items-center gap-3 px-1">
            <span className="text-[10px] w-6 text-gray-400 font-bold uppercase tracking-wider">Top</span>
            <input type="range" min="-600" max="600" value={activeRenderSpec.gifOverlay?.style?.y ?? 0} onChange={(e) => updateSpec(spec => { if (!spec.gifOverlay.style) spec.gifOverlay.style = {}; spec.gifOverlay.style.y = parseInt(e.target.value); })} className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#08c225]" />
          </div>
          <div className="flex items-center gap-3 px-1">
            <span className="text-[10px] w-6 text-gray-400 font-bold uppercase tracking-wider">Zoom</span>
            <input type="range" min="0.5" max="3" step="0.1" value={activeRenderSpec.gifOverlay?.style?.scale ?? 1} onChange={(e) => updateSpec(spec => { if (!spec.gifOverlay.style) spec.gifOverlay.style = {}; spec.gifOverlay.style.scale = parseFloat(e.target.value); })} className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#08c225]" />
          </div>
        </div>
      </div>
    </div>
  );
}
