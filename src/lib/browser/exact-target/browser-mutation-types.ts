export type BrowserMutationState = "PREPARED" | "DISPATCHED" | "CONFIRMED" | "REJECTED" | "FAILED";
export type BrowserMutationOutcome = "no" | "dispatched" | "confirmed";
export type BrowserPhysicalInputCount = 0 | 1 | 2 | 3 | 4;

export type BrowserMutationIdentity = Readonly<{
  commandId: string;
  logicalMutationId?: `sha256:${string}` | null;
  exactCallIdentityHash: `sha256:${string}`;
  jobId: string;
  resultRevision: number;
  attemptId: string;
  leaseVersion: number;
  executionFenceHash: `sha256:${string}`;
  productStepId: string;
  callId: string;
  childCapabilityId: string;
  effectScope: "target_local" | "provider_effect";
  actionOrdinal: number;
  targetRef: string;
  documentRef: string;
  actionId: string;
  positivePostconditionHash: `sha256:${string}`;
  negativePostconditionHash: `sha256:${string}`;
  requestHash: `sha256:${string}`;
  payloadHash: `sha256:${string}`;
}>;

export type BrowserExactCallMutationFact = Readonly<{
  effectScope: "target_local" | "provider_effect";
  providerEffectIdentityHash: `sha256:${string}` | null;
  outcome: "DISPATCHED" | "CONFIRMED" | "REJECTED";
  mutationOutcome: BrowserMutationOutcome;
  terminalAt: string | null;
  failureCode: string | null;
  nativeFailureCode: string | null;
  authorityRef: string;
  authorityHash: `sha256:${string}`;
  targetRef: string;
  documentRef: string;
  productStepId: string;
  callId: string;
  childCapabilityId: string;
  actionOrdinal: number;
  physicalInputCount: BrowserPhysicalInputCount;
  downloadGuidHash: `sha256:${string}` | null;
  downloadCompleted: boolean;
  identityRevalidated: boolean;
}>;

export type BrowserProviderEffectStepCallFact = Readonly<{
  exactCallIdentityHash: `sha256:${string}`;
  inputHash: `sha256:${string}`;
  mutation: BrowserExactCallMutationFact;
}>;

export type BrowserAtomicStepOutcome = Readonly<{
  state: "dispatched" | "confirmed" | "rejected";
  mutationOutcome: BrowserMutationOutcome;
  providerEffectIdentityHash: `sha256:${string}` | null;
  terminalAt: string | null;
  failureCode: string | null;
  nativeFailureCode: string | null;
  authorityRef: string;
  authorityHash: `sha256:${string}`;
  targetRef: string;
  documentRef: string;
  physicalInputCount: BrowserPhysicalInputCount;
  downloadGuidHash: `sha256:${string}` | null;
  downloadCompleted: boolean;
  identityRevalidated: boolean;
  terminalPayload?: unknown | null;
}>;

export type AtomicStepRow = Readonly<{
  command_id: string;
  logical_mutation_id: `sha256:${string}` | null;
  target_ref: string;
  document_ref: string;
  state: "DISPATCHED" | "CONFIRMED" | "REJECTED";
  mutation_outcome: BrowserMutationOutcome | null;
  reason: string | null;
  native_cause_code: string | null;
  terminal_at: string | null;
  action_ordinal: number;
  physical_input_count: BrowserPhysicalInputCount;
  download_guid_hash: `sha256:${string}` | null;
  download_completed: 0 | 1;
  media_identity_revalidated: 0 | 1;
  provider_recovery_payload: string | null;
}>;
