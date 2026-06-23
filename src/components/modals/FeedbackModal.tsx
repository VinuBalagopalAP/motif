import React from 'react';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  feedbackReason: string;
  setFeedbackReason: React.Dispatch<React.SetStateAction<string>>;
  submitFeedbackReason: () => void;
}

export function FeedbackModal({
  isOpen,
  onClose,
  feedbackReason,
  setFeedbackReason,
  submitFeedbackReason
}: FeedbackModalProps) {
  if (!isOpen) return null;

  const toggleReason = (reason: string) => {
    setFeedbackReason(prev => 
      prev.includes(reason) 
        ? prev.replace(reason, "").trim() 
        : (prev ? prev + " " + reason : reason)
    );
  };

  const getReasonClass = (reason: string) => {
    return `px-3 py-1.5 text-xs font-semibold rounded-full transition-colors border ${
      feedbackReason.includes(reason) 
        ? 'bg-green-50 text-green-700 border-green-200' 
        : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-200'
    }`;
  };

  return (
    <div className="fixed inset-0 bg-black/20 z-50 flex items-center justify-center animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl animate-in zoom-in-95 duration-200">
        <h3 className="text-lg font-bold text-[#282828] mb-2">Provide Additional Feedback</h3>
        <p className="text-sm text-gray-500 mb-4">What was the issue? This helps us improve Motif.</p>

        <div className="flex gap-2 mb-4">
          <button onClick={() => toggleReason("Inaccurate")} className={getReasonClass("Inaccurate")}>Inaccurate</button>
          <button onClick={() => toggleReason("Buggy Code")} className={getReasonClass("Buggy Code")}>Buggy Code</button>
          <button onClick={() => toggleReason("Refusal")} className={getReasonClass("Refusal")}>Refusal</button>
        </div>

        <textarea
          className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-[#08c225] focus:ring-1 focus:ring-[#08c225] resize-none mb-4"
          rows={3}
          placeholder="Optional comments..."
          value={feedbackReason}
          onChange={(e) => setFeedbackReason(e.target.value)}
        />

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-50 rounded-xl transition-colors">Skip</button>
          <button onClick={submitFeedbackReason} className="px-4 py-2 text-sm font-semibold text-white bg-[#08c225] hover:bg-[#00b33c] rounded-xl transition-colors">Submit</button>
        </div>
      </div>
    </div>
  );
}
