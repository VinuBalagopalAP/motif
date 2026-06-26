import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { Job } from '@/types';

export type Message = {
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

interface ChatState {
  messages: Message[];
  setMessages: (messages: Message[] | ((prev: Message[]) => Message[])) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  historyJobs: Job[];
  setHistoryJobs: (jobs: Job[] | ((prev: Job[]) => Job[])) => void;
  activeChatId: string | null;
  setActiveChatId: (id: string | null) => void;
  attachments: { url: string; type: string; name: string }[];
  setAttachments: (attachments: { url: string; type: string; name: string }[] | ((prev: { url: string; type: string; name: string }[]) => { url: string; type: string; name: string }[])) => void;
  fontTargetMessageId: string | null;
  setFontTargetMessageId: (id: string | null) => void;
  fontTargetSection: 'linked' | 'top' | 'bottom' | null;
  setFontTargetSection: (section: 'linked' | 'top' | 'bottom' | null) => void;
  isUploadingFont: boolean;
  setIsUploadingFont: (isUploading: boolean) => void;
  
  // Actions that don't strictly require session/user can be here
  fetchHistory: (user: any) => Promise<void>;
  deleteJob: (jobId: string) => Promise<void>;
  stopJob: (jobId: string) => Promise<void>;
  loadJob: (job: Job, setActiveView: (view: 'chat' | 'dashboard') => void, setMobileMenuOpen: (open: boolean) => void) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  setMessages: (msgs) => set((state) => ({ messages: typeof msgs === 'function' ? msgs(state.messages) : msgs })),
  loading: false,
  setLoading: (loading) => set({ loading }),
  historyJobs: [],
  setHistoryJobs: (jobs) => set((state) => ({ historyJobs: typeof jobs === 'function' ? jobs(state.historyJobs) : jobs })),
  activeChatId: null,
  setActiveChatId: (id) => set({ activeChatId: id }),
  attachments: [],
  setAttachments: (atts) => set((state) => ({ attachments: typeof atts === 'function' ? atts(state.attachments) : atts })),
  fontTargetMessageId: null,
  setFontTargetMessageId: (id) => set({ fontTargetMessageId: id }),
  fontTargetSection: null,
  setFontTargetSection: (section) => set({ fontTargetSection: section }),
  isUploadingFont: false,
  setIsUploadingFont: (isUploading) => set({ isUploadingFont: isUploading }),

  fetchHistory: async (user: any) => {
    if (!user) return;
    const { data, error } = await supabase
      .from('video_jobs')
      .select('*, messages(*)')
      .order('created_at', { ascending: false });

    if (data) {
      set({ historyJobs: data });
    }
  },

  deleteJob: async (jobId: string) => {
    try {
      const { error } = await supabase
        .from('video_jobs')
        .delete()
        .eq('id', jobId);

      if (!error) {
        set((state) => ({
          historyJobs: state.historyJobs.filter(job => job.id !== jobId),
          messages: state.messages.some(m => m.jobId === jobId) ? [] : state.messages
        }));
      }
    } catch (e) {
      console.error("Failed to delete job:", e);
    }
  },

  stopJob: async (jobId: string) => {
    try {
      const { error } = await supabase
        .from('video_jobs')
        .update({ status: 'error', error: 'Cancelled by user' })
        .eq('id', jobId);

      if (!error) {
        set((state) => ({
          messages: state.messages.map(m =>
            m.jobId === jobId && m.job ? { ...m, job: { ...m.job, status: 'error', error: 'Cancelled by user' } } : m
          )
        }));
      }
    } catch (e) {
      console.error("Failed to stop job:", e);
    }
  },

  loadJob: (job: Job, setActiveView, setMobileMenuOpen) => {
    window.history.pushState(null, '', `/c/${job.id}`);
    set({ activeChatId: job.id });
    setActiveView('chat');
    
    // Map messages
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

    set({ messages: mapMessages(job) });
    setMobileMenuOpen(false);
  }
}));
