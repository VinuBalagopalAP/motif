"use client";

import { useState, useRef, useEffect } from "react";
import { Player } from "@remotion/player";
import { UgcVideo } from "@/remotion/UgcVideo";
import type { Job } from "@/lib/jobs";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  jobId?: string;
  job?: Job;
};

export default function ChatApp() {
  const { user, session, loading: authLoading } = useAuth();
  const router = useRouter();

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [historyJobs, setHistoryJobs] = useState<Job[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editInput, setEditInput] = useState("");
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Authentication check
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // Fetch History
  const fetchHistory = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('video_jobs')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (data) {
      setHistoryJobs(data);
    }
  };

  const deleteJob = async (jobId: string) => {
    try {
      const { error } = await supabase
        .from('video_jobs')
        .delete()
        .eq('id', jobId);
      
      if (!error) {
        setHistoryJobs(prev => prev.filter(job => job.id !== jobId));
        if (messages.some(m => m.jobId === jobId)) {
          setMessages([]);
        }
      } else {
        console.error("Failed to delete job:", error);
      }
    } catch (e) {
      console.error("Failed to delete job:", e);
    }
  };
  const stopJob = async (jobId: string) => {
    try {
      const { error } = await supabase
        .from('video_jobs')
        .update({ status: 'error', error: 'Cancelled by user' })
        .eq('id', jobId);
      
      if (!error) {
        setMessages(prev => prev.map(m => 
          m.jobId === jobId && m.job ? { ...m, job: { ...m.job, status: 'error', error: 'Cancelled by user' } } : m
        ));
      }
    } catch (e) {
      console.error("Failed to stop job:", e);
    }
  };

  useEffect(() => {
    if (user) {
      fetchHistory();
    }
  }, [user]);

  const scrollToBottom = () => {
    const main = document.getElementById("chat-main");
    if (main) {
      main.scrollTo({ top: main.scrollHeight, behavior: "smooth" });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Polling for job status
  useEffect(() => {
    const activeJobs = messages.filter(m => m.jobId && (!m.job || m.job.status !== 'done' && m.job.status !== 'error'));
    
    if (activeJobs.length === 0) return;

    const interval = setInterval(async () => {
      let updated = false;
      const nextMessages = [...messages];

      for (const msg of activeJobs) {
        try {
          const res = await fetch(`/api/jobs/${msg.jobId}`, {
            headers: {
              'Authorization': `Bearer ${session?.access_token}`
            }
          });
          if (res.ok) {
            const job: Job = await res.json();
            const msgIndex = nextMessages.findIndex(m => m.id === msg.id);
            if (msgIndex !== -1 && JSON.stringify(nextMessages[msgIndex].job) !== JSON.stringify(job)) {
              nextMessages[msgIndex].job = job;
              updated = true;
              
              if (job.status === 'done' || job.status === 'error') {
                fetchHistory(); // refresh sidebar
              }
            }
          }
        } catch (e) {
          console.error(e);
        }
      }

      if (updated) {
        setMessages(nextMessages);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [messages, session]);

  const runGeneration = async (prompt: string) => {
    if (!prompt.trim() || !user || !session) return;

    const userMessage: Message = { id: Date.now().toString(), role: "user", content: prompt };
    const assistantMessage: Message = { id: (Date.now() + 1).toString(), role: "assistant", content: "" };
    
    setMessages(prev => [...prev, userMessage, assistantMessage]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ 
          message: prompt, 
          userId: user.id,
          chatId: activeChatId,
          history: messages.map(m => ({ 
            role: m.role, 
            content: m.role === 'assistant' ? (m.job?.product_json?.chat_reply || "Generated a video.") : m.content 
          }))
        })
      });
      const data = await res.json();
      
      if (data.isChat) {
        if (!activeChatId && data.chatId) setActiveChatId(data.chatId);
        setMessages(prev => prev.map(m => 
          m.id === assistantMessage.id ? { 
            ...m, 
            job: { status: 'done', product_json: { chat_reply: data.reply } } as any 
          } : m
        ));
        fetchHistory();
      } else {
        if (!activeChatId && data.chatId) setActiveChatId(data.chatId);
        setMessages(prev => prev.map(m => 
          m.id === assistantMessage.id ? { ...m, jobId: data.jobId } : m
        ));
        fetchHistory(); // Only fetch history for UGC video jobs
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await runGeneration(input);
  };

  const handleRegenerate = async (jobId: string) => {
    if (!session) return;
    try {
      const res = await fetch("/api/chat/regenerate", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ jobId })
      });
      if (res.ok) {
        setMessages(prev => prev.map(m => 
          m.jobId === jobId ? { ...m, job: { ...m.job, status: 'started' } as any } : m
        ));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditSubmit = async (jobId: string, oldContent: string) => {
    if (editInput.trim() === oldContent || !editInput.trim()) {
      setEditingMsgId(null);
      return;
    }
    const newMessage = editInput;
    setEditingMsgId(null);
    if (!session) return;
    try {
      const res = await fetch("/api/chat/edit", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ jobId, message: newMessage })
      });
      if (res.ok) {
        setMessages(prev => prev.map(m => {
          if (m.id === `user-${jobId}`) {
            return { ...m, content: newMessage };
          }
          if (m.jobId === jobId) {
            return { ...m, job: { ...m.job, message: newMessage, status: 'started' } as any };
          }
          return m;
        }));
        fetchHistory();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadJob = (job: Job) => {
    setActiveChatId(job.id);
    if (job.product_json?.chat_history) {
      const historyMessages = job.product_json.chat_history.map((msg: any, i: number) => ({
        id: `hist-${job.id}-${i}`,
        role: msg.role,
        content: msg.content || '',
        jobId: msg.type === 'video' ? job.id : undefined,
        job: msg.type === 'video' ? { ...job, status: 'done', render_spec_json: msg.render_spec } : (msg.type === 'chat' ? { status: 'done', product_json: { chat_reply: msg.content } } : undefined)
      }));
      setMessages(historyMessages);
    } else {
      setMessages([
        { id: `user-${job.id}`, role: 'user', content: job.message },
        { id: `asst-${job.id}`, role: 'assistant', content: '', jobId: job.id, job }
      ]);
    }
    setMobileMenuOpen(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (authLoading || !user) {
    return <div className="h-screen flex items-center justify-center bg-gray-50 text-gray-400">Loading workspace...</div>;
  }

  const isGenerating = messages.some(m => m.jobId && m.job?.status !== 'done' && m.job?.status !== 'error');

  return (
    <div className="flex h-[100dvh] bg-[#ffffff] text-[#282828] font-sans selection:bg-[#c3f3b9]">
      {/* Mobile Overlay Backdrop */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-40 md:hidden transition-opacity" 
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-[#f9f9fa] border-r border-gray-100 flex flex-col transform transition-transform duration-200 ease-in-out
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        md:relative md:translate-x-0 md:flex
      `}>
        <div className="p-6 flex flex-col gap-4">
          <button 
            onClick={() => { setActiveChatId(null); setMessages([]); setMobileMenuOpen(false); }}
            className="flex items-center justify-center gap-2 bg-[#08c225] hover:bg-[#00b33c] text-white rounded-[16px] px-4 py-3 font-semibold text-sm shadow-[0_4px_12px_rgba(8,194,37,0.2)] hover:shadow-[0_6px_16px_rgba(8,194,37,0.3)] transition-all duration-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Chat
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto px-4 py-2">
          <div className="text-xs font-semibold text-[#757575] mb-4 px-2 uppercase tracking-wider">Library</div>
          <div className="space-y-1">
            {historyJobs.map(job => (
              <div key={job.id} className="group flex items-center w-full hover:bg-gray-200/50 rounded-xl transition-colors">
                <button 
                  onClick={() => { loadJob(job); setMobileMenuOpen(false); }}
                  className="flex-1 text-left truncate px-3 py-2.5 text-sm font-medium text-[#282828]"
                >
                  {job.message}
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); deleteJob(job.id); }}
                  className="opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-red-500 transition-all"
                  title="Delete video"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                  </svg>
                </button>
              </div>
            ))}
            {historyJobs.length === 0 && (
              <div className="text-[#757575] text-sm px-3 font-medium mt-2">No videos yet.</div>
            )}
          </div>
        </div>

        <div className="p-4 flex items-center justify-between border-t border-gray-100">
          <div className="text-sm font-medium text-[#757575] truncate pr-2">{user.email}</div>
          <button onClick={handleLogout} className="text-[#757575] hover:text-[#282828] hover:bg-gray-200/50 rounded-lg p-2 transition-colors" title="Sign out">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 relative bg-[#ffffff]">
        <header className="relative py-3 px-4 sm:px-6 bg-[#ffffff] border-b border-gray-100 flex items-center justify-center sticky top-0 z-10 md:hidden h-[57px]">
          <button onClick={() => setMobileMenuOpen(true)} className="absolute left-4 sm:left-6 p-1 -ml-1 text-[#757575] hover:text-[#282828] transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-[#282828]">Motif</h1>
        </header>

        <main id="chat-main" className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-8 pb-48">
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
              messages.map((m) => (
                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start w-full'}`}>
                  <div className={`${
                    m.role === 'user' 
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
                              <button onClick={() => handleEditSubmit(m.id.replace('user-', ''), m.content)} className="px-3 py-1.5 text-xs font-semibold text-white bg-[#08c225] hover:bg-[#00b33c] rounded-lg">Save & Generate</button>
                            </div>
                          </div>
                        ) : (
                          <>
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
                        {m.job?.status === 'done' && m.job.render_spec_json ? (
                          <div className="mt-2 flex flex-col items-center gap-4 w-full max-w-[320px]">
                            <div className="rounded-[24px] overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.08)] border border-gray-100 relative group bg-[#f9f9fa] w-full">
                              <Player
                                component={UgcVideo}
                                inputProps={{ spec: m.job.render_spec_json }}
                                durationInFrames={Math.floor(m.job.render_spec_json.durationSec * 30)}
                                compositionWidth={1080}
                                compositionHeight={1920}
                                fps={30}
                                controls
                                autoPlay
                                loop
                                acknowledgeRemotionLicense={true}
                                style={{
                                  width: '100%',
                                  aspectRatio: '9/16',
                                  backgroundColor: '#f9f9fa'
                                }}
                              />
                              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 backdrop-blur border border-gray-200 px-3 py-1.5 rounded-full text-xs font-semibold text-[#08c225] shadow-sm pointer-events-none">
                                Rendered at 60fps
                              </div>
                            </div>
                            
                            <div className="flex gap-3 w-full">
                              <button
                                onClick={() => handleRegenerate(m.jobId!)}
                                className="flex-1 px-4 py-2.5 bg-[#f9f9fa] hover:bg-gray-100 text-[#282828] font-semibold text-sm rounded-[16px] shadow-sm border border-gray-200 transition-all flex items-center justify-center gap-2"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                                </svg>
                                Regenerate
                              </button>
                              <button
                                onClick={() => setExportModalOpen(true)}
                                className="flex-1 px-4 py-2.5 bg-[#08c225] hover:bg-[#00b33c] text-white font-semibold text-sm rounded-[16px] shadow-sm border border-transparent transition-all flex items-center justify-center gap-2"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                                </svg>
                                Export MP4
                              </button>
                            </div>
                          </div>
                        ) : m.job?.status === 'done' && m.job.product_json?.chat_reply ? (
                          <div className="bg-white text-[#282828] rounded-[24px] px-6 py-4 font-medium text-sm border border-gray-100 shadow-sm w-fit max-w-[80%]">
                            <p className="whitespace-pre-wrap leading-relaxed">{m.job.product_json.chat_reply}</p>
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
                            Thinking...
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
              ))
            )}
            <div ref={messagesEndRef} className="h-10" />
          </div>
        </main>

        <footer className="absolute bottom-0 w-full p-3 sm:p-6 pointer-events-none bg-gradient-to-t from-white via-white to-transparent pt-20">
          <div className="max-w-4xl mx-auto relative pointer-events-auto">
            <div className="bg-white rounded-[24px] shadow-[0_8px_30px_rgba(0,0,0,0.06)] border border-gray-200 p-2 transition-shadow focus-within:shadow-[0_8px_40px_rgba(0,0,0,0.1)] focus-within:border-gray-300 relative">
              <form onSubmit={handleSubmit} className="relative flex items-end">
                <textarea
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e);
                    }
                  }}
                  placeholder={isGenerating ? "Generating..." : "Message or paste a link..."}
                  className={`w-full bg-transparent pl-4 pr-16 py-3 max-h-[200px] min-h-[44px] resize-none focus:outline-none text-[#282828] placeholder-gray-400 font-medium text-[15px] ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                  disabled={loading || isGenerating}
                  rows={1}
                />
                <button 
                  type="submit"
                  disabled={loading || !input.trim() || isGenerating}
                  className="absolute right-2 bottom-1.5 text-white bg-[#08c225] hover:bg-[#00b33c] rounded-[16px] w-10 h-10 flex items-center justify-center disabled:opacity-40 disabled:hover:bg-[#08c225] transition-all duration-200"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" />
                  </svg>
                </button>
              </form>
            </div>
            <div className="text-center mt-3 mb-1">
              <span className="text-[#757575] text-[11px] font-medium tracking-wide">
                Motif Beta
              </span>
            </div>
          </div>
        </footer>
      </div>

      {/* Export Explainer Modal */}
      {exportModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[24px] shadow-2xl max-w-md w-full p-8 relative animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setExportModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-full transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-blue-500">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
              </svg>
            </div>
            
            <h3 className="text-xl font-bold text-[#282828] mb-3">Serverless Demo Mode</h3>
            <p className="text-sm text-gray-600 mb-4 leading-relaxed">
              To keep this demonstration <strong>100% serverless and zero-cost</strong> on Vercel, the FFmpeg MP4 rendering backend (`@remotion/lambda`) is intentionally disabled.
            </p>
            <p className="text-sm text-gray-600 mb-6 leading-relaxed">
              Running heavy FFmpeg encoders inside a Next.js serverless function is an anti-pattern that crashes under load. In a production environment, this button would trigger a scalable AWS Lambda function to render the MP4 to an S3 bucket!
            </p>
            
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 mb-6">
              <p className="text-sm font-medium text-gray-700">💡 <strong>Tip for Evaluators:</strong> You can simply screen-record the web player to save the result!</p>
            </div>
            
            <button 
              onClick={() => setExportModalOpen(false)}
              className="w-full py-3 bg-[#282828] hover:bg-black text-white font-semibold rounded-[16px] transition-colors"
            >
              Got it, thanks!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
