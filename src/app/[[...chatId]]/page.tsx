"use client";

import { useState, useRef, useEffect } from "react";
import { Player } from "@remotion/player";
import { UgcVideo } from "@/remotion/UgcVideo";
import type { Job } from "@/lib/jobs";
import { useAuth } from "@/components/AuthProvider";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import TextareaAutosize from 'react-textarea-autosize';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { ArtifactCanvas } from "@/components/ArtifactCanvas";
import packageJson from '../../../package.json';

interface ParsedArtifact {
  id: string;
  identifier: string;
  type: string;
  title: string;
  content: string;
  isGenerating?: boolean;
}

interface ParsedMessagePart {
  type: 'text' | 'artifact';
  content?: string;
  artifact?: ParsedArtifact;
}

function parseMessageParts(text: string): ParsedMessagePart[] {
  const parts: ParsedMessagePart[] = [];
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
        id: match[1], // Use identifier as ID to maintain stability
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
  const [attachments, setAttachments] = useState<{ url: string; type: string; name: string }[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [activeArtifact, setActiveArtifact] = useState<ParsedArtifact | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

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

  const [gifSearchQuery, setGifSearchQuery] = useState("");
  const [isSearchingGif, setIsSearchingGif] = useState(false);
  const [activeTabs, setActiveTabs] = useState<Record<string, 'captions' | 'meme' | 'background'>>({});
  // pendingBgTypes removed — instant tab switching now uses activeBgType in spec
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
        body: JSON.stringify({ jobId, messageIndex: index, variantIndex, isPositive })
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

  // Initial load from URL
  useEffect(() => {
    if (user && historyJobs.length > 0 && !initialChatIdLoaded.current) {
      const chatIdArray = params?.chatId as string[] | undefined;
      if (chatIdArray && chatIdArray[0] === 'c' && chatIdArray[1]) {
        const jobId = chatIdArray[1];
        const job = historyJobs.find(j => j.id === jobId);
        if (job) {
          setActiveChatId(job.id);
          if (job.product_json?.chat_history) {
            const historyMessages = job.product_json.chat_history.map((msg: any, i: number) => {
              const variants = msg.variants || [{
                type: msg.type,
                content: msg.content,
                render_spec: msg.render_spec,
                sources: msg.sources
              }];
              const activeIndex = variants.length - 1;
              const activeVariant = variants[activeIndex];

              return {
                id: `hist-${job.id}-${i}`,
                role: msg.role,
                content: msg.content || '',
                type: activeVariant.type,
                attachments: msg.attachments,
                userFeedback: msg.userFeedback,
                variants: msg.variants ? msg.variants : undefined,
                activeVariantIndex: msg.variants ? activeIndex : undefined,
                jobId: job.id,
                job: activeVariant.type === 'video'
                  ? { ...job, status: 'done', render_spec_json: activeVariant.render_spec }
                  : (msg.role === 'assistant' ? { status: 'done', product_json: { chat_reply: activeVariant.content, sources: activeVariant.sources } } : undefined)
              };
            });
            setMessages(historyMessages);
          } else {
            setMessages([
              { id: `user-${job.id}`, role: 'user', content: job.message },
              { id: `asst-${job.id}`, role: 'assistant', content: '', jobId: job.id, job }
            ]);
          }
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

  // Polling for job status
  useEffect(() => {
    const activeJobs = messages.filter(m => m.jobId && (!m.job || m.job.status !== 'done' && m.job.status !== 'error'));

    if (activeJobs.length === 0) return;

    const interval = setInterval(async () => {
      for (const msg of activeJobs) {
        try {
          const res = await fetch(`/api/jobs/${msg.jobId}`, {
            headers: {
              'Authorization': `Bearer ${session?.access_token}`
            }
          });
          if (res.ok) {
            const job: Job = await res.json();

            setMessages(prev => {
              const newMessages = [...prev];
              const msgIndex = newMessages.findIndex(m => m.id === msg.id);
              if (msgIndex !== -1 && JSON.stringify(newMessages[msgIndex].job) !== JSON.stringify(job)) {
                const updatedMsg = { ...newMessages[msgIndex], job };

                // If job is done, sync the active variant to reflect the final render_spec
                if (job.status === 'done' && job.render_spec_json) {
                  if (updatedMsg.variants && updatedMsg.variants.length > 0) {
                    // Update the active variant in the existing variants array
                    const activeIdx = updatedMsg.activeVariantIndex ?? updatedMsg.variants.length - 1;
                    const newVariants = [...updatedMsg.variants];
                    newVariants[activeIdx] = {
                      ...newVariants[activeIdx],
                      type: 'video',
                      render_spec: job.render_spec_json
                    };
                    updatedMsg.variants = newVariants;
                    updatedMsg.type = 'video';
                  } else {
                    // No variants yet — create them from the completed job spec (first generation)
                    updatedMsg.variants = [{ type: 'video', render_spec: job.render_spec_json }];
                    updatedMsg.activeVariantIndex = 0;
                    updatedMsg.type = 'video';
                  }
                }

                newMessages[msgIndex] = updatedMsg;
                return newMessages;
              }
              return prev;
            });

            // If job just finished, refresh the sidebar
            if (job.status === 'done' || job.status === 'error') {
              fetchHistory();
            }
          }
        } catch (e) {
          console.error(e);
        }
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [messages, session]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await runGeneration(input);
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

  const handleEditSubmit = async (msgId: string, oldContent: string) => {
    if (editInput.trim() === oldContent || !editInput.trim()) {
      setEditingMsgId(null);
      return;
    }
    const newMessage = editInput;
    setEditingMsgId(null);
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
    if (job.product_json?.chat_history) {
      const historyMessages = job.product_json.chat_history.map((msg: any, i: number) => {
        const variants = msg.variants || [{
          type: msg.type,
          content: msg.content,
          render_spec: msg.render_spec,
          sources: msg.sources
        }];
        const activeIndex = variants.length - 1;
        const activeVariant = variants[activeIndex];

        return {
          id: `hist-${job.id}-${i}`,
          role: msg.role,
          content: msg.content || '',
          type: activeVariant.type,
          attachments: msg.attachments,
          userFeedback: msg.userFeedback,
          variants: msg.variants ? msg.variants : undefined,
          activeVariantIndex: msg.variants ? activeIndex : undefined,
          jobId: job.id,
          job: activeVariant.type === 'video'
            ? { ...job, status: 'done', render_spec_json: activeVariant.render_spec }
            : (msg.role === 'assistant' ? { status: 'done', product_json: { chat_reply: activeVariant.content, sources: activeVariant.sources } } : undefined)
        };
      });
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

  const handleSearchGif = async (msgId: string) => {
    if (!gifSearchQuery.trim()) return;
    setIsSearchingGif(true);
    try {
      const res = await fetch(`/api/search-gifs?q=${encodeURIComponent(gifSearchQuery)}`);
      const data = await res.json();
      if (data.options && data.options.length > 0) {
        setMessages(prev => prev.map(msg => {
          if (msg.id === msgId) {
            const variants = [...(msg.variants || [])];
            const activeIdx = msg.activeVariantIndex ?? variants.length - 1;
            const spec = JSON.parse(JSON.stringify(variants[activeIdx].render_spec));
            if (!spec.gifOverlay) spec.gifOverlay = { url: "" };
            spec.gifOverlay.options = data.options;
            spec.gifOverlay.url = data.options[0]; // Auto-select first result
            variants[activeIdx] = { ...variants[activeIdx], render_spec: spec };
            return { ...msg, variants, job: { ...msg.job, render_spec_json: spec } as any };
          }
          return msg;
        }));
      }
    } catch (e) {
      console.error("Failed to search gifs", e);
    }
    setIsSearchingGif(false);
  };

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
        fixed inset-y-0 left-0 z-50 bg-[#f9f9fa] border-r border-gray-100 flex flex-col transition-all duration-300 ease-in-out
        ${mobileMenuOpen ? 'translate-x-0 w-64' : '-translate-x-full w-64'}
        md:relative md:translate-x-0 md:h-full md:overflow-hidden
        ${sidebarOpen ? 'md:w-64 md:opacity-100' : 'md:w-0 md:opacity-0 md:border-none'}
      `}>
        <div className="w-64 h-full flex flex-col min-w-[256px]">
          <div className="p-4 flex flex-col gap-3 mt-2">
            <div className="flex items-center justify-between px-1">
              <button
                onClick={() => setSidebarOpen(false)}
                className="relative p-1.5 text-gray-400 hover:text-[#282828] hover:bg-gray-200/50 rounded-lg transition-colors hidden md:block group"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-5 h-5">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" strokeWidth={1.5} />
                  <line x1="9" y1="3" x2="9" y2="21" strokeWidth={1.5} />
                </svg>
                <span className="absolute top-full left-0 mt-2 px-2.5 py-1.5 bg-[#282828] text-white text-[11px] font-medium rounded-md opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity duration-200 z-[100] shadow-lg flex items-center gap-2">
                  Close sidebar <span className="text-gray-400 font-sans font-semibold">⌘\</span>
                </span>
              </button>
              <div className="w-4 hidden md:block"></div>
            </div>
            <button
              onClick={() => { setActiveChatId(null); setMessages([]); setMobileMenuOpen(false); window.history.pushState(null, '', '/'); }}
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

          <div className="p-4 flex items-center justify-between border-t border-gray-100 relative">
            <div className="text-sm font-medium text-[#757575] truncate pr-2">{user.email}</div>

            <div className="relative">
              <button
                onClick={() => setSettingsMenuOpen(!settingsMenuOpen)}
                className={`hover:text-[#282828] hover:bg-gray-200/50 rounded-lg p-2 transition-colors ${settingsMenuOpen ? 'bg-gray-200/50 text-[#282828]' : 'text-[#757575]'}`}
                title="Settings"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.78.929l-.15.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>

              {settingsMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setSettingsMenuOpen(false)}></div>
                  <div className="absolute bottom-full right-0 mb-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <div className="flex flex-col p-1.5">
                      <button
                        onClick={() => {
                          setSettingsMenuOpen(false);
                          setSharedLinksModalOpen(true);
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-[#282828] hover:bg-gray-100 rounded-lg flex items-center gap-2.5 transition-colors font-medium"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-gray-500">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                        </svg>
                        Manage Shared Links
                      </button>
                      <div className="h-px bg-gray-100 my-1 mx-2"></div>
                      <button
                        onClick={() => {
                          setSettingsMenuOpen(false);
                          handleLogout();
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-2.5 transition-colors font-medium"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                        </svg>
                        Sign Out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Area & Canvas Split Pane */}
      <div className="flex-1 flex min-w-0 relative bg-[#ffffff] overflow-hidden">

        {/* Desktop Sidebar Toggle (when closed) */}
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="absolute top-6 left-6 z-20 p-2 text-gray-400 hover:text-[#282828] hover:bg-gray-100 rounded-lg transition-colors hidden md:block group"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-5 h-5">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" strokeWidth={1.5} />
              <line x1="9" y1="3" x2="9" y2="21" strokeWidth={1.5} />
            </svg>
            <span className="absolute top-full left-0 mt-2 px-2.5 py-1.5 bg-[#282828] text-white text-[11px] font-medium rounded-md opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity duration-200 z-[100] shadow-lg flex items-center gap-2">
              Open sidebar <span className="text-gray-400 font-sans font-semibold">⌘\</span>
            </span>
          </button>
        )}

        {/* Chat Feed */}
        <div className={`flex flex-col min-w-0 h-full relative transition-all duration-300 ease-in-out ${activeArtifact ? 'w-full md:w-[45%] max-w-[600px] min-w-[350px] border-r border-gray-100 hidden md:flex flex-shrink-0' : 'w-full flex-1'}`}>
          <header className="relative py-3 px-4 sm:px-6 bg-[#ffffff] border-b border-gray-100 flex items-center justify-center sticky top-0 z-10 md:hidden h-[57px]">
            <button onClick={() => setMobileMenuOpen(true)} className="absolute left-4 sm:left-6 p-1 -ml-1 text-[#757575] hover:text-[#282828] transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
            <h1 className="text-lg font-semibold text-[#282828]">Motif</h1>
            {messages.length > 0 && (
              <button
                onClick={handleShareEntireChat}
                disabled={sharingJobId === messages.find(m => m.role === 'assistant')?.jobId}
                className="absolute right-4 p-1.5 text-gray-500 hover:text-gray-800 transition-colors disabled:opacity-50"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" /></svg>
              </button>
            )}
          </header>

          {/* Desktop Top Right Header (Share Entire Chat) */}
          {messages.length > 0 && (
            <div className="absolute top-6 right-6 z-20 hidden md:block">
              <button
                onClick={handleShareEntireChat}
                disabled={sharingJobId === messages.find(m => m.role === 'assistant')?.jobId}
                className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 text-gray-600 hover:text-[#282828] hover:bg-gray-50 rounded-lg shadow-sm transition-colors text-sm font-medium disabled:opacity-50"
                title="Share Entire Chat"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" /></svg>
                Share
              </button>
            </div>
          )}

          <main id="chat-main" className="flex-1 overflow-y-auto p-4 sm:p-6 pb-0" style={{ maskImage: 'linear-gradient(to bottom, black calc(100% - 120px), transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, black calc(100% - 120px), transparent 100%)' }}>
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
                                  <button onClick={() => handleEditSubmit(m.id, m.content)} className="px-3 py-1.5 text-xs font-semibold text-white bg-[#08c225] hover:bg-[#00b33c] rounded-lg">Send</button>
                                </div>
                              </div>
                            ) : (
                              <>
                                {m.attachments && m.attachments.length > 0 && (
                                  <div className="flex flex-wrap gap-2 mb-3">
                                    {m.attachments.map((att, i) => (
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
                                        {/* Tab Bar */}
                                        <div className="flex bg-gray-100 p-1.5 rounded-[12px] shadow-inner mb-1">
                                          {['captions', 'meme', 'background'].map((tab) => {
                                            const currentTab = activeTabs[m.id] || 'captions';
                                            return (
                                              <button
                                                key={tab}
                                                onClick={() => setActiveTabs(prev => ({ ...prev, [m.id]: tab as any }))}
                                                className={`flex-1 text-xs font-bold py-2 rounded-[8px] transition-all capitalize tracking-wide ${currentTab === tab ? 'bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] text-[#282828]' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'}`}
                                              >
                                                {tab}
                                              </button>
                                            );
                                          })}
                                        </div>

                                        {/* Background Tab */}
                                        {(activeTabs[m.id] || 'captions') === 'background' && (
                                          <div className="w-full p-4 bg-white border border-gray-200 rounded-[16px] text-sm shadow-[0_2px_10px_rgba(0,0,0,0.02)] animate-in fade-in slide-in-from-bottom-2 duration-200">
                                            <div className="font-semibold text-gray-700 mb-3 flex items-center justify-between">
                                              <span>Background Mode</span>
                                            </div>
                                            <div className="flex items-center gap-3 mb-4">
                                              <select
                                                className="border border-gray-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#08c225]/20 flex-1 bg-white"
                                                value={activeRenderSpec.backgroundMode || 'video'}
                                                onChange={(e) => updateSpec(spec => { spec.backgroundMode = e.target.value; })}
                                              >
                                                <option value="video">Media (Video/Image)</option>
                                                <option value="color">Plain Color</option>
                                              </select>
                                              {activeRenderSpec.backgroundMode === 'color' && (
                                                <div className="relative w-10 h-10 rounded-xl border border-gray-200 overflow-hidden shadow-sm shrink-0 hover:scale-105 transition-transform" style={{ backgroundColor: activeRenderSpec.backgroundColor || '#000000' }}>
                                                  <input
                                                    type="color"
                                                    value={activeRenderSpec.backgroundColor || '#000000'}
                                                    onChange={(e) => updateSpec(spec => { spec.backgroundColor = e.target.value; })}
                                                    className="absolute inset-0 w-[200%] h-[200%] -top-1/2 -left-1/2 cursor-pointer opacity-0"
                                                  />
                                                </div>
                                              )}
                                            </div>

                                            {(!activeRenderSpec.backgroundMode || activeRenderSpec.backgroundMode === 'video') && (
                                              <div className="flex flex-col gap-3 pt-3 border-t border-gray-100">
                                                <div className="flex items-center justify-between">
                                                  <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Media Type</label>
                                                  {/* Indicator if pre-fetched video is available */}
                                                  {activeRenderSpec.background_video && (
                                                    <span className="text-[10px] text-[#08c225] font-medium">✓ Both ready</span>
                                                  )}
                                                </div>
                                                <div className="flex bg-gray-50 p-1 rounded-lg border border-gray-100">
                                                  <button
                                                    onClick={() => updateSpec(spec => {
                                                      spec.activeBgType = 'image';
                                                      spec.background = spec.background_image || { type: 'image', url: spec.background?.url || '', prompt: spec.background?.prompt || '' };
                                                    })}
                                                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${(activeRenderSpec.activeBgType || activeRenderSpec.background?.type) === 'image' || (!activeRenderSpec.activeBgType && activeRenderSpec.background?.type !== 'video') ? 'bg-white shadow-sm border border-gray-200 text-[#08c225]' : 'text-gray-500 hover:text-gray-700'}`}
                                                  >
                                                    AI Image
                                                  </button>
                                                  <button
                                                    onClick={() => {
                                                      if (activeRenderSpec.background_video) {
                                                        // Pre-fetched video available — instant switch
                                                        updateSpec(spec => {
                                                          spec.activeBgType = 'video';
                                                          spec.background = spec.background_video;
                                                        });
                                                      } else {
                                                        // No pre-fetched video yet — trigger regeneration
                                                        handlePartialRegenerate(m.jobId!, m.id, 'background', 'video', activeRenderSpec.background?.prompt || '');
                                                      }
                                                    }}
                                                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${activeRenderSpec.activeBgType === 'video' || activeRenderSpec.background?.type === 'video' ? 'bg-white shadow-sm border border-gray-200 text-[#08c225]' : 'text-gray-500 hover:text-gray-700'}`}
                                                  >
                                                    Stock Video {!activeRenderSpec.background_video && <span className="opacity-50 text-[9px]">(fetch)</span>}
                                                  </button>
                                                </div>

                                                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mt-2">Generation Prompt</label>
                                                <TextareaAutosize
                                                  value={activeRenderSpec.background?.prompt || ""}
                                                  onChange={(e) => updateSpec(spec => { if (!spec.background) spec.background = { type: 'image', url: '' }; spec.background.prompt = e.target.value; })}
                                                  className="w-full border border-gray-200 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#08c225]/20 bg-gray-50 resize-none text-gray-600 font-mono"
                                                  minRows={2}
                                                />
                                                <button
                                                  onClick={() => handlePartialRegenerate(m.jobId!, m.id, 'background', activeRenderSpec.activeBgType || activeRenderSpec.background?.type || 'image', activeRenderSpec.background?.prompt || '')}
                                                  disabled={!activeRenderSpec.background?.prompt}
                                                  className="w-full mt-1 px-3 py-2 bg-[#08c225]/10 text-[#08c225] hover:bg-[#08c225]/20 font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                                >
                                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                                                  </svg>
                                                  Regenerate Media
                                                </button>
                                              </div>
                                            )}

                                          </div>
                                        )}

                                        {/* Captions Tab */}
                                        {(activeTabs[m.id] || 'captions') === 'captions' && (
                                          <div className="w-full p-4 bg-white border border-gray-200 rounded-[16px] text-sm shadow-[0_2px_10px_rgba(0,0,0,0.02)] animate-in fade-in slide-in-from-bottom-2 duration-200">
                                            <div className="font-semibold text-gray-700 mb-4 flex justify-between items-center">
                                              <span>Caption Content</span>
                                              <div className="flex items-center gap-3">
                                                <label className="flex items-center gap-1.5 text-[11px] font-medium text-gray-500 cursor-pointer">
                                                  <input
                                                    type="checkbox"
                                                    checked={activeRenderSpec.overlayText?.style?.linkFonts !== false}
                                                    onChange={(e) => updateSpec(spec => {
                                                      if (!spec.overlayText.style) spec.overlayText.style = {};
                                                      spec.overlayText.style.linkFonts = e.target.checked;
                                                      if (e.target.checked) {
                                                        spec.overlayText.style.bottomFontFamily = spec.overlayText.style.topFontFamily;
                                                      }
                                                    })}
                                                    className="rounded border-gray-300 text-[#08c225] focus:ring-[#08c225]"
                                                  />
                                                  Link Fonts
                                                </label>
                                                {activeRenderSpec.overlayText?.style?.linkFonts !== false && (
                                                  <select
                                                    className="border border-gray-200 rounded-lg p-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#08c225]/20 w-32 bg-white"
                                                    value={activeRenderSpec.overlayText?.style?.topFontFamily || activeRenderSpec.overlayText?.style?.fontFamily || "system-ui, -apple-system, sans-serif"}
                                                    onChange={(e) => {
                                                      if (e.target.value === 'upload_custom') {
                                                        setFontTargetMessageId(m.id);
                                                        setFontTargetSection('linked');
                                                        fontFileInputRef.current?.click();
                                                        return;
                                                      }
                                                      updateSpec(spec => {
                                                        if (!spec.overlayText.style) spec.overlayText.style = {};
                                                        spec.overlayText.style.topFontFamily = e.target.value;
                                                        spec.overlayText.style.bottomFontFamily = e.target.value;
                                                        spec.overlayText.style.fontFamily = e.target.value;
                                                      });
                                                    }}
                                                  >
                                                    <option value="system-ui, -apple-system, sans-serif">System</option>
                                                    {(activeRenderSpec.overlayText?.style?.topFontFamily?.startsWith('http') || activeRenderSpec.overlayText?.style?.fontFamily?.startsWith('http')) && (
                                                      <option value={activeRenderSpec.overlayText?.style?.topFontFamily || activeRenderSpec.overlayText?.style?.fontFamily}>Custom Font</option>
                                                    )}
                                                    <option value="upload_custom" className="text-[#08c225] font-semibold">Upload Custom Font...</option>
                                                    <option value="Montserrat">Montserrat</option>
                                                    <option value="Roboto">Roboto</option>
                                                    <option value="Bangers">Bangers</option>
                                                    <option value="Permanent Marker">Marker</option>
                                                    <option value="Anton">Anton</option>
                                                    <option value="Oswald">Oswald</option>
                                                    <option value="Playfair Display">Playfair</option>
                                                  </select>
                                                )}
                                              </div>
                                            </div>

                                            <div className="flex flex-col gap-4">
                                              {/* Top Hook Section */}
                                              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                                                <div className="flex items-center justify-between mb-2">
                                                  <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Top Hook</label>
                                                  <div className="flex gap-3">
                                                    <label className="flex items-center gap-1.5 text-[11px] font-medium text-gray-500 cursor-pointer">
                                                      <input type="checkbox" checked={activeRenderSpec.overlayText?.showTopText !== false} onChange={(e) => updateSpec(spec => { spec.overlayText.showTopText = e.target.checked; })} className="rounded border-gray-300 text-[#08c225] focus:ring-[#08c225] w-3.5 h-3.5" /> Show
                                                    </label>
                                                    <label className="flex items-center gap-1.5 text-[11px] font-medium text-gray-500 cursor-pointer">
                                                      <input type="checkbox" checked={activeRenderSpec.overlayText?.style?.showTopBackground !== false} onChange={(e) => updateSpec(spec => { if (!spec.overlayText.style) spec.overlayText.style = {}; spec.overlayText.style.showTopBackground = e.target.checked; })} className="rounded border-gray-300 text-[#08c225] focus:ring-[#08c225] w-3.5 h-3.5" /> Bg
                                                    </label>
                                                  </div>
                                                </div>
                                                {activeRenderSpec.overlayText?.style?.linkFonts === false && (
                                                  <div className="mb-2">
                                                    <select
                                                      className="border border-gray-200 rounded-lg p-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#08c225]/20 w-full bg-white"
                                                      value={activeRenderSpec.overlayText?.style?.topFontFamily || activeRenderSpec.overlayText?.style?.fontFamily || "system-ui, -apple-system, sans-serif"}
                                                      onChange={(e) => {
                                                        if (e.target.value === 'upload_custom') {
                                                          setFontTargetMessageId(m.id);
                                                          setFontTargetSection('top');
                                                          fontFileInputRef.current?.click();
                                                          return;
                                                        }
                                                        updateSpec(spec => { if (!spec.overlayText.style) spec.overlayText.style = {}; spec.overlayText.style.topFontFamily = e.target.value; });
                                                      }}
                                                    >
                                                      <option value="system-ui, -apple-system, sans-serif">System</option>
                                                      {(activeRenderSpec.overlayText?.style?.topFontFamily?.startsWith('http') || activeRenderSpec.overlayText?.style?.fontFamily?.startsWith('http')) && (
                                                        <option value={activeRenderSpec.overlayText?.style?.topFontFamily || activeRenderSpec.overlayText?.style?.fontFamily}>Custom Font</option>
                                                      )}
                                                      <option value="upload_custom" className="text-[#08c225] font-semibold">Upload Custom Font...</option>
                                                      <option value="Montserrat">Montserrat</option>
                                                      <option value="Roboto">Roboto</option>
                                                      <option value="Bangers">Bangers</option>
                                                      <option value="Permanent Marker">Marker</option>
                                                      <option value="Anton">Anton</option>
                                                      <option value="Oswald">Oswald</option>
                                                      <option value="Playfair Display">Playfair</option>
                                                    </select>
                                                  </div>
                                                )}
                                                <div className="relative">
                                                  <TextareaAutosize
                                                    value={activeRenderSpec.overlayText?.top || ""}
                                                    onChange={(e) => updateSpec(spec => { spec.overlayText.top = e.target.value; })}
                                                    className="w-full border border-gray-200 rounded-lg p-2.5 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-[#08c225]/20 resize-none bg-white"
                                                    minRows={1}
                                                  />
                                                  <button
                                                    onClick={() => handlePartialRegenerate(m.jobId!, m.id, 'caption')}
                                                    title="Regenerate Top Hook"
                                                    className="absolute right-2 bottom-2 p-1 text-gray-400 hover:text-[#08c225] transition-colors rounded hover:bg-[#08c225]/10"
                                                  >
                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
                                                  </button>
                                                </div>
                                                <div className="flex items-center gap-3 mt-3 px-1">
                                                  <span className="text-[10px] w-8 text-gray-400 font-bold uppercase tracking-wider">Y-Pos</span>
                                                  <input type="range" min="20" max="800" value={activeRenderSpec.overlayText?.style?.topY ?? 180} onChange={(e) => updateSpec(spec => { if (!spec.overlayText.style) spec.overlayText.style = {}; spec.overlayText.style.topY = parseInt(e.target.value); })} className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#08c225]" />
                                                </div>
                                                <div className="flex items-center gap-3 mt-3 px-1">
                                                  <span className="text-[10px] w-8 text-gray-400 font-bold uppercase tracking-wider">Opac</span>
                                                  <input type="range" min="0" max="1" step="0.05" value={activeRenderSpec.overlayText?.style?.topTextOpacity ?? 1} onChange={(e) => updateSpec(spec => { if (!spec.overlayText.style) spec.overlayText.style = {}; spec.overlayText.style.topTextOpacity = parseFloat(e.target.value); })} className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#08c225]" />
                                                </div>
                                                <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-gray-200/60">
                                                  <span className="text-[10px] w-8 text-gray-400 font-bold uppercase tracking-wider">Color</span>
                                                  <div className="flex items-center gap-2">
                                                    {['#ffffff', '#ffeb3b', '#00e5ff', '#ea284e'].map(color => (
                                                      <button
                                                        key={color}
                                                        onClick={() => updateSpec(spec => { if (!spec.overlayText.style) spec.overlayText.style = {}; spec.overlayText.style.topTextColor = color; })}
                                                        className={`w-5 h-5 rounded-full shadow-sm transition-all ${activeRenderSpec.overlayText?.style?.topTextColor === color ? 'ring-2 ring-offset-2 ring-[#08c225] scale-110' : 'border border-gray-200 hover:scale-110'}`}
                                                        style={{ backgroundColor: color }}
                                                      />
                                                    ))}
                                                    <div className="relative w-6 h-6 rounded-full border border-gray-200 overflow-hidden shadow-sm shrink-0 cursor-pointer hover:scale-110 transition-transform" style={{ background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)' }}>
                                                      <input
                                                        type="color"
                                                        value={activeRenderSpec.overlayText?.style?.topTextColor || '#ffffff'}
                                                        onChange={(e) => updateSpec(spec => { if (!spec.overlayText.style) spec.overlayText.style = {}; spec.overlayText.style.topTextColor = e.target.value; })}
                                                        className="absolute inset-0 w-[200%] h-[200%] -top-1/2 -left-1/2 cursor-pointer opacity-0"
                                                      />
                                                    </div>
                                                  </div>
                                                </div>
                                              </div>

                                              {/* Bottom CTA Section */}
                                              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                                                <div className="flex items-center justify-between mb-2">
                                                  <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Bottom CTA</label>
                                                  <div className="flex gap-3">
                                                    <label className="flex items-center gap-1.5 text-[11px] font-medium text-gray-500 cursor-pointer">
                                                      <input type="checkbox" checked={activeRenderSpec.overlayText?.showBottomText !== false} onChange={(e) => updateSpec(spec => { spec.overlayText.showBottomText = e.target.checked; })} className="rounded border-gray-300 text-[#08c225] focus:ring-[#08c225] w-3.5 h-3.5" /> Show
                                                    </label>
                                                    <label className="flex items-center gap-1.5 text-[11px] font-medium text-gray-500 cursor-pointer">
                                                      <input type="checkbox" checked={activeRenderSpec.overlayText?.style?.showBottomBackground !== false} onChange={(e) => updateSpec(spec => { if (!spec.overlayText.style) spec.overlayText.style = {}; spec.overlayText.style.showBottomBackground = e.target.checked; })} className="rounded border-gray-300 text-[#08c225] focus:ring-[#08c225] w-3.5 h-3.5" /> Bg
                                                    </label>
                                                  </div>
                                                </div>
                                                {activeRenderSpec.overlayText?.style?.linkFonts === false && (
                                                  <div className="mb-2">
                                                    <select
                                                      className="border border-gray-200 rounded-lg p-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#08c225]/20 w-full bg-white"
                                                      value={activeRenderSpec.overlayText?.style?.bottomFontFamily || activeRenderSpec.overlayText?.style?.fontFamily || "system-ui, -apple-system, sans-serif"}
                                                      onChange={(e) => {
                                                        if (e.target.value === 'upload_custom') {
                                                          setFontTargetMessageId(m.id);
                                                          setFontTargetSection('bottom');
                                                          fontFileInputRef.current?.click();
                                                          return;
                                                        }
                                                        updateSpec(spec => { if (!spec.overlayText.style) spec.overlayText.style = {}; spec.overlayText.style.bottomFontFamily = e.target.value; });
                                                      }}
                                                    >
                                                      <option value="system-ui, -apple-system, sans-serif">System</option>
                                                      {(activeRenderSpec.overlayText?.style?.bottomFontFamily?.startsWith('http') || activeRenderSpec.overlayText?.style?.fontFamily?.startsWith('http')) && (
                                                        <option value={activeRenderSpec.overlayText?.style?.bottomFontFamily || activeRenderSpec.overlayText?.style?.fontFamily}>Custom Font</option>
                                                      )}
                                                      <option value="upload_custom" className="text-[#08c225] font-semibold">Upload Custom Font...</option>
                                                      <option value="Montserrat">Montserrat</option>
                                                      <option value="Roboto">Roboto</option>
                                                      <option value="Bangers">Bangers</option>
                                                      <option value="Permanent Marker">Marker</option>
                                                      <option value="Anton">Anton</option>
                                                      <option value="Oswald">Oswald</option>
                                                      <option value="Playfair Display">Playfair</option>
                                                    </select>
                                                  </div>
                                                )}
                                                <div className="relative">
                                                  <TextareaAutosize
                                                    value={activeRenderSpec.overlayText?.bottom || ""}
                                                    onChange={(e) => updateSpec(spec => { spec.overlayText.bottom = e.target.value; })}
                                                    className="w-full border border-gray-200 rounded-lg p-2.5 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-[#08c225]/20 resize-none bg-white"
                                                    minRows={1}
                                                  />
                                                  <button
                                                    onClick={() => handlePartialRegenerate(m.jobId!, m.id, 'caption')}
                                                    title="Regenerate Bottom CTA"
                                                    className="absolute right-2 bottom-2 p-1 text-gray-400 hover:text-[#08c225] transition-colors rounded hover:bg-[#08c225]/10"
                                                  >
                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
                                                  </button>
                                                </div>
                                                <div className="flex items-center gap-3 mt-3 px-1">
                                                  <span className="text-[10px] w-8 text-gray-400 font-bold uppercase tracking-wider">Y-Pos</span>
                                                  <input type="range" min="20" max="800" value={activeRenderSpec.overlayText?.style?.bottomY ?? 180} onChange={(e) => updateSpec(spec => { if (!spec.overlayText.style) spec.overlayText.style = {}; spec.overlayText.style.bottomY = parseInt(e.target.value); })} className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#08c225]" />
                                                </div>
                                                <div className="flex items-center gap-3 mt-3 px-1">
                                                  <span className="text-[10px] w-8 text-gray-400 font-bold uppercase tracking-wider">Opac</span>
                                                  <input type="range" min="0" max="1" step="0.05" value={activeRenderSpec.overlayText?.style?.bottomTextOpacity ?? 1} onChange={(e) => updateSpec(spec => { if (!spec.overlayText.style) spec.overlayText.style = {}; spec.overlayText.style.bottomTextOpacity = parseFloat(e.target.value); })} className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#08c225]" />
                                                </div>
                                                <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-gray-200/60">
                                                  <span className="text-[10px] w-8 text-gray-400 font-bold uppercase tracking-wider">Color</span>
                                                  <div className="flex items-center gap-2">
                                                    {['#ffffff', '#ffeb3b', '#00e5ff', '#ea284e'].map(color => (
                                                      <button
                                                        key={color}
                                                        onClick={() => updateSpec(spec => { if (!spec.overlayText.style) spec.overlayText.style = {}; spec.overlayText.style.bottomTextColor = color; })}
                                                        className={`w-5 h-5 rounded-full shadow-sm transition-all ${activeRenderSpec.overlayText?.style?.bottomTextColor === color ? 'ring-2 ring-offset-2 ring-[#08c225] scale-110' : 'border border-gray-200 hover:scale-110'}`}
                                                        style={{ backgroundColor: color }}
                                                      />
                                                    ))}
                                                    <div className="relative w-6 h-6 rounded-full border border-gray-200 overflow-hidden shadow-sm shrink-0 cursor-pointer hover:scale-110 transition-transform" style={{ background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)' }}>
                                                      <input
                                                        type="color"
                                                        value={activeRenderSpec.overlayText?.style?.bottomTextColor || '#ffffff'}
                                                        onChange={(e) => updateSpec(spec => { if (!spec.overlayText.style) spec.overlayText.style = {}; spec.overlayText.style.bottomTextColor = e.target.value; })}
                                                        className="absolute inset-0 w-[200%] h-[200%] -top-1/2 -left-1/2 cursor-pointer opacity-0"
                                                      />
                                                    </div>
                                                  </div>
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        )}

                                        {/* Meme Tab */}
                                        {(activeTabs[m.id] || 'captions') === 'meme' && (
                                          <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
                                            {/* Meme Options & Search Panel */}
                                            <div className="w-full p-4 bg-white border border-gray-200 rounded-[16px] text-sm shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
                                              <div className="font-semibold text-gray-700 mb-3 flex items-center justify-between">
                                                <span>Meme Options</span>
                                              </div>

                                              {/* Search Input */}
                                              <div className="flex items-center gap-2 mb-4">
                                                <input
                                                  type="text"
                                                  placeholder="Search new meme..."
                                                  value={gifSearchQuery}
                                                  onChange={(e) => setGifSearchQuery(e.target.value)}
                                                  onKeyDown={(e) => { if (e.key === 'Enter') handleSearchGif(m.id); }}
                                                  className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#08c225]/20"
                                                />
                                                <button
                                                  onClick={() => handleSearchGif(m.id)}
                                                  disabled={isSearchingGif || !gifSearchQuery.trim()}
                                                  className="px-3 py-2 bg-[#08c225] text-white rounded-lg text-sm font-semibold hover:bg-[#00b33c] disabled:opacity-50 transition-colors"
                                                >
                                                  {isSearchingGif ? '...' : 'Search'}
                                                </button>
                                              </div>

                                              {/* Options Carousel */}
                                              {activeRenderSpec.gifOverlay?.options && activeRenderSpec.gifOverlay.options.length > 0 && (
                                                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
                                                  {activeRenderSpec.gifOverlay.options.map((optUrl: string, idx: number) => (
                                                    <button
                                                      key={idx}
                                                      onClick={() => updateSpec(spec => { if (!spec.gifOverlay) spec.gifOverlay = { url: "" }; spec.gifOverlay.url = optUrl; })}
                                                      className={`shrink-0 w-16 h-16 rounded-xl overflow-hidden transition-all ${activeRenderSpec.gifOverlay?.url === optUrl ? 'border-2 border-[#08c225] scale-105' : 'border border-gray-100 hover:border-gray-300'}`}
                                                    >
                                                      <img src={optUrl} alt="meme option" className="w-full h-full object-cover" />
                                                    </button>
                                                  ))}
                                                </div>
                                              )}
                                            </div>

                                            {/* Styling Panel & Meme Toggle */}
                                            <div className="w-full p-4 bg-white border border-gray-200 rounded-[16px] text-sm shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
                                              <div className="font-semibold text-gray-700 mb-4 flex items-center justify-between">
                                                <span>Meme Position</span>
                                                <label className="flex items-center gap-2 text-xs font-medium text-gray-500 cursor-pointer">
                                                  <input type="checkbox" checked={activeRenderSpec.gifOverlay?.showGifLayer !== false} onChange={(e) => updateSpec(spec => { if (!spec.gifOverlay) spec.gifOverlay = { url: "" }; spec.gifOverlay.showGifLayer = e.target.checked; })} className="rounded border-gray-300 text-[#08c225] focus:ring-[#08c225]" /> Show
                                                </label>
                                              </div>

                                              <div className="flex flex-col gap-3 bg-gray-50 p-3 rounded-xl border border-gray-100">
                                                <div className="flex items-center gap-3 px-1">
                                                  <span className="text-[10px] w-6 text-gray-400 font-bold uppercase tracking-wider">Left</span>
                                                  <input type="range" min="-400" max="400" value={activeRenderSpec.gifOverlay?.style?.x ?? 0} onChange={(e) => updateSpec(spec => { if (!spec.gifOverlay.style) spec.gifOverlay.style = {}; spec.gifOverlay.style.x = parseInt(e.target.value); })} className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#08c225]" />
                                                </div>
                                                <div className="flex items-center gap-3 px-1">
                                                  <span className="text-[10px] w-6 text-gray-400 font-bold uppercase tracking-wider">Top</span>
                                                  <input type="range" min="-600" max="600" value={activeRenderSpec.gifOverlay?.style?.y ?? 0} onChange={(e) => updateSpec(spec => { if (!spec.gifOverlay.style) spec.gifOverlay.style = {}; spec.gifOverlay.style.y = parseInt(e.target.value); })} className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#08c225]" />
                                                </div>
                                                <div className="flex items-center gap-3 px-1">
                                                  <span className="text-[10px] w-6 text-gray-400 font-bold uppercase tracking-wider">Zoom</span>
                                                  <input type="range" min="0.5" max="3" step="0.1" value={activeRenderSpec.gifOverlay?.style?.scale ?? 1} onChange={(e) => updateSpec(spec => { if (!spec.gifOverlay.style) spec.gifOverlay.style = {}; spec.gifOverlay.style.scale = parseFloat(e.target.value); })} className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#08c225]" />
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        )}
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
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M7.498 15.25H4.372c-1.026 0-1.945-.694-2.054-1.715a12.137 12.137 0 0 1-.068-1.285c0-2.848.992-5.464 2.649-7.521C5.287 4.247 5.886 4 6.504 4h4.016a4.5 4.5 0 0 1 1.423.23l3.114 1.04a4.5 4.5 0 0 0 1.423.23h1.294M7.498 15.25c.618 0 .991.724.725 1.282A7.471 7.471 0 0 0 7.5 19.75 2.25 2.25 0 0 0 9.75 22a.75.75 0 0 0 .75-.75v-.633c0-.79.364-1.543.985-2.072a4.498 4.498 0 0 1 1.672-.322m0-8.473h1.25m-1.25 8.473c.806 0 1.533.446 2.031 1.08a9.041 9.041 0 0 0 2.861 2.4c.723.384 1.35.956 1.653 1.715M16.5 10.75c-.083-.205-.173-.405-.27-.602-.197-.4.078-.898.523-.898h.908c.889 0 1.713.518 1.972 1.368.339 1.11.521 2.287.521 3.507 0 1.553-.295 3.036-.831 4.398-.352.886-1.132 1.339-1.965 1.339h-1.053c-.472 0-.745-.556-.5-.96a8.958 8.958 0 0 0 1.302-4.665c0-1.194-.232-2.333-.654-3.375Z" /></svg>
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
                                                navigator.clipboard.writeText(m.job!.product_json.chat_reply);
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
                                {m.job?.status ? m.job.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Thinking...'}
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
          </main>

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
                    onChange={handleFileChange}
                  />
                  <input
                    type="file"
                    ref={fontFileInputRef}
                    className="hidden"
                    accept=".ttf,.otf"
                    onChange={handleFontUpload}
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
        </div>

        {/* Canvas Pane */}
        {activeArtifact && (
          <ArtifactCanvas
            artifact={activeArtifact as any}
            onClose={() => setActiveArtifact(null)}
          />
        )}

      </div>

      {/* Feedback Modal */}
      {feedbackModalState && (
        <div className="fixed inset-0 bg-black/20 z-50 flex items-center justify-center animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-[#282828] mb-2">Provide Additional Feedback</h3>
            <p className="text-sm text-gray-500 mb-4">What was the issue? This helps us improve Motif.</p>

            <div className="flex gap-2 mb-4">
              <button onClick={() => setFeedbackReason(prev => prev.includes("Inaccurate") ? prev.replace("Inaccurate", "").trim() : (prev ? prev + " Inaccurate" : "Inaccurate"))} className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors border ${feedbackReason.includes("Inaccurate") ? 'bg-green-50 text-green-700 border-green-200' : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-200'}`}>Inaccurate</button>
              <button onClick={() => setFeedbackReason(prev => prev.includes("Buggy Code") ? prev.replace("Buggy Code", "").trim() : (prev ? prev + " Buggy Code" : "Buggy Code"))} className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors border ${feedbackReason.includes("Buggy Code") ? 'bg-green-50 text-green-700 border-green-200' : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-200'}`}>Buggy Code</button>
              <button onClick={() => setFeedbackReason(prev => prev.includes("Refusal") ? prev.replace("Refusal", "").trim() : (prev ? prev + " Refusal" : "Refusal"))} className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors border ${feedbackReason.includes("Refusal") ? 'bg-green-50 text-green-700 border-green-200' : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-200'}`}>Refusal</button>
            </div>

            <textarea
              className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-[#08c225] focus:ring-1 focus:ring-[#08c225] resize-none mb-4"
              rows={3}
              placeholder="Optional comments..."
              value={feedbackReason}
              onChange={(e) => setFeedbackReason(e.target.value)}
            />

            <div className="flex justify-end gap-2">
              <button onClick={() => setFeedbackModalState(null)} className="px-4 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-50 rounded-xl transition-colors">Skip</button>
              <button onClick={submitFeedbackReason} className="px-4 py-2 text-sm font-semibold text-white bg-[#08c225] hover:bg-[#00b33c] rounded-xl transition-colors">Submit</button>
            </div>
          </div>
        </div>
      )}

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
      {/* Image Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center animate-in fade-in duration-200 p-4"
          onClick={() => setPreviewImage(null)}
        >
          <button
            className="absolute top-6 right-6 p-2 text-white/70 hover:text-white bg-black/40 hover:bg-black/60 rounded-full transition-all"
            onClick={() => setPreviewImage(null)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          <img
            src={previewImage}
            alt="Preview"
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl cursor-default"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Shared Links Dashboard Modal */}
      {sharedLinksModalOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setSharedLinksModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in slide-in-from-bottom-4 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-blue-500">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[#282828]">Shared Links Dashboard</h2>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mt-0.5">Manage your public chats</p>
                </div>
              </div>
              <button
                onClick={() => setSharedLinksModalOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-white">
              {loadingSharedLinks ? (
                <div className="flex flex-col items-center justify-center h-40 gap-4">
                  <div className="w-8 h-8 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
                  <div className="text-sm font-medium text-gray-500">Loading your shared links...</div>
                </div>
              ) : sharedLinks.length === 0 ? (
                <div className="text-center py-12 flex flex-col items-center">
                  <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-gray-400">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                    </svg>
                  </div>
                  <h3 className="text-[#282828] font-bold text-lg mb-2">No active shared links</h3>
                  <p className="text-gray-500 text-sm max-w-xs">When you share a chat, it will appear here so you can easily copy the link or revoke access later.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {sharedLinks.map(link => {
                    const firstUserMsg = link.messages_json?.find((m: any) => m.role === 'user');
                    const title = firstUserMsg ? firstUserMsg.content : 'Untitled Chat';
                    const url = `${window.location.origin}/share/${link.id}`;

                    return (
                      <div key={link.id} className="bg-white border border-gray-100 shadow-sm rounded-xl p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center hover:border-gray-300 transition-colors">
                        <div className="flex-1 min-w-0 w-full">
                          <div className="font-bold text-[#282828] truncate mb-1">{title}</div>
                          <div className="flex items-center gap-3 text-xs font-medium text-gray-500">
                            <span className="flex items-center gap-1">
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              {new Date(link.created_at).toLocaleDateString()}
                            </span>
                            <span className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded text-[10px] uppercase tracking-wider font-bold">Public</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(url);
                              setToast('Link copied to clipboard!');
                              setTimeout(() => setToast(null), 3000);
                            }}
                            className="flex-1 sm:flex-none px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-semibold rounded-lg border border-gray-200 transition-colors flex items-center justify-center gap-1.5"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" /></svg>
                            Copy
                          </button>
                          <button
                            onClick={() => setLinkToDisable(link.id)}
                            className="flex-1 sm:flex-none px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold rounded-lg border border-red-100 transition-colors flex items-center justify-center gap-1.5"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                            Disable
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal */}
      {linkToDisable && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setLinkToDisable(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-[#282828] mb-2">Disable Link?</h3>
              <p className="text-sm text-gray-500 mb-6 leading-relaxed">This will instantly revoke public access. Anyone with the link will no longer be able to view this chat. This action cannot be undone.</p>
              <div className="flex gap-3 w-full">
                <button onClick={() => setLinkToDisable(null)} className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-[#282828] font-semibold text-sm rounded-xl transition-colors">Cancel</button>
                <button onClick={() => deleteSharedLink(linkToDisable)} className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white font-semibold text-sm rounded-xl transition-colors shadow-sm">Disable Link</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-[#282828] text-white px-5 py-3 rounded-full shadow-2xl text-sm font-medium animate-in fade-in slide-in-from-bottom-6 duration-300 z-[200] flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-[#08c225]">
            <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
          </svg>
          {toast}
        </div>
      )}
    </div>
  );
}
