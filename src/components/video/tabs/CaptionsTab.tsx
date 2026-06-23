import React from 'react';
import TextareaAutosize from 'react-textarea-autosize';

interface CaptionsTabProps {
  messageId: string;
  jobId: string;
  activeRenderSpec: any;
  updateSpec: (updater: (spec: any) => void) => void;
  handlePartialRegenerate: (jobId: string, msgId: string, partialTarget: 'caption' | 'gif' | 'audio' | 'background', bgType?: string, bgPrompt?: string) => void;
  setFontTargetMessageId: (id: string | null) => void;
  setFontTargetSection: (section: 'top' | 'bottom' | 'linked' | null) => void;
  fontFileInputRef: React.RefObject<HTMLInputElement | null>;
}

export function CaptionsTab({
  messageId,
  jobId,
  activeRenderSpec,
  updateSpec,
  handlePartialRegenerate,
  setFontTargetMessageId,
  setFontTargetSection,
  fontFileInputRef
}: CaptionsTabProps) {
  return (
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
  );
}
