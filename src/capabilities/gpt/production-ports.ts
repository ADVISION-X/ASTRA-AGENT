import type {
  BrowserExecutionBinding,
  BrowserExactCallMutationFact,
  BrowserTargetLease,
} from "../../lib/browser/browser-authority-api.js";
import type {
  GptContinuationStorePort,
  StoredGptContinuation,
} from "./session/gpt-continuation-store-port.js";

type GptAppendRecordResult = Readonly<{ status: "success" | "failed"; recordRef?: string }>;
type GptAppendArtifactResult = Readonly<{ status: "success" | "failed"; artifactRef?: string }>;
type GptReadRecordResult = Readonly<{ status: "success" | "failed"; recordRef?: string | undefined; record?: Readonly<Record<string, unknown>> | undefined }>;
type GptReadArtifactResult = Readonly<{ status: "success" | "failed"; artifactRef?: string | undefined; artifact?: Readonly<{ content: Uint8Array; mimeType?: string; integrityHash: string }> | undefined }>;

export interface GptEvidenceStorePort {
  appendRecord(input: Readonly<{
    missionId: string;
    runId: string;
    stepId?: string;
    sourceCapabilityId?: string;
    sourceChildCapabilityId?: string;
    recordType: "evidence" | "failure";
    recordPayload: Record<string, unknown>;
    artifactRefs?: string[];
    createdAt?: string;
    idempotencyKey: string;
    correlationId?: string;
  }>): Promise<GptAppendRecordResult>;
  appendArtifact(input: Readonly<{
    missionId: string;
    runId: string;
    artifactType: "ai_raw_output" | "other";
    mimeType?: string;
    content?: string | Uint8Array<ArrayBuffer>;
    idempotencyKey: string;
    correlationId?: string;
  }>): Promise<GptAppendArtifactResult>;
  readRecordRef(input: Readonly<{ recordRef: string }>): Promise<GptReadRecordResult>;
  readArtifactRef(input: Readonly<{ artifactRef: string }>): Promise<GptReadArtifactResult>;
  readExactCallEvidence(input: Readonly<{
    missionId: string;
    runId: string;
    exactCallIdentityHash: `sha256:${string}`;
  }>): Promise<Readonly<{
    recordRef: string;
    record: Readonly<Record<string, unknown>>;
  }> | null>;
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
    wait: Readonly<{ signal: AbortSignal; remainingMs(): number }>,
  ): Promise<BrowserTargetLease>;
}

export interface GptContinuationReadbackPort {
  readGptContinuation(continuationRef: string): StoredGptContinuation | null;
  readGptContinuationForOriginJob(
    jobId: string,
    pluginId: string,
    turnMarker: string,
  ): StoredGptContinuation | null;
  readGptContinuationForFrontier(frontierRef: `sha256:${string}`): StoredGptContinuation | null;
  readTaskPluginVersion(jobId: string): number | null;
}

export interface GptProductionRuntimePort {
  readonly continuationStore: GptContinuationStorePort;
  readonly continuationReadback: GptContinuationReadbackPort;
  attemptIdsForTask(jobId: string): readonly string[];
}
