import { createHash } from "node:crypto";

import type { BrowserTargetLease } from "../../lib/browser/browser-authority-api.js";
import type {
  GptChildCapabilityId,
  GptChildInputMap,
  GptChildOutputMap,
  GptReasoningRequirementResult,
} from "./child-types.js";
import type { GptContinuationStorePort } from "./session/gpt-continuation-store-port.js";

export type {
  GptApprovedFile,
  GptChildCall,
  GptChildCapabilityId,
  GptChildInputMap,
  GptChildOutputMap,
  GptChildSuccess,
  GptContinuationCheckpointInput,
  GptHash,
  GptReasoningRequirementResult,
  GptTextCheckpointInput,
} from "./child-types.js";

export const GPT_ABILITY_GROUP_ID = "gpt" as const;
export const GPT_TRANSPORT = "gpt-web" as const;
export const GPT_MODEL_SELECTION_VERSION = "gpt-model-selection.v2" as const;

export type GptFailureClassification = "failed";
type GptChildProfile = "DOM_OBSERVATION" | "TARGET_LOCAL_MUTATION"
  | "PROVIDER_EFFECT_ONCE" | "CONTINUATION_TRANSACTION";
type GptChildDecision = "DONE" | "ACT" | "WAIT" | "FAIL_CLOSED";

