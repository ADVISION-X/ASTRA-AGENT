import { createHash } from "node:crypto";

import type {
  BrowserAtomicStepIdentity,
  BrowserAtomicStepOutcome,
  BrowserTargetLease,
} from "../../lib/browser/browser-authority-api.js";
import type {
  GptChildCapabilityId,
  GptChildInputMap,
  GptChildOutputMap,
  GptReasoningRequirementResult,
} from "./child-types.js";
import type { ProviderStoppedEmptyProof } from "../../lib/execution-failure.js";

export type {
  GptApprovedFile,
  GptChildCapabilityId,
  GptChildInputMap,
  GptChildOutputMap,
  ProductGptChildCapabilityId,
  GptHash,
  GptReasoningRequirementResult,
} from "./child-types.js";

export const GPT_MODEL_SELECTION_VERSION = "gpt-model-selection.v2" as const;

export type GptFailureClassification = "failed";
type GptChildProfile = "DOM_OBSERVATION" | "TARGET_LOCAL_MUTATION"
  | "PROVIDER_EFFECT_ONCE";
type GptChildDecision = "DONE" | "ACT" | "WAIT" | "FAIL_CLOSED";

export type GptChildBrowserFact = Readonly<{
  exactCallIdentityHash: `sha256:${string}`;
  providerEffectIdentityHash: `sha256:${string}` | null;
  childCapabilityId: GptChildCapabilityId;
  effectScope: "target_local" | "provider_effect";
  browserOutcome: "DISPATCHED" | "CONFIRMED" | "REJECTED";
  mutationOutcome: "no" | "dispatched" | "confirmed";
  terminalAt: string | null;
  evidenceRef: string;
  evidenceHash: `sha256:${string}`;
}>;

interface ChildCapabilityContract {
  readonly childCapabilityId: string;
  readonly contractVersion: 2 | 3 | 4 | 5 | 6;
  readonly semanticIntent: string;
  readonly owner: "gpt";
  readonly inputSchema: `gpt.${string}.input.v1` | `gpt.${string}.input.v2` | `gpt.${string}.input.v3`;
  readonly requiredTargetKind: "chatgpt" | "none";
  readonly profile: GptChildProfile;
  readonly boundedWait: boolean;
  readonly decisions: readonly GptChildDecision[];
  readonly precondition: string;
  readonly actionQualification: string;
  readonly mutationBudget: "zero" | "zero-or-one-browser-input" | "exactly-one-browser-input"
    | "zero-or-one-transaction";
  readonly oneObservationOrMutation: "bounded-observation" | "at-most-one-mutation";
  readonly positivePostcondition: string;
  readonly negativePostcondition: string;
  readonly evidenceSchema: "gpt-child-capability-proof.v2";
  readonly evidenceBoundary: "hashes-refs-counts-typed-causes-only";
  readonly failureClassification: readonly GptFailureClassification[];
  readonly replayPolicy: "observation-only" | "target-local-per-generation"
    | "provider-effect-once" | "transaction-identical-readback";
}

