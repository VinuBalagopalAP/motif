import { useEffect } from 'react';
import { Message, Job } from '@/types';

export function useJobPoller(
  messages: Message[],
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>,
  session: any,
  fetchHistory: () => Promise<void>
) {
  useEffect(() => {
    const activeJobs = messages.filter(m => m.jobId && (!m.job || m.job.status !== 'done' && m.job.status !== 'error'));

    if (activeJobs.length === 0) return;

    const interval = setInterval(async () => {
      for (const msg of activeJobs) {
        try {
          const res = await fetch(`/api/jobs/${msg.jobId}`, {
            headers: {
              'Authorization': `Bearer ${session?.access_token}`
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
                    // Update the active variant in the existing variants array
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
                    // No variants yet — create them from the completed job spec (first generation)
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
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [messages, session, setMessages, fetchHistory]);
}
