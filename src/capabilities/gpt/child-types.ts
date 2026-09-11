import type {
  GptExecutionProfile,
  GptReasoningRequirement,
  GptReasoningTier,
} from "./schema.js";

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

type GptResponseCheckpointInput = Readonly<{
  probeBudgetMs: number;
  canonicalConversationUrl: string;
  expectedPromptHash: GptHash;
  turnMarker: string;
}>;

export interface GptChildInputMap {
  readonly prepare_clean_gpt_chat: Readonly<{ timeoutMs: number }>;
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
  readonly submit_exact_gpt_turn_once: Readonly<{
    files: readonly GptApprovedFile[];
    promptHash: GptHash;
  }>;
  readonly checkpoint_gpt_text_response: GptResponseCheckpointInput;
  readonly checkpoint_gpt_generated_image: Readonly<{
    canonicalConversationUrl: string;
    expectedPromptHash: GptHash;
    probeBudgetMs: number;
    turnMarker: string;
  }>;
}

export interface GptChildOutputMap {
  readonly prepare_clean_gpt_chat: Readonly<{
    composer: number;
    turns: number;
    attachments: number;
    generating: number;
    draftEmpty: true;
    staleDraftCleared: boolean;
  }>;
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
  readonly submit_exact_gpt_turn_once: Readonly<{
    status: "CONFIRMED";
    promptHash: GptHash;
    mutationSent: true;
    canonicalConversationUrl: string;
    userTurnId: string;
  }>;
  readonly checkpoint_gpt_text_response: Readonly<{
    assistantTurnId: string;
    rawDomHtml: string;
    rawDomHash: GptHash;
    semanticText: string;
    semanticTextHash: GptHash;
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
  }>;
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
