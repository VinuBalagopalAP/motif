"use client";
import React, { useRef, useEffect } from 'react';
import { useParams, useRouter } from "next/navigation";
import { useAuth } from '@/components/AuthProvider';
import { useAppStore } from '@/store/useAppStore';
import { useChatStore } from '@/store/useChatStore';
import { useChatActions } from '@/hooks/useChatActions';

import { ExportModal } from '@/components/modals/ExportModal';
import { SharedLinksModal } from '@/components/modals/SharedLinksModal';
import { ImagePreviewModal } from '@/components/modals/ImagePreviewModal';
import { ConfirmDisableModal } from '@/components/modals/ConfirmDisableModal';
import { FeedbackModal } from '@/components/modals/FeedbackModal';
import { ChatFeed } from '@/components/chat/ChatFeed';
import { ChatInput } from '@/components/chat/ChatInput';
import { Sidebar } from '@/components/chat/Sidebar';
import { Dashboard } from '@/components/Dashboard';
import { ArtifactCanvas } from "@/components/ArtifactCanvas";

export default function ChatApp() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading, session } = useAuth();
  
  const {
    activeView, setActiveView,
    sidebarOpen, setSidebarOpen,
    mobileMenuOpen, setMobileMenuOpen,
    exportModalOpen, setExportModalOpen,
    sharedLinksModalOpen, setSharedLinksModalOpen,
    activeArtifact, setActiveArtifact,
    previewImage, setPreviewImage,
    toast, setToast,
    feedbackModalState, setFeedbackModalState,
    feedbackReason, setFeedbackReason,
    sharingJobId,
    sharedLinks,
    loadingSharedLinks,
    linkToDisable, setLinkToDisable
  } = useAppStore();

  const { messages, historyJobs, loadJob, fetchHistory } = useChatStore();
  const { handleShareEntireChat, submitFeedbackReason, deleteSharedLink, fetchSharedLinks } = useChatActions();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const fontFileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initialChatIdLoaded = useRef(false);
  const prevMessagesLength = useRef(0);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault();
        setSidebarOpen(!sidebarOpen);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sidebarOpen, setSidebarOpen]);

  useEffect(() => {
    if (sharedLinksModalOpen && session?.access_token) {
      fetchSharedLinks();
    }
  }, [sharedLinksModalOpen, session?.access_token, fetchSharedLinks]);

  useEffect(() => {
    if (user) {
      fetchHistory(user);
    }
  }, [user, fetchHistory]);

  useEffect(() => {
    if (user && historyJobs.length > 0 && !initialChatIdLoaded.current) {
      const chatIdArray = params?.chatId as string[] | undefined;
      if (chatIdArray && chatIdArray[0] === 'c' && chatIdArray[1]) {
        const jobId = chatIdArray[1];
        const job = historyJobs.find(j => j.id === jobId);
        if (job) {
          loadJob(job, setActiveView, setMobileMenuOpen);
          initialChatIdLoaded.current = true;
        } else {
          window.history.replaceState(null, '', '/');
        }
      } else {
        initialChatIdLoaded.current = true;
      }
    }
  }, [user, historyJobs, params, loadJob, setActiveView, setMobileMenuOpen]);

  useEffect(() => {
    const isStreaming = messages.some(m => (m.job?.status as any) === 'Streaming text...');
    if (isStreaming || messages.length > prevMessagesLength.current) {
      const main = document.getElementById("chat-main");
      if (main) {
        main.scrollTo({ top: main.scrollHeight, behavior: "smooth" });
      }
    }
    prevMessagesLength.current = messages.length;
  }, [messages]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (event: PromiseRejectionEvent) => {
      if (event.reason && (event.reason.name === 'EncodingError' || (event.reason.message && event.reason.message.includes('EncodingError')))) {
        event.preventDefault(); 
      }
    };
    window.addEventListener('unhandledrejection', handler);
    return () => window.removeEventListener('unhandledrejection', handler);
  }, []);

  if (authLoading || !user) {
    return <div className="h-screen flex items-center justify-center bg-gray-50 text-gray-400">Loading workspace...</div>;
  }

  return (
    <div className="flex h-[100dvh] bg-[#ffffff] text-[#282828] font-sans selection:bg-[#c3f3b9]">
      <Sidebar />

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

        {/* Dashboard View */}
        <div className={`flex-1 w-full h-full overflow-hidden ${activeView === 'dashboard' ? 'block' : 'hidden'}`}>
          <Dashboard jobs={historyJobs} onSelectJob={(job, messageId) => { 
            loadJob(job, setActiveView, setMobileMenuOpen); 
            if (messageId) {
              setTimeout(() => {
                const el = document.getElementById(`message-${messageId}`);
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  el.classList.add('animate-pulse');
                  setTimeout(() => el.classList.remove('animate-pulse'), 2000);
                }
              }, 300); // Wait for chat view to render
            }
          }} />
        </div>

        {/* Chat Feed View */}
        <div className={`flex flex-col min-w-0 h-full relative transition-all duration-300 ease-in-out ${activeArtifact ? 'w-full md:w-[45%] max-w-[600px] min-w-[350px] border-r border-gray-100 hidden md:flex flex-shrink-0' : 'w-full flex-1'} ${activeView === 'dashboard' ? '!hidden' : ''}`}>
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
              </button>
            </div>
          )}

          <main id="chat-main" className="flex-1 overflow-y-auto p-4 sm:p-6 pb-0" style={{ maskImage: 'linear-gradient(to bottom, black calc(100% - 120px), transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, black calc(100% - 120px), transparent 100%)' }}>
            <ChatFeed
              fontFileInputRef={fontFileInputRef}
              messagesEndRef={messagesEndRef}
            />
          </main>

          <ChatInput
            fileInputRef={fileInputRef}
            fontFileInputRef={fontFileInputRef}
          />
        </div>

        {/* Canvas Pane */}
        {activeArtifact && (
          <ArtifactCanvas
            artifact={activeArtifact as any}
            onClose={() => setActiveArtifact(null)}
          />
        )}

      </div>

      <FeedbackModal
        isOpen={!!feedbackModalState}
        onClose={() => setFeedbackModalState(null)}
        feedbackReason={feedbackReason}
        setFeedbackReason={setFeedbackReason}
        submitFeedbackReason={submitFeedbackReason}
      />

      {/* Export Explainer Modal */}
      <ExportModal isOpen={exportModalOpen} onClose={() => setExportModalOpen(false)} />
      <ImagePreviewModal imageUrl={previewImage} onClose={() => setPreviewImage(null)} />

      {/* Shared Links Dashboard Modal */}
      <SharedLinksModal
        isOpen={sharedLinksModalOpen}
        onClose={() => setSharedLinksModalOpen(false)}
        loadingSharedLinks={loadingSharedLinks}
        sharedLinks={sharedLinks}
        setToast={(msg: string | null) => {
          setToast(msg);
          if (msg) setTimeout(() => setToast(null), 3000);
        }}
        setLinkToDisable={setLinkToDisable}
      />

      {/* Custom Confirmation Modal */}
      <ConfirmDisableModal
        linkId={linkToDisable}
        onCancel={() => setLinkToDisable(null)}
        onConfirm={deleteSharedLink}
      />

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