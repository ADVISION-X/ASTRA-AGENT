import type { BrowserTargetLease } from "../../lib/browser/browser-authority-api.js";
import type { GptContinuationStorePort } from "./session/gpt-continuation-store-port.js";

export const GPT_ABILITY_GROUP_ID = "gpt" as const;
export const GPT_TRANSPORT = "gpt-web" as const;
export const GPT_TURN_FLOW_VERSION = "gpt-turn-flow.v3" as const;
export const GPT_MODEL_SELECTION_VERSION = "gpt-model-selection.v2" as const;

const PAGE_OBSERVATIONS = [
  "prepare_clean_gpt_chat",
  "verify_gpt_conversation_identity",
  "reconcile_gpt_attachment_set",
  "reconcile_gpt_draft",
  "reconcile_gpt_turn_submission",
  "wait_for_stable_gpt_text",
  "checkpoint_gpt_text_response",
  "wait_for_stable_gpt_image",
  "checkpoint_gpt_generated_image",
] as const;

const PAGE_MUTATIONS = [
  "focus_exact_gpt_conversation",
  "open_gpt_execution_profile",
  "open_gpt_model_selector_v2",
  "select_exact_gpt_model_v2",
  "ensure_exact_gpt_reasoning_tier",
  "close_gpt_execution_profile",
  "open_gpt_attachment_control",
  "attach_approved_gpt_files_once",
  "write_exact_gpt_prompt",
  "submit_exact_gpt_turn_once",
] as const;

const SESSION_MUTATIONS = [
  "persist_gpt_continuation",
  "acquire_gpt_continuation_lane",
  "advance_gpt_continuation_lane",
  "release_gpt_continuation_lane",
] as const;

export const GPT_CHILD_CAPABILITY_IDS = Object.freeze([
  ...PAGE_OBSERVATIONS,
  ...PAGE_MUTATIONS,
  ...SESSION_MUTATIONS,
].sort((left, right) => left.localeCompare(right)));

export type GptChildCapabilityId = typeof GPT_CHILD_CAPABILITY_IDS[number];
export type GptFailureClassification = "failed";

export interface ChildCapabilityContract {
  readonly childCapabilityId: GptChildCapabilityId;
  readonly contractVersion: 2;
  readonly inputSchema: `gpt.${string}.input.v1`;
  readonly requiredTargetKind: "chatgpt" | "none";
  readonly allowedDocumentTransition: "forbidden" | "exact-navigation-only" | "not-applicable";
  readonly precondition: string;
  readonly oneObservationOrMutation: "bounded-observation" | "at-most-one-mutation";
  readonly postcondition: string;
  readonly evidenceSchema: "gpt-child-capability-proof.v2";
  readonly failureClassification: readonly GptFailureClassification[];
  readonly replayPolicy: "observation-only" | "target-local-per-generation" | "provider-effect-once";
}

const transitionIds = new Set<GptChildCapabilityId>([
  "focus_exact_gpt_conversation",
  "submit_exact_gpt_turn_once",
  "reconcile_gpt_turn_submission",
]);
const sessionIds = new Set<GptChildCapabilityId>(SESSION_MUTATIONS);
const mutationIds = new Set<GptChildCapabilityId>([...PAGE_MUTATIONS, ...SESSION_MUTATIONS]);
const providerEffectIds = new Set<GptChildCapabilityId>([
  "attach_approved_gpt_files_once",
  "submit_exact_gpt_turn_once",
]);

const contractFor = (childCapabilityId: GptChildCapabilityId): ChildCapabilityContract => {
  const session = sessionIds.has(childCapabilityId);
  const mutation = mutationIds.has(childCapabilityId);
  return Object.freeze({
    childCapabilityId,
    contractVersion: 2,
    inputSchema: `gpt.${childCapabilityId}.input.v1`,
    requiredTargetKind: session ? "none" : "chatgpt",
    allowedDocumentTransition: session
      ? "not-applicable"
      : transitionIds.has(childCapabilityId) ? "exact-navigation-only" : "forbidden",
    precondition: session
      ? "exact continuation identity supplied by the current durable execution"
      : "one Browser Authority exact Target and current Document",
    oneObservationOrMutation: mutation ? "at-most-one-mutation" : "bounded-observation",
    postcondition: "the named child returns its direct typed postcondition and evidence",
    evidenceSchema: "gpt-child-capability-proof.v2",
    failureClassification: ["failed"] as const,
    replayPolicy: !mutation
      ? "observation-only"
      : providerEffectIds.has(childCapabilityId)
        ? "provider-effect-once"
        : "target-local-per-generation",
  });
};

export const GPT_CHILD_CAPABILITY_CONTRACTS = Object.freeze(
  Object.fromEntries(GPT_CHILD_CAPABILITY_IDS.map((id) => [id, contractFor(id)])),
) as Readonly<Record<GptChildCapabilityId, ChildCapabilityContract>>;

export type GptChildCapabilityIntent = Readonly<{
  childCapabilityId: GptChildCapabilityId;
  executionId: string;
  flowVersion: typeof GPT_TURN_FLOW_VERSION;
  stepIndex: number;
  inputHash: `sha256:${string}`;
  pluginStepId: string;
  actionOrdinal: number;
  input: Readonly<Record<string, unknown>>;
}>;

export interface GptChildCapabilityProof {
  readonly schemaVersion: "gpt-child-capability-proof.v2";
  readonly childCapabilityId: GptChildCapabilityId;
  readonly executionId: string;
  readonly flowVersion: typeof GPT_TURN_FLOW_VERSION;
  readonly stepIndex: number;
  readonly inputHash: `sha256:${string}`;
  readonly pluginStepId: string;
  readonly actionOrdinal: number;
  readonly targetRefHash: `sha256:${string}` | null;
  readonly beforeDocumentRefHash: `sha256:${string}` | null;
  readonly afterDocumentRefHash: `sha256:${string}` | null;
  readonly candidateCount: number | null;
  readonly observedSemantics: readonly string[];
  readonly committedMutation: "no" | "dispatched" | "confirmed";
  readonly postconditionResult: "passed" | "failed" | "pending";
  readonly startedAt: string;
  readonly endedAt: string;
  readonly evidenceRef: string;
  readonly evidenceHash: `sha256:${string}`;
}

export type GptChildCapabilityResult = Readonly<{
  status: "success" | GptFailureClassification;
  value: unknown;
  proof: GptChildCapabilityProof;
  failureCode: string | null;
}>;

export type GptExecutionContext = Readonly<{
  dataDir: string;
  browser?: BrowserTargetLease;
  signal?: AbortSignal;
  continuationStore?: GptContinuationStorePort;
  onProof?: (proof: GptChildCapabilityProof) => Promise<void>;
}>;

export interface GptAbilityGroup {
  readonly abilityGroupId: typeof GPT_ABILITY_GROUP_ID;
  readonly transport: typeof GPT_TRANSPORT;
  listChildCapabilityIds(): readonly GptChildCapabilityId[];
  execute(intent: GptChildCapabilityIntent, context: GptExecutionContext): Promise<GptChildCapabilityResult>;
}
