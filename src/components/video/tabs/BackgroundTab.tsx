import React from 'react';
import TextareaAutosize from 'react-textarea-autosize';

interface BackgroundTabProps {
  messageId: string;
  jobId: string;
  activeRenderSpec: any;
  updateSpec: (updater: (spec: any) => void) => void;
  handlePartialRegenerate: (jobId: string, msgId: string, partialTarget: 'caption' | 'gif' | 'audio' | 'background', bgType?: string, bgPrompt?: string) => void;
}

export function BackgroundTab({
  messageId,
  jobId,
  activeRenderSpec,
  updateSpec,
  handlePartialRegenerate,
}: BackgroundTabProps) {
  return (
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
  );
}