const GPT_CHILD_CONTRACTS = {
  acknowledge_known_gpt_rate_limit: { childCapabilityId: "acknowledge_known_gpt_rate_limit", contractVersion: 2, semanticIntent: "acknowledge the one exact known GPT rate-limit dialog after Runtime persisted the provider gate", owner: "gpt", inputSchema: "gpt.acknowledge_known_gpt_rate_limit.input.v1", requiredTargetKind: "chatgpt", profile: "TARGET_LOCAL_MUTATION", boundedWait: true, decisions: ["ACT", "FAIL_CLOSED"], precondition: "Runtime provider cooldown intent is durable and the same target document exact dialog fact is bound", actionQualification: "one exact known dialog and one enabled exact acknowledgement button", mutationBudget: "exactly-one-browser-input", oneObservationOrMutation: "at-most-one-mutation", positivePostcondition: "after at least 2500ms the exact known dialog is absent on the same document", negativePostcondition: "absent multiple mismatched disabled stale or unknown state fails closed without another click", evidenceSchema: "gpt-child-capability-proof.v2", evidenceBoundary: "hashes-refs-counts-typed-causes-only", failureClassification: ["failed"], replayPolicy: "target-local-per-generation" },
  reconcile_gpt_attachment_set: { childCapabilityId: "reconcile_gpt_attachment_set", contractVersion: 3, semanticIntent: "prove all and only approved attachments are ready", owner: "gpt", inputSchema: "gpt.reconcile_gpt_attachment_set.input.v1", requiredTargetKind: "chatgpt", profile: "DOM_OBSERVATION", boundedWait: true, decisions: ["DONE", "WAIT", "FAIL_CLOSED"], precondition: "approved provider display names and Product timeout", actionQualification: "never", mutationBudget: "zero", oneObservationOrMutation: "bounded-observation", positivePostcondition: "one composer exact visible approved attachment card set and zero scoped spinner and pending action", negativePostcondition: "composer or attachment ambiguity unexpected duplicate card or Product deadline fails closed", evidenceSchema: "gpt-child-capability-proof.v2", evidenceBoundary: "hashes-refs-counts-typed-causes-only", failureClassification: ["failed"], replayPolicy: "observation-only" },
  checkpoint_gpt_text_response: { childCapabilityId: "checkpoint_gpt_text_response", contractVersion: 6, semanticIntent: "checkpoint exact assistant outerHTML and deterministic semantic text", owner: "gpt", inputSchema: "gpt.checkpoint_gpt_text_response.input.v3", requiredTargetKind: "chatgpt", profile: "DOM_OBSERVATION", boundedWait: false, decisions: ["DONE", "FAIL_CLOSED"], precondition: "confirmed canonical conversation and exact user turn identity", actionQualification: "never", mutationBudget: "zero", oneObservationOrMutation: "bounded-observation", positivePostcondition: "one revision-bound task-owned artifact binds the exact adjacent assistant turn DOM and semantic text hashes", negativePostcondition: "zero multiple stale revision drift wrong adjacency content hash drift or unproven twenty-minute stopped-empty window fails closed", evidenceSchema: "gpt-child-capability-proof.v2", evidenceBoundary: "hashes-refs-counts-typed-causes-only", failureClassification: ["failed"], replayPolicy: "observation-only" },
  checkpoint_gpt_generated_image: { childCapabilityId: "checkpoint_gpt_generated_image", contractVersion: 6, semanticIntent: "checkpoint the exact assistant image content", owner: "gpt", inputSchema: "gpt.checkpoint_gpt_generated_image.input.v3", requiredTargetKind: "chatgpt", profile: "DOM_OBSERVATION", boundedWait: false, decisions: ["DONE", "FAIL_CLOSED"], precondition: "confirmed canonical conversation and exact user turn identity", actionQualification: "never", mutationBudget: "zero", oneObservationOrMutation: "bounded-observation", positivePostcondition: "one unique authenticated image byte artifact is bound to the exact adjacent assistant turn and current Browser authority", negativePostcondition: "zero multiple changed unauthorized wrong-adjacency or byte-invalid media fails closed without any viewer save or native download action", evidenceSchema: "gpt-child-capability-proof.v2", evidenceBoundary: "hashes-refs-counts-typed-causes-only", failureClassification: ["failed"], replayPolicy: "observation-only" },
  prepare_clean_gpt_chat: { childCapabilityId: "prepare_clean_gpt_chat", contractVersion: 4, semanticIntent: "prove a fresh chat and clear only an otherwise isolated stale draft", owner: "gpt", inputSchema: "gpt.prepare_clean_gpt_chat.input.v1", requiredTargetKind: "chatgpt", profile: "TARGET_LOCAL_MUTATION", boundedWait: true, decisions: ["DONE", "ACT", "WAIT", "FAIL_CLOSED"], precondition: "one composer zero turns attachments and generating", actionQualification: "only a nonempty stale exact editable draft remains", mutationBudget: "zero-or-one-browser-input", oneObservationOrMutation: "at-most-one-mutation", positivePostcondition: "revision-bound exact empty editable draft with zero prior state", negativePostcondition: "the Browser-owned post-action fresh read proves prior turn attachment generating ambiguity or uncleared draft", evidenceSchema: "gpt-child-capability-proof.v2", evidenceBoundary: "hashes-refs-counts-typed-causes-only", failureClassification: ["failed"], replayPolicy: "target-local-per-generation" },
  open_gpt_execution_profile: { childCapabilityId: "open_gpt_execution_profile", contractVersion: 3, semanticIntent: "open the unique execution profile popup", owner: "gpt", inputSchema: "gpt.open_gpt_execution_profile.input.v2", requiredTargetKind: "chatgpt", profile: "TARGET_LOCAL_MUTATION", boundedWait: true, decisions: ["DONE", "ACT", "WAIT", "FAIL_CLOSED"], precondition: "same-Document six-query profile topology is fully absent hydrating or fully open on an approved reasoning scale", actionQualification: "five profile rows absent and one collapsed qualified trigger", mutationBudget: "zero-or-one-browser-input", oneObservationOrMutation: "at-most-one-mutation", positivePostcondition: "same mutation packet proves one complete popup reasoning topology on scale zero through two or zero through four and expanded trigger", negativePostcondition: "partial ambiguity unknown scale ineligible candidate document drift timeout or incomplete same-packet topology fails closed", evidenceSchema: "gpt-child-capability-proof.v2", evidenceBoundary: "hashes-refs-counts-typed-causes-only", failureClassification: ["failed"], replayPolicy: "target-local-per-generation" },
  open_gpt_model_selector_v2: { childCapabilityId: "open_gpt_model_selector_v2", contractVersion: 4, semanticIntent: "make the exact approved model option available", owner: "gpt", inputSchema: "gpt.open_gpt_model_selector_v2.input.v2", requiredTargetKind: "chatgpt", profile: "TARGET_LOCAL_MUTATION", boundedWait: true, decisions: ["DONE", "ACT", "FAIL_CLOSED"], precondition: "the exact approved model option is present or one unique model-selector entry is openable", actionQualification: "unique model-selector entry only", mutationBudget: "zero-or-one-browser-input", oneObservationOrMutation: "at-most-one-mutation", positivePostcondition: "one exact target model option is present", negativePostcondition: "target model absent or ambiguous and unavailable entry fail closed", evidenceSchema: "gpt-child-capability-proof.v2", evidenceBoundary: "hashes-refs-counts-typed-causes-only", failureClassification: ["failed"], replayPolicy: "target-local-per-generation" },
  select_exact_gpt_model_v2: { childCapabilityId: "select_exact_gpt_model_v2", contractVersion: 4, semanticIntent: "select the unique exact approved model option", owner: "gpt", inputSchema: "gpt.select_exact_gpt_model_v2.input.v2", requiredTargetKind: "chatgpt", profile: "TARGET_LOCAL_MUTATION", boundedWait: true, decisions: ["ACT", "FAIL_CLOSED"], precondition: "one exact target model option exists with a boolean selected state", actionQualification: "the unique exact target model option only", mutationBudget: "exactly-one-browser-input", oneObservationOrMutation: "at-most-one-mutation", positivePostcondition: "the retained exact clicked option proves aria-checked true and the selector closes", negativePostcondition: "target option ambiguity invalid checked state unselected clicked option or selector remaining open fails closed", evidenceSchema: "gpt-child-capability-proof.v2", evidenceBoundary: "hashes-refs-counts-typed-causes-only", failureClassification: ["failed"], replayPolicy: "target-local-per-generation" },
  ensure_gpt_reasoning_requirement: { childCapabilityId: "ensure_gpt_reasoning_requirement", contractVersion: 4, semanticIntent: "resolve and satisfy the Product-frozen reasoning requirement on an approved observed scale", owner: "gpt", inputSchema: "gpt.ensure_gpt_reasoning_requirement.input.v2", requiredTargetKind: "chatgpt", profile: "TARGET_LOCAL_MUTATION", boundedWait: true, decisions: ["DONE", "ACT", "FAIL_CLOSED"], precondition: "one enabled reasoning control one approved slider scale and one required profile.reasoningRequirement", actionQualification: "the resolved numeric value differs from the observed current value", mutationBudget: "zero-or-one-browser-input", oneObservationOrMutation: "at-most-one-mutation", positivePostcondition: "fresh aria-valuenow equals the resolved tier and requested resolved degraded facts remain distinct", negativePostcondition: "unknown scale unavailable exact tier ambiguity disabled state or readback mismatch fails closed after the shared transient DOM confirmation stages", evidenceSchema: "gpt-child-capability-proof.v2", evidenceBoundary: "hashes-refs-counts-typed-causes-only", failureClassification: ["failed"], replayPolicy: "target-local-per-generation" },
  close_gpt_execution_profile: { childCapabilityId: "close_gpt_execution_profile", contractVersion: 4, semanticIntent: "close the current execution profile popup", owner: "gpt", inputSchema: "gpt.close_gpt_execution_profile.input.v2", requiredTargetKind: "chatgpt", profile: "TARGET_LOCAL_MUTATION", boundedWait: true, decisions: ["DONE", "ACT", "FAIL_CLOSED"], precondition: "popup absent with collapsed trigger and usable composer or one expanded exact trigger owning the popup", actionQualification: "owned popup present and trigger uniquely qualified", mutationBudget: "zero-or-one-browser-input", oneObservationOrMutation: "at-most-one-mutation", positivePostcondition: "same packet proves popup absent trigger collapsed and one usable composer", negativePostcondition: "wrong owner ambiguity or retained popup fails closed after the shared transient DOM confirmation stages", evidenceSchema: "gpt-child-capability-proof.v2", evidenceBoundary: "hashes-refs-counts-typed-causes-only", failureClassification: ["failed"], replayPolicy: "target-local-per-generation" },
  open_gpt_attachment_control: { childCapabilityId: "open_gpt_attachment_control", contractVersion: 3, semanticIntent: "open the exact composer attachment menu", owner: "gpt", inputSchema: "gpt.open_gpt_attachment_control.input.v1", requiredTargetKind: "chatgpt", profile: "TARGET_LOCAL_MUTATION", boundedWait: true, decisions: ["DONE", "ACT", "WAIT", "FAIL_CLOSED"], precondition: "same-Document unique composer-scoped visible trigger unique active menu and one exact visible upload leaf", actionQualification: "active menu absent and one qualified composer-scoped visible trigger", mutationBudget: "zero-or-one-browser-input", oneObservationOrMutation: "at-most-one-mutation", positivePostcondition: "same mutation packet proves one qualified composer trigger one active menu and one exact visible upload-from-computer leaf", negativePostcondition: "missing ambiguous hidden ineligible wrong-text candidate document drift timeout or incomplete same-packet menu fails closed", evidenceSchema: "gpt-child-capability-proof.v2", evidenceBoundary: "hashes-refs-counts-typed-causes-only", failureClassification: ["failed"], replayPolicy: "target-local-per-generation" },
  write_exact_gpt_prompt: { childCapabilityId: "write_exact_gpt_prompt", contractVersion: 4, semanticIntent: "make the composer retain the exact approved prompt", owner: "gpt", inputSchema: "gpt.write_exact_gpt_prompt.input.v1", requiredTargetKind: "chatgpt", profile: "TARGET_LOCAL_MUTATION", boundedWait: true, decisions: ["DONE", "ACT", "WAIT", "FAIL_CLOSED"], precondition: "one composer and exact approved prompt", actionQualification: "exact editable retained value is not already exact", mutationBudget: "zero-or-one-browser-input", oneObservationOrMutation: "at-most-one-mutation", positivePostcondition: "revision-bound exact editable hash proves retained bytes equal the approved prompt", negativePostcondition: "the Browser-owned post-action fresh read proves retained-value mismatch ambiguity disabled composer drift or semantic fallback", evidenceSchema: "gpt-child-capability-proof.v2", evidenceBoundary: "hashes-refs-counts-typed-causes-only", failureClassification: ["failed"], replayPolicy: "target-local-per-generation" },
  attach_approved_gpt_files_once: { childCapabilityId: "attach_approved_gpt_files_once", contractVersion: 3, semanticIntent: "select the complete approved file set in one batch", owner: "gpt", inputSchema: "gpt.attach_approved_gpt_files_once.input.v1", requiredTargetKind: "chatgpt", profile: "TARGET_LOCAL_MUTATION", boundedWait: true, decisions: ["DONE", "ACT", "FAIL_CLOSED"], precondition: "exact scoped upload leaf grants file input, immutable content hashes, and zero foreign composer attachment card", actionQualification: "one current connected enabled file input accepts the approved batch", mutationBudget: "zero-or-one-browser-input", oneObservationOrMutation: "at-most-one-mutation", positivePostcondition: "one batch selected and exact attachment set readback is possible", negativePostcondition: "grant scope input identity candidate set mismatch or a foreign composer attachment card fails closed before any upload after the shared transient DOM confirmation stages", evidenceSchema: "gpt-child-capability-proof.v2", evidenceBoundary: "hashes-refs-counts-typed-causes-only", failureClassification: ["failed"], replayPolicy: "target-local-per-generation" },
  submit_exact_gpt_turn_once: { childCapabilityId: "submit_exact_gpt_turn_once", contractVersion: 6, semanticIntent: "submit the exact approved outgoing turn once", owner: "gpt", inputSchema: "gpt.submit_exact_gpt_turn_once.input.v2", requiredTargetKind: "chatgpt", profile: "PROVIDER_EFFECT_ONCE", boundedWait: true, decisions: ["ACT", "FAIL_CLOSED"], precondition: "the click command atomically revalidates one outgoing identity from prompt hash and approved attachment labels", actionQualification: "Browser exact-call authority WAL current Target Document and mechanical click qualification", mutationBudget: "exactly-one-browser-input", oneObservationOrMutation: "at-most-one-mutation", positivePostcondition: "the exact new user turn has the approved rendered prompt hash and the same provider effect Browser terminal receipt", negativePostcondition: "outgoing identity mismatch missing exact new user turn Provider negative or unclosed dispatch fails closed", evidenceSchema: "gpt-child-capability-proof.v2", evidenceBoundary: "hashes-refs-counts-typed-causes-only", failureClassification: ["failed"], replayPolicy: "provider-effect-once" },
} as const satisfies Readonly<{
  [K in GptChildCapabilityId]: ChildCapabilityContract & Readonly<{ childCapabilityId: K }>;
}>;

