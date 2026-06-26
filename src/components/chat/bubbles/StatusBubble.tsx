import React from 'react';

interface StatusBubbleProps {
  message: any;
  stopJob: (jobId: string) => void;
}

export function StatusBubble({ message: m, stopJob }: StatusBubbleProps) {
  if (m.job?.status === 'error') {
    return (
      <div className="bg-red-50 text-red-600 rounded-[16px] p-4 text-sm flex items-center gap-3 font-medium border border-red-100">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span>Error: {m.job.error}</span>
      </div>
    );
  }

  if (m.job?.status === 'started' || m.job?.status === 'queued' || !m.job) {
    return (
      <div className="bg-white text-[#757575] rounded-[24px] px-6 py-4 font-medium text-sm border border-gray-100 shadow-sm w-fit max-w-[80%] flex items-center gap-2">
        <div className="w-4 h-4 border-2 border-gray-200 border-t-[#08c225] rounded-full animate-spin"></div>
        {m.job?.status ? m.job.status.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) : 'Thinking...'}
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden bg-[#f9f9fa] border border-gray-100 rounded-[24px] w-[320px] h-[569px] flex flex-col items-center justify-center mt-2">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/50 to-transparent h-full w-full animate-[shimmer-slide_3s_ease-in-out_infinite]"></div>
      <div className="relative z-10 flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-gray-200 border-t-[#08c225] rounded-full animate-spin"></div>
        <div className="text-sm font-medium text-[#757575] max-w-[200px] text-center">
          {m.job?.status === 'switching_model' ? 'Switching model...' :
            m.job?.status === 'scraping' ? 'Analyzing source...' :
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
  );
}
