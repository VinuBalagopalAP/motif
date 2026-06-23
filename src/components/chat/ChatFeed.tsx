"use client";
import React, { useState } from 'react';
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Player } from '@remotion/player';
import { UgcVideo } from '@/remotion/UgcVideo';
import { VideoEditor } from '@/components/video/VideoEditor';

interface ChatFeedProps {
  messages: any[];
  setMessages: React.Dispatch<React.SetStateAction<any[]>>;
  handleEditSubmit: (msgId: string, newContent: string, oldContent: string) => void;
  setActiveArtifact: (artifact: any) => void;
  setExportModalOpen: (open: boolean) => void;
  sharingJobId: string | null;
  handleShareSingleMessage: (jobId: string, msgId: string) => void;
  handleRegenerate: (jobId: string, msgId: string) => void;
  handlePartialRegenerate: (jobId: string, msgId: string, partialTarget: 'caption' | 'gif' | 'audio' | 'background', bgType?: string, bgPrompt?: string) => void;
  handleFeedback: (msgId: string, jobId: string, index: number, variantIndex: number, isUpvote: boolean) => void;
  stopJob: (jobId: string) => void;
  setFontTargetMessageId: (id: string | null) => void;
  setFontTargetSection: (section: 'top' | 'bottom' | 'linked' | null) => void;
  fontFileInputRef: React.RefObject<HTMLInputElement | null>;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  setPreviewImage: (url: string | null) => void;
}

