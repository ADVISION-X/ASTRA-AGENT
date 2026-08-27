import type { BrowserTargetLease } from "../../lib/browser/browser-authority-api.js";
import type { GptContinuationStorePort } from "./session/gpt-continuation-store-port.js";

export const GPT_ABILITY_GROUP_ID = "gpt" as const;
export const GPT_TRANSPORT = "gpt-web" as const;

const DOM_OBSERVATIONS = [
  "bind_exact_gpt_target",
  "observe_gpt_document",
  "verify_gpt_workspace",
  "verify_clean_gpt_chat",
  "verify_gpt_conversation_identity",
  "observe_gpt_execution_profile",
  "verify_gpt_execution_profile",
  "verify_gpt_attachment_set",
  "verify_exact_gpt_prompt",
  "verify_gpt_turn_submission",
  "observe_exact_gpt_assistant_turn",
  "wait_for_stable_gpt_response",
  "checkpoint_gpt_text_response",
  "capture_gpt_response_artifact",
  "verify_exact_gpt_title",
] as const;

const DOM_MUTATIONS = [
  "restore_gpt_operator_source",
  "acknowledge_known_gpt_rate_limit",
  "dismiss_known_gpt_search_dialog",
  "cleanup_owned_gpt_transient_ui",
  "focus_exact_gpt_conversation",
  "open_gpt_conversation_search",
  "write_gpt_conversation_search_key",
  "select_exact_gpt_conversation_result",
  "open_gpt_fork_control",
  "commit_gpt_checkpoint_fork",
  "open_gpt_model_selector",
  "select_exact_gpt_model",
  "open_gpt_reasoning_selector",
  "select_exact_gpt_reasoning_tier",
  "open_gpt_attachment_control",
  "attach_approved_gpt_files_once",
  "focus_exact_gpt_composer",
  "write_exact_gpt_prompt",
  "submit_exact_gpt_turn",
  "checkpoint_gpt_generated_image",
  "open_gpt_title_control",
  "write_exact_gpt_title",
  "commit_gpt_title",
] as const;

const SESSION_MUTATIONS = [
  "persist_gpt_continuation",
  "acquire_gpt_continuation_lane",
  "advance_gpt_continuation_lane",
  "release_gpt_continuation_lane",
] as const;

const SESSION_OBSERVATIONS = ["recover_gpt_response_checkpoint"] as const;

export const GPT_CHILD_CAPABILITY_IDS = Object.freeze([
  ...DOM_OBSERVATIONS,
  ...DOM_MUTATIONS,
  ...SESSION_MUTATIONS,
  ...SESSION_OBSERVATIONS,
].sort((left, right) => left.localeCompare(right)));

export type GptChildCapabilityId = typeof GPT_CHILD_CAPABILITY_IDS[number];
export type GptFailureClassification = "recovery_pending" | "review_required" | "failed";

export interface ChildCapabilityContract {
  readonly childCapabilityId: GptChildCapabilityId;
  readonly contractVersion: 1;
  readonly inputSchema: `gpt.${string}.input.v1`;
  readonly requiredTargetKind: "chatgpt" | "none";
  readonly allowedDocumentTransition: "forbidden" | "exact-navigation-only" | "not-applicable";
  readonly precondition: string;
  readonly oneObservationOrMutation: "bounded-observation" | "at-most-one-mutation";
  readonly postcondition: string;
  readonly evidenceSchema: "gpt-child-capability-proof.v1";
  readonly failureClassification: readonly GptFailureClassification[];
  readonly replayPolicy: "observation-only" | "never-after-mutation-dispatch";
}

const transitionIds = new Set<GptChildCapabilityId>([
  "focus_exact_gpt_conversation",
  "select_exact_gpt_conversation_result",
  "commit_gpt_checkpoint_fork",
  "restore_gpt_operator_source",
  "submit_exact_gpt_turn",
]);
const sessionIds = new Set<GptChildCapabilityId>([...SESSION_MUTATIONS, ...SESSION_OBSERVATIONS]);
const mutationIds = new Set<GptChildCapabilityId>([...DOM_MUTATIONS, ...SESSION_MUTATIONS]);

const contractFor = (childCapabilityId: GptChildCapabilityId): ChildCapabilityContract => {
  const session = sessionIds.has(childCapabilityId);
  const mutation = mutationIds.has(childCapabilityId);
  return Object.freeze({
    childCapabilityId,
    contractVersion: 1,
    inputSchema: `gpt.${childCapabilityId}.input.v1`,
    requiredTargetKind: session ? "none" : "chatgpt",
    allowedDocumentTransition: session
      ? "not-applicable"
      : transitionIds.has(childCapabilityId) ? "exact-navigation-only" : "forbidden",
    precondition: session
      ? "exact continuation or checkpoint identity supplied by the Product Plugin execution"
      : "one Browser Authority exact Target and current Document",
    oneObservationOrMutation: mutation ? "at-most-one-mutation" : "bounded-observation",
    postcondition: "the named child returns its direct typed postcondition and evidence",
    evidenceSchema: "gpt-child-capability-proof.v1",
    failureClassification: ["recovery_pending", "review_required", "failed"] as const,
    replayPolicy: mutation ? "never-after-mutation-dispatch" : "observation-only",
  });
};

export const GPT_CHILD_CAPABILITY_CONTRACTS = Object.freeze(
  Object.fromEntries(GPT_CHILD_CAPABILITY_IDS.map((id) => [id, contractFor(id)])),
) as Readonly<Record<GptChildCapabilityId, ChildCapabilityContract>>;

export type GptChildCapabilityIntent = Readonly<{
  childCapabilityId: GptChildCapabilityId;
  executionId: string;
  input: Readonly<Record<string, unknown>>;
}>;

export interface GptChildCapabilityProof {
  readonly schemaVersion: "gpt-child-capability-proof.v1";
  readonly childCapabilityId: GptChildCapabilityId;
  readonly executionId: string;
  readonly targetRefHash: `sha256:${string}` | null;
  readonly beforeDocumentRefHash: `sha256:${string}` | null;
  readonly afterDocumentRefHash: `sha256:${string}` | null;
  readonly beforeUrl: string | null;
  readonly afterUrl: string | null;
  readonly candidateCount: number | null;
  readonly observedSemantics: readonly string[];
  readonly committedMutation: "no" | "yes" | "unknown";
  readonly postconditionResult: "passed" | "failed" | "unknown";
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
