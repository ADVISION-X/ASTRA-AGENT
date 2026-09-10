import type {
  GptExecutionProfile,
  GptReasoningRequirement,
  GptReasoningTier,
} from "./schema.js";
import type { GptContinuationLane } from "./session/gpt-session-controller.js";
import type {
  GptProviderContinuation,
  GptSemanticAdmissionReceipt,
} from "./session/gpt-continuation-store-port.js";

export type GptHash = `sha256:${string}`;

export type GptReasoningRequirementResult = Readonly<{
  requestedTier: GptReasoningTier;
  requestedValue: number;
  selectionPolicy: GptReasoningRequirement["selectionPolicy"];
  observedScale: Readonly<{
    min: number | null;
    max: number | null;
    currentBefore: number | null;
  }>;
  resolvedTier: GptReasoningTier | null;
  resolvedValue: number | null;
  degraded: boolean;
  currentValue: number | null;
  mutationOutcome: "no" | "dispatched" | "confirmed";
  browserOutcome: "DISPATCHED" | "CONFIRMED" | "REJECTED" | null;
  gptPostcondition: "passed" | "failed" | "pending";
}>;

export type GptApprovedFileInput = Readonly<{
  artifactRef: string;
  displayName: string;
  sha256: GptHash;
  bytes: number;
}>;

export type GptApprovedFile = GptApprovedFileInput & Readonly<{
  providerDisplayName: string;
}>;

export type GptPromptIdentity = Readonly<{
  length: number;
  prefix: string;
  suffix: string;
  hash: GptHash;
}>;

export type GptTextCheckpointInput = Readonly<{
  checkpointKind: "text";
  sourceAttemptId: string;
  assistantTurnId: string;
  artifactRef: string;
  rawDomHash: GptHash;
  semanticTextHash: GptHash;
  canonicalConversationUrl: string;
  promptHash: GptHash;
  turnMarker: string;
  evidenceRef: string;
  evidenceHash: GptHash;
}>;

export type GptGeneratedImageCheckpointInput = Readonly<{
  checkpointKind: "generated_image";
  sourceAttemptId: string;
  assistantTurnId: string;
  canonicalConversationUrl: string;
  promptHash: GptHash;
  mediaHash: GptHash;
  turnMarker: string;
  originalArtifactRef: string;
  originalSha256: GptHash;
  originalBytes: number;
  originalMediaType: `image/${string}`;
  originalWidth: number;
  originalHeight: number;
  webpArtifactRef: string;
  webpSha256: GptHash;
  webpBytes: number;
  mediaType: "image/webp";
  width: 1200;
  height: 630;
  evidenceRef: string;
  evidenceHash: GptHash;
  predecessorTextCheckpoint: GptTextCheckpointInput;
}>;

export type GptContinuationCheckpointInput =
  | GptTextCheckpointInput
  | GptGeneratedImageCheckpointInput;

type GptConversationIdentityInput = Readonly<{
  canonicalConversationUrl: string;
  expectedPromptHash: GptHash;
  expectedResponseHash: GptHash;
  timeoutMs: number;
  turnMarker: string;
}>;

type GptSourceCheckpointInput = Readonly<{
  sourceAssistantTurnId: string;
  sourceCanonicalConversationUrl: string;
  sourcePromptHash: GptHash;
  sourceResponseHash: GptHash;
  sourceTurnMarker: string;
  timeoutMs: number;
}>;

type GptResponseWaitInput = Readonly<{
  probeBudgetMs: number;
  canonicalConversationUrl: string;
  conversationIdentityHash: GptHash;
  expectedPromptHash: GptHash;
  turnMarker: string;
}>;

type GptPersistContinuationInput = Readonly<{
  authorizationRef: string;
  currentCheckpoint: GptContinuationCheckpointInput;
  jobId: string;
  ownerRef: string;
  pluginId: string;
  provider: GptProviderContinuation;
  subjectRef: string;
}> & Readonly<{
  frontier?: Readonly<{
    frontierRef: GptHash;
    originCheckpoint: Omit<GptTextCheckpointInput, "checkpointKind">;
  }>;
}>;

type GptReservationCommonInput = Readonly<{
  authorizationRef: string;
  laneVersion: number;
  originProvenanceHash: GptHash;
  ownerRef: string;
  reservationEffectHash: GptHash;
  reservationFenceHash: GptHash;
  reservationIdentityHash: GptHash;
  semanticContractHash: GptHash;
  subjectRef: string;
}>;

type GptReservationInput =
  | GptReservationCommonInput & Readonly<{
      reservationKind: "reusable_origin";
    }>
  | GptReservationCommonInput & Readonly<{
      reservationKind: "derived_continuation";
      sourceCheckpointHash: GptHash;
    }>;