export const GPT_CHILD_CAPABILITY_CONTRACTS: Readonly<Record<GptChildCapabilityId, ChildCapabilityContract>> =
  Object.freeze(GPT_CHILD_CONTRACTS);

export const gptCanonicalHash = (value: unknown): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;

type GptChildExecutionIdentity = Readonly<{
  executionId: string;
  jobId: string;
  attemptId: string;
  resultRevision: number;
  productStepId: string;
  callId: string;
  inputHash: `sha256:${string}`;
  actionOrdinal: number;
}>;

type GptChildCapabilityIntentMap = {
  readonly [K in GptChildCapabilityId]: GptChildExecutionIdentity & Readonly<{
    childCapabilityId: K;
    input: GptChildInputMap[K];
  }>;
};

export type GptAnyChildCapabilityIntent = GptChildCapabilityIntentMap[GptChildCapabilityId];

export type GptChildCapabilityIntent<K extends GptChildCapabilityId = GptChildCapabilityId> =
  GptChildExecutionIdentity & Readonly<{
    childCapabilityId: K;
    input: GptChildInputMap[K];
  }>;

export interface GptChildCapabilityProof {
  readonly schemaVersion: "gpt-child-capability-proof.v2";
  readonly childCapabilityId: GptChildCapabilityId;
  readonly childContractVersion: 2 | 3 | 4 | 5 | 6;
  readonly childStatus: "success" | "failed";
  readonly childReasonCode: string;
  readonly exactCallIdentityHash: `sha256:${string}`;
  readonly internalDecisionCode: GptChildDecision | null;
  readonly executionId: string;
  readonly jobId: string;
  readonly attemptId: string;
  readonly resultRevision: number;
  readonly productStepId: string;
  readonly callId: string;
  readonly inputHash: `sha256:${string}`;
  readonly actionOrdinal: number;
  readonly authorityRefHashes: readonly `sha256:${string}`[];
  readonly factResultIds: readonly string[];
  readonly candidateCardinality: Readonly<{ raw: number | null; eligible: number | null }>;
  readonly observationRevisionHash: `sha256:${string}` | null;
  readonly committedMutation: "no" | "dispatched" | "confirmed";
  readonly postconditionResult: "passed" | "failed" | "pending";
  readonly browserFact: GptChildBrowserFact | null;
  readonly nativeFailureCode: string | null;
  readonly stoppedEmptyProof?: ProviderStoppedEmptyProof;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly evidenceRef: string;
  readonly evidenceHash: `sha256:${string}`;
}

