import { useAuth } from "@/components/AuthProvider";
import { useAppStore } from "@/store/useAppStore";
import { useChatStore, Message } from "@/store/useChatStore";
import { supabase } from "@/lib/supabase";

export function useChatActions() {
  const { user, session } = useAuth();

  const {
    messages, setMessages,
    setLoading, loading,
    activeChatId, setActiveChatId,
    attachments, setAttachments,
    fontTargetMessageId, setFontTargetMessageId,
    fontTargetSection, setFontTargetSection,
    setIsUploadingFont, fetchHistory
  } = useChatStore();

  const {
    setToast,
    setFeedbackModalState,
    feedbackModalState,
    feedbackReason,
    setSharingJobId,
    sharedLinks,
    setSharedLinks,
    setLoadingSharedLinks,
    setLinkToDisable,
    setUploadingFiles,
    uploadingFiles,
  } = useAppStore();

  const handleFontUpload = async (e: React.ChangeEvent<HTMLInputElement>, fontFileInputRef: React.RefObject<HTMLInputElement | null>) => {
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

          if (!spec.overlayText) spec.overlayText = {};
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

  const handleFeedback = async (msgId: string, jobId: string, index: number, variantIndex: number, isPositive: boolean) => {
    if (!session) return;
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
      if (res.ok && data.feedbackId) {
        if (!isPositive) {
          setFeedbackModalState({ isOpen: true, feedbackId: data.feedbackId, job_id: jobId, index, is_positive: isPositive });
        }
      }
    } catch (e) {
      console.error("Failed to submit feedback", e);
    }
  };

  const submitFeedbackReason = async () => {
    if (!feedbackModalState || !session) return;
    try {
      const res = await fetch('/api/feedback', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ feedbackId: feedbackModalState.feedbackId, reason: feedbackReason })
      });
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

  const deleteSharedLink = async (id: string) => {
    try {
      const res = await fetch(`/api/shares/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (res.ok) {
        setSharedLinks(sharedLinks.filter(link => link.id !== id));
        setToast('Link disabled successfully');
        setTimeout(() => setToast(null), 3000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLinkToDisable(null);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, fileInputRef: React.RefObject<HTMLInputElement | null>) => {
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
        fetchHistory(user);
      } else {
        const data = await res.json();
        if (!activeChatId && data.chatId) {
          setActiveChatId(data.chatId);
          window.history.replaceState(null, '', `/c/${data.chatId}`);
        }
        setMessages(prev => prev.map(m =>
          m.id === assistantMessage.id ? { ...m, jobId: data.jobId } : m
        ));
        fetchHistory(user);
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
          fetchHistory(user); 
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
    } catch (e) {
      console.error(e);
    }
  };

  const handleEditSubmit = async (msgId: string, newMessage: string, oldContent: string) => {
    if (newMessage.trim() === oldContent || !newMessage.trim()) return;
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
        fetchHistory(user);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return {
    handleFontUpload,
    handleFeedback,
    submitFeedbackReason,
    handleShare,
    handleShareEntireChat,
    handleShareSingleMessage,
    fetchSharedLinks,
    deleteSharedLink,
    handleFileChange,
    runGeneration,
    handleRegenerate,
    handlePartialRegenerate,
    handleEditSubmit
  };
}
