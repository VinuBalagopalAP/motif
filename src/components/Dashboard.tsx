import type { Job } from "@/types";
import { useMemo } from "react";

export function Dashboard({ jobs, onSelectJob }: { jobs: Job[], onSelectJob: (job: Job, messageId?: string) => void }) {
  const getFinalRenderSpec = (job: Job) => {
    if (job.render_spec_json) return { spec: job.render_spec_json, messageId: `asst-${job.id}` };
    if (job.messages && job.messages.length > 0) {
      const sortedMessages = [...job.messages].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      for (const msg of sortedMessages) {
        if (msg.variants && msg.variants.length > 0) {
          const lastVariant = msg.variants[msg.variants.length - 1];
          if (lastVariant.type === 'video' && lastVariant.render_spec) {
            return { spec: lastVariant.render_spec, messageId: msg.id };
          }
        }
      }
    }
    return null;
  };

  const completedJobs = useMemo(() => {
    const processedJobs = jobs.map(job => ({ ...job, final_spec_data: getFinalRenderSpec(job) }));
    return processedJobs.filter(j => {
      const url = j.final_spec_data?.spec?.background_video?.url || j.final_spec_data?.spec?.background_image?.url || j.final_spec_data?.spec?.background?.url;
      return !!url;
    });
  }, [jobs]);

  return (
    <div className="flex-1 overflow-y-auto bg-[#f9f9fa] p-6 sm:p-10 h-full w-full">
      <div className="max-w-6xl mx-auto w-full">
        <h1 className="text-3xl font-bold text-[#282828] mb-2">Video Dashboard</h1>
        <p className="text-[#757575] mb-8">View and manage your generated UGC videos.</p>
        
        {completedJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center w-full">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-gray-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-[#282828]">No videos yet</h3>
            <p className="text-[#757575] mt-1">Start a new chat to generate your first UGC video.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 w-full">
            {completedJobs.map(job => (
              <div 
                key={job.id} 
                onClick={() => onSelectJob(job, job.final_spec_data?.messageId)}
                className="group cursor-pointer bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-xl hover:border-transparent hover:-translate-y-1 transition-all duration-300 flex flex-col"
              >
                {/* Thumbnail */}
                <div className="aspect-[9/16] w-full bg-gray-100 relative overflow-hidden">
                  {(() => {
                    const spec = job.final_spec_data?.spec;
                    const url = spec?.background_video?.url || spec?.background_image?.url || spec?.background?.url;
                    const isVideo = spec?.background?.type === 'video' || spec?.background_video?.url || url?.match(/\.(mp4|webm|mov)$/i);
                    
                    if (url) {
                      return isVideo ? (
                        <video 
                          src={url} 
                          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          muted 
                          loop 
                          playsInline 
                          autoPlay
                        />
                      ) : (
                        <img 
                          src={url} 
                          alt="Video thumbnail"
                          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      );
                    }
                    return (
                      <div className="absolute inset-0 flex items-center justify-center text-gray-300">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                        </svg>
                      </div>
                    );
                  })()}
                  {/* Status badge */}
                  <div className="absolute top-3 right-3">
                    <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full shadow-sm ${
                      job.status === 'done' ? 'bg-[#08c225] text-white' : 
                      job.status === 'error' ? 'bg-red-500 text-white' : 
                      'bg-white/90 text-[#282828] backdrop-blur-sm'
                    }`}>
                      {job.status === 'done' ? 'Completed' : job.status}
                    </span>
                  </div>
                  
                  {/* Play overlay on hover */}
                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center text-[#282828] shadow-lg backdrop-blur-sm transform scale-90 group-hover:scale-100 transition-all duration-300">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 ml-1">
                        <path fillRule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Card Content */}
                <div className="p-4 flex flex-col flex-1">
                  <h3 className="font-semibold text-[#282828] text-sm line-clamp-2 leading-tight mb-2 flex-1">
                    {job.message}
                  </h3>
                  <div className="flex items-center justify-between mt-auto">
                    <span className="text-[11px] font-medium text-[#757575]">
                      {new Date(job.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    <span className="text-[11px] font-semibold text-[#08c225]">
                      View Chat &rarr;
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
