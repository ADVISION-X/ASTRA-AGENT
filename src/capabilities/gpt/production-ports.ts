import type {
  BrowserExecutionBinding,
  BrowserExactCallMutationFact,
  BrowserTargetLease,
} from "../../lib/browser/browser-authority-api.js";
import type {
  GptContinuationStorePort,
  StoredGptContinuation,
} from "./session/gpt-continuation-store-port.js";

type GptEvidenceStoreResult = Readonly<{
  status: "success" | "failed" | "invalid_input";
  recordRef?: string | undefined;
  artifactRef?: string | undefined;
  record?: Readonly<Record<string, unknown>> | undefined;
  artifact?: Readonly<{
    content: Uint8Array<ArrayBuffer>;
    mimeType?: string | undefined;
    integrityHash: string;
  }> | undefined;
}>;

export interface GptEvidenceStorePort {
  appendRecord(input: Readonly<{
    missionId: string;
    runId: string;
    sessionId?: string;
    roundId?: string;
    stepId?: string;
    sourceCapabilityId?: string;
    sourceChildCapabilityId?: string;
    recordType: "ai_result" | "ability_result" | "observation" | "evidence"
      | "visual_evidence" | "failure" | "mission_event";
    recordPayload: Record<string, unknown>;
    artifactRefs?: string[];
    parentRefs?: string[];
    createdAt?: string;
    idempotencyKey: string;
    correlationId?: string;
  }>): Promise<GptEvidenceStoreResult>;
  appendArtifact(input: Readonly<{
    missionId: string;
    runId: string;
    sessionId?: string;
    roundId?: string;
    artifactType: "screenshot" | "coordinate_grid" | "ai_raw_output"
      | "ai_json_output" | "runtime_log" | "other";
    mimeType?: string;
    bytesRef?: string;
    content?: string | Uint8Array<ArrayBuffer>;
    sourceRef?: string;
    parentRefs?: string[];
    idempotencyKey: string;
    correlationId?: string;
  }>): Promise<GptEvidenceStoreResult>;
  readRecordRef(input: Readonly<{
    childCapabilityId: "read-record-ref";
    recordRef: string;
  }>): Promise<GptEvidenceStoreResult>;
  readArtifactRef(input: Readonly<{
    childCapabilityId: "read-artifact-ref";
    artifactRef: string;
  }>): Promise<GptEvidenceStoreResult>;
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