export type GptChildBrowserFact = Readonly<{
  exactCallIdentityHash: `sha256:${string}`;
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
  readonly contractVersion: 2 | 3 | 4 | 5;
  readonly semanticIntent: string;
  readonly owner: "gpt";
  readonly inputSchema: `gpt.${string}.input.v1` | `gpt.${string}.input.v2`;
  readonly requiredTargetKind: "chatgpt" | "none";
  readonly allowedDocumentTransition: "forbidden" | "exact-navigation-only" | "not-applicable";
  readonly profile: GptChildProfile;
  readonly boundedWait: boolean;
  readonly decisions: readonly GptChildDecision[];
  readonly precondition: string;
  readonly actionQualification: string;
  readonly mutationBudget: "zero" | "zero-or-one-browser-input" | "exactly-one-browser-input" | "zero-or-one-transaction";
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
  verify_gpt_conversation_identity: { childCapabilityId: "verify_gpt_conversation_identity", contractVersion: 3, semanticIntent: "prove the current conversation matches the exact canonical identity", owner: "gpt", inputSchema: "gpt.verify_gpt_conversation_identity.input.v1", requiredTargetKind: "chatgpt", allowedDocumentTransition: "exact-navigation-only", profile: "DOM_OBSERVATION", boundedWait: false, decisions: ["DONE", "FAIL_CLOSED"], precondition: "exact conversation URL marker prompt hash and response hash", actionQualification: "never", mutationBudget: "zero", oneObservationOrMutation: "bounded-observation", positivePostcondition: "one revision-bound canonical conversation and exact adjacent turn pair match", negativePostcondition: "missing ambiguous stale revision-drifted or mismatched identity fails closed", evidenceSchema: "gpt-child-capability-proof.v2", evidenceBoundary: "hashes-refs-counts-typed-causes-only", failureClassification: ["failed"], replayPolicy: "observation-only" },
  reconcile_gpt_attachment_set: { childCapabilityId: "reconcile_gpt_attachment_set", contractVersion: 3, semanticIntent: "prove all and only approved attachments are ready", owner: "gpt", inputSchema: "gpt.reconcile_gpt_attachment_set.input.v1", requiredTargetKind: "chatgpt", allowedDocumentTransition: "forbidden", profile: "DOM_OBSERVATION", boundedWait: true, decisions: ["DONE", "WAIT", "FAIL_CLOSED"], precondition: "approved provider display names and Product timeout", actionQualification: "never", mutationBudget: "zero", oneObservationOrMutation: "bounded-observation", positivePostcondition: "one composer exact visible approved attachment card set and zero scoped spinner and pending action", negativePostcondition: "composer or attachment ambiguity unexpected duplicate card or Product deadline fails closed", evidenceSchema: "gpt-child-capability-proof.v2", evidenceBoundary: "hashes-refs-counts-typed-causes-only", failureClassification: ["failed"], replayPolicy: "observation-only" },
  reconcile_gpt_draft: { childCapabilityId: "reconcile_gpt_draft", contractVersion: 4, semanticIntent: "prove composer retains the exact prompt approved attachments and enabled send control", owner: "gpt", inputSchema: "gpt.reconcile_gpt_draft.input.v1", requiredTargetKind: "chatgpt", allowedDocumentTransition: "forbidden", profile: "DOM_OBSERVATION", boundedWait: false, decisions: ["DONE", "FAIL_CLOSED"], precondition: "exact prompt approved attachment set and one composer", actionQualification: "never", mutationBudget: "zero", oneObservationOrMutation: "bounded-observation", positivePostcondition: "two consecutive fresh revisions on the same Target and Document bind identical exact draft attachment and enabled-send facts", negativePostcondition: "missing ambiguous unstable changed unscoped attachment or semantic-projection-only draft fails closed", evidenceSchema: "gpt-child-capability-proof.v2", evidenceBoundary: "hashes-refs-counts-typed-causes-only", failureClassification: ["failed"], replayPolicy: "observation-only" },
  reconcile_gpt_turn_submission: { childCapabilityId: "reconcile_gpt_turn_submission", contractVersion: 4, semanticIntent: "prove Provider accepted the exact user turn without resubmission", owner: "gpt", inputSchema: "gpt.reconcile_gpt_turn_submission.input.v1", requiredTargetKind: "chatgpt", allowedDocumentTransition: "exact-navigation-only", profile: "DOM_OBSERVATION", boundedWait: true, decisions: ["DONE", "WAIT", "FAIL_CLOSED"], precondition: "same accepted attempt confirmed-submit receipt marker prompt hash and locator", actionQualification: "never", mutationBudget: "zero", oneObservationOrMutation: "bounded-observation", positivePostcondition: "confirmed submit receipt exact user turn permanent conversation locator and exact empty editable composer all match", negativePostcondition: "receipt mismatch stable mismatch ambiguity lifecycle failure or deadline fails closed", evidenceSchema: "gpt-child-capability-proof.v2", evidenceBoundary: "hashes-refs-counts-typed-causes-only", failureClassification: ["failed"], replayPolicy: "observation-only" },
  checkpoint_gpt_text_response: { childCapabilityId: "checkpoint_gpt_text_response", contractVersion: 3, semanticIntent: "checkpoint exact assistant outerHTML and deterministic semantic text", owner: "gpt", inputSchema: "gpt.checkpoint_gpt_text_response.input.v1", requiredTargetKind: "chatgpt", allowedDocumentTransition: "exact-navigation-only", profile: "DOM_OBSERVATION", boundedWait: false, decisions: ["DONE", "FAIL_CLOSED"], precondition: "exact stable assistant turn identity", actionQualification: "never", mutationBudget: "zero", oneObservationOrMutation: "bounded-observation", positivePostcondition: "one revision-bound task-owned artifact binds the exact predecessor prompt DOM and semantic text hashes", negativePostcondition: "zero multiple stale revision drift predecessor mismatch or hash drift fails closed", evidenceSchema: "gpt-child-capability-proof.v2", evidenceBoundary: "hashes-refs-counts-typed-causes-only", failureClassification: ["failed"], replayPolicy: "observation-only" },
  checkpoint_gpt_generated_image: { childCapabilityId: "checkpoint_gpt_generated_image", contractVersion: 3, semanticIntent: "checkpoint the exact assistant image content", owner: "gpt", inputSchema: "gpt.checkpoint_gpt_generated_image.input.v1", requiredTargetKind: "chatgpt", allowedDocumentTransition: "exact-navigation-only", profile: "DOM_OBSERVATION", boundedWait: false, decisions: ["DONE", "FAIL_CLOSED"], precondition: "exact assistant turn semantic media and predecessor text receipt", actionQualification: "never", mutationBudget: "zero", oneObservationOrMutation: "bounded-observation", positivePostcondition: "one authenticated original image identity is bound to the same conversation prompt and predecessor text checkpoint", negativePostcondition: "zero multiple changed unauthorized or predecessor-mismatched media fails closed", evidenceSchema: "gpt-child-capability-proof.v2", evidenceBoundary: "hashes-refs-counts-typed-causes-only", failureClassification: ["failed"], replayPolicy: "observation-only" },
  prepare_clean_gpt_chat: { childCapabilityId: "prepare_clean_gpt_chat", contractVersion: 4, semanticIntent: "prove a fresh chat and clear only an otherwise isolated stale draft", owner: "gpt", inputSchema: "gpt.prepare_clean_gpt_chat.input.v1", requiredTargetKind: "chatgpt", allowedDocumentTransition: "forbidden", profile: "TARGET_LOCAL_MUTATION", boundedWait: true, decisions: ["DONE", "ACT", "WAIT", "FAIL_CLOSED"], precondition: "one composer zero turns attachments and generating", actionQualification: "only a nonempty stale exact editable draft remains", mutationBudget: "zero-or-one-browser-input", oneObservationOrMutation: "at-most-one-mutation", positivePostcondition: "revision-bound exact empty editable draft with zero prior state", negativePostcondition: "transient draft-clear readback remains unsettled for 2500ms or prior turn attachment generating ambiguity or uncleared draft fails closed", evidenceSchema: "gpt-child-capability-proof.v2", evidenceBoundary: "hashes-refs-counts-typed-causes-only", failureClassification: ["failed"], replayPolicy: "target-local-per-generation" },
  focus_exact_gpt_conversation: { childCapabilityId: "focus_exact_gpt_conversation", contractVersion: 5, semanticIntent: "focus the Product-frozen exact conversation", owner: "gpt", inputSchema: "gpt.focus_exact_gpt_conversation.input.v2", requiredTargetKind: "chatgpt", allowedDocumentTransition: "exact-navigation-only", profile: "TARGET_LOCAL_MUTATION", boundedWait: true, decisions: ["DONE", "ACT", "WAIT", "FAIL_CLOSED"], precondition: "verified canonical conversation URL plus Product-frozen marker and prompt hash", actionQualification: "current canonical URL or exact identity turn differs", mutationBudget: "zero-or-one-browser-input", oneObservationOrMutation: "at-most-one-mutation", positivePostcondition: "current URL and exactly one marker plus prompt-hash turn match", negativePostcondition: "transient navigation readback remains unsettled for 2500ms or URL marker prompt identity mismatch fails closed", evidenceSchema: "gpt-child-capability-proof.v2", evidenceBoundary: "hashes-refs-counts-typed-causes-only", failureClassification: ["failed"], replayPolicy: "target-local-per-generation" },
  open_gpt_execution_profile: { childCapabilityId: "open_gpt_execution_profile", contractVersion: 3, semanticIntent: "open the unique execution profile popup", owner: "gpt", inputSchema: "gpt.open_gpt_execution_profile.input.v2", requiredTargetKind: "chatgpt", allowedDocumentTransition: "forbidden", profile: "TARGET_LOCAL_MUTATION", boundedWait: true, decisions: ["DONE", "ACT", "WAIT", "FAIL_CLOSED"], precondition: "same-Document six-query profile topology is fully absent hydrating or fully open on an approved reasoning scale", actionQualification: "five profile rows absent and one collapsed qualified trigger", mutationBudget: "zero-or-one-browser-input", oneObservationOrMutation: "at-most-one-mutation", positivePostcondition: "same mutation packet proves one complete popup reasoning topology on scale zero through two or zero through four and expanded trigger", negativePostcondition: "partial ambiguity unknown scale ineligible candidate document drift timeout or incomplete same-packet topology fails closed", evidenceSchema: "gpt-child-capability-proof.v2", evidenceBoundary: "hashes-refs-counts-typed-causes-only", failureClassification: ["failed"], replayPolicy: "target-local-per-generation" },
  open_gpt_model_selector_v2: { childCapabilityId: "open_gpt_model_selector_v2", contractVersion: 3, semanticIntent: "open the unique advanced model selector", owner: "gpt", inputSchema: "gpt.open_gpt_model_selector_v2.input.v2", requiredTargetKind: "chatgpt", allowedDocumentTransition: "forbidden", profile: "TARGET_LOCAL_MUTATION", boundedWait: false, decisions: ["DONE", "ACT", "FAIL_CLOSED"], precondition: "one coherent popup entry simple and advanced topology with the exact execution-profile model display name", actionQualification: "OPENABLE topology only", mutationBudget: "zero-or-one-browser-input", oneObservationOrMutation: "at-most-one-mutation", positivePostcondition: "stable ALREADY_OPEN topology has zero entry zero simple one active advanced panel and one exact target model radio", negativePostcondition: "target model unavailable transition legacy or any other topology and failed direct readback fail closed", evidenceSchema: "gpt-child-capability-proof.v2", evidenceBoundary: "hashes-refs-counts-typed-causes-only", failureClassification: ["failed"], replayPolicy: "target-local-per-generation" },
  select_exact_gpt_model_v2: { childCapabilityId: "select_exact_gpt_model_v2", contractVersion: 3, semanticIntent: "select the exact model and consume the same Browser mutation postcondition packet", owner: "gpt", inputSchema: "gpt.select_exact_gpt_model_v2.input.v2", requiredTargetKind: "chatgpt", allowedDocumentTransition: "forbidden", profile: "TARGET_LOCAL_MUTATION", boundedWait: false, decisions: ["ACT", "FAIL_CLOSED"], precondition: "v2 execution profile ALREADY_OPEN topology and one exact radio with boolean checked state", actionQualification: "the unique radio is qualified whether checked true or false", mutationBudget: "exactly-one-browser-input", oneObservationOrMutation: "at-most-one-mutation", positivePostcondition: "same mutation packet proves the exact clicked radio aria-checked true plus popup retained entry collapsed simple active advanced absent", negativePostcondition: "radio ambiguity invalid checked state unselected clicked radio or incomplete same-packet postcondition fails closed", evidenceSchema: "gpt-child-capability-proof.v2", evidenceBoundary: "hashes-refs-counts-typed-causes-only", failureClassification: ["failed"], replayPolicy: "target-local-per-generation" },
  ensure_gpt_reasoning_requirement: { childCapabilityId: "ensure_gpt_reasoning_requirement", contractVersion: 3, semanticIntent: "resolve and satisfy the Product-frozen reasoning requirement on an approved observed scale", owner: "gpt", inputSchema: "gpt.ensure_gpt_reasoning_requirement.input.v2", requiredTargetKind: "chatgpt", allowedDocumentTransition: "forbidden", profile: "TARGET_LOCAL_MUTATION", boundedWait: false, decisions: ["DONE", "ACT", "FAIL_CLOSED"], precondition: "one enabled reasoning control one approved slider scale and one required profile.reasoningRequirement", actionQualification: "the resolved numeric value differs from the observed current value", mutationBudget: "zero-or-one-browser-input", oneObservationOrMutation: "at-most-one-mutation", positivePostcondition: "fresh aria-valuenow equals the resolved tier and requested resolved degraded facts remain distinct", negativePostcondition: "unknown scale unavailable exact tier ambiguity disabled state or readback mismatch fails closed", evidenceSchema: "gpt-child-capability-proof.v2", evidenceBoundary: "hashes-refs-counts-typed-causes-only", failureClassification: ["failed"], replayPolicy: "target-local-per-generation" },
  close_gpt_execution_profile: { childCapabilityId: "close_gpt_execution_profile", contractVersion: 3, semanticIntent: "close the current execution profile popup", owner: "gpt", inputSchema: "gpt.close_gpt_execution_profile.input.v2", requiredTargetKind: "chatgpt", allowedDocumentTransition: "forbidden", profile: "TARGET_LOCAL_MUTATION", boundedWait: false, decisions: ["DONE", "ACT", "FAIL_CLOSED"], precondition: "popup absent with collapsed trigger and usable composer or one expanded exact trigger owning the popup", actionQualification: "owned popup present and trigger uniquely qualified", mutationBudget: "zero-or-one-browser-input", oneObservationOrMutation: "at-most-one-mutation", positivePostcondition: "same packet proves popup absent trigger collapsed and one usable composer", negativePostcondition: "wrong owner ambiguous trigger retained popup or obstructed composer fails closed", evidenceSchema: "gpt-child-capability-proof.v2", evidenceBoundary: "hashes-refs-counts-typed-causes-only", failureClassification: ["failed"], replayPolicy: "target-local-per-generation" },
  open_gpt_attachment_control: { childCapabilityId: "open_gpt_attachment_control", contractVersion: 3, semanticIntent: "open the exact composer attachment menu", owner: "gpt", inputSchema: "gpt.open_gpt_attachment_control.input.v1", requiredTargetKind: "chatgpt", allowedDocumentTransition: "forbidden", profile: "TARGET_LOCAL_MUTATION", boundedWait: true, decisions: ["DONE", "ACT", "WAIT", "FAIL_CLOSED"], precondition: "same-Document unique composer-scoped visible trigger unique active menu and one exact visible upload leaf", actionQualification: "active menu absent and one qualified composer-scoped visible trigger", mutationBudget: "zero-or-one-browser-input", oneObservationOrMutation: "at-most-one-mutation", positivePostcondition: "same mutation packet proves one qualified composer trigger one active menu and one exact visible upload-from-computer leaf", negativePostcondition: "missing ambiguous hidden ineligible wrong-text candidate document drift timeout or incomplete same-packet menu fails closed", evidenceSchema: "gpt-child-capability-proof.v2", evidenceBoundary: "hashes-refs-counts-typed-causes-only", failureClassification: ["failed"], replayPolicy: "target-local-per-generation" },
  write_exact_gpt_prompt: { childCapabilityId: "write_exact_gpt_prompt", contractVersion: 4, semanticIntent: "make the composer retain the exact approved prompt", owner: "gpt", inputSchema: "gpt.write_exact_gpt_prompt.input.v1", requiredTargetKind: "chatgpt", allowedDocumentTransition: "forbidden", profile: "TARGET_LOCAL_MUTATION", boundedWait: true, decisions: ["DONE", "ACT", "WAIT", "FAIL_CLOSED"], precondition: "one composer and exact approved prompt", actionQualification: "exact editable retained value is not already exact", mutationBudget: "zero-or-one-browser-input", oneObservationOrMutation: "at-most-one-mutation", positivePostcondition: "revision-bound exact editable hash proves retained bytes equal the approved prompt", negativePostcondition: "transient retained-value mismatch remains unsettled for 2500ms or ambiguity disabled composer drift and semantic fallback fails closed", evidenceSchema: "gpt-child-capability-proof.v2", evidenceBoundary: "hashes-refs-counts-typed-causes-only", failureClassification: ["failed"], replayPolicy: "target-local-per-generation" },
  wait_for_stable_gpt_text: { childCapabilityId: "wait_for_stable_gpt_text", contractVersion: 4, semanticIntent: "wait for the exact assistant text to become stable", owner: "gpt", inputSchema: "gpt.wait_for_stable_gpt_text.input.v2", requiredTargetKind: "chatgpt", allowedDocumentTransition: "exact-navigation-only", profile: "TARGET_LOCAL_MUTATION", boundedWait: true, decisions: ["DONE", "ACT", "WAIT", "FAIL_CLOSED"], precondition: "exact conversation identity user turn marker prompt hash and deadline", actionQualification: "one exact rate-limit dialog may be acknowledged once", mutationBudget: "zero-or-one-browser-input", oneObservationOrMutation: "at-most-one-mutation", positivePostcondition: "one identity-bound adjacent assistant semantic text is stable for the bounded interval", negativePostcondition: "terminal decline repeated dialog ambiguity identity drift or deadline fails closed", evidenceSchema: "gpt-child-capability-proof.v2", evidenceBoundary: "hashes-refs-counts-typed-causes-only", failureClassification: ["failed"], replayPolicy: "target-local-per-generation" },
  wait_for_stable_gpt_image: { childCapabilityId: "wait_for_stable_gpt_image", contractVersion: 4, semanticIntent: "wait for the exact assistant image to become stable", owner: "gpt", inputSchema: "gpt.wait_for_stable_gpt_image.input.v2", requiredTargetKind: "chatgpt", allowedDocumentTransition: "exact-navigation-only", profile: "TARGET_LOCAL_MUTATION", boundedWait: true, decisions: ["DONE", "ACT", "WAIT", "FAIL_CLOSED"], precondition: "exact conversation identity user turn marker prompt hash and deadline", actionQualification: "one exact rate-limit dialog may be acknowledged once", mutationBudget: "zero-or-one-browser-input", oneObservationOrMutation: "at-most-one-mutation", positivePostcondition: "one identity-bound adjacent assistant semantic media content identity is stable", negativePostcondition: "terminal decline repeated dialog zero multiple changed media identity drift or deadline fails closed", evidenceSchema: "gpt-child-capability-proof.v2", evidenceBoundary: "hashes-refs-counts-typed-causes-only", failureClassification: ["failed"], replayPolicy: "target-local-per-generation" },
  open_gpt_checkpoint_actions_menu: { childCapabilityId: "open_gpt_checkpoint_actions_menu", contractVersion: 3, semanticIntent: "open or confirm the exact source checkpoint actions menu", owner: "gpt", inputSchema: "gpt.open_gpt_checkpoint_actions_menu.input.v1", requiredTargetKind: "chatgpt", allowedDocumentTransition: "forbidden", profile: "TARGET_LOCAL_MUTATION", boundedWait: false, decisions: ["DONE", "ACT", "FAIL_CLOSED"], precondition: "exact source conversation assistant turn marker prompt and response hashes", actionQualification: "source-bound menu absent and one source more-actions control", mutationBudget: "zero-or-one-browser-input", oneObservationOrMutation: "at-most-one-mutation", positivePostcondition: "one active menu owner-bound to the exact source-turn trigger and one exact open-new-fork leaf", negativePostcondition: "source mismatch wrong owner menu or leaf missing ambiguous or unbound fails closed", evidenceSchema: "gpt-child-capability-proof.v2", evidenceBoundary: "hashes-refs-counts-typed-causes-only", failureClassification: ["failed"], replayPolicy: "target-local-per-generation" },
  open_gpt_fork_destination_menu: { childCapabilityId: "open_gpt_fork_destination_menu", contractVersion: 2, semanticIntent: "open or confirm the exact fork destination menu", owner: "gpt", inputSchema: "gpt.open_gpt_fork_destination_menu.input.v1", requiredTargetKind: "chatgpt", allowedDocumentTransition: "forbidden", profile: "TARGET_LOCAL_MUTATION", boundedWait: false, decisions: ["DONE", "ACT", "FAIL_CLOSED"], precondition: "fresh exact source identity active checkpoint menu and one exact open-new-fork leaf", actionQualification: "destination menu absent and the unique open-new-fork leaf remains source-bound", mutationBudget: "zero-or-one-browser-input", oneObservationOrMutation: "at-most-one-mutation", positivePostcondition: "one destination menu owner-bound to the frozen open-new-fork entry and one exact branch-to-new-chat leaf", negativePostcondition: "source checkpoint menu wrong owner destination menu or leaf missing ambiguous changed or unbound fails closed", evidenceSchema: "gpt-child-capability-proof.v2", evidenceBoundary: "hashes-refs-counts-typed-causes-only", failureClassification: ["failed"], replayPolicy: "target-local-per-generation" },
  attach_approved_gpt_files_once: { childCapabilityId: "attach_approved_gpt_files_once", contractVersion: 2, semanticIntent: "select the complete approved file set in one batch", owner: "gpt", inputSchema: "gpt.attach_approved_gpt_files_once.input.v1", requiredTargetKind: "chatgpt", allowedDocumentTransition: "forbidden", profile: "PROVIDER_EFFECT_ONCE", boundedWait: false, decisions: ["DONE", "ACT", "FAIL_CLOSED"], precondition: "exact scoped upload leaf grants file input and immutable content hashes", actionQualification: "one current connected enabled file input accepts the approved batch", mutationBudget: "zero-or-one-browser-input", oneObservationOrMutation: "at-most-one-mutation", positivePostcondition: "one batch selected and exact attachment set readback is possible", negativePostcondition: "grant scope input identity candidate or set mismatch fails closed", evidenceSchema: "gpt-child-capability-proof.v2", evidenceBoundary: "hashes-refs-counts-typed-causes-only", failureClassification: ["failed"], replayPolicy: "provider-effect-once" },
  submit_exact_gpt_turn_once: { childCapabilityId: "submit_exact_gpt_turn_once", contractVersion: 4, semanticIntent: "submit the exact prompt attachments and turn marker once", owner: "gpt", inputSchema: "gpt.submit_exact_gpt_turn_once.input.v1", requiredTargetKind: "chatgpt", allowedDocumentTransition: "exact-navigation-only", profile: "PROVIDER_EFFECT_ONCE", boundedWait: true, decisions: ["DONE", "ACT", "WAIT", "FAIL_CLOSED"], precondition: "revision-bound exact editable draft marker approved attachments and one enabled send control", actionQualification: "no exact submitted turn exists and precondition remains current", mutationBudget: "zero-or-one-browser-input", oneObservationOrMutation: "at-most-one-mutation", positivePostcondition: "one exact user turn canonical conversation URL exact empty editable composer zero pending attachments and permanent locator", negativePostcondition: "residual draft or attachment Browser same-packet outer-turn hydration remains unsettled for 5000ms changed prompt candidate ambiguity Provider negative semantic fallback or unclosed dispatch fails closed", evidenceSchema: "gpt-child-capability-proof.v2", evidenceBoundary: "hashes-refs-counts-typed-causes-only", failureClassification: ["failed"], replayPolicy: "provider-effect-once" },
  fork_exact_gpt_conversation_at_checkpoint: { childCapabilityId: "fork_exact_gpt_conversation_at_checkpoint", contractVersion: 4, semanticIntent: "fork once from the already-open exact source-bound destination menu", owner: "gpt", inputSchema: "gpt.fork_exact_gpt_conversation_at_checkpoint.input.v1", requiredTargetKind: "chatgpt", allowedDocumentTransition: "exact-navigation-only", profile: "PROVIDER_EFFECT_ONCE", boundedWait: false, decisions: ["DONE", "ACT", "FAIL_CLOSED"], precondition: "fresh exact source identity active destination menu and one exact branch-to-new-chat leaf", actionQualification: "no child relation exists and the unique final leaf remains source-bound", mutationBudget: "zero-or-one-browser-input", oneObservationOrMutation: "at-most-one-mutation", positivePostcondition: "Browser transfers the same logical Target to the verified child page and retires the source page then GPT proves one child canonical URL and one source-bound relation", negativePostcondition: "menu source leaf child takeover or relation missing ambiguous changed leaked or unclosed fails closed", evidenceSchema: "gpt-child-capability-proof.v2", evidenceBoundary: "hashes-refs-counts-typed-causes-only", failureClassification: ["failed"], replayPolicy: "provider-effect-once" },
  persist_gpt_continuation: { childCapabilityId: "persist_gpt_continuation", contractVersion: 2, semanticIntent: "atomically bind an exact continuation origin", owner: "gpt", inputSchema: "gpt.persist_gpt_continuation.input.v1", requiredTargetKind: "none", allowedDocumentTransition: "not-applicable", profile: "CONTINUATION_TRANSACTION", boundedWait: false, decisions: ["DONE", "ACT", "FAIL_CLOSED"], precondition: "exact owner subject authorization provider checkpoint and optional frontier", actionQualification: "row is absent", mutationBudget: "zero-or-one-transaction", oneObservationOrMutation: "at-most-one-mutation", positivePostcondition: "origin and current provider checkpoint pair are identical and immutable", negativePostcondition: "identity content authorization or pair conflict fails closed", evidenceSchema: "gpt-child-capability-proof.v2", evidenceBoundary: "hashes-refs-counts-typed-causes-only", failureClassification: ["failed"], replayPolicy: "transaction-identical-readback" },
  reserve_exact_gpt_continuation_once: { childCapabilityId: "reserve_exact_gpt_continuation_once", contractVersion: 2, semanticIntent: "reserve the exact continuation once", owner: "gpt", inputSchema: "gpt.reserve_exact_gpt_continuation_once.input.v1", requiredTargetKind: "none", allowedDocumentTransition: "not-applicable", profile: "CONTINUATION_TRANSACTION", boundedWait: false, decisions: ["DONE", "ACT", "FAIL_CLOSED"], precondition: "exact continuation creator lane fence effect and provenance", actionQualification: "matching reservation is absent", mutationBudget: "zero-or-one-transaction", oneObservationOrMutation: "at-most-one-mutation", positivePostcondition: "one reservation CAS row reads back identically", negativePostcondition: "owner authorization version provenance or competing content fails closed", evidenceSchema: "gpt-child-capability-proof.v2", evidenceBoundary: "hashes-refs-counts-typed-causes-only", failureClassification: ["failed"], replayPolicy: "transaction-identical-readback" },
  complete_exact_gpt_continuation_reservation_once: { childCapabilityId: "complete_exact_gpt_continuation_reservation_once", contractVersion: 2, semanticIntent: "complete the exact reservation and release its lane", owner: "gpt", inputSchema: "gpt.complete_exact_gpt_continuation_reservation_once.input.v1", requiredTargetKind: "none", allowedDocumentTransition: "not-applicable", profile: "CONTINUATION_TRANSACTION", boundedWait: false, decisions: ["DONE", "ACT", "FAIL_CLOSED"], precondition: "same reservation lane fence provider artifact admission and read grant", actionQualification: "reservation is incomplete and owned by this exact creator", mutationBudget: "zero-or-one-transaction", oneObservationOrMutation: "at-most-one-mutation", positivePostcondition: "all completion fields commit atomically and reservation lane is released", negativePostcondition: "partial fields owner version authorization or content conflict fails closed", evidenceSchema: "gpt-child-capability-proof.v2", evidenceBoundary: "hashes-refs-counts-typed-causes-only", failureClassification: ["failed"], replayPolicy: "transaction-identical-readback" },
  acquire_gpt_continuation_lane: { childCapabilityId: "acquire_gpt_continuation_lane", contractVersion: 2, semanticIntent: "acquire the exact complete continuation lane", owner: "gpt", inputSchema: "gpt.acquire_gpt_continuation_lane.input.v1", requiredTargetKind: "none", allowedDocumentTransition: "not-applicable", profile: "CONTINUATION_TRANSACTION", boundedWait: false, decisions: ["DONE", "ACT", "FAIL_CLOSED"], precondition: "complete row expected version and one mutually exclusive typed authorization", actionQualification: "lane is free or identically owned", mutationBudget: "zero-or-one-transaction", oneObservationOrMutation: "at-most-one-mutation", positivePostcondition: "lane owner and new version read back exactly", negativePostcondition: "incomplete row variant mix owner subject authorization or version conflict fails closed", evidenceSchema: "gpt-child-capability-proof.v2", evidenceBoundary: "hashes-refs-counts-typed-causes-only", failureClassification: ["failed"], replayPolicy: "transaction-identical-readback" },
  advance_gpt_continuation_lane: { childCapabilityId: "advance_gpt_continuation_lane", contractVersion: 2, semanticIntent: "advance the exact continuation frontier and release the lane", owner: "gpt", inputSchema: "gpt.advance_gpt_continuation_lane.input.v1", requiredTargetKind: "none", allowedDocumentTransition: "not-applicable", profile: "CONTINUATION_TRANSACTION", boundedWait: false, decisions: ["DONE", "ACT", "FAIL_CLOSED"], precondition: "same lane owner version and exact new provider checkpoint pair", actionQualification: "current pair differs and CAS version matches", mutationBudget: "zero-or-one-transaction", oneObservationOrMutation: "at-most-one-mutation", positivePostcondition: "provider checkpoint advance atomically and lane owner is null", negativePostcondition: "owner version pair or content conflict fails closed", evidenceSchema: "gpt-child-capability-proof.v2", evidenceBoundary: "hashes-refs-counts-typed-causes-only", failureClassification: ["failed"], replayPolicy: "transaction-identical-readback" },
  release_gpt_continuation_lane: { childCapabilityId: "release_gpt_continuation_lane", contractVersion: 2, semanticIntent: "release the exact continuation lane without advancing", owner: "gpt", inputSchema: "gpt.release_gpt_continuation_lane.input.v1", requiredTargetKind: "none", allowedDocumentTransition: "not-applicable", profile: "CONTINUATION_TRANSACTION", boundedWait: false, decisions: ["DONE", "ACT", "FAIL_CLOSED"], precondition: "same exact lane owner and version", actionQualification: "lane is currently owned by this exact job", mutationBudget: "zero-or-one-transaction", oneObservationOrMutation: "at-most-one-mutation", positivePostcondition: "lane owner is null and release version reads back exactly", negativePostcondition: "foreign owner version conflict or simultaneous advance fails closed", evidenceSchema: "gpt-child-capability-proof.v2", evidenceBoundary: "hashes-refs-counts-typed-causes-only", failureClassification: ["failed"], replayPolicy: "transaction-identical-readback" },
} as const satisfies Readonly<{
  [K in GptChildCapabilityId]: ChildCapabilityContract & Readonly<{ childCapabilityId: K }>;
}>;

