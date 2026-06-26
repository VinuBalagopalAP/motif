import { useEffect, useCallback } from 'react';
import { Message, Job } from '@/types';
import { supabase } from '@/lib/supabase';

export function useJobPoller(
  messages: Message[],
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>,
  session: any,
  fetchHistory: () => Promise<void>
) {
  
  const fetchSingleJob = useCallback(async (msg: Message) => {
    if (!msg.jobId || !session?.access_token) return;
    try {
      const res = await fetch(`/api/jobs/${msg.jobId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      if (res.ok) {
        const job: Job = await res.json();
        setMessages(prev => {
          const newMessages = [...prev];
          const msgIndex = newMessages.findIndex(m => m.id === msg.id);
          if (msgIndex !== -1 && JSON.stringify(newMessages[msgIndex].job) !== JSON.stringify(job)) {
            const updatedMsg = { ...newMessages[msgIndex], job };

            // If job is done, sync the active variant to reflect the final render_spec
            if (job.status === 'done' && job.render_spec_json) {
              const anyMsg = updatedMsg as any;
              if (anyMsg.variants && anyMsg.variants.length > 0) {
                const activeIdx = anyMsg.activeVariantIndex ?? anyMsg.variants.length - 1;
                const newVariants = [...anyMsg.variants];
                newVariants[activeIdx] = {
                  ...newVariants[activeIdx],
                  type: 'video',
                  render_spec: job.render_spec_json
                };
                anyMsg.variants = newVariants;
                anyMsg.type = 'video';
              } else {
                anyMsg.variants = [{ type: 'video', render_spec: job.render_spec_json }];
                anyMsg.activeVariantIndex = 0;
                anyMsg.type = 'video';
              }
            }

            newMessages[msgIndex] = updatedMsg;
            return newMessages;
          }
          return prev;
        });

        // If job just finished, refresh the sidebar
        if (job.status === 'done' || job.status === 'error') {
          fetchHistory();
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, [session, setMessages, fetchHistory]);

  useEffect(() => {
    const activeJobs = messages.filter(m => m.jobId && (!m.job || m.job.status !== 'done' && m.job.status !== 'error'));

    if (activeJobs.length === 0) return;

    // Phase 2: Supabase Realtime (WebSocket) replacing the 2000ms HTTP poller
    // We listen for updates on the `video_jobs` table. When an update happens, 
    // we fetch the job securely using the existing API to ensure RLS and schema parsing works identically.
    const channel = supabase
      .channel('job_updates')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'video_jobs' },
        (payload) => {
          const updatedJobId = payload.new.id;
          const activeMsg = activeJobs.find(m => m.jobId === updatedJobId);
          if (activeMsg) {
            fetchSingleJob(activeMsg);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] Subscribed to video_jobs updates');
        }
      });

    // Fallback: fetch once immediately on mount just in case we missed a state change before socket connected
    activeJobs.forEach(msg => fetchSingleJob(msg));

    return () => {
      supabase.removeChannel(channel);
    };
  }, [messages, fetchSingleJob]);
}
