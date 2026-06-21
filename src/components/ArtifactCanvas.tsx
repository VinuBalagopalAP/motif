"use client";

import React, { useState } from 'react';
import { SandpackProvider, SandpackCodeEditor, SandpackLayout, SandpackPreview } from '@codesandbox/sandpack-react';
import ReactMarkdown from 'react-markdown';

export interface ParsedArtifact {
  id: string;
  identifier: string;
  type: string;
  title: string;
  content: string;
}

interface ArtifactCanvasProps {
  artifact: ParsedArtifact;
  onClose: () => void;
}

export function ArtifactCanvas({ artifact, onClose }: ArtifactCanvasProps) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview');

  const isCode = artifact.type === 'code' || artifact.type === 'react';
  const mainFile = artifact.type === 'react' ? '/App.tsx' : '/index.ts';

  const handleCopy = () => {
    navigator.clipboard.writeText(artifact.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => {
      console.error('Failed to copy text: ', err);
    });
  };

  return (
    <div className="flex-1 hidden md:flex flex-col bg-[#1e1e1e] border-l border-gray-100 h-full overflow-hidden animate-in slide-in-from-right-8 duration-300 pointer-events-auto">
      <header className="h-[57px] bg-white flex-shrink-0 border-b border-gray-100 flex items-center justify-between px-4 z-20">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-500 border border-gray-100 flex-shrink-0">
            {isCode ? (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" /></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
            )}
          </div>
          <div className="truncate">
            <h2 className="text-sm font-bold text-[#282828] truncate">{artifact.title}</h2>
          </div>
        </div>

        {isCode && artifact.type === 'react' && (
          <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200">
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                activeTab === 'preview' 
                  ? 'bg-white text-gray-800 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Preview
            </button>
            <button
              onClick={() => setActiveTab('code')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                activeTab === 'code' 
                  ? 'bg-white text-gray-800 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Code
            </button>
          </div>
        )}

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleCopy}
            className="px-3 py-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1.5 border border-gray-200"
          >
            {copied ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5 text-[#08c225]"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                <span className="text-[#08c225]">Copied!</span>
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" /></svg>
                Copy
              </>
            )}
          </button>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            type="button"
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer relative z-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 pointer-events-none"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      </header>
      
      <div className="flex-1 overflow-hidden flex flex-col bg-[#1e1e1e] w-full relative z-10">
        {isCode ? (
          <SandpackProvider 
            template={artifact.type === 'react' ? 'react-ts' : 'vanilla-ts'} 
            theme="dark"
            files={{
              [mainFile]: artifact.content
            }}
            customSetup={{
              dependencies: {
                recharts: "latest",
                "react-is": "latest",
                "prop-types": "latest",
                "lucide-react": "^0.300.0"
              }
            }}
            options={{
              visibleFiles: [mainFile],
              activeFile: mainFile,
            }}
            style={{ display: 'flex', flex: 1, flexDirection: 'column' }}
          >
            <SandpackLayout style={{ height: 'calc(100vh - 57px)', border: 'none', borderRadius: 0 }}>
              {artifact.type === 'react' && (
                <SandpackPreview 
                  showOpenInCodeSandbox={false}
                  showRefreshButton={true}
                  style={{ display: activeTab === 'preview' ? 'flex' : 'none', height: 'calc(100vh - 57px)' }}
                />
              )}
              <SandpackCodeEditor 
                showTabs={false} 
                showLineNumbers={true}
                wrapContent={true}
                readOnly={true}
                style={{ display: (!isCode || artifact.type !== 'react' || activeTab === 'code') ? 'flex' : 'none', height: 'calc(100vh - 57px)', overflow: 'auto' }}
              />
            </SandpackLayout>
          </SandpackProvider>
        ) : (
          <div className="p-8 prose prose-invert max-w-none text-gray-200 overflow-y-auto h-full">
            <ReactMarkdown>{artifact.content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