type GptAcquireContinuationInput = Readonly<{
  continuationRef: string;
  ownerRef: string;
  subjectRef: string;
}> & (
  | Readonly<{
      authorization: Readonly<{
        kind: "row_authorization";
        currentAuthorizationRef: string;
      }>;
    }>
  | Readonly<{
      authorization: Readonly<{
        kind: "continuation_lane_use_grant";
        currentJobId: string;
        currentAuthorizationRef: string;
        opaqueLaneUseGrantHash: GptHash;
      }>;
      parentManifestId: string;
      parentManifestHash: GptHash;
    }>
);

export interface GptChildInputMap {
  readonly prepare_clean_gpt_chat: Readonly<{ timeoutMs: number }>;
  readonly focus_exact_gpt_conversation: Readonly<{
    canonicalConversationUrl: string;
  }>;
  readonly verify_gpt_conversation_identity: GptConversationIdentityInput;
  readonly open_gpt_execution_profile: Readonly<{ profile: GptExecutionProfile }>;
  readonly open_gpt_model_selector_v2: Readonly<{ profile: GptExecutionProfile }>;
  readonly select_exact_gpt_model_v2: Readonly<{ profile: GptExecutionProfile }>;
  readonly ensure_gpt_reasoning_requirement: Readonly<{ profile: GptExecutionProfile }>;
  readonly close_gpt_execution_profile: Readonly<{ profile: GptExecutionProfile }>;
  readonly open_gpt_attachment_control: Readonly<Record<string, never>>;
  readonly attach_approved_gpt_files_once: Readonly<{ files: readonly GptApprovedFileInput[] }>;
  readonly reconcile_gpt_attachment_set: Readonly<{
    files: readonly GptApprovedFileInput[];
    timeoutMs: number;
  }>;
  readonly write_exact_gpt_prompt: Readonly<{ prompt: string }>;
  readonly reconcile_gpt_draft: Readonly<{
    files: readonly GptApprovedFile[];
    prompt: string;
    turnMarker: string;
  }>;
  readonly submit_exact_gpt_turn_once: Readonly<{
    files: readonly GptApprovedFile[];
    promptHash: GptHash;
    turnMarker: string;
  }>;
  readonly reconcile_gpt_turn_submission: Readonly<{
    expectedPromptHash: GptHash;
    timeoutMs: number;
    turnMarker: string;
  }>;
  readonly wait_for_stable_gpt_text: GptResponseWaitInput;
  readonly checkpoint_gpt_text_response: Readonly<{
    assistantTurnId: string;
    canonicalConversationUrl: string;
    expectedPromptHash: GptHash;
    expectedResponseHash: GptHash;
    turnMarker: string;
  }>;
  readonly wait_for_stable_gpt_image: GptResponseWaitInput;
  readonly checkpoint_gpt_generated_image: Readonly<{
    assistantTurnId: string;
    canonicalConversationUrl: string;
    expectedMediaHash: GptHash;
    expectedPromptHash: GptHash;
    predecessorTextCheckpoint: GptTextCheckpointInput;
    turnMarker: string;
  }>;
  readonly open_gpt_checkpoint_actions_menu: GptSourceCheckpointInput;
  readonly open_gpt_fork_destination_menu: GptSourceCheckpointInput;
  readonly fork_exact_gpt_conversation_at_checkpoint: GptSourceCheckpointInput;
  readonly persist_gpt_continuation: GptPersistContinuationInput;
  readonly reserve_exact_gpt_continuation_once: GptReservationInput;
  readonly complete_exact_gpt_continuation_reservation_once: Readonly<{
    artifactHash: GptHash;
    artifactRef: string;
    checkpoint: GptTextCheckpointInput;
    completionReceiptHash: GptHash;
    laneVersion: number;
    opaqueReadGrantHash: GptHash;
    provider: GptProviderContinuation;
    reservationFenceHash: GptHash;
    reservationIdentityHash: GptHash;
    semanticAdmissionReceipt: GptSemanticAdmissionReceipt;
    semanticAdmissionReceiptHash: GptHash;
    semanticAdmissionReceiptRef: string;
  }>;
  readonly acquire_gpt_continuation_lane: GptAcquireContinuationInput;
  readonly advance_gpt_continuation_lane: Readonly<{
    currentCheckpoint: GptContinuationCheckpointInput;
    jobId: string;
    lane: GptContinuationLane;
    pluginId: string;
    provider: GptProviderContinuation;
  }>;
  readonly release_gpt_continuation_lane: Readonly<{
    jobId: string;
    lane: GptContinuationLane;
  }>;
}

type GptConversationIdentityOutput = Readonly<{
  canonicalConversationUrl: string;
  turnMarker: string;
  userTurnId: string;
  assistantTurnId: string;
  semanticText: string;
  promptHash: GptHash;
  responseHash: GptHash;
  conversationHash: GptHash;
}>;

type GptForkOutput = Readonly<{
  sourceCanonicalConversationUrl: string;
  sourceAssistantTurnId: string;
  childCanonicalConversationUrl: string;
  sourceToChildRelationHash: GptHash;
}>;

