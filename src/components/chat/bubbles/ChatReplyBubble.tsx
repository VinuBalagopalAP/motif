import React, { useState } from 'react';
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ChatReplyBubbleProps {
  message: any;
  activeContent: string;
  activeSources: any;
  index: number;
  setMessages: React.Dispatch<React.SetStateAction<any[]>>;
  setActiveArtifact: (artifact: any) => void;
  handleFeedback: (msgId: string, jobId: string, index: number, variantIndex: number, isUpvote: boolean) => void;
  sharingJobId: string | null;
  handleShareSingleMessage: (jobId: string, msgId: string) => void;
  handleRegenerate: (jobId: string, msgId: string) => void;
}

const parseMessageParts = (text: string) => {
  const parts: any[] = [];
  const artifactRegex = /<artifact\s+identifier="([^"]+)"\s+type="([^"]+)"\s+title="([^"]+)">([\s\S]*?)(?:<\/artifact>|$)/g;

  let lastIndex = 0;
  let match;

  while ((match = artifactRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: text.substring(lastIndex, match.index) });
    }

    let isGenerating = false;
    let codeContent = match[4].trim();

    if (codeContent.endsWith('```')) {
      codeContent = codeContent.slice(0, -3).trim();
    } else {
      isGenerating = true;
    }

    if (codeContent.startsWith('```')) {
      const firstNewline = codeContent.indexOf('\n');
      if (firstNewline !== -1) {
        codeContent = codeContent.slice(firstNewline + 1);
      }
    }

    parts.push({
      type: 'artifact',
      artifact: {
        id: match[1],
        type: match[2],
        title: match[3],
        content: codeContent,
        isGenerating
      }
    });

    lastIndex = artifactRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.substring(lastIndex) });
  }

  return parts;
};

export function ChatReplyBubble({
  message: m,
  activeContent,
  activeSources,
  index,
  setMessages,
  setActiveArtifact,
  handleFeedback,
  sharingJobId,
  handleShareSingleMessage,
  handleRegenerate
}: ChatReplyBubbleProps) {
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  return (
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
  );
}