export const GPT_CHILD_CAPABILITY_IDS = Object.freeze(
  (Object.keys(GPT_CHILD_CONTRACTS) as GptChildCapabilityId[]).sort((left, right) => left.localeCompare(right)),
);
export const GPT_CHILD_CAPABILITY_CONTRACTS: Readonly<Record<GptChildCapabilityId, ChildCapabilityContract>> =
  Object.freeze(GPT_CHILD_CONTRACTS);

type GptChildExecutionIdentity = Readonly<{
  executionId: string;
  jobId: string;
  attemptId: string;
  pluginId: string;
  pluginVersion: number;
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
  readonly childContractVersion: 2 | 3 | 4 | 5;
  readonly childStatus: "success" | "failed";
  readonly childReasonCode: string;
  readonly exactCallIdentityHash: `sha256:${string}`;
  readonly internalDecisionCode: GptChildDecision | null;
  readonly executionId: string;
  readonly jobId: string;
  readonly attemptId: string;
  readonly pluginId: string;
  readonly pluginVersion: number;
  readonly productStepId: string;
  readonly callId: string;
  readonly inputHash: `sha256:${string}`;
  readonly actionOrdinal: number;
  readonly targetRefHash: `sha256:${string}` | null;
  readonly beforeDocumentRefHash: `sha256:${string}` | null;
  readonly afterDocumentRefHash: `sha256:${string}` | null;
  readonly authorityRefHashes: readonly `sha256:${string}`[];
  readonly factResultIds: readonly string[];
  readonly candidateCardinality: Readonly<{ raw: number | null; eligible: number | null }>;
  readonly observationRevisionHash: `sha256:${string}` | null;
  readonly committedMutation: "no" | "dispatched" | "confirmed";
  readonly postconditionResult: "passed" | "failed" | "pending";
  readonly browserFact: GptChildBrowserFact | null;
  readonly nativeFailureCode: string | null;
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
  signal?: AbortSignal;
  continuationStore?: GptContinuationStorePort;
  confirmedProviderSubmitReceipt?: Readonly<{
    sourceAttemptId: string;
    sourceExactCallIdentityHash: `sha256:${string}`;
    sourceActionOrdinal: number;
    sourceProductStepId: string;
    sourceCallId: string;
    sourceTargetRef: string;
    sourceDocumentRef: string;
    readbackDocumentRefHash: `sha256:${string}`;
    sourceTerminalAt: string;
    evidenceRef: string;
    evidenceHash: `sha256:${string}`;
    promptHash: `sha256:${string}`;
    turnMarker: string;
  }>;
  mutationMode?: "normal" | "readback";
  yieldForProviderWait?: (durationMs: number) => Promise<void>;
  navigateCrossConversationPoll?: (
    canonicalConversationUrl: string,
    probeDeadlineAt: number,
  ) => Promise<"navigated" | "reobserve" | "deadline">;
  onProof?: (proof: GptChildCapabilityProof) => Promise<void>;
}>;

export const gptExactCallIdentityHash = (
  intent: Readonly<{
    jobId: string;
    attemptId: string;
    pluginId: string;
    pluginVersion: number;
    productStepId: string;
    callId: string;
    childCapabilityId: GptChildCapabilityId;
    inputHash: `sha256:${string}`;
  }>,
): `sha256:${string}` => `sha256:${createHash("sha256").update(JSON.stringify([
  intent.jobId,
  intent.attemptId,
  intent.pluginId,
  intent.pluginVersion,
  intent.productStepId,
  intent.callId,
  intent.childCapabilityId,
  intent.inputHash,
])).digest("hex")}`;

export interface GptAbilityGroup {
  readonly abilityGroupId: typeof GPT_ABILITY_GROUP_ID;
  readonly transport: typeof GPT_TRANSPORT;
  listChildCapabilityIds(): readonly GptChildCapabilityId[];
  execute<K extends GptChildCapabilityId>(
    intent: GptChildCapabilityIntent<K>,
    context: GptExecutionContext,
  ): Promise<GptChildCapabilityResult<K>>;
}
