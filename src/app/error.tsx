'use client'; // Error boundaries must be Client Components

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-zinc-950 text-white font-sans">
      <div className="max-w-md text-center p-8 border border-zinc-800 rounded-xl bg-zinc-900 shadow-2xl">
        <div className="mb-6 flex justify-center">
          <div className="h-16 w-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center border border-red-500/20">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
          </div>
        </div>
        <h2 className="text-2xl font-bold mb-3 tracking-tight">Something went wrong!</h2>
        <p className="text-zinc-400 mb-8 text-sm">
          A critical error occurred while rendering the application. We've been notified.
        </p>
        <button
          className="px-6 py-2.5 bg-white text-black font-medium rounded-lg hover:bg-zinc-200 transition-colors shadow-sm"
          onClick={
            // Attempt to recover by trying to re-render the segment
            () => reset()
          }
        >
          Try again
        </button>
      </div>
    </div>
  );
}
