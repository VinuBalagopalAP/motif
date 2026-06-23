"use client";
import React, { useState } from 'react';
import { BackgroundTab } from './tabs/BackgroundTab';
import { CaptionsTab } from './tabs/CaptionsTab';
import { MemeTab } from './tabs/MemeTab';

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

      {activeTab === 'background' && (
        <BackgroundTab
          messageId={messageId}
          jobId={jobId}
          activeRenderSpec={activeRenderSpec}
          updateSpec={updateSpec}
          handlePartialRegenerate={handlePartialRegenerate}
        />
      )}

      {activeTab === 'captions' && (
        <CaptionsTab
          messageId={messageId}
          jobId={jobId}
          activeRenderSpec={activeRenderSpec}
          updateSpec={updateSpec}
          handlePartialRegenerate={handlePartialRegenerate}
          setFontTargetMessageId={setFontTargetMessageId}
          setFontTargetSection={setFontTargetSection}
          fontFileInputRef={fontFileInputRef}
        />
      )}

      {activeTab === 'meme' && (
        <MemeTab
          activeRenderSpec={activeRenderSpec}
          updateSpec={updateSpec}
        />
      )}
    </div>
  );
}
