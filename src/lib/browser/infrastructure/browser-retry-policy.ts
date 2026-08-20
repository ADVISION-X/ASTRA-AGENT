export type BrowserRetryDecision = Readonly<{ retry: boolean; delayMs: number }>;

export const decideBrowserChainRetry = (attempt: number, reasonCode: string): BrowserRetryDecision => {
  if (attempt >= 3 || reasonCode === "BROWSER_OUTCOME_UNKNOWN" || reasonCode === "BROWSER_DUAL_ACTIVE_WORKER") {
    return { retry: false, delayMs: 0 };
  }
  return { retry: true, delayMs: 250 * (attempt + 1) };
};
