import type {
  BrowserExecutionBinding,
  BrowserExactCallMutationFact,
  BrowserTargetLease,
  BrowserTargetLeaseWait,
} from "../../lib/browser/browser-authority-api.js";

type GptAppendArtifactResult = Readonly<{ status: "success"; artifactRef: string }>
  | Readonly<{ status: "failed"; failureReason: string }>;
type GptReadArtifactResult = Readonly<{ status: "success"; artifactRef: string;
  artifact: Readonly<{ content: Uint8Array; mimeType?: string; integrityHash: string }> }>
  | Readonly<{ status: "failed"; failureReason: string }>;
export interface GptEvidenceStorePort {
  appendArtifact(input: Readonly<{ missionId: string; runId: string;
    artifactType: "ai_raw_output" | "other"; mimeType?: string; content?: string | Uint8Array;
    idempotencyKey: string; correlationId?: string }>): Promise<GptAppendArtifactResult>;
  readArtifact(input: Readonly<{ missionId: string; runId: string;
    idempotencyKey: string }>): Promise<GptReadArtifactResult>;
}

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
