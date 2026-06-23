import React from 'react';

interface ConfirmDisableModalProps {
  linkId: string | null;
  onCancel: () => void;
  onConfirm: (id: string) => void;
}

export function ConfirmDisableModal({ linkId, onCancel, onConfirm }: ConfirmDisableModalProps) {
  if (!linkId) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onCancel}>
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
            <button onClick={onCancel} className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-[#282828] font-semibold text-sm rounded-xl transition-colors">Cancel</button>
            <button onClick={() => onConfirm(linkId)} className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white font-semibold text-sm rounded-xl transition-colors shadow-sm">Disable Link</button>
          </div>
        </div>
      </div>
    </div>
  );
}
