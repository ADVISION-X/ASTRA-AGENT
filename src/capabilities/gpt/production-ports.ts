import type {
  BrowserExecutionBinding,
  BrowserProviderEffectStepCallFact,
  BrowserTargetLease,
  BrowserTargetLeaseWait,
} from "../../lib/browser/browser-authority-api.js";
import type { GptHash } from "./contract.js";

export type GptProductionExecutionInput = Readonly<{
  sourceReusableCalls?: readonly Readonly<{
    productStepId: string; callId: string; childCapabilityId: string;
    sourceEffectSetHash: GptHash;
    sourceAttemptId: string; sourceResultRevision: number;
    effectIdentityHash: GptHash; walAuthorityHash: GptHash;
    checkpointExactCallIdentityHash: GptHash;
    artifactRef: string; artifactContentHash: GptHash;
    submitPromptHash: GptHash;
    canonicalConversationHash: GptHash; userTurnHash: GptHash;
  }>[];
  recordSettledCheckpoint?: (input: Readonly<{
    providerEffectIdentityHash: GptHash; browserAuthorityHash: GptHash;
    browserAuthorityRef: string; sourceAttemptId: string; sourceResultRevision: number;
    checkpointExactCallIdentityHash: GptHash; artifactRef: string;
    artifactContentHash: GptHash; submitPromptHash: GptHash;
    canonicalConversationUrl: string; userTurnId: string;
  }>) => void;
  readbackOnlyCalls?: readonly Readonly<{ productStepId: string; callId: string;
    childCapabilityId: "submit_exact_gpt_turn_once"; source?: Readonly<{ sourceAttemptId: string; sourceResultRevision: number; effectIdentityHash: `sha256:${string}`; walAuthorityHash: `sha256:${string}` }> }>[];
  jobId: string;
  productId: string;
  ownerRef: string;
  subjectRef: string;
  authorizationRef: string;
  resultRevision: number;
  domainRejectionRevision?: boolean;
  sourceReuseZeroSubmitGrant?: boolean;
  deliveryPriorityReplayCalls?: readonly Readonly<{ productStepId: string; callId: string;
    childCapabilityId: string; sourceEffectSetHash: GptHash;
    callGrantHash: GptHash }>[];
  attemptId: string;
  deviceId: string;
  leaseVersion: number;
  executionFenceHash: GptHash;
  capabilityManifestHash: GptHash;
  maxProviderTurns: number;
  expiresAtMonotonic: number;
  commandTtlMs: number;
  abortSignal: AbortSignal;
  parentSpanId: string;
  providerContinuationParent?: Readonly<{
    jobId: string;
    sources: readonly Parameters<GptProductionBrowserAuthority["readSourceConfirmedProviderEffect"]>[0][];
  }>;
}>;

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
  readConfirmedRateLimitAcknowledgement(input: Readonly<{
    jobId: string; attemptId: string; resultRevision: number; incidentRequestId: string;
  }>): Readonly<{ terminalAt: string }> | null;
  readSourceConfirmedProviderEffect(input: Readonly<{
    jobId: string; sourceAttemptId: string; sourceResultRevision: number;
    productStepId: string; callId: string; childCapabilityId: string;
    effectIdentityHash: GptHash; walAuthorityHash: GptHash;
  }>): Readonly<{ exactCallIdentityHash: GptHash; actionOrdinal: number;
    inputHash: GptHash; terminalPayload: unknown;
    conversationLocator?: Awaited<ReturnType<BrowserTargetLease["readSubmittedConversationUrl"]>> | null;
    authorityRef: string; authorityHash: GptHash; terminalAt: string }>;
  releaseJobBoundTarget(jobId: string, releaseAuthority: "wait-new-attempt",
    signal: AbortSignal): Promise<void>;
  readProviderEffectStepCallFact(input: Readonly<{
    jobId: string;
    attemptId: string;
    resultRevision: number;
    productStepId: string;
    callId: string;
    childCapabilityId: string;
  }>): BrowserProviderEffectStepCallFact | null;
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
  assertIncidentFailureIsolated(error: unknown): void;
  pendingIncidents(): readonly ProviderRateLimitIncidentInput[];
  beginIncident(input: ProviderRateLimitIncidentInput): Promise<ProviderRateLimitIncidentHandle>;
}
