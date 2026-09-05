import { failureCode } from "../../../lib/execution-failure.js";

import type { BrowserTargetLease } from "../../../lib/browser/browser-authority-api.js";

export const GPT_DIRECT_POST_MUTATION_SETTLEMENT_MS = 2_500;

const retryableGptObservationFailure = (error: unknown): boolean => [
  "BROWSER_DOM_CANDIDATE_MISSING",
  "BROWSER_DOM_NODE_STALE",
].includes(failureCode(error));

export const waitForGptDirectMutationSettlement = async <State>(
  browser: Pick<BrowserTargetLease, "wait">,
  readState: () => Promise<State>,
  ready: (state: State) => boolean,
  hardFailure: (state: State) => boolean,
): Promise<State> => {
  const deadline = Date.now() + GPT_DIRECT_POST_MUTATION_SETTLEMENT_MS;
  let lastState: State | null = null;
  let lastError: unknown = null;
  do {
    try {
      const observed = await readState();
      lastState = observed;
      lastError = null;
      if (ready(observed) || hardFailure(observed)) return observed;
    } catch (error) {
      if (!retryableGptObservationFailure(error)) throw error;
      lastError = error;
    }
    const remaining = deadline - Date.now();
    if (remaining > 0) await browser.wait({ durationMs: Math.min(125, remaining) });
  } while (Date.now() < deadline);
  if (lastError) throw lastError;
  if (lastState) return lastState;
  throw new Error("GPT_DIRECT_MUTATION_SETTLEMENT_OBSERVATION_MISSING");
};
