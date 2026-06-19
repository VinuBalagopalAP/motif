import { updateJobStatus } from '../jobs';
import { extractProduct } from './extractProduct';
import { scrapeSite } from './scrapeSite';
import { generateConcept } from './generateConcepts';
import { pickAssets } from './pickAssets';
import { logPipelineStep, logError } from './logger';



const jobQueue: { jobId: string; message: string; token?: string }[] = [];
let isProcessingQueue = false;

export async function enqueueJob(jobId: string, message: string, token?: string) {
  jobQueue.push({ jobId, message, token });
  await updateJobStatus(jobId, { status: 'queued' }, token);
  
  if (!isProcessingQueue) {
    processQueue();
  }
}

async function processQueue() {
  if (jobQueue.length === 0) {
    isProcessingQueue = false;
    return;
  }
  
  isProcessingQueue = true;
  const job = jobQueue.shift();
  if (job) {
    logPipelineStep(job.jobId, 'QUEUE', `Started processing job from queue (remaining: ${jobQueue.length})`);
    await runPipelineWorker(job.jobId, job.message, job.token);
  }
  
  // Process the next job in the queue
  processQueue();
}

// A deterministic state machine that mimics a queue worker.
export async function runPipelineWorker(jobId: string, message: string, token?: string) {
  try {
    // State: planning
    logPipelineStep(jobId, 'PLANNING', `Extracting URL from message: "${message}"`);
    await updateJobStatus(jobId, { status: 'planning' }, token);
    const urlMatch = message.match(/(?:https?:\/\/)?(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{2,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&//=]*)/i);
    const foundUrl = urlMatch ? urlMatch[0] : null;

    // State: scraping
    let scrapedData: { title: string; description: string; headings: string[]; bodyText: string; } = { title: "", description: "", headings: [], bodyText: "" };
    if (foundUrl) {
      logPipelineStep(jobId, 'SCRAPING', `Scraping URL found in message: ${foundUrl}`);
      await updateJobStatus(jobId, { status: 'scraping' }, token);
      scrapedData = await scrapeSite(foundUrl);
      logPipelineStep(jobId, 'SCRAPING', `Successfully scraped site: ${scrapedData.title}`);
      await updateJobStatus(jobId, { scraped_data_json: scrapedData }, token);
    } else {
      logPipelineStep(jobId, 'SCRAPING', 'No URL provided, skipping scraping step.');
    }

    // State: picking_assets
    logPipelineStep(jobId, 'ASSETS', `Generating creative concept...`);
    await updateJobStatus(jobId, { status: 'picking_assets' }, token);
    const concept = await generateConcept(message, scrapedData);
    
    // Save the extracted product name from the concept
    await updateJobStatus(jobId, { product_json: { name: concept.productName, url: foundUrl } }, token);

    logPipelineStep(jobId, 'ASSETS', `Concept generated for ${concept.productName}! Searching for Pexels and Giphy assets...`);
    const renderSpec = await pickAssets(concept);

    // State: done
    logPipelineStep(jobId, 'DONE', `Pipeline completed successfully! Render spec ready.`);
    
    console.log(`\n\x1b[36m--- RENDER SPEC FOR [${jobId}] ---\x1b[0m`);
    console.dir(renderSpec, { depth: null, colors: true });
    console.log(`\x1b[36m--------------------------------------------------\x1b[0m\n`);

    await updateJobStatus(jobId, { 
      status: 'done', 
      render_spec_json: renderSpec,
      output_url: `/video/${jobId}` 
    }, token);

  } catch (error: any) {
    logError(jobId, 'PIPELINE', error);
    let errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    if (errorMessage.includes('429 Too Many Requests') || errorMessage.includes('quota') || errorMessage.includes('404')) {
      errorMessage = "Your limit has ended, please try after few hours.";
    }

    await updateJobStatus(jobId, { 
      status: 'error',
      error: errorMessage
    }, token);
  }
}
