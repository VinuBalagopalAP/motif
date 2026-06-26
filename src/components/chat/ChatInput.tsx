import React from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import packageJson from "../../../package.json";
import { useAppStore } from "@/store/useAppStore";
import { useChatStore } from "@/store/useChatStore";
import { useChatActions } from "@/hooks/useChatActions";

interface ChatInputProps {
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  fontFileInputRef: React.RefObject<HTMLInputElement | null>;
}

export function ChatInput({
  fileInputRef,
  fontFileInputRef
}: ChatInputProps) {
  const [input, setInput] = React.useState("");
  
  const { uploadingFiles } = useAppStore();
  const { loading, attachments, setAttachments, messages } = useChatStore();
  const { runGeneration, handleFileChange, handleFontUpload } = useChatActions();

  const isGenerating = messages.some(m => m.jobId && m.job?.status !== 'done' && m.job?.status !== 'error');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loading && !isGenerating && !uploadingFiles && (input.trim() || attachments.length > 0)) {
      runGeneration(input);
      setInput("");
    }
  };

  return (
    <footer className="absolute bottom-0 w-full p-3 sm:p-6 pointer-events-none bg-gradient-to-t from-white via-white to-transparent pt-20">
      <div className="max-w-4xl mx-auto relative pointer-events-auto">
        <div className="bg-white rounded-[24px] shadow-[0_8px_30px_rgba(0,0,0,0.06)] border border-gray-200 transition-shadow focus-within:shadow-[0_8px_40px_rgba(0,0,0,0.1)] focus-within:border-gray-300 overflow-hidden relative">
          <form onSubmit={handleSubmit} className="relative flex flex-col">
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              multiple
              accept="image/*,application/pdf,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => handleFileChange(e, fileInputRef)}
            />
            <input
              type="file"
              ref={fontFileInputRef}
              className="hidden"
              accept=".ttf,.otf"
              onChange={(e) => handleFontUpload(e, fontFileInputRef)}
            />

            {attachments.length > 0 && (
              <div className="flex gap-3 p-4 overflow-x-auto border-b border-gray-100 bg-gray-50/50 items-center">
                {attachments.map((att, i) => (
                  <div key={i} className="relative group flex-shrink-0 w-16 h-16 rounded-xl bg-white border border-gray-200 overflow-hidden flex items-center justify-center shadow-sm">
                    {att.type.startsWith('image/') ? (
                      <img src={att.url} alt={att.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-[9px] font-bold text-[#282828] break-all p-2 text-center uppercase tracking-wide">{att.name.split('.').pop()}</div>
                    )}
                    <button
                      type="button"
                      onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
                      className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-red-600"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" /></svg>
                    </button>
                  </div>
                ))}
                {uploadingFiles && (
                  <div className="w-16 h-16 rounded-xl bg-white border border-gray-200 flex items-center justify-center shadow-sm flex-shrink-0">
                    <div className="w-5 h-5 border-2 border-gray-200 border-t-[#08c225] rounded-full animate-spin"></div>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-end w-full p-2 gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingFiles}
                className="flex-shrink-0 text-gray-400 hover:text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-xl w-9 h-9 flex items-center justify-center transition-all duration-200 shadow-sm"
                title="Attach image or PDF"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" /></svg>
              </button>
              <TextareaAutosize
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (e.metaKey || e.ctrlKey || !e.shiftKey) {
                      e.preventDefault();
                      if (!loading && !isGenerating && !uploadingFiles && (input.trim() || attachments.length > 0)) {
                        runGeneration(input);
                        setInput("");
                      }
                    }
                  }
                }}
                placeholder={isGenerating ? "Generating..." : uploadingFiles ? "Uploading..." : "Message or paste a link..."}
                className="flex-1 bg-transparent text-[#282828] placeholder-gray-400 focus:outline-none resize-none py-1.5 px-2 text-[15px] leading-relaxed [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] min-w-0"
                minRows={1}
                maxRows={8}
              />
              <button
                type="submit"
                disabled={loading || (!input.trim() && attachments.length === 0) || isGenerating || uploadingFiles}
                className="flex-shrink-0 text-white bg-[#08c225] hover:bg-[#00b33c] rounded-xl w-9 h-9 flex items-center justify-center disabled:opacity-40 disabled:hover:bg-[#08c225] transition-all duration-200 shadow-sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-[18px] h-[18px]">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" />
                </svg>
              </button>
            </div>
          </form>
        </div>
        <div className="text-center mt-3 mb-1">
          <span className="text-[#757575] text-[11px] font-medium tracking-wide">
            Motif v{packageJson.version}
          </span>
        </div>
      </div>
    </footer>
  );
}
