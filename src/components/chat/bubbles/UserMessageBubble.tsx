import React from 'react';

interface UserMessageBubbleProps {
  message: any;
  editingMsgId: string | null;
  editInput: string;
  setEditingMsgId: (id: string | null) => void;
  setEditInput: (input: string) => void;
  handleEditSubmit: (id: string, input: string, original: string) => void;
  setPreviewImage: (url: string | null) => void;
}

export function UserMessageBubble({
  message: m,
  editingMsgId,
  editInput,
  setEditingMsgId,
  setEditInput,
  handleEditSubmit,
  setPreviewImage
}: UserMessageBubbleProps) {
  return (
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
  );
}
