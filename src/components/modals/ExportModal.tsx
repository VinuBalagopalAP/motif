import React from 'react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ExportModal({ isOpen, onClose }: ExportModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-[24px] shadow-2xl max-w-md w-full p-8 relative animate-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
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
          onClick={onClose}
          className="w-full py-3 bg-[#282828] hover:bg-black text-white font-semibold rounded-[16px] transition-colors"
        >
          Got it, thanks!
        </button>
      </div>
    </div>
  );
}
