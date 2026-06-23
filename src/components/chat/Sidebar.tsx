import type { Job } from "@/types";

interface SidebarProps {
  user: any;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  setActiveChatId: (id: string | null) => void;
  setMessages: (messages: any[]) => void;
  historyJobs: Job[];
  loadJob: (job: Job) => void;
  deleteJob: (id: string) => void;
  settingsMenuOpen: boolean;
  setSettingsMenuOpen: (open: boolean) => void;
  setSharedLinksModalOpen: (open: boolean) => void;
  handleLogout: () => void;
}

export function Sidebar({
  user,
  mobileMenuOpen,
  setMobileMenuOpen,
  sidebarOpen,
  setSidebarOpen,
  setActiveChatId,
  setMessages,
  historyJobs,
  loadJob,
  deleteJob,
  settingsMenuOpen,
  setSettingsMenuOpen,
  setSharedLinksModalOpen,
  handleLogout
}: SidebarProps) {
  return (
    <>
      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-40 md:hidden animate-in fade-in duration-200"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Container */}
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
            <div className="text-sm font-medium text-[#757575] truncate pr-2">{user?.email}</div>

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
    </>
  );
}
