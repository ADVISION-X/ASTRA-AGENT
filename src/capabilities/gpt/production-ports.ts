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

export type ProviderRateLimitIncidentInput = Readonly<{
  jobId: string;
  attemptId: string;
  resultRevision: number;
  deviceId: string;
  leaseVersion: number;
  fenceHash: `sha256:${string}`;
  capabilityManifestHash: `sha256:${string}`;
  dialogHash: `sha256:${string}`;
  observationHash: `sha256:${string}`;
  targetRefHash: `sha256:${string}`;
  documentRefHash: `sha256:${string}`;
  sessionKey: string;
  observedAt: string;
}>;

export type ProviderRateLimitClearance = Readonly<{
  clearance: "confirmed_absent" | "not_cleared";
  acknowledgementReceiptHash: `sha256:${string}`;
  acknowledgedAt: string;
}>;

export interface ProviderRateLimitIncidentHandle {
  readonly incidentRequestId: string;
  deliver(clearance: ProviderRateLimitClearance): Promise<void>;
}

/** Runtime-owned narrow control port; GPT never imports Runtime implementation or state. */
export interface ProviderRateLimitControlPort {
  assertProviderSubmitAllowed(): void;
  pendingIncidents(): readonly ProviderRateLimitIncidentInput[];
  beginIncident(input: ProviderRateLimitIncidentInput): Promise<ProviderRateLimitIncidentHandle>;
}
