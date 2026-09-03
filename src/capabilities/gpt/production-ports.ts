import type {
  BrowserExecutionBinding,
  BrowserExactCallMutationFact,
  BrowserTargetLease,
} from "../../lib/browser/browser-authority-api.js";
import type { GptContinuationReadbackPort } from "./continuation-readback.js";
import type { GptContinuationStorePort } from "./session/gpt-continuation-store-port.js";

export interface GptProductionBrowserAuthority {
  readExactCallMutationFact(input: Readonly<{
    jobId: string;
    attemptId: string;
    ownerPluginId: string;
    pluginVersion: number;
    exactCallIdentityHash: `sha256:${string}`;
    actionOrdinal: number;
  }>): BrowserExactCallMutationFact | null;
  countProviderTurnDispatches(jobId: string, attemptId: string): number;
  acquireJobBoundTargetLease(
    binding: BrowserExecutionBinding,
    ownerId: string,
    wait: Readonly<{ signal: AbortSignal; remainingMs(): number }>,
  ): Promise<BrowserTargetLease>;
}

export interface GptProductionRuntimePort {
  readonly continuationStore: GptContinuationStorePort;
  readonly continuationReadback: GptContinuationReadbackPort;
  attemptIdsForTask(jobId: string): readonly string[];
}
