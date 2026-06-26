"use client";
import React, { useState } from 'react';
import { UserMessageBubble } from '@/components/chat/bubbles/UserMessageBubble';
import { VideoResultBubble } from '@/components/chat/bubbles/VideoResultBubble';
import { ChatReplyBubble } from '@/components/chat/bubbles/ChatReplyBubble';
import { StatusBubble } from '@/components/chat/bubbles/StatusBubble';
import { useAppStore } from '@/store/useAppStore';
import { useChatStore } from '@/store/useChatStore';
import { useChatActions } from '@/hooks/useChatActions';
import { useJobPoller } from '@/hooks/useJobPoller';
import { useAuth } from '@/components/AuthProvider';

interface ChatFeedProps {
  fontFileInputRef: React.RefObject<HTMLInputElement | null>;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

export function ChatFeed({
  fontFileInputRef,
  messagesEndRef,
}: ChatFeedProps) {
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editInput, setEditInput] = useState("");

  const { user, session } = useAuth();
  
  const { 
    setActiveArtifact, 
    setExportModalOpen, 
    sharingJobId, 
    setPreviewImage 
  } = useAppStore();
  
  const { 
    messages, 
    setMessages, 
    setFontTargetMessageId, 
    setFontTargetSection, 
    stopJob,
    fetchHistory
  } = useChatStore();
  
  const { 
    handleEditSubmit, 
    handleShareSingleMessage, 
    handleRegenerate, 
    handlePartialRegenerate, 
    handleFeedback 
  } = useChatActions();

  useJobPoller(messages, setMessages, session, () => fetchHistory(user));

  return (
    <div className="flex-1 overflow-y-auto px-4 md:px-8 pt-8 pb-10 space-y-10 font-sans custom-scrollbar">
      {messages.length === 0 ? (
        <div className="text-center mt-32 relative z-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-[#f9f9fa] rounded-full mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-[#08c225]">
              <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-[#282828] mb-3">How can I help you today?</h2>
          <div className="max-w-md mx-auto">
            <p className="text-sm text-[#757575] font-medium leading-relaxed">
              Chat with me, or provide a product link and I'll generate a high-quality marketing video for you automatically.
            </p>
          </div>
        </div>
      ) : (
        messages.map((m, index) => {
          const activeVariant = m.variants ? m.variants[m.activeVariantIndex ?? m.variants.length - 1] : undefined;
          const activeType = activeVariant ? activeVariant.type : (m.type || (m.role === 'assistant' && m.job?.product_json?.chat_reply ? 'chat' : 'video'));
          const activeContent = activeVariant ? activeVariant.content : m.job?.product_json?.chat_reply;
          const activeSources = activeVariant ? activeVariant.sources : m.job?.product_json?.sources;
          const activeRenderSpec = activeVariant ? activeVariant.render_spec : m.job?.render_spec_json;

          return (
            <div id={`message-${m.id}`} key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start w-full'} transition-colors duration-500`}>
              <div className={`${m.role === 'user'
                ? 'max-w-[80%] bg-[#f9f9fa] text-[#282828] rounded-[24px] px-6 py-4 font-medium text-sm border border-gray-100 shadow-sm'
                : 'w-full'
                }`}>
                {m.role === 'user' ? (
                  <UserMessageBubble
                    message={m}
                    editingMsgId={editingMsgId}
                    editInput={editInput}
                    setEditingMsgId={setEditingMsgId}
                    setEditInput={setEditInput}
                    handleEditSubmit={handleEditSubmit}
                    setPreviewImage={setPreviewImage}
                  />
                ) : (
                  <div className="space-y-4 w-full flex justify-start">
                    {m.job?.status === 'done' && activeRenderSpec ? (
                      <VideoResultBubble
                        message={m}
                        activeRenderSpec={activeRenderSpec}
                        setMessages={setMessages}
                        handleRegenerate={handleRegenerate}
                        setExportModalOpen={setExportModalOpen}
                        handlePartialRegenerate={handlePartialRegenerate}
                        setFontTargetMessageId={setFontTargetMessageId}
                        setFontTargetSection={setFontTargetSection}
                        fontFileInputRef={fontFileInputRef}
                      />
                    ) : activeType === 'chat' && (activeContent || m.job?.status !== 'done') ? (
                      <ChatReplyBubble
                        message={m}
                        activeContent={activeContent}
                        activeSources={activeSources}
                        index={index}
                        setMessages={setMessages}
                        setActiveArtifact={setActiveArtifact}
                        handleFeedback={handleFeedback}
                        sharingJobId={sharingJobId}
                        handleShareSingleMessage={handleShareSingleMessage}
                        handleRegenerate={handleRegenerate}
                        isLatest={index === messages.length - 1}
                      />
                    ) : (
                      <StatusBubble
                        message={m}
                        stopJob={stopJob}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}
      <div className="h-40 flex-shrink-0" />
      <div ref={messagesEndRef} />
    </div>
  );
}