export interface GptChildOutputMap {
  readonly prepare_clean_gpt_chat: Readonly<{
    composer: number;
    turns: number;
    attachments: number;
    generating: number;
    draftEmpty: true;
    staleDraftCleared: boolean;
  }>;
  readonly focus_exact_gpt_conversation: Readonly<{
    url: string;
    state: "already-focused" | "focused";
  }>;
  readonly verify_gpt_conversation_identity: GptConversationIdentityOutput;
  readonly open_gpt_execution_profile: Readonly<{ state: "profile-popup-open" }>;
  readonly open_gpt_model_selector_v2: Readonly<{
    selectionVersion: "gpt-model-selection.v2";
    state: "model-selector-open" | "model-selector-opened";
  }>;
  readonly select_exact_gpt_model_v2: Readonly<{
    modelDisplayName: string;
    previousChecked: "true" | "false";
    selectionVersion: "gpt-model-selection.v2";
    state: "exact-model-selected";
  }>;
  readonly ensure_gpt_reasoning_requirement: GptReasoningRequirementResult & Readonly<{
    state: "already-selected" | "selected";
  }>;
  readonly close_gpt_execution_profile: Readonly<{ state: "profile-popup-closed" }>;
  readonly open_gpt_attachment_control: Readonly<{ state: "upload-choice-ready" }>;
  readonly attach_approved_gpt_files_once: Readonly<{
    files: readonly GptApprovedFile[];
    mutationSent: boolean;
  }>;
  readonly reconcile_gpt_attachment_set: Readonly<{ files: readonly GptApprovedFile[] }>;
  readonly write_exact_gpt_prompt: GptPromptIdentity;
  readonly reconcile_gpt_draft: GptPromptIdentity & Readonly<{
    attachmentDisplayNames: readonly string[];
  }>;
  readonly submit_exact_gpt_turn_once: Readonly<{ promptHash: GptHash; mutationSent: boolean }>;
  readonly reconcile_gpt_turn_submission: Readonly<{
    turnMarker: string;
    userTurnId: string;
    canonicalConversationUrl: string;
    promptHash: GptHash;
    conversationIdentityHash: GptHash;
  }>;
  readonly wait_for_stable_gpt_text: Readonly<{
    assistantTurnId: string;
    responseHash: GptHash;
    responseText: string;
  }>;
  readonly checkpoint_gpt_text_response: Readonly<{
    assistantTurnId: string;
    rawDomHtml: string;
    rawDomHash: GptHash;
    semanticText: string;
    semanticTextHash: GptHash;
  }>;
  readonly wait_for_stable_gpt_image: Readonly<{
    assistantTurnId: string;
    semanticMediaId: "gpt-generated-image-main";
    mediaHash: GptHash;
  }>;
  readonly checkpoint_gpt_generated_image: Readonly<{
    assistantTurnId: string;
    semanticMediaId: "gpt-generated-image-main";
    mediaHash: GptHash;
    authorityTargetHash: GptHash;
    authorityDocumentHash: GptHash;
    canonicalConversationUrl: string;
    promptHash: GptHash;
    turnMarker: string;
    artifactId: string;
    originalBytes: Uint8Array;
    webpBytes: Uint8Array;
    sha256: GptHash;
    originalSha256: GptHash;
    originalSizeBytes: number;
    originalMediaType: `image/${string}`;
    originalWidth: number;
    originalHeight: number;
    bytes: number;
    mediaType: "image/webp";
    width: 1200;
    height: 630;
    predecessorTextCheckpoint: GptTextCheckpointInput;
  }>;
  readonly open_gpt_checkpoint_actions_menu: Readonly<{
    sourceAssistantTurnId: string;
    state: "already-open" | "opened";
  }>;
  readonly open_gpt_fork_destination_menu: Readonly<{
    sourceAssistantTurnId: string;
    state: "already-open" | "opened";
  }>;
  readonly fork_exact_gpt_conversation_at_checkpoint: GptForkOutput;
  readonly persist_gpt_continuation: Readonly<{ continuationRef: string }>;
  readonly reserve_exact_gpt_continuation_once: Readonly<{
    continuationRef: string;
    reservationIdentityHash: GptHash;
    laneVersion: number;
    reservationFenceHash: GptHash;
    complete: boolean;
    opaqueReadGrantHash: GptHash | null;
  }>;
  readonly complete_exact_gpt_continuation_reservation_once: Readonly<{
    continuationRef: string;
    reservationIdentityHash: GptHash;
    laneVersion: number;
    completionReceiptHash: GptHash;
  }>;
  readonly acquire_gpt_continuation_lane: GptContinuationLane;
  readonly advance_gpt_continuation_lane: Readonly<{ advanced: true }>;
  readonly release_gpt_continuation_lane: Readonly<{ released: true }>;
}

export type GptChildCapabilityId = keyof GptChildInputMap & keyof GptChildOutputMap;

export type GptChildCall<K extends GptChildCapabilityId> = Readonly<{
  child: K;
  input: GptChildInputMap[K];
}>;

export type GptChildSuccess<K extends GptChildCapabilityId> = Readonly<{
  status: "success";
  value: GptChildOutputMap[K];
}>;
