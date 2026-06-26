let claudeCircuitTripped = false;

export const CircuitBreaker = {
  /**
   * Checks if the Claude API circuit breaker has been tripped due to authentication or rate limit errors.
   */
  isClaudeRevoked(): boolean {
    return claudeCircuitTripped;
  },

  /**
   * Reports an API failure. If the status is a 401, 403, or 429 (rate limit), the circuit breaker will trip,
   * routing all future LLM requests immediately to the fallback provider.
   */
  reportApiFailure(status?: number) {
    if (status === 401 || status === 403 || status === 429) {
      console.error(`[CircuitBreaker] Claude API returned ${status}. Tripping circuit breaker to switch completely to Gemini.`);
      claudeCircuitTripped = true;
    }
  },

  /**
   * Manually resets the circuit breaker.
   */
  reset() {
    claudeCircuitTripped = false;
  }
};
