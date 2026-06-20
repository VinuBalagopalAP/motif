'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';

export default function SharedChatPage() {
  const params = useParams();
  const shareId = params?.shareId as string;
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!shareId) return;

    const fetchSharedChat = async () => {
      try {
        const { supabase } = await import('@/lib/supabase');
        
        const { data, error } = await supabase
          .from('shared_chats')
          .select('messages_json, created_at')
          .eq('id', shareId)
          .single();

        if (error) throw error;
        
        if (data) {
          setMessages(data.messages_json);
        }
      } catch (err) {
        console.error('Failed to load shared chat', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSharedChat();
  }, [shareId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f9f9fa] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-[#08c225] rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!messages || messages.length === 0) {
    return (
      <div className="min-h-screen bg-[#f9f9fa] flex items-center justify-center flex-col gap-4">
        <h2 className="text-xl font-bold text-gray-800">Chat Not Found</h2>
        <p className="text-gray-500">This shared link is invalid or has been deleted.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f9f9fa] flex flex-col items-center py-12 px-4">
      <div className="w-full max-w-3xl mb-8 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-tr from-[#08c225] to-[#34d399] rounded-xl flex items-center justify-center shadow-lg text-white font-bold text-lg">M</div>
          <span className="font-bold text-gray-800 tracking-tight text-xl">Motif</span>
          <span className="ml-2 px-2 py-1 bg-gray-100 text-gray-500 text-xs font-bold rounded-lg tracking-wider">SHARED</span>
        </div>
        <button onClick={() => window.location.href = '/'} className="px-4 py-2 bg-white text-gray-700 border border-gray-200 rounded-full font-semibold text-sm hover:bg-gray-50 transition-colors shadow-sm">
          Start your own chat
        </button>
      </div>

      <div className="w-full max-w-3xl space-y-6 pb-32">
        {messages.map((m: any) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start w-full'}`}>
            <div className={`${
              m.role === 'user' 
                ? 'bg-[#f4f4f5] text-[#282828] rounded-[24px] px-5 py-3.5 max-w-[80%]' 
                : 'bg-white border border-gray-100 shadow-sm rounded-[24px] px-6 py-5 w-full'
            }`}>
              {m.role === 'assistant' && (
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#08c225] to-[#34d399] flex items-center justify-center shadow-sm flex-shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-white">
                      <path d="M16.5 7.5h-9v9h9v-9z" />
                      <path fillRule="evenodd" d="M8.25 2.25A.75.75 0 019 3v.75h2.25V3a.75.75 0 011.5 0v.75H15V3a.75.75 0 011.5 0v.75h.75a3 3 0 013 3v11.25a3 3 0 01-3 3H15a.75.75 0 01-1.5 0v.75a.75.75 0 01-1.5 0v-.75H9.75a.75.75 0 01-1.5 0v.75a.75.75 0 01-1.5 0v-.75H6a3 3 0 01-3-3V6.75a3 3 0 013-3h.75V3a.75.75 0 01.75-.75zM6 6.75A1.5 1.5 0 004.5 8.25v10.5A1.5 1.5 0 006 20.25h12a1.5 1.5 0 001.5-1.5V8.25A1.5 1.5 0 0018 6.75H6z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span className="font-bold text-[#282828] tracking-tight">Motif</span>
                </div>
              )}
              
              <div className={`prose prose-sm max-w-none ${m.role === 'user' ? 'text-[#282828]' : 'text-gray-700'}`}>
                {m.content ? <ReactMarkdown>{m.content}</ReactMarkdown> : (m.job?.product_json?.chat_reply ? <ReactMarkdown>{m.job.product_json.chat_reply}</ReactMarkdown> : null)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
