import React from 'react';
import { Player } from '@remotion/player';
import { UgcVideo } from '@/remotion/UgcVideo';
import { VideoEditor } from '@/components/video/VideoEditor';

interface VideoResultBubbleProps {
  message: any;
  activeRenderSpec: any;
  setMessages: React.Dispatch<React.SetStateAction<any[]>>;
  handleRegenerate: (jobId: string, msgId: string) => void;
  setExportModalOpen: (open: boolean) => void;
  handlePartialRegenerate: (jobId: string, msgId: string, partialTarget: 'caption' | 'gif' | 'audio' | 'background', bgType?: string, bgPrompt?: string) => void;
  setFontTargetMessageId: (id: string | null) => void;
  setFontTargetSection: (section: 'top' | 'bottom' | 'linked' | null) => void;
  fontFileInputRef: React.RefObject<HTMLInputElement | null>;
}

export function VideoResultBubble({
  message: m,
  activeRenderSpec,
  setMessages,
  handleRegenerate,
  setExportModalOpen,
  handlePartialRegenerate,
  setFontTargetMessageId,
  setFontTargetSection,
  fontFileInputRef
}: VideoResultBubbleProps) {

  const updateSpec = (updater: (spec: any) => void) => {
    setMessages(prev => prev.map(msg => {
      if (msg.id === m.id) {
        const variants = [...(msg.variants || [])];
        const activeIdx = msg.activeVariantIndex ?? variants.length - 1;
        const spec = JSON.parse(JSON.stringify(variants[activeIdx].render_spec));
        updater(spec);
        variants[activeIdx] = { ...variants[activeIdx], render_spec: spec };
        return { ...msg, variants, job: { ...msg.job, render_spec_json: spec } as any };
      }
      return msg;
    }));
  };

  return (
    <div className="mt-2 flex flex-col md:flex-row items-start justify-center gap-6 w-full max-w-4xl">
      {/* Left Column: Video */}
      <div className="flex flex-col items-center gap-3 w-full max-w-[320px] flex-shrink-0">
        <div className="rounded-[24px] overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.08)] border border-gray-100 relative group bg-[#f9f9fa] w-full">
          <Player
            component={UgcVideo}
            inputProps={{ spec: activeRenderSpec }}
            durationInFrames={Math.floor(activeRenderSpec.durationSec * 30)}
            compositionWidth={1080}
            compositionHeight={1920}
            fps={30}
            controls
            loop
            acknowledgeRemotionLicense={true}
            style={{
              width: '100%',
              aspectRatio: '9/16',
              backgroundColor: '#f9f9fa'
            }}
          />
          <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 backdrop-blur border border-gray-200 px-3 py-1.5 rounded-full text-xs font-semibold text-[#08c225] shadow-sm pointer-events-none">
            Rendered at 30fps
          </div>
        </div>
        {m.variants && m.variants.length > 1 && (
          <div className="flex items-center justify-center gap-3 w-full my-1 text-xs font-semibold text-gray-500">
            <button
              onClick={() => setMessages(prev => prev.map(msg => msg.id === m.id ? { ...msg, activeVariantIndex: Math.max(0, (msg.activeVariantIndex ?? msg.variants!.length - 1) - 1) } : msg))}
              disabled={(m.activeVariantIndex ?? m.variants.length - 1) === 0}
              className="p-1 hover:bg-gray-100 rounded disabled:opacity-30 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
            </button>
            <span>{(m.activeVariantIndex ?? m.variants.length - 1) + 1} / {m.variants.length}</span>
            <button
              onClick={() => setMessages(prev => prev.map(msg => msg.id === m.id ? { ...msg, activeVariantIndex: Math.min(msg.variants!.length - 1, (msg.activeVariantIndex ?? msg.variants!.length - 1) + 1) } : msg))}
              disabled={(m.activeVariantIndex ?? m.variants.length - 1) === m.variants.length - 1}
              className="p-1 hover:bg-gray-100 rounded disabled:opacity-30 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
            </button>
          </div>
        )}
      </div>

      {/* Right Column: Controls */}
      <div className="flex flex-col gap-4 w-full max-w-sm">
        <VideoEditor
          messageId={m.id}
          jobId={m.jobId!}
          activeRenderSpec={activeRenderSpec}
          updateSpec={updateSpec}
          handlePartialRegenerate={handlePartialRegenerate}
          setFontTargetMessageId={setFontTargetMessageId}
          setFontTargetSection={setFontTargetSection}
          fontFileInputRef={fontFileInputRef}
        />
        {/* Actions */}
        <div className="flex flex-col gap-2 mt-1">
          <div className="flex gap-2 w-full">
            <button
              onClick={() => handleRegenerate(m.jobId!, m.id)}
              className="flex-1 px-4 py-2.5 bg-white hover:bg-gray-50 text-[#282828] font-semibold text-sm rounded-[12px] shadow-sm border border-gray-200 transition-all flex items-center justify-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 text-gray-500">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              Regenerate All
            </button>
            <button
              onClick={() => setExportModalOpen(true)}
              className="flex-1 px-4 py-2.5 bg-[#08c225] hover:bg-[#00b33c] text-white font-semibold text-sm rounded-[12px] shadow-sm border border-transparent transition-all flex items-center justify-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Export MP4
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
