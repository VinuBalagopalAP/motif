"use client";
import React, { useState } from 'react';
import TextareaAutosize from 'react-textarea-autosize';

interface VideoEditorProps {
  messageId: string;
  jobId: string;
  activeRenderSpec: any;
  updateSpec: (updater: (spec: any) => void) => void;
  handlePartialRegenerate: (jobId: string, msgId: string, partialTarget: 'caption' | 'gif' | 'audio' | 'background', bgType?: string, bgPrompt?: string) => void;
  setFontTargetMessageId: (id: string | null) => void;
  setFontTargetSection: (section: 'top' | 'bottom' | 'linked' | null) => void;
  fontFileInputRef: React.RefObject<HTMLInputElement | null>;
}

export function VideoEditor({
  messageId,
  jobId,
  activeRenderSpec,
  updateSpec,
  handlePartialRegenerate,
  setFontTargetMessageId,
  setFontTargetSection,
  fontFileInputRef
}: VideoEditorProps) {
  const [activeTab, setActiveTab] = useState<string>('captions');
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
    <div className="flex flex-col gap-4 w-full max-w-sm">
      {/* Tab Bar */}
      <div className="flex bg-gray-100 p-1.5 rounded-[12px] shadow-inner mb-1">
        {['captions', 'meme', 'background'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 text-xs font-bold py-2 rounded-[8px] transition-all capitalize tracking-wide ${activeTab === tab ? 'bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] text-[#282828]' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Background Tab */}
      {activeTab === 'background' && (
        <div className="w-full p-4 bg-white border border-gray-200 rounded-[16px] text-sm shadow-[0_2px_10px_rgba(0,0,0,0.02)] animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="font-semibold text-gray-700 mb-3 flex items-center justify-between">
            <span>Background Mode</span>
          </div>
          <div className="flex items-center gap-3 mb-4">
            <select
              className="border border-gray-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#08c225]/20 flex-1 bg-white"
              value={activeRenderSpec.backgroundMode || 'video'}
              onChange={(e) => updateSpec(spec => { spec.backgroundMode = e.target.value; })}
            >
              <option value="video">Media (Video/Image)</option>
              <option value="color">Plain Color</option>
            </select>
            {activeRenderSpec.backgroundMode === 'color' && (
              <div className="relative w-10 h-10 rounded-xl border border-gray-200 overflow-hidden shadow-sm shrink-0 hover:scale-105 transition-transform" style={{ backgroundColor: activeRenderSpec.backgroundColor || '#000000' }}>
                <input
                  type="color"
                  value={activeRenderSpec.backgroundColor || '#000000'}
                  onChange={(e) => updateSpec(spec => { spec.backgroundColor = e.target.value; })}
                  className="absolute inset-0 w-[200%] h-[200%] -top-1/2 -left-1/2 cursor-pointer opacity-0"
                />
              </div>
            )}
          </div>

          {(!activeRenderSpec.backgroundMode || activeRenderSpec.backgroundMode === 'video') && (
            <div className="flex flex-col gap-3 pt-3 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Media Type</label>
                {activeRenderSpec.background_video && (
                  <span className="text-[10px] text-[#08c225] font-medium">✓ Both ready</span>
                )}
              </div>
              <div className="flex bg-gray-50 p-1 rounded-lg border border-gray-100">
                <button
                  onClick={() => updateSpec(spec => {
                    spec.activeBgType = 'image';
                    spec.background = spec.background_image || { type: 'image', url: spec.background?.url || '', prompt: spec.background?.prompt || '' };
                  })}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${(activeRenderSpec.activeBgType || activeRenderSpec.background?.type) === 'image' || (!activeRenderSpec.activeBgType && activeRenderSpec.background?.type !== 'video') ? 'bg-white shadow-sm border border-gray-200 text-[#08c225]' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  AI Image
                </button>
                <button
                  onClick={() => {
                    if (activeRenderSpec.background_video) {
                      updateSpec(spec => {
                        spec.activeBgType = 'video';
                        spec.background = spec.background_video;
                      });
                    } else {
                      handlePartialRegenerate(jobId, messageId, 'background', 'video', activeRenderSpec.background?.prompt || '');
                    }
                  }}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${activeRenderSpec.activeBgType === 'video' || activeRenderSpec.background?.type === 'video' ? 'bg-white shadow-sm border border-gray-200 text-[#08c225]' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Stock Video {!activeRenderSpec.background_video && <span className="opacity-50 text-[9px]">(fetch)</span>}
                </button>
              </div>

              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mt-2">Generation Prompt</label>
              <TextareaAutosize
                value={activeRenderSpec.background?.prompt || ""}
                onChange={(e) => updateSpec(spec => { if (!spec.background) spec.background = { type: 'image', url: '' }; spec.background.prompt = e.target.value; })}
                className="w-full border border-gray-200 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#08c225]/20 bg-gray-50 resize-none text-gray-600 font-mono"
                minRows={2}
              />
              <button
                onClick={() => handlePartialRegenerate(jobId, messageId, 'background', activeRenderSpec.activeBgType || activeRenderSpec.background?.type || 'image', activeRenderSpec.background?.prompt || '')}
                disabled={!activeRenderSpec.background?.prompt}
                className="w-full mt-1 px-3 py-2 bg-[#08c225]/10 text-[#08c225] hover:bg-[#08c225]/20 font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
                Regenerate Media
              </button>
            </div>
          )}
        </div>
      )}

      {/* Captions Tab */}
      {activeTab === 'captions' && (
        <div className="w-full p-4 bg-white border border-gray-200 rounded-[16px] text-sm shadow-[0_2px_10px_rgba(0,0,0,0.02)] animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="font-semibold text-gray-700 mb-4 flex justify-between items-center">
            <span>Caption Content</span>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-[11px] font-medium text-gray-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={activeRenderSpec.overlayText?.style?.linkFonts !== false}
                  onChange={(e) => updateSpec(spec => {
                    if (!spec.overlayText.style) spec.overlayText.style = {};
                    spec.overlayText.style.linkFonts = e.target.checked;
                    if (e.target.checked) {
                      spec.overlayText.style.bottomFontFamily = spec.overlayText.style.topFontFamily;
                    }
                  })}
                  className="rounded border-gray-300 text-[#08c225] focus:ring-[#08c225]"
                />
                Link Fonts
              </label>
              {activeRenderSpec.overlayText?.style?.linkFonts !== false && (
                <select
                  className="border border-gray-200 rounded-lg p-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#08c225]/20 w-32 bg-white"
                  value={activeRenderSpec.overlayText?.style?.topFontFamily || activeRenderSpec.overlayText?.style?.fontFamily || "system-ui, -apple-system, sans-serif"}
                  onChange={(e) => {
                    if (e.target.value === 'upload_custom') {
                      setFontTargetMessageId(messageId);
                      setFontTargetSection('linked');
                      fontFileInputRef.current?.click();
                      return;
                    }
                    updateSpec(spec => {
                      if (!spec.overlayText.style) spec.overlayText.style = {};
                      spec.overlayText.style.topFontFamily = e.target.value;
                      spec.overlayText.style.bottomFontFamily = e.target.value;
                      spec.overlayText.style.fontFamily = e.target.value;
                    });
                  }}
                >
                  <option value="system-ui, -apple-system, sans-serif">System</option>
                  {(activeRenderSpec.overlayText?.style?.topFontFamily?.startsWith('http') || activeRenderSpec.overlayText?.style?.fontFamily?.startsWith('http')) && (
                    <option value={activeRenderSpec.overlayText?.style?.topFontFamily || activeRenderSpec.overlayText?.style?.fontFamily}>Custom Font</option>
                  )}
                  <option value="upload_custom" className="text-[#08c225] font-semibold">Upload Custom Font...</option>
                  <option value="Montserrat">Montserrat</option>
                  <option value="Roboto">Roboto</option>
                  <option value="Bangers">Bangers</option>
                  <option value="Permanent Marker">Marker</option>
                  <option value="Anton">Anton</option>
                  <option value="Oswald">Oswald</option>
                  <option value="Playfair Display">Playfair</option>
                </select>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {/* Top Hook Section */}
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Top Hook</label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-1.5 text-[11px] font-medium text-gray-500 cursor-pointer">
                    <input type="checkbox" checked={activeRenderSpec.overlayText?.showTopText !== false} onChange={(e) => updateSpec(spec => { spec.overlayText.showTopText = e.target.checked; })} className="rounded border-gray-300 text-[#08c225] focus:ring-[#08c225] w-3.5 h-3.5" /> Show
                  </label>
                  <label className="flex items-center gap-1.5 text-[11px] font-medium text-gray-500 cursor-pointer">
                    <input type="checkbox" checked={activeRenderSpec.overlayText?.style?.showTopBackground !== false} onChange={(e) => updateSpec(spec => { if (!spec.overlayText.style) spec.overlayText.style = {}; spec.overlayText.style.showTopBackground = e.target.checked; })} className="rounded border-gray-300 text-[#08c225] focus:ring-[#08c225] w-3.5 h-3.5" /> Bg
                  </label>
                </div>
              </div>
              {activeRenderSpec.overlayText?.style?.linkFonts === false && (
                <div className="mb-2">
                  <select
                    className="border border-gray-200 rounded-lg p-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#08c225]/20 w-full bg-white"
                    value={activeRenderSpec.overlayText?.style?.topFontFamily || activeRenderSpec.overlayText?.style?.fontFamily || "system-ui, -apple-system, sans-serif"}
                    onChange={(e) => {
                      if (e.target.value === 'upload_custom') {
                        setFontTargetMessageId(messageId);
                        setFontTargetSection('top');
                        fontFileInputRef.current?.click();
                        return;
                      }
                      updateSpec(spec => { if (!spec.overlayText.style) spec.overlayText.style = {}; spec.overlayText.style.topFontFamily = e.target.value; });
                    }}
                  >
                    <option value="system-ui, -apple-system, sans-serif">System</option>
                    {(activeRenderSpec.overlayText?.style?.topFontFamily?.startsWith('http') || activeRenderSpec.overlayText?.style?.fontFamily?.startsWith('http')) && (
                      <option value={activeRenderSpec.overlayText?.style?.topFontFamily || activeRenderSpec.overlayText?.style?.fontFamily}>Custom Font</option>
                    )}
                    <option value="upload_custom" className="text-[#08c225] font-semibold">Upload Custom Font...</option>
                    <option value="Montserrat">Montserrat</option>
                    <option value="Roboto">Roboto</option>
                    <option value="Bangers">Bangers</option>
                    <option value="Permanent Marker">Marker</option>
                    <option value="Anton">Anton</option>
                    <option value="Oswald">Oswald</option>
                    <option value="Playfair Display">Playfair</option>
                  </select>
                </div>
              )}
              <div className="relative">
                <TextareaAutosize
                  value={activeRenderSpec.overlayText?.top || ""}
                  onChange={(e) => updateSpec(spec => { spec.overlayText.top = e.target.value; })}
                  className="w-full border border-gray-200 rounded-lg p-2.5 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-[#08c225]/20 resize-none bg-white"
                  minRows={1}
                />
                <button
                  onClick={() => handlePartialRegenerate(jobId, messageId, 'caption')}
                  title="Regenerate Top Hook"
                  className="absolute right-2 bottom-2 p-1 text-gray-400 hover:text-[#08c225] transition-colors rounded hover:bg-[#08c225]/10"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
                </button>
              </div>
              <div className="flex items-center gap-3 mt-3 px-1">
                <span className="text-[10px] w-8 text-gray-400 font-bold uppercase tracking-wider">Y-Pos</span>
                <input type="range" min="20" max="800" value={activeRenderSpec.overlayText?.style?.topY ?? 180} onChange={(e) => updateSpec(spec => { if (!spec.overlayText.style) spec.overlayText.style = {}; spec.overlayText.style.topY = parseInt(e.target.value); })} className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#08c225]" />
              </div>
              <div className="flex items-center gap-3 mt-3 px-1">
                <span className="text-[10px] w-8 text-gray-400 font-bold uppercase tracking-wider">Opac</span>
                <input type="range" min="0" max="1" step="0.05" value={activeRenderSpec.overlayText?.style?.topTextOpacity ?? 1} onChange={(e) => updateSpec(spec => { if (!spec.overlayText.style) spec.overlayText.style = {}; spec.overlayText.style.topTextOpacity = parseFloat(e.target.value); })} className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#08c225]" />
              </div>
              <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-gray-200/60">
                <span className="text-[10px] w-8 text-gray-400 font-bold uppercase tracking-wider">Color</span>
                <div className="flex items-center gap-2">
                  {['#ffffff', '#ffeb3b', '#00e5ff', '#ea284e'].map(color => (
                    <button
                      key={color}
                      onClick={() => updateSpec(spec => { if (!spec.overlayText.style) spec.overlayText.style = {}; spec.overlayText.style.topTextColor = color; })}
                      className={`w-5 h-5 rounded-full shadow-sm transition-all ${activeRenderSpec.overlayText?.style?.topTextColor === color ? 'ring-2 ring-offset-2 ring-[#08c225] scale-110' : 'border border-gray-200 hover:scale-110'}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <div className="relative w-6 h-6 rounded-full border border-gray-200 overflow-hidden shadow-sm shrink-0 cursor-pointer hover:scale-110 transition-transform" style={{ background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)' }}>
                    <input
                      type="color"
                      value={activeRenderSpec.overlayText?.style?.topTextColor || '#ffffff'}
                      onChange={(e) => updateSpec(spec => { if (!spec.overlayText.style) spec.overlayText.style = {}; spec.overlayText.style.topTextColor = e.target.value; })}
                      className="absolute inset-0 w-[200%] h-[200%] -top-1/2 -left-1/2 cursor-pointer opacity-0"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom CTA Section */}
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Bottom CTA</label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-1.5 text-[11px] font-medium text-gray-500 cursor-pointer">
                    <input type="checkbox" checked={activeRenderSpec.overlayText?.showBottomText !== false} onChange={(e) => updateSpec(spec => { spec.overlayText.showBottomText = e.target.checked; })} className="rounded border-gray-300 text-[#08c225] focus:ring-[#08c225] w-3.5 h-3.5" /> Show
                  </label>
                  <label className="flex items-center gap-1.5 text-[11px] font-medium text-gray-500 cursor-pointer">
                    <input type="checkbox" checked={activeRenderSpec.overlayText?.style?.showBottomBackground !== false} onChange={(e) => updateSpec(spec => { if (!spec.overlayText.style) spec.overlayText.style = {}; spec.overlayText.style.showBottomBackground = e.target.checked; })} className="rounded border-gray-300 text-[#08c225] focus:ring-[#08c225] w-3.5 h-3.5" /> Bg
                  </label>
                </div>
              </div>
              {activeRenderSpec.overlayText?.style?.linkFonts === false && (
                <div className="mb-2">
                  <select
                    className="border border-gray-200 rounded-lg p-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#08c225]/20 w-full bg-white"
                    value={activeRenderSpec.overlayText?.style?.bottomFontFamily || activeRenderSpec.overlayText?.style?.fontFamily || "system-ui, -apple-system, sans-serif"}
                    onChange={(e) => {
                      if (e.target.value === 'upload_custom') {
                        setFontTargetMessageId(messageId);
                        setFontTargetSection('bottom');
                        fontFileInputRef.current?.click();
                        return;
                      }
                      updateSpec(spec => { if (!spec.overlayText.style) spec.overlayText.style = {}; spec.overlayText.style.bottomFontFamily = e.target.value; });
                    }}
                  >
                    <option value="system-ui, -apple-system, sans-serif">System</option>
                    {(activeRenderSpec.overlayText?.style?.bottomFontFamily?.startsWith('http') || activeRenderSpec.overlayText?.style?.fontFamily?.startsWith('http')) && (
                      <option value={activeRenderSpec.overlayText?.style?.bottomFontFamily || activeRenderSpec.overlayText?.style?.fontFamily}>Custom Font</option>
                    )}
                    <option value="upload_custom" className="text-[#08c225] font-semibold">Upload Custom Font...</option>
                    <option value="Montserrat">Montserrat</option>
                    <option value="Roboto">Roboto</option>
                    <option value="Bangers">Bangers</option>
                    <option value="Permanent Marker">Marker</option>
                    <option value="Anton">Anton</option>
                    <option value="Oswald">Oswald</option>
                    <option value="Playfair Display">Playfair</option>
                  </select>
                </div>
              )}
              <div className="relative">
                <TextareaAutosize
                  value={activeRenderSpec.overlayText?.bottom || ""}
                  onChange={(e) => updateSpec(spec => { spec.overlayText.bottom = e.target.value; })}
                  className="w-full border border-gray-200 rounded-lg p-2.5 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-[#08c225]/20 resize-none bg-white"
                  minRows={1}
                />
                <button
                  onClick={() => handlePartialRegenerate(jobId, messageId, 'caption')}
                  title="Regenerate Bottom CTA"
                  className="absolute right-2 bottom-2 p-1 text-gray-400 hover:text-[#08c225] transition-colors rounded hover:bg-[#08c225]/10"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
                </button>
              </div>
              <div className="flex items-center gap-3 mt-3 px-1">
                <span className="text-[10px] w-8 text-gray-400 font-bold uppercase tracking-wider">Y-Pos</span>
                <input type="range" min="20" max="800" value={activeRenderSpec.overlayText?.style?.bottomY ?? 180} onChange={(e) => updateSpec(spec => { if (!spec.overlayText.style) spec.overlayText.style = {}; spec.overlayText.style.bottomY = parseInt(e.target.value); })} className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#08c225]" />
              </div>
              <div className="flex items-center gap-3 mt-3 px-1">
                <span className="text-[10px] w-8 text-gray-400 font-bold uppercase tracking-wider">Opac</span>
                <input type="range" min="0" max="1" step="0.05" value={activeRenderSpec.overlayText?.style?.bottomTextOpacity ?? 1} onChange={(e) => updateSpec(spec => { if (!spec.overlayText.style) spec.overlayText.style = {}; spec.overlayText.style.bottomTextOpacity = parseFloat(e.target.value); })} className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#08c225]" />
              </div>
              <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-gray-200/60">
                <span className="text-[10px] w-8 text-gray-400 font-bold uppercase tracking-wider">Color</span>
                <div className="flex items-center gap-2">
                  {['#ffffff', '#ffeb3b', '#00e5ff', '#ea284e'].map(color => (
                    <button
                      key={color}
                      onClick={() => updateSpec(spec => { if (!spec.overlayText.style) spec.overlayText.style = {}; spec.overlayText.style.bottomTextColor = color; })}
                      className={`w-5 h-5 rounded-full shadow-sm transition-all ${activeRenderSpec.overlayText?.style?.bottomTextColor === color ? 'ring-2 ring-offset-2 ring-[#08c225] scale-110' : 'border border-gray-200 hover:scale-110'}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <div className="relative w-6 h-6 rounded-full border border-gray-200 overflow-hidden shadow-sm shrink-0 cursor-pointer hover:scale-110 transition-transform" style={{ background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)' }}>
                    <input
                      type="color"
                      value={activeRenderSpec.overlayText?.style?.bottomTextColor || '#ffffff'}
                      onChange={(e) => updateSpec(spec => { if (!spec.overlayText.style) spec.overlayText.style = {}; spec.overlayText.style.bottomTextColor = e.target.value; })}
                      className="absolute inset-0 w-[200%] h-[200%] -top-1/2 -left-1/2 cursor-pointer opacity-0"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Meme Tab */}
      {activeTab === 'meme' && (
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
      )}
    </div>
  );
}
