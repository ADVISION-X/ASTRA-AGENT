import type {
  BrowserExecutionBinding,
  BrowserExactCallMutationFact,
  BrowserTargetLease,
  BrowserTargetLeaseWait,
} from "../../lib/browser/browser-authority-api.js";
import type { ForensicsPersistenceAbilityGroup } from "../forensics-persistence/index.js";

export type GptEvidenceStorePort = Pick<ForensicsPersistenceAbilityGroup,
  "appendArtifact" | "readArtifact">;

export interface GptProductionBrowserAuthority {
  readExactCallMutationFact(input: Readonly<{
    jobId: string;
    attemptId: string;
    exactCallIdentityHash: `sha256:${string}`;
    actionOrdinal: number;
  }>): BrowserExactCallMutationFact | null;
  countProviderTurnDispatches(jobId: string, attemptId: string): number;
  acquireJobBoundTargetLease(
    binding: BrowserExecutionBinding,
    ownerId: string,
    wait: BrowserTargetLeaseWait,
  ): Promise<BrowserTargetLease>;
}