type GptChildResultCommon = Readonly<{
  proof: GptChildCapabilityProof;
  reasoningRequirementResult: GptReasoningRequirementResult | null;
  failureCause: Readonly<{ name: string; code: string | null }> | null;
  failureBrowserEffect: Readonly<{
    effectScope: "target_local" | "provider_effect";
    childCapabilityId: string;
    browserOutcome: "DISPATCHED" | "CONFIRMED" | "REJECTED";
    providerEffectIdentityHash?: `sha256:${string}` | null;
  }> | null;
}>;

export type GptChildCapabilityResult<K extends GptChildCapabilityId = GptChildCapabilityId> =
  | GptChildResultCommon & Readonly<{
      status: "success";
      value: GptChildOutputMap[K];
      failureCode: null;
      failureCause: null;
      failureBrowserEffect: null;
    }>
  | GptChildResultCommon & Readonly<{
      status: GptFailureClassification;
      value: null;
      failureCode: string;
    }>;

export type GptExecutionContext = Readonly<{
  dataDir: string;
  browser?: BrowserTargetLease;
  browserAtomicIdentity?: BrowserAtomicStepIdentity;
  signal?: AbortSignal;
  waitForProviderObservation?: (
    observationDeadlineAt: number,
    reason: GptProviderObservationWaitReason,
  ) => Promise<"reobserve" | "deadline">;
  assertProviderInputAllowed?: () => void;
  rateLimitAckDispatchNotAfter?: number;
  confirmedProviderEffectReadback?: Readonly<{
    terminalPayload: unknown;
    terminalAt: string;
    authorityRef: string;
    authorityHash: `sha256:${string}`;
    providerEffectIdentityHash: `sha256:${string}`;
    mutationOutcome: "no" | "confirmed";
  }>;
  dispatchedProviderEffectReadback?: BrowserAtomicStepOutcome;
  confirmedRateLimitAcknowledgementReadback?: Readonly<{
    terminalPayload: unknown;
    browserFact?: GptChildBrowserFact;
  }>;
  onProof?: (proof: GptChildCapabilityProof) => Promise<void>;
}>;

export type GptProviderObservationWaitReason =
  | "initial-observation"
  | "exact-user-turn-unavailable"
  | "adjacent-assistant-missing"
  | "stop-present"
  | "stopped-empty-confirming"
  | "generated-image-source-pending";

export const gptExactCallIdentityHash = (
  intent: Readonly<{
    jobId: string;
    attemptId: string;
    resultRevision: number;
    productStepId: string;
    callId: string;
    childCapabilityId: GptChildCapabilityId;
    inputHash: `sha256:${string}`;
  }>,
): `sha256:${string}` => `sha256:${createHash("sha256").update(JSON.stringify([
  intent.jobId,
  ...(GPT_CHILD_CAPABILITY_CONTRACTS[intent.childCapabilityId].replayPolicy === "provider-effect-once"
    ? [] : [intent.attemptId]),
  intent.resultRevision,
  intent.productStepId,
  intent.callId,
  intent.childCapabilityId,
  intent.inputHash,
])).digest("hex")}`;

export interface GptAbilityGroup {
  execute<K extends GptChildCapabilityId>(
    intent: GptChildCapabilityIntent<K>,
    context: GptExecutionContext,
  ): Promise<GptChildCapabilityResult<K>>;
}
