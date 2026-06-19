export let geminiCallCount = 0;

export function incrementGeminiCount() {
  geminiCallCount++;
  return geminiCallCount;
}

export function logPipelineStep(jobId: string, step: string, message: string) {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  console.log(`\n[\x1b[36m${timestamp}\x1b[0m] [\x1b[35mJob: ${jobId.slice(0,8)}\x1b[0m] [\x1b[32m${step}\x1b[0m] ${message}`);
}

export function logApiHit(apiName: string, callCount?: number) {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  const countStr = callCount ? ` (Total calls: ${callCount})` : '';
  console.log(`[\x1b[36m${timestamp}\x1b[0m] \x1b[43m\x1b[30m API HIT \x1b[0m Hitting ${apiName}${countStr}`);
}

export function logError(jobId: string, step: string, error: any) {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  console.error(`\n[\x1b[36m${timestamp}\x1b[0m] [\x1b[35mJob: ${jobId.slice(0,8)}\x1b[0m] [\x1b[31mERROR in ${step}\x1b[0m]`, error);
}
