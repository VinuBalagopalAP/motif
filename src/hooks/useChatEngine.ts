"use client";
import { useState, useRef, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useJobPoller } from '@/hooks/useJobPoller';
import { supabase } from "@/lib/supabase";
import type { Job } from "@/types";

interface ParsedArtifact {
  id: string;
  identifier: string;
  type: string;
  title: string;
  content: string;
  isGenerating?: boolean;
}

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  type?: string;
  jobId?: string;
  job?: Job;
  attachments?: { url: string; type: string; name: string }[];
  userFeedback?: 'up' | 'down';
  variants?: any[];
  activeVariantIndex?: number;
  sources?: any[];
};

export function useChatEngine() {
  const { user, session, loading: authLoading } = useAuth();
  const router = useRouter();

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [historyJobs, setHistoryJobs] = useState<Job[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<{ url: string; type: string; name: string }[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [activeArtifact, setActiveArtifact] = useState<ParsedArtifact | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'chat' | 'dashboard'>('chat');

  // Phase 3 State
  const [feedbackModalState, setFeedbackModalState] = useState<{ isOpen: boolean; feedbackId: string; job_id: string; index: number; is_positive: boolean } | null>(null);
  const [feedbackReason, setFeedbackReason] = useState("");
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [sharingJobId, setSharingJobId] = useState<string | null>(null);

  const [sharedLinksModalOpen, setSharedLinksModalOpen] = useState(false);
  const [sharedLinks, setSharedLinks] = useState<any[]>([]);
  const [loadingSharedLinks, setLoadingSharedLinks] = useState(false);
  const [linkToDisable, setLinkToDisable] = useState<string | null>(null);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const params = useParams();
  const initialChatIdLoaded = useRef(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Custom Font Upload State
  const fontFileInputRef = useRef<HTMLInputElement>(null);
  const [fontTargetMessageId, setFontTargetMessageId] = useState<string | null>(null);
  const [fontTargetSection, setFontTargetSection] = useState<'linked' | 'top' | 'bottom' | null>(null);
  const [isUploadingFont, setIsUploadingFont] = useState(false);

  const handleFontUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !fontTargetMessageId || !fontTargetSection) return;

    if (!file.name.toLowerCase().endsWith('.ttf') && !file.name.toLowerCase().endsWith('.otf')) {
      alert("Only .ttf and .otf font files are supported.");
      return;
    }

    setIsUploadingFont(true);
    setToast("Uploading custom font...");

    try {
      const ext = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
      const { data, error } = await supabase.storage
        .from('fonts')
        .upload(fileName, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('fonts')
        .getPublicUrl(data.path);

      setMessages(prev => prev.map(msg => {
        if (msg.id === fontTargetMessageId) {
          const variants = [...(msg.variants || [])];
          const activeIdx = msg.activeVariantIndex ?? variants.length - 1;
          const spec = JSON.parse(JSON.stringify(variants[activeIdx].render_spec));

          if (!spec.overlayText.style) spec.overlayText.style = {};

          if (fontTargetSection === 'linked') {
            spec.overlayText.style.topFontFamily = publicUrl;
            spec.overlayText.style.bottomFontFamily = publicUrl;
            spec.overlayText.style.fontFamily = publicUrl;
          } else if (fontTargetSection === 'top') {
            spec.overlayText.style.topFontFamily = publicUrl;
          } else if (fontTargetSection === 'bottom') {
            spec.overlayText.style.bottomFontFamily = publicUrl;
          }

          variants[activeIdx] = { ...variants[activeIdx], render_spec: spec };
          return { ...msg, variants, job: { ...msg.job, render_spec_json: spec } as any };
        }
        return msg;
      }));
      setToast("Custom font applied!");
    } catch (err: any) {
      console.error("Font upload error:", err);
      alert("Failed to upload font: " + err.message);
    } finally {
      setIsUploadingFont(false);
      if (fontFileInputRef.current) fontFileInputRef.current.value = '';
      setFontTargetMessageId(null);
      setFontTargetSection(null);
      setTimeout(() => setToast(null), 3000);
    }
  };

  // Authentication check
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // Keyboard shortcut to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+\ on Mac or Ctrl+\ on Windows
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault();
        setSidebarOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch History
  const fetchHistory = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('video_jobs')
      .select('*, messages(*)')
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

  const handleFeedback = async (msgId: string, jobId: string, index: number, variantIndex: number, isPositive: boolean) => {
    if (!session) return;
    console.log("Feedback clicked on message:", { msgId, jobId, index, isPositive });
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, userFeedback: isPositive ? 'up' : 'down' } : m));

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ msgId, jobId, messageIndex: index, variantIndex, isPositive })
      });
      const data = await res.json();
      console.log("Feedback API response:", data);
      if (res.ok && data.feedbackId) {
        if (!isPositive) {
          setFeedbackModalState({ isOpen: true, feedbackId: data.feedbackId, job_id: jobId, index, is_positive: isPositive });
          setFeedbackReason("");
        }
      }
    } catch (e) {
      console.error("Failed to submit feedback", e);
    }
  };

  const submitFeedbackReason = async () => {
    if (!feedbackModalState || !session) return;
    console.log("Submitting feedback reason:", { feedbackId: feedbackModalState.feedbackId, reason: feedbackReason });
    try {
      const res = await fetch('/api/feedback', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ feedbackId: feedbackModalState.feedbackId, reason: feedbackReason })
      });
      console.log("Feedback reason API response status:", res.status);
      setFeedbackModalState(null);
    } catch (e) {
      console.error(e);
    }
  };

  const handleShare = async (jobId: string, messagesToShare: any[] = messages, shareType: 'entire' | 'single' = 'entire') => {
    if (!session || messagesToShare.length === 0) return;
    setSharingJobId(jobId);
    try {
      const res = await fetch('/api/share', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ jobId, messages: messagesToShare, shareType })
      });
      const data = await res.json();
      if (data.shareId) {
        const url = `${window.location.origin}/share/${data.shareId}`;
        navigator.clipboard.writeText(url);
        setToast('Share link copied to clipboard!');
        setTimeout(() => setToast(null), 3000);
      }
    } catch (e) {
      console.error("Share failed", e);
      setToast('Share failed');
      setTimeout(() => setToast(null), 3000);
    } finally {
      setSharingJobId(null);
    }
  };

  const handleShareEntireChat = async () => {
    if (!session || messages.length === 0) return;
    const firstAssistantMsg = messages.find(m => m.role === 'assistant');
    if (!firstAssistantMsg?.jobId) {
      setToast('Cannot share empty chat');
      setTimeout(() => setToast(null), 3000);
      return;
    }
    await handleShare(firstAssistantMsg.jobId, messages, 'entire');
  };

  const handleShareSingleMessage = async (jobId: string, msgId: string) => {
    const idx = messages.findIndex(m => m.id === msgId);
    if (idx === -1) return;
    const assistantMsg = messages[idx];
    let userMsg = null;
    for (let i = idx - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        userMsg = messages[i];
        break;
      }
    }
    const messagesToShare = userMsg ? [userMsg, assistantMsg] : [assistantMsg];
    await handleShare(jobId, messagesToShare, 'single');
  };

  const fetchSharedLinks = async () => {
    setLoadingSharedLinks(true);
    try {
      const res = await fetch('/api/shares', {
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSharedLinks(data.shares || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSharedLinks(false);
    }
  };

  useEffect(() => {
    if (sharedLinksModalOpen && session?.access_token) {
      fetchSharedLinks();
    }
  }, [sharedLinksModalOpen, session?.access_token]);

  const deleteSharedLink = async (id: string) => {
    try {
      const res = await fetch(`/api/shares/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (res.ok) {
        setSharedLinks(prev => prev.filter(link => link.id !== id));
        setToast('Link disabled successfully');
        setTimeout(() => setToast(null), 3000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLinkToDisable(null);
    }
  };



  useEffect(() => {
    if (user) {
      fetchHistory();
    }
  }, [user]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadingFiles(true);
    try {
      const newAttachments: { name: string, type: string, url: string }[] = [];
      for (const file of files) {
        const ext = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

        const { data, error } = await supabase.storage
          .from('chat-attachments')
          .upload(fileName, file);

        if (error) {
          console.error('Upload error:', error);
          continue;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('chat-attachments')
          .getPublicUrl(data.path);

        newAttachments.push({
          name: file.name,
          type: file.type,
          url: publicUrl
        });
      }
      setAttachments(prev => [...prev, ...newAttachments]);
    } finally {
      setUploadingFiles(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const mapMessages = (job: any): Message[] => {
    if (job.messages && job.messages.length > 0) {
      const sortedMessages = [...job.messages].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      return sortedMessages.map((msg: any) => {
        const variants = msg.variants?.length > 0 ? msg.variants : [{
          type: msg.type,
          content: msg.content,
          render_spec: msg.render_spec,
          sources: msg.sources
        }];
        const activeIndex = variants.length - 1;
        const activeVariant = variants[activeIndex];

        return {
          id: msg.id,
          role: msg.role as 'user' | 'assistant',
          content: msg.content || '',
          type: activeVariant?.type || msg.type || 'chat',
          attachments: msg.attachments,
          userFeedback: msg.user_feedback || msg.userFeedback,
          variants: msg.variants?.length > 0 ? msg.variants : undefined,
          activeVariantIndex: msg.variants?.length > 0 ? activeIndex : undefined,
          jobId: job.id,
          job: (activeVariant?.type === 'video'
            ? { ...job, status: 'done', render_spec_json: activeVariant.render_spec }
            : (msg.role === 'assistant' ? { status: 'done', product_json: { chat_reply: activeVariant?.content || msg.content, sources: activeVariant?.sources || msg.sources } } : undefined)) as Job | undefined
        };
      });
    } else {
      return [
        { id: `user-${job.id}`, role: 'user', content: job.message },
        { id: `asst-${job.id}`, role: 'assistant', content: '', jobId: job.id, job }
      ] as Message[];
    }
  };

  // Initial load from URL
  useEffect(() => {
    if (user && historyJobs.length > 0 && !initialChatIdLoaded.current) {
      const chatIdArray = params?.chatId as string[] | undefined;
      if (chatIdArray && chatIdArray[0] === 'c' && chatIdArray[1]) {
        const jobId = chatIdArray[1];
        const job = historyJobs.find(j => j.id === jobId);
        if (job) {
          setActiveChatId(job.id);
          setMessages(mapMessages(job));
          initialChatIdLoaded.current = true;
        } else {
          window.history.replaceState(null, '', '/');
        }
      } else {
        initialChatIdLoaded.current = true;
      }
    }
  }, [user, historyJobs, params]);

  const scrollToBottom = () => {
    const main = document.getElementById("chat-main");
    if (main) {
      main.scrollTo({ top: main.scrollHeight, behavior: "smooth" });
    }
  };

  const prevMessagesLength = useRef(messages.length);
  useEffect(() => {
    const isStreaming = messages.some(m => (m.job?.status as any) === 'Streaming text...');
    if (isStreaming || messages.length > prevMessagesLength.current) {
      scrollToBottom();
    }
    prevMessagesLength.current = messages.length;
  }, [messages]);

  // Polling for job status has been extracted to a custom hook
  useJobPoller(messages, setMessages, session, fetchHistory);

  // Suppress harmless Remotion image decoding abort errors from littering the Next.js terminal
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handler = (event: PromiseRejectionEvent) => {
      if (event.reason && (event.reason.name === 'EncodingError' || (event.reason.message && event.reason.message.includes('EncodingError')))) {
        event.preventDefault(); // Stops Next.js from capturing and printing it to the terminal
      }
    };

    window.addEventListener('unhandledrejection', handler);
    return () => window.removeEventListener('unhandledrejection', handler);
  }, []);

  const runGeneration = async (prompt: string, historyOverride?: Message[]) => {
    if ((!prompt.trim() && attachments.length === 0) || !user || !session || loading || uploadingFiles) return;

    const currentAttachments = [...attachments];
    setAttachments([]);

    const userMessage: Message = { id: Date.now().toString(), role: "user", content: prompt, attachments: currentAttachments.length > 0 ? currentAttachments : undefined };
    const assistantMessage: Message = { id: (Date.now() + 1).toString(), role: "assistant", content: "" };

    setMessages(prev => [...(historyOverride || prev), userMessage, assistantMessage]);
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
          attachments: currentAttachments.length > 0 ? currentAttachments : undefined,
          history: (historyOverride || messages).map(m => ({
            role: m.role,
            type: m.type || (m.role === 'assistant' ? (m.job?.product_json?.chat_reply ? 'chat' : 'video') : undefined),
            content: m.role === 'assistant' ? (m.job?.product_json?.chat_reply || "Generated a video.") : m.content,
            attachments: m.attachments
          }))
        })
      });
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/x-ndjson")) {
        const reader = res.body?.getReader();
        if (!reader) return;
        const decoder = new TextDecoder();
        let buffer = "";

        let currentReply = "";
        let currentSources: any[] = [];
        let currentStatus = "";
        let isWaitingForVideo = false;

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const event = JSON.parse(line);
              if (event.type === 'init') {
                if (!activeChatId && event.chatId) {
                  setActiveChatId(event.chatId);
                  window.history.replaceState(null, '', `/c/${event.chatId}`);
                }
                setMessages(prev => prev.map(m =>
                  m.id === assistantMessage.id ? {
                    ...m,
                    jobId: event.chatId,
                    type: 'chat',
                    job: { status: 'Thinking...', product_json: { chat_reply: '', sources: [] } } as any
                  } : m
                ));
              } else if (event.type === 'status') {
                currentStatus = event.message;
                setMessages(prev => prev.map(m =>
                  m.id === assistantMessage.id ? {
                    ...m,
                    type: 'chat',
                    job: { status: currentStatus, product_json: { chat_reply: currentReply, sources: currentSources } } as any
                  } : m
                ));
              } else if (event.type === 'text') {
                currentReply += event.text;
                setMessages(prev => prev.map(m =>
                  m.id === assistantMessage.id ? {
                    ...m,
                    type: 'chat',
                    job: { status: 'Streaming text...', product_json: { chat_reply: currentReply, sources: currentSources } } as any
                  } : m
                ));
              } else if (event.type === 'trigger_video') {
                isWaitingForVideo = true;
              } else if (event.type === 'done') {
                currentReply = event.reply;
                currentSources = event.sources;
                setMessages(prev => prev.map(m =>
                  m.id === assistantMessage.id ? {
                    ...m,
                    type: 'chat',
                    job: { status: isWaitingForVideo ? 'started' : 'done', product_json: { chat_reply: currentReply, sources: currentSources } } as any
                  } : m
                ));
              }
            } catch (err) {
              console.error("Failed to parse stream event", line, err);
            }
          }
        }
        fetchHistory();
      } else {
        const data = await res.json();
        if (!activeChatId && data.chatId) {
          setActiveChatId(data.chatId);
          window.history.replaceState(null, '', `/c/${data.chatId}`);
        }
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


  const handleRegenerate = async (jobId: string, msgId: string) => {
    if (!session) return;
    try {
      setMessages(prev => prev.map(m =>
        m.id === msgId ? { ...m, job: { ...m.job, status: 'started' } as any } : m
      ));
      const res = await fetch("/api/chat/regenerate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ jobId })
      });

      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/x-ndjson")) {
        const reader = res.body?.getReader();
        if (!reader) return;
        const decoder = new TextDecoder();
        let buffer = "";

        let currentReply = "";
        let currentSources: any[] = [];
        let currentStatus = "";

        setMessages(prev => prev.map(m => {
          if (m.id === msgId) {
            const variants = [...(m.variants || [{ type: m.type, content: m.content, sources: m.sources }])];
            variants.push({ type: 'chat', content: '', sources: [] });
            return { ...m, variants, activeVariantIndex: variants.length - 1, job: { ...m.job, status: 'started' } as any };
          }
          return m;
        }));

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const event = JSON.parse(line);

              if (event.type === 'status') {
                currentStatus = event.message;
                setMessages(prev => prev.map(m => m.id === msgId ? { ...m, job: { ...m.job, status: currentStatus } as any } : m));
              } else if (event.type === 'text') {
                currentReply += event.text;
                setMessages(prev => prev.map(m => {
                  if (m.id === msgId) {
                    const variants = [...(m.variants || [])];
                    if (variants.length > 0) {
                      variants[variants.length - 1] = { ...variants[variants.length - 1], content: currentReply };
                    }
                    return { ...m, content: currentReply, variants, job: { ...m.job, status: 'started', product_json: { chat_reply: currentReply } } as any };
                  }
                  return m;
                }));
              } else if (event.type === 'done') {
                currentSources = event.sources || [];
                setMessages(prev => prev.map(m => {
                  if (m.id === msgId) {
                    const variants = [...(m.variants || [])];
                    if (variants.length > 0) {
                      variants[variants.length - 1] = { ...variants[variants.length - 1], content: event.reply, sources: currentSources };
                    }
                    return { ...m, content: event.reply, sources: currentSources, variants, job: { ...m.job, status: 'done', product_json: { chat_reply: event.reply, sources: currentSources } } as any };
                  }
                  return m;
                }));
              }
            } catch (e) {
              console.error("Stream parse error", e);
            }
          }
        }
      } else {
        if (res.ok) {
          fetchHistory(); // Video job runs in background, polling will update UI
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePartialRegenerate = async (jobId: string, msgId: string, partialTarget: 'caption' | 'gif' | 'audio' | 'background', bgType?: string, bgPrompt?: string) => {
    if (!session) return;
    try {
      setMessages(prev => prev.map(m =>
        m.id === msgId ? { ...m, job: { ...m.job, status: 'started' } as any } : m
      ));
      const res = await fetch("/api/chat/regenerate-partial", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ jobId, partialTarget, bgType, bgPrompt })
      });
      // the job poller will pick up the rest!
    } catch (e) {
      console.error(e);
    }
  };

  const handleEditSubmit = async (msgId: string, newMessage: string, oldContent: string) => {
    if (newMessage.trim() === oldContent || !newMessage.trim()) {
      return;
    }
    if (!session) return;

    if (msgId.startsWith('hist-') || !msgId.startsWith('user-')) {
      const index = messages.findIndex(m => m.id === msgId);
      if (index === -1) return;
      const truncatedHistory = messages.slice(0, index);
      runGeneration(newMessage, truncatedHistory);
      return;
    }

    const jobId = msgId.replace('user-', '');
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
    window.history.pushState(null, '', `/c/${job.id}`);
    setActiveChatId(job.id);
    setActiveView('chat');
    setMessages(mapMessages(job));
    setMobileMenuOpen(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };


  return {
    user, session, authLoading, router, params,
    messages, setMessages,
    loading, setLoading,
    historyJobs, setHistoryJobs,
    mobileMenuOpen, setMobileMenuOpen,
    exportModalOpen, setExportModalOpen,
    activeChatId, setActiveChatId,
    attachments, setAttachments,
    uploadingFiles, setUploadingFiles,
    activeArtifact, setActiveArtifact,
    previewImage, setPreviewImage,
    toast, setToast,
    activeView, setActiveView,
    feedbackModalState, setFeedbackModalState,
    feedbackReason, setFeedbackReason,
    activeMenuId, setActiveMenuId,
    sharingJobId, setSharingJobId,
    sharedLinksModalOpen, setSharedLinksModalOpen,
    sharedLinks, setSharedLinks,
    loadingSharedLinks, setLoadingSharedLinks,
    linkToDisable, setLinkToDisable,
    settingsMenuOpen, setSettingsMenuOpen,
    sidebarOpen, setSidebarOpen,
    fileInputRef, messagesEndRef, fontFileInputRef,
    fontTargetMessageId, setFontTargetMessageId,
    fontTargetSection, setFontTargetSection,
    isUploadingFont, setIsUploadingFont,
    handleFontUpload,
    fetchHistory,
    deleteJob,
    stopJob,
    handleFeedback,
    submitFeedbackReason,
    handleShare,
    handleShareEntireChat,
    handleShareSingleMessage,
    fetchSharedLinks,
    deleteSharedLink,
    handleFileChange,
    runGeneration,
    handleEditSubmit,
    handleRegenerate,
    handlePartialRegenerate,
    loadJob,
    handleLogout
  };
}
