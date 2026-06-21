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
    await runPipelineWorker(job.jobId, job.message, job.token, (job as any).history);
  }

  // Process the next job in the queue
  processQueue();
}

export async function runPipelineWorker(jobId: string, message: string, token?: string, history: any[] = [], classification?: any, assistantMessage?: any, partialTarget?: string, existingRenderSpec?: any) {
  try {
    // State: planning
    logPipelineStep(jobId, 'PLANNING', `Extracting product info from message and history...`);
    await updateJobStatus(jobId, { status: 'planning' }, token);

    let foundUrl = null;
    let productName = "Unknown Product";
    try {
      const productInfo = await extractProduct(message, history);
      foundUrl = productInfo.url || null;
      productName = productInfo.name || "Unknown Product";
    } catch (e: any) {
      logPipelineStep(jobId, 'PLANNING', `Failed to extract product info: ${e.message}`);
    }

    // State: scraping
    let scrapedData: { title: string; description: string; headings: string[]; bodyText: string; } = { title: "", description: "", headings: [], bodyText: "" };
    if (foundUrl && !partialTarget) {
      logPipelineStep(jobId, 'SCRAPING', `Scraping URL found in message: ${foundUrl}`);
      await updateJobStatus(jobId, { status: 'scraping' }, token);
      scrapedData = await scrapeSite(foundUrl);
      logPipelineStep(jobId, 'SCRAPING', `Successfully scraped site: ${scrapedData.title}`);
      await updateJobStatus(jobId, { scraped_data_json: scrapedData }, token);
    } else if (!partialTarget) {
      logPipelineStep(jobId, 'SCRAPING', 'No URL provided, skipping scraping step.');
    }

    // State: picking_assets
    logPipelineStep(jobId, 'ASSETS', `Generating creative concept for ${productName}...`);
    await updateJobStatus(jobId, { status: 'picking assets' }, token);

    // If partialTarget is present, we FORCE BYPASS cache to get fresh new variations.
    const bypassCache = !!partialTarget;
    const concept = await generateConcept(message, scrapedData, productName, history, bypassCache);

    // Save the extracted product name from the concept
    await updateJobStatus(jobId, {
      product_json: { chat_history: history, name: concept.productName, url: foundUrl }
    }, token);

    let renderSpec;

    if (partialTarget && existingRenderSpec) {
      logPipelineStep(jobId, 'ASSETS', `Merging partial regeneration for ${partialTarget}...`);

      renderSpec = { ...existingRenderSpec };

      if (partialTarget === 'caption') {
        renderSpec.overlayText = {
          ...concept.overlayText,
          style: existingRenderSpec.overlayText?.style // preserve existing user styling if they just want new text!
        };
      } else if (partialTarget === 'gif') {
        // Run pickAssets just for the GIF
        const tempSpec = await pickAssets(concept);
        renderSpec.gifOverlay = tempSpec.gifOverlay;
      }
    } else {
      logPipelineStep(jobId, 'ASSETS', `Concept generated for ${concept.productName}! Searching for Pexels and Giphy assets...`);
      renderSpec = await pickAssets(concept);
    }

    // State: done
    logPipelineStep(jobId, 'DONE', `Pipeline completed successfully! Render spec ready.`);

    console.log(`\n\x1b[36m--- RENDER SPEC FOR [${jobId}] ---\x1b[0m`);
    console.dir(renderSpec, { depth: null, colors: true });
    console.log(`\x1b[36m--------------------------------------------------\x1b[0m\n`);

    let finalHistory = [...history];

    if (assistantMessage) {
      assistantMessage.variants.push({ type: 'video', render_spec: renderSpec });
      finalHistory.push(assistantMessage);
    } else {
      finalHistory.push({
        role: 'assistant',
        type: 'video',
        render_spec: renderSpec
      });
    }

    await updateJobStatus(jobId, {
      product_json: { chat_history: finalHistory, name: concept.productName, url: foundUrl },
      status: 'done'
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
