import type {
  BrowserExecutionBinding,
  BrowserExactCallMutationFact,
  BrowserTargetLease,
  BrowserTargetLeaseWait,
} from "../../lib/browser/browser-authority-api.js";

type GptAppendArtifactResult = Readonly<{ status: "success" | "failed"; artifactRef?: string }>;
type GptReadArtifactResult = Readonly<{ status: "success" | "failed"; artifactRef?: string | undefined; artifact?: Readonly<{ content: Uint8Array; mimeType?: string; integrityHash: string }> | undefined }>;

export interface GptEvidenceStorePort {
  appendArtifact(input: Readonly<{
    missionId: string;
    runId: string;
    artifactType: "ai_raw_output" | "other";
    mimeType?: string;
    content?: string | Uint8Array<ArrayBuffer>;
    idempotencyKey: string;
    correlationId?: string;
  }>): Promise<GptAppendArtifactResult>;
  readArtifactRef(input: Readonly<{ artifactRef: string }>): Promise<GptReadArtifactResult>;
}

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
    wait: BrowserTargetLeaseWait,
  ): Promise<BrowserTargetLease>;
}
