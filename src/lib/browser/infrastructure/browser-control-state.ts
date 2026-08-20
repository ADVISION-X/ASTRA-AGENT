export type BrowserInfrastructureErrorCode =
  | "BROWSER_INFRASTRUCTURE_UNAVAILABLE"
  | "BROWSER_INSTALL_INVALID"
  | "BROWSER_CONTROLLER_ALREADY_OWNED"
  | "BROWSER_HOST_IDENTITY_INVALID"
  | "BROWSER_CALLER_ORIGIN_INVALID"
  | "BROWSER_EXTENSION_ID_MISMATCH"
  | "BROWSER_EXTENSION_ARTIFACT_MISMATCH"
  | "BROWSER_ACTIVATION_TUPLE_MISMATCH"
  | "BROWSER_AUTH_TRANSCRIPT_INVALID"
  | "BROWSER_CAPABILITY_PROBE_FAILED"
  | "BROWSER_PROFILE_ENROLLMENT_INVALID"
  | "BROWSER_CHROME_PROCESS_IDENTITY_INVALID"
  | "BROWSER_MANAGED_POLICY_INVALID"
  | "BROWSER_AUTHORITY_LIVENESS_EXPIRED"
  | "BROWSER_WORKER_FENCE_STALE"
  | "BROWSER_DUAL_ACTIVE_DETECTED"
  | "BROWSER_BACKPRESSURE"
  | "BROWSER_FILE_ARTIFACT_GRANT_INVALID"
  | "BROWSER_RELEASE_ROLLBACK_BLOCKED"
  | "BROWSER_ARTIFACT_REVOKED"
  | "BROWSER_AUTHORITY_REVOKED"
  | "BROWSER_COMMAND_PERMIT_STALE"
  | "BROWSER_TARGET_LEASE_STALE"
  | "BROWSER_DOCUMENT_STALE"
  | "BROWSER_DEVTOOLS_CONFLICT"
  | "BROWSER_OUTCOME_UNKNOWN"
  | "BROWSER_REPAIR_REQUIRED";

export type BrowserInfrastructureControlState =
  | Readonly<{ kind: "OFFLINE" }>
  | Readonly<{ kind: "VERIFYING_INSTALL"; attempt: number }>
  | Readonly<{ kind: "STARTING_CHROME"; processEpoch: number }>
  | Readonly<{ kind: "BINDING_OWNER"; supervisorEpoch: number }>
  | Readonly<{ kind: "CONNECTING_HOST"; connectionGeneration: number }>
  | Readonly<{ kind: "AUTHENTICATING_TRANSPORT"; nativePortEpoch: number }>
  | Readonly<{ kind: "PROBING_CAPABILITIES"; transcriptHash: string }>
  | Readonly<{
      kind: "AUTHORITY_AVAILABLE";
      authorityRefHash: string;
      activationTupleHash: string;
    }>
  | Readonly<{ kind: "DRAINING"; reason: string }>
  | Readonly<{
      kind: "BACKOFF";
      attempt: number;
      nextProbeAtMonotonicMs: number;
    }>
  | Readonly<{ kind: "REPAIR_REQUIRED"; code: BrowserInfrastructureErrorCode }>
  | Readonly<{ kind: "STOPPING" }>;

export type BrowserAuthoritySlot<T> =
  | Readonly<{
      kind: "ABSENT";
      reasonCode: string;
      changedAtMonotonicMs: number;
    }>
  | Readonly<{ kind: "PRESENT"; authority: T; changedAtMonotonicMs: number }>;
