import { create } from 'zustand';

export interface ParsedArtifact {
  id: string;
  identifier: string;
  type: string;
  title: string;
  content: string;
  isGenerating?: boolean;
}

interface FeedbackModalState {
  isOpen: boolean;
  feedbackId: string;
  job_id: string;
  index: number;
  is_positive: boolean;
}

interface AppState {
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  exportModalOpen: boolean;
  setExportModalOpen: (open: boolean) => void;
  activeArtifact: ParsedArtifact | null;
  setActiveArtifact: (artifact: ParsedArtifact | null) => void;
  previewImage: string | null;
  setPreviewImage: (image: string | null) => void;
  toast: string | null;
  setToast: (toast: string | null) => void;
  activeView: 'chat' | 'dashboard';
  setActiveView: (view: 'chat' | 'dashboard') => void;
  feedbackModalState: FeedbackModalState | null;
  setFeedbackModalState: (state: FeedbackModalState | null) => void;
  feedbackReason: string;
  setFeedbackReason: (reason: string | ((prev: string) => string)) => void;
  activeMenuId: string | null;
  setActiveMenuId: (id: string | null) => void;
  sharingJobId: string | null;
  setSharingJobId: (id: string | null) => void;
  sharedLinksModalOpen: boolean;
  setSharedLinksModalOpen: (open: boolean) => void;
  sharedLinks: any[];
  setSharedLinks: (links: any[]) => void;
  loadingSharedLinks: boolean;
  setLoadingSharedLinks: (loading: boolean) => void;
  linkToDisable: string | null;
  setLinkToDisable: (id: string | null) => void;
  settingsMenuOpen: boolean;
  setSettingsMenuOpen: (open: boolean) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  uploadingFiles: boolean;
  setUploadingFiles: (uploading: boolean) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  mobileMenuOpen: false,
  setMobileMenuOpen: (open) => set({ mobileMenuOpen: open }),
  exportModalOpen: false,
  setExportModalOpen: (open) => set({ exportModalOpen: open }),
  activeArtifact: null,
  setActiveArtifact: (artifact) => set({ activeArtifact: artifact }),
  previewImage: null,
  setPreviewImage: (image) => set({ previewImage: image }),
  toast: null,
  setToast: (toast) => set({ toast }),
  activeView: 'chat',
  setActiveView: (view) => set({ activeView: view }),
  feedbackModalState: null,
  setFeedbackModalState: (state) => set({ feedbackModalState: state }),
  feedbackReason: "",
  setFeedbackReason: (reason) => set((state) => ({ feedbackReason: typeof reason === 'function' ? reason(state.feedbackReason) : reason })),
  activeMenuId: null,
  setActiveMenuId: (id) => set({ activeMenuId: id }),
  sharingJobId: null,
  setSharingJobId: (id) => set({ sharingJobId: id }),
  sharedLinksModalOpen: false,
  setSharedLinksModalOpen: (open) => set({ sharedLinksModalOpen: open }),
  sharedLinks: [],
  setSharedLinks: (links) => set({ sharedLinks: links }),
  loadingSharedLinks: false,
  setLoadingSharedLinks: (loading) => set({ loadingSharedLinks: loading }),
  linkToDisable: null,
  setLinkToDisable: (id) => set({ linkToDisable: id }),
  settingsMenuOpen: false,
  setSettingsMenuOpen: (open) => set({ settingsMenuOpen: open }),
  sidebarOpen: true,
  setSidebarOpen: (open) => set((state) => ({ sidebarOpen: typeof open === 'function' ? open(state.sidebarOpen) : open })),
  uploadingFiles: false,
  setUploadingFiles: (uploading) => set({ uploadingFiles: uploading }),
}));