export function ChatFeed({
  messages,
  setMessages,
  handleEditSubmit,
  setActiveArtifact,
  setExportModalOpen,
  sharingJobId,
  handleShareSingleMessage,
  handleRegenerate,
  handlePartialRegenerate,
  handleFeedback,
  stopJob,
  setFontTargetMessageId,
  setFontTargetSection,
  fontFileInputRef,
  messagesEndRef,
  setPreviewImage
}: ChatFeedProps) {
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editInput, setEditInput] = useState("");
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const parseMessageParts = (text: string) => {
    const parts: any[] = [];
    const artifactRegex = /<artifact\s+identifier="([^"]+)"\s+type="([^"]+)"\s+title="([^"]+)">([\s\S]*?)(?:<\/artifact>|$)/g;

    let lastIndex = 0;
    let match;

    while ((match = artifactRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: 'text', content: text.substring(lastIndex, match.index) });
      }

      const rawMatch = match[0];
      const isGenerating = !rawMatch.endsWith('</artifact>');

      parts.push({
        type: 'artifact',
        artifact: {
          id: match[1],
          identifier: match[1],
          type: match[2],
          title: match[3],
          content: match[4].trim(),
          isGenerating
        }
      });

      lastIndex = artifactRegex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push({ type: 'text', content: text.substring(lastIndex) });
    }

    return parts.length > 0 ? parts : [{ type: 'text', content: text }];
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 mt-4">
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
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start w-full'}`}>
              <div className={`${m.role === 'user'
                ? 'max-w-[80%] bg-[#f9f9fa] text-[#282828] rounded-[24px] px-6 py-4 font-medium text-sm border border-gray-100 shadow-sm'
                : 'w-full'
                }`}>
                {m.role === 'user' ? (
                  <div className="relative group/msg">
                    {editingMsgId === m.id ? (
                      <div className="flex flex-col gap-3 min-w-[250px] sm:min-w-[400px]">
                        <textarea
                          value={editInput}
                          onChange={(e) => setEditInput(e.target.value)}
                          className="w-full bg-white border border-gray-200 rounded-[12px] p-3 text-sm focus:outline-none focus:border-[#08c225] resize-none min-h-[80px]"
                          autoFocus
                        />
                        <div className="flex justify-end gap-2">
                          <button onClick={() => setEditingMsgId(null)} className="px-3 py-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 bg-gray-100 rounded-lg">Cancel</button>
                          <button onClick={() => { handleEditSubmit(m.id, editInput, m.content); setEditingMsgId(null); }} className="px-3 py-1.5 text-xs font-semibold text-white bg-[#08c225] hover:bg-[#00b33c] rounded-lg">Send</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {m.attachments && m.attachments.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-3">
                            {m.attachments.map((att: any, i: number) => (
                              <div key={i} className="w-32 h-32 rounded-xl border border-gray-200 overflow-hidden bg-white">
                                {att.type.startsWith('image/') ? (
                                  <button onClick={() => setPreviewImage(att.url)} className="w-full h-full border-none p-0 focus:outline-none"><img src={att.url} alt={att.name} className="w-full h-full object-cover hover:opacity-90 transition-opacity cursor-pointer" /></button>
                                ) : (
                                  <a href={att.url} target="_blank" rel="noopener noreferrer" className="w-full h-full flex items-center justify-center p-2 text-xs text-gray-500 font-medium break-all text-center hover:bg-gray-50">{att.name}</a>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        <p className="whitespace-pre-wrap leading-relaxed pr-8">{m.content}</p>
                        <button
                          onClick={() => { setEditingMsgId(m.id); setEditInput(m.content); }}
                          className="absolute top-0 right-0 opacity-100 md:opacity-0 md:group-hover/msg:opacity-100 p-1.5 text-gray-400 hover:text-[#08c225] transition-all bg-[#f9f9fa] rounded-md"
                          title="Edit prompt"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4 w-full flex justify-start">
                    {m.job?.status === 'done' && activeRenderSpec ? (
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
                          {(() => {
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
                              <>
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
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    ) : activeType === 'chat' && (activeContent || m.job?.status !== 'done') ? (
                      <div className="flex flex-col gap-1 w-fit max-w-[80%] group/reply">
                        <div className="bg-white text-[#282828] rounded-[24px] px-6 py-4 font-medium text-sm border border-gray-100 shadow-sm flex flex-col">
                          {activeContent ? parseMessageParts(activeContent).map((part, idx) => (
                            part.type === 'text' && part.content?.trim() ? (
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                key={idx}
                                components={{
                                  p: ({ node, ...props }) => <p className="whitespace-pre-wrap leading-relaxed mb-4 last:mb-0" {...props} />,
                                  h1: ({ node, ...props }) => <h1 className="text-xl font-bold mb-3 mt-4 first:mt-0" {...props} />,
                                  h2: ({ node, ...props }) => <h2 className="text-lg font-bold mb-3 mt-4 first:mt-0" {...props} />,
                                  h3: ({ node, ...props }) => <h3 className="text-base font-bold mb-2 mt-3 first:mt-0" {...props} />,
                                  ul: ({ node, ...props }) => <ul className="list-disc pl-5 mb-4 space-y-1 last:mb-0" {...props} />,
                                  ol: ({ node, ...props }) => <ol className="list-decimal pl-5 mb-4 space-y-1 last:mb-0" {...props} />,
                                  li: ({ node, ...props }) => <li className="" {...props} />,
                                  a: ({ node, ...props }) => <a className="text-[#08c225] hover:underline" target="_blank" rel="noopener noreferrer" {...props} />,
                                  strong: ({ node, ...props }) => <strong className="font-bold" {...props} />,
                                  em: ({ node, ...props }) => <em className="italic" {...props} />,
                                  blockquote: ({ node, ...props }) => <blockquote className="border-l-4 border-gray-200 pl-4 italic text-gray-600 mb-4" {...props} />,
                                  table: ({ node, ...props }) => <div className="overflow-x-auto mb-4"><table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg" {...props} /></div>,
                                  thead: ({ node, ...props }) => <thead className="bg-gray-50" {...props} />,
                                  th: ({ node, ...props }) => <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200" {...props} />,
                                  td: ({ node, ...props }) => <td className="px-4 py-3 text-sm text-gray-700 border-b border-gray-200" {...props} />,
                                }}
                              >
                                {part.content}
                              </ReactMarkdown>
                            ) : part.type === 'artifact' && part.artifact ? (
                              <div
                                key={idx}
                                onClick={() => !part.artifact!.isGenerating && setActiveArtifact(part.artifact!)}
                                className={`my-3 border border-gray-200 rounded-xl p-3 flex flex-col gap-3 transition-all shadow-sm ${part.artifact.isGenerating ? 'bg-gray-50/50' : 'cursor-pointer hover:bg-gray-50 hover:border-[#08c225]/50'}`}
                              >
                                <div className="flex items-center gap-3">
                                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${part.artifact.isGenerating ? 'bg-gray-200 text-gray-500 animate-pulse' : 'bg-[#f0fdf4] text-[#08c225]'}`}>
                                    {part.artifact.type === 'code' || part.artifact.type === 'react' ? (
                                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" /></svg>
                                    ) : (
                                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-bold text-[#282828] truncate">
                                      {part.artifact.isGenerating ? `Generating ${part.artifact.title}...` : part.artifact.title}
                                    </div>
                                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mt-0.5">
                                      {part.artifact.isGenerating ? 'Writing code...' : `View ${part.artifact.type}`}
                                    </div>
                                  </div>
                                  <div className="text-gray-400">
                                    {part.artifact.isGenerating ? (
                                      <div className="w-5 h-5 border-2 border-gray-300 border-t-[#08c225] rounded-full animate-spin"></div>
                                    ) : (
                                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ) : null
                          )) : null}
                          {Array.isArray(activeSources) && activeSources.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-gray-100">
                              <div className="text-[11px] font-semibold uppercase tracking-wide text-[#9a9a9a] mb-1.5">Sources</div>
                              <div className="flex flex-col gap-1">
                                {activeSources.map((s: { url: string; title: string }, i: number) => (
                                  <a
                                    key={i}
                                    href={s.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[13px] text-[#08c225] hover:underline truncate"
                                    title={s.url}
                                  >
                                    {i + 1}. {s.title || s.url}
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                          {m.job?.status !== 'done' && (
                            <div className={`flex items-center gap-3 text-[#757575] font-semibold text-sm ${activeContent ? 'mt-4 pt-4 border-t border-gray-100' : ''}`}>
                              <div className="w-4 h-4 border-2 border-gray-200 border-t-[#08c225] rounded-full animate-spin"></div>
                              <span className="animate-pulse">{m.job?.status || 'Thinking...'}</span>
                            </div>
                          )}
                        </div>
                        {m.job?.status === 'done' && (
                          <div className="flex items-center gap-1 mt-4 text-gray-400 relative">
                            {m.variants && m.variants.length > 1 && (
                              <div className="flex items-center gap-2 mr-3 text-xs font-semibold text-gray-400">
                                <button
                                  onClick={() => setMessages(prev => prev.map(msg => msg.id === m.id ? { ...msg, activeVariantIndex: Math.max(0, (msg.activeVariantIndex ?? msg.variants!.length - 1) - 1) } : msg))}
                                  disabled={(m.activeVariantIndex ?? m.variants.length - 1) === 0}
                                  className="p-1 hover:text-gray-700 disabled:opacity-30 transition-colors"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                                </button>
                                <span>{(m.activeVariantIndex ?? m.variants.length - 1) + 1} / {m.variants.length}</span>
                                <button
                                  onClick={() => setMessages(prev => prev.map(msg => msg.id === m.id ? { ...msg, activeVariantIndex: Math.min(msg.variants!.length - 1, (msg.activeVariantIndex ?? msg.variants!.length - 1) + 1) } : msg))}
                                  disabled={(m.activeVariantIndex ?? m.variants.length - 1) === m.variants.length - 1}
                                  className="p-1 hover:text-gray-700 disabled:opacity-30 transition-colors"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                                </button>
                              </div>
                            )}
                            <button onClick={() => navigator.clipboard.writeText(m.job?.product_json?.chat_reply || m.content)} className="p-1.5 hover:bg-gray-100 hover:text-gray-700 rounded-lg transition-colors" title="Copy">
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" /></svg>
                            </button>
                            <button onClick={() => m.jobId && handleFeedback(m.id, m.jobId, index, m.activeVariantIndex ?? (m.variants?.length ? m.variants.length - 1 : 0), true)} className={`p-1.5 rounded-lg transition-colors ${m.userFeedback === 'up' ? 'text-[#08c225] bg-[#f0fdf4]' : 'hover:bg-gray-100 hover:text-gray-700'}`} title="Good response">
                              {m.userFeedback === 'up' ? (
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M7.493 18.5c-.425 0-.82-.236-.975-.632A7.48 7.48 0 016 15.125c0-1.75.599-3.358 1.602-4.568l3.124-3.748c.18-.215.426-.347.69-.347h.183c.966 0 1.75.784 1.75 1.75v1.272c0 .484.225.942.603 1.242.484.382 1.135.536 1.745.41l2.453-.51c.717-.148 1.455.107 1.933.682.477.575.602 1.346.335 2.05l-1.325 3.518A2.75 2.75 0 0114.625 18.5H7.493zM4.5 15.125c0 1.256.326 2.433.896 3.447C5.228 18.847 4.904 19 4.5 19a2.25 2.25 0 01-2.25-2.25v-5.5A2.25 2.25 0 014.5 9h.036c.15 0 .298.02.441.058C4.653 9.877 4.5 10.74 4.5 11.625v3.5z" /></svg>
                              ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.25c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 0 1 2.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 0 0 .322-1.672V3a.75.75 0 0 1 .75-.75 2.25 2.25 0 0 1 2.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282m0 0h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 0 1-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 0 0-1.423-.23H5.904m10.598-9.75H14.25M5.904 18.5c.083.205.173.405.27.602.197.4-.078.898-.523.898h-.908c-.889 0-1.713-.518-1.972-1.368a12 12 0 0 1-.521-3.507c0-1.553.295-3.036.831-4.398C3.387 9.953 4.167 9.5 5 9.5h1.053c.472 0 .745.556.5-.96a8.958 8.958 0 0 0-1.302 4.665c0 1.194.232 2.333.654 3.375Z" /></svg>
                              )}
                            </button>
                            <button onClick={() => m.jobId && handleFeedback(m.id, m.jobId, index, m.activeVariantIndex ?? (m.variants?.length ? m.variants.length - 1 : 0), false)} className={`p-1.5 rounded-lg transition-colors ${m.userFeedback === 'down' ? 'text-red-500 bg-red-50' : 'hover:bg-gray-100 hover:text-gray-700'}`} title="Bad response">
                              {m.userFeedback === 'down' ? (
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M15.73 5.5c.424 0 .82.236.975.632a7.48 7.48 0 01.545 2.743c0 1.75-.599 3.358-1.602 4.568l-3.124 3.748c-.18.215-.426.347-.69.347h-.183c-.966 0-1.75-.784-1.75-1.75v-1.272c0-.484-.225-.942-.603-1.242-.484-.382-1.135-.536-1.745-.41l-2.453.51c-.717.148-1.455-.107-1.933-.682-.477-.575-.602-1.346-.335-2.05l1.325-3.518A2.75 2.75 0 019.375 5.5h7.355zM19.5 8.875c0-1.256-.326-2.433-.896-3.447C18.772 5.153 19.096 5 19.5 5A2.25 2.25 0 0121.75 7.25v5.5a2.25 2.25 0 01-2.25 2.25h-.036c-.15 0-.298-.02-.441-.058.324-.838.477-1.701.477-2.585v-3.5z" /></svg>
                              ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M7.498 15.25H4.372c-1.026 0-1.945-.694-2.054-1.715a12.137 12.137 0 0 1-.068-1.285c0-2.848.992-5.464 2.649-7.521C5.287 4.247 5.886 4 6.504 4h4.016a4.5 4.5 0 0 1 1.423.23l3.114 1.04a4.5 4.5 0 0 0 1.423.23h1.294M7.498 15.25c.618 0 .991.724.725 1.282A7.471 7.471 0 0 0 7.5 19.75 2.25 2.25 0 0 0 9.75 22a.75.75 0 0 0 .75-.75v-.633c0-.79.364-1.543.985-2.072a4.498 4.498 0 0 1 1.672-.322m0-8.473h1.25m-1.25 8.473c.806 0 1.533.446 2.031 1.08a9.041 9.041 0 0 0 2.861 2.4c.723.384 1.35.956 1.653 1.715M16.5 10.75c-.083-.205-.173-.405-.27-.602-.197-.4.078-.898.523-.898h.908c.889 0 1.713.518 1.972 1.368.339 1.11.521 2.287.521 3.507 0 1.553-.295 3.036-.831 4.398-.352.886-1.132 1.339-1.965 1.339h-1.053c-.472 0-.745-.556-.5-.96a8.958 8.958 0 0 0-1.302 4.665c0 1.194-.232-2.333-.654-3.375Z" /></svg>
                              )}
                            </button>
                            <button onClick={() => m.jobId && handleShareSingleMessage(m.jobId, m.id)} disabled={sharingJobId === m.jobId} className="p-1.5 hover:bg-gray-100 hover:text-gray-700 rounded-lg transition-colors disabled:opacity-50" title="Share Message">
                              {sharingJobId === m.jobId ? (
                                <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
                              ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" /></svg>
                              )}
                            </button>
                            <button onClick={() => m.jobId && handleRegenerate(m.jobId, m.id)} className="p-1.5 hover:bg-gray-100 hover:text-gray-700 rounded-lg transition-colors" title="Regenerate">
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
                            </button>

                            <div className="relative">
                              <button onClick={() => setActiveMenuId(activeMenuId === m.id ? null : m.id)} className={`p-1.5 rounded-lg transition-colors ${activeMenuId === m.id ? 'bg-gray-100 text-gray-700' : 'hover:bg-gray-100 hover:text-gray-700'}`} title="More options">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM18.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" /></svg>
                              </button>
                              {activeMenuId === m.id && (
                                <>
                                  <div className="fixed inset-0 z-40" onClick={() => setActiveMenuId(null)}></div>
                                  <div className="absolute bottom-full mb-2 left-0 w-48 bg-white border border-gray-100 shadow-xl rounded-xl py-1 z-50">
                                    <button
                                      onClick={() => {
                                        navigator.clipboard.writeText(m.job?.product_json?.chat_reply || m.content);
                                        setActiveMenuId(null);
                                      }}
                                      className="w-full text-left px-4 py-2 text-[13px] font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M14.25 9.75L16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" /></svg>
                                      Copy raw markdown
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : m.job?.status === 'error' ? (
                      <div className="bg-red-50 text-red-600 rounded-[16px] p-4 text-sm flex items-center gap-3 font-medium border border-red-100">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span>Error: {m.job.error}</span>
                      </div>
                    ) : m.job?.status === 'started' || m.job?.status === 'queued' || !m.job ? (
                      <div className="bg-white text-[#757575] rounded-[24px] px-6 py-4 font-medium text-sm border border-gray-100 shadow-sm w-fit max-w-[80%] flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-gray-200 border-t-[#08c225] rounded-full animate-spin"></div>
                        {m.job?.status ? m.job.status.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) : 'Thinking...'}
                      </div>
                    ) : (
                      <div className="relative overflow-hidden bg-[#f9f9fa] border border-gray-100 rounded-[24px] w-[320px] h-[569px] flex flex-col items-center justify-center mt-2">
                        {/* Calm Loading Animation */}
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/50 to-transparent h-full w-full animate-[shimmer-slide_3s_ease-in-out_infinite]"></div>

                        <div className="relative z-10 flex flex-col items-center gap-4">
                          <div className="w-10 h-10 border-2 border-gray-200 border-t-[#08c225] rounded-full animate-spin"></div>
                          <div className="text-sm font-medium text-[#757575]">
                            {m.job?.status === 'scraping' ? 'Analyzing source...' :
                              m.job?.status === 'planning' ? 'Generating assets...' :
                                'Rendering video...'}
                          </div>
                          <button
                            onClick={() => m.jobId && stopJob(m.jobId)}
                            className="mt-4 px-4 py-2 bg-white/80 hover:bg-white text-red-500 font-semibold text-sm rounded-full shadow-sm border border-red-100 transition-all flex items-center gap-2 z-20"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                              <path d="M5.25 3A2.25 2.25 0 0 0 3 5.25v9.5A2.25 2.25 0 0 0 5.25 17h9.5A2.25 2.25 0 0 0 17 14.75v-9.5A2.25 2.25 0 0 0 14.75 3h-9.5Z" />
                            </svg>
                            Stop Generation
                          </button>
                        </div>
                      </div>
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
