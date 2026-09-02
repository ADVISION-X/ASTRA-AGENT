import { createHash } from "node:crypto";

import type { BrowserTargetLease } from "../../lib/browser/browser-authority-api.js";
import type {
  GptChildCapabilityId,
  GptChildInputMap,
  GptChildOutputMap,
} from "./child-types.js";
import type { GptContinuationStorePort } from "./session/gpt-continuation-store-port.js";

export type {
  GptApprovedFile,
  GptApprovedFileInput,
  GptChildCall,
  GptChildCapabilityId,
  GptChildInputMap,
  GptChildOutputMap,
  GptChildSuccess,
  GptGeneratedImageCheckpointInput,
  GptHash,
  GptTextCheckpointInput,
} from "./child-types.js";

export const GPT_ABILITY_GROUP_ID = "gpt" as const;
export const GPT_TRANSPORT = "gpt-web" as const;
export const GPT_MODEL_SELECTION_VERSION = "gpt-model-selection.v2" as const;

export type GptFailureClassification = "failed";
export type GptChildProfile = "DOM_OBSERVATION" | "TARGET_LOCAL_MUTATION"
  | "PROVIDER_EFFECT_ONCE" | "CONTINUATION_TRANSACTION";
export type GptChildDecision = "DONE" | "ACT" | "WAIT" | "FAIL_CLOSED";

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

export interface ChildCapabilityContract {
  readonly childCapabilityId: string;
  readonly contractVersion: 2;
  readonly semanticIntent: string;
  readonly owner: "gpt";
  readonly inputSchema: `gpt.${string}.input.v1`;
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
  verify_gpt_conversation_identity: { childCapabilityId: "verify_gpt_conversation_identity", contractVersion: 2, semanticIntent: "prove the current conversation matches the exact canonical identity", owner: "gpt", inputSchema: "gpt.verify_gpt_conversation_identity.input.v1", requiredTargetKind: "chatgpt", allowedDocumentTransition: "exact-navigation-only", profile: "DOM_OBSERVATION", boundedWait: false, decisions: ["DONE", "FAIL_CLOSED"], precondition: "exact conversation URL marker prompt hash and response hash", actionQualification: "never", mutationBudget: "zero", oneObservationOrMutation: "bounded-observation", positivePostcondition: "one canonical conversation and exact adjacent turn pair match", negativePostcondition: "missing ambiguous stale or mismatched identity fails closed", evidenceSchema: "gpt-child-capability-proof.v2", evidenceBoundary: "hashes-refs-counts-typed-causes-only", failureClassification: ["failed"], replayPolicy: "observation-only" },
  reconcile_gpt_attachment_set: { childCapabilityId: "reconcile_gpt_attachment_set", contractVersion: 2, semanticIntent: "prove all and only approved attachments are ready", owner: "gpt", inputSchema: "gpt.reconcile_gpt_attachment_set.input.v1", requiredTargetKind: "chatgpt", allowedDocumentTransition: "forbidden", profile: "DOM_OBSERVATION", boundedWait: true, decisions: ["DONE", "WAIT", "FAIL_CLOSED"], precondition: "approved provider display names and Product timeout", actionQualification: "never", mutationBudget: "zero", oneObservationOrMutation: "bounded-observation", positivePostcondition: "one region exact label set all ready and zero spinner", negativePostcondition: "unexpected attachment stable ambiguity or deadline fails closed", evidenceSchema: "gpt-child-capability-proof.v2", evidenceBoundary: "hashes-refs-counts-typed-causes-only", failureClassification: ["failed"], replayPolicy: "observation-only" },
  reconcile_gpt_draft: { childCapabilityId: "reconcile_gpt_draft", contractVersion: 2, semanticIntent: "prove composer retains the exact prompt", owner: "gpt", inputSchema: "gpt.reconcile_gpt_draft.input.v1", requiredTargetKind: "chatgpt", allowedDocumentTransition: "forbidden", profile: "DOM_OBSERVATION", boundedWait: false, decisions: ["DONE", "FAIL_CLOSED"], precondition: "exact prompt and one composer", actionQualification: "never", mutationBudget: "zero", oneObservationOrMutation: "bounded-observation", positivePostcondition: "composer value hash equals exact prompt hash", negativePostcondition: "missing ambiguous or changed draft fails closed", evidenceSchema: "gpt-child-capability-proof.v2", evidenceBoundary: "hashes-refs-counts-typed-causes-only", failureClassification: ["failed"], replayPolicy: "observation-only" },
  reconcile_gpt_turn_submission: { childCapabilityId: "reconcile_gpt_turn_submission", contractVersion: 2, semanticIntent: "prove Provider accepted the exact user turn without resubmission", owner: "gpt", inputSchema: "gpt.reconcile_gpt_turn_submission.input.v1", requiredTargetKind: "chatgpt", allowedDocumentTransition: "exact-navigation-only", profile: "DOM_OBSERVATION", boundedWait: true, decisions: ["DONE", "WAIT", "FAIL_CLOSED"], precondition: "confirmed submit identity marker prompt hash and locator", actionQualification: "never", mutationBudget: "zero", oneObservationOrMutation: "bounded-observation", positivePostcondition: "one exact user turn and permanent conversation locator", negativePostcondition: "stable mismatch ambiguity lifecycle failure or deadline fails closed", evidenceSchema: "gpt-child-capability-proof.v2", evidenceBoundary: "hashes-refs-counts-typed-causes-only", failureClassification: ["failed"], replayPolicy: "observation-only" },
  checkpoint_gpt_text_response: { childCapabilityId: "checkpoint_gpt_text_response", contractVersion: 2, semanticIntent: "checkpoint exact assistant outerHTML and deterministic semantic text", owner: "gpt", inputSchema: "gpt.checkpoint_gpt_text_response.input.v1", requiredTargetKind: "chatgpt", allowedDocumentTransition: "exact-navigation-only", profile: "DOM_OBSERVATION", boundedWait: false, decisions: ["DONE", "FAIL_CLOSED"], precondition: "exact stable assistant turn identity", actionQualification: "never", mutationBudget: "zero", oneObservationOrMutation: "bounded-observation", positivePostcondition: "one task-owned artifact binds DOM and semantic text hashes", negativePostcondition: "zero multiple stale or hash drift fails closed", evidenceSchema: "gpt-child-capability-proof.v2", evidenceBoundary: "hashes-refs-counts-typed-causes-only", failureClassification: ["failed"], replayPolicy: "observation-only" },
  checkpoint_gpt_generated_image: { childCapabilityId: "checkpoint_gpt_generated_image", contractVersion: 2, semanticIntent: "checkpoint the exact assistant image content", owner: "gpt", inputSchema: "gpt.checkpoint_gpt_generated_image.input.v1", requiredTargetKind: "chatgpt", allowedDocumentTransition: "exact-navigation-only", profile: "DOM_OBSERVATION", boundedWait: false, decisions: ["DONE", "FAIL_CLOSED"], precondition: "exact assistant turn semantic media and predecessor text receipt", actionQualification: "never", mutationBudget: "zero", oneObservationOrMutation: "bounded-observation", positivePostcondition: "one authenticated original image content identity is stored", negativePostcondition: "zero multiple changed or unauthorized media fails closed", evidenceSchema: "gpt-child-capability-proof.v2", evidenceBoundary: "hashes-refs-counts-typed-causes-only", failureClassification: ["failed"], replayPolicy: "observation-only" },
  prepare_clean_gpt_chat: { childCapabilityId: "prepare_clean_gpt_chat", contractVersion: 2, semanticIntent: "prove a fresh chat and clear only an otherwise isolated stale draft", owner: "gpt", inputSchema: "gpt.prepare_clean_gpt_chat.input.v1", requiredTargetKind: "chatgpt", allowedDocumentTransition: "forbidden", profile: "TARGET_LOCAL_MUTATION", boundedWait: false, decisions: ["DONE", "ACT", "FAIL_CLOSED"], precondition: "one composer zero turns attachments and generating", actionQualification: "only a nonempty stale draft remains", mutationBudget: "zero-or-one-browser-input", oneObservationOrMutation: "at-most-one-mutation", positivePostcondition: "exact empty draft with zero prior state", negativePostcondition: "prior turn attachment generating ambiguity or uncleared draft fails closed", evidenceSchema: "gpt-child-capability-proof.v2", evidenceBoundary: "hashes-refs-counts-typed-causes-only", failureClassification: ["failed"], replayPolicy: "target-local-per-generation" },
  focus_exact_gpt_conversation: { childCapabilityId: "focus_exact_gpt_conversation", contractVersion: 2, semanticIntent: "focus the Product-frozen exact conversation", owner: "gpt", inputSchema: "gpt.focus_exact_gpt_conversation.input.v1", requiredTargetKind: "chatgpt", allowedDocumentTransition: "exact-navigation-only", profile: "TARGET_LOCAL_MUTATION", boundedWait: false, decisions: ["DONE", "ACT", "FAIL_CLOSED"], precondition: "verified canonical conversation URL", actionQualification: "current canonical URL differs", mutationBudget: "zero-or-one-browser-input", oneObservationOrMutation: "at-most-one-mutation", positivePostcondition: "current URL equals the exact canonical conversation URL", negativePostcondition: "origin mismatch navigation failure or readback mismatch fails closed", evidenceSchema: "gpt-child-capability-proof.v2", evidenceBoundary: "hashes-refs-counts-typed-causes-only", failureClassification: ["failed"], replayPolicy: "target-local-per-generation" },
  open_gpt_execution_profile: { childCapabilityId: "open_gpt_execution_profile", contractVersion: 2, semanticIntent: "open the unique execution profile popup", owner: "gpt", inputSchema: "gpt.open_gpt_execution_profile.input.v1", requiredTargetKind: "chatgpt", allowedDocumentTransition: "forbidden", profile: "TARGET_LOCAL_MUTATION", boundedWait: false, decisions: ["DONE", "ACT", "FAIL_CLOSED"], precondition: "exact execution profile and one trigger or already-open popup", actionQualification: "popup absent and one qualified trigger", mutationBudget: "zero-or-one-browser-input", oneObservationOrMutation: "at-most-one-mutation", positivePostcondition: "one popup and one active reasoning panel", negativePostcondition: "missing ambiguity disabled trigger or incomplete popup fails closed", evidenceSchema: "gpt-child-capability-proof.v2", evidenceBoundary: "hashes-refs-counts-typed-causes-only", failureClassification: ["failed"], replayPolicy: "target-local-per-generation" },
  open_gpt_model_selector_v2: { childCapabilityId: "open_gpt_model_selector_v2", contractVersion: 2, semanticIntent: "open the unique advanced model selector", owner: "gpt", inputSchema: "gpt.open_gpt_model_selector_v2.input.v1", requiredTargetKind: "chatgpt", allowedDocumentTransition: "forbidden", profile: "TARGET_LOCAL_MUTATION", boundedWait: false, decisions: ["DONE", "ACT", "FAIL_CLOSED"], precondition: "one coherent popup entry simple and advanced topology", actionQualification: "OPENABLE topology only", mutationBudget: "zero-or-one-browser-input", oneObservationOrMutation: "at-most-one-mutation", positivePostcondition: "ALREADY_OPEN topology in one coherent packet", negativePostcondition: "any other topology or failed direct readback fails closed", evidenceSchema: "gpt-child-capability-proof.v2", evidenceBoundary: "hashes-refs-counts-typed-causes-only", failureClassification: ["failed"], replayPolicy: "target-local-per-generation" },
  select_exact_gpt_model_v2: { childCapabilityId: "select_exact_gpt_model_v2", contractVersion: 2, semanticIntent: "select the exact model and restore the simple profile panel", owner: "gpt", inputSchema: "gpt.select_exact_gpt_model_v2.input.v1", requiredTargetKind: "chatgpt", allowedDocumentTransition: "forbidden", profile: "TARGET_LOCAL_MUTATION", boundedWait: false, decisions: ["ACT", "FAIL_CLOSED"], precondition: "ALREADY_OPEN topology and one exact radio with boolean checked state", actionQualification: "the unique radio is qualified whether checked true or false", mutationBudget: "exactly-one-browser-input", oneObservationOrMutation: "at-most-one-mutation", positivePostcondition: "popup retained entry collapsed simple active advanced absent", negativePostcondition: "radio ambiguity invalid checked state or incomplete restore fails closed", evidenceSchema: "gpt-child-capability-proof.v2", evidenceBoundary: "hashes-refs-counts-typed-causes-only", failureClassification: ["failed"], replayPolicy: "target-local-per-generation" },
  ensure_exact_gpt_reasoning_tier: { childCapabilityId: "ensure_exact_gpt_reasoning_tier", contractVersion: 2, semanticIntent: "set the exact numeric reasoning tier", owner: "gpt", inputSchema: "gpt.ensure_exact_gpt_reasoning_tier.input.v1", requiredTargetKind: "chatgpt", allowedDocumentTransition: "forbidden", profile: "TARGET_LOCAL_MUTATION", boundedWait: false, decisions: ["DONE", "ACT", "FAIL_CLOSED"], precondition: "one enabled reasoning control and slider range zero through four", actionQualification: "current numeric value differs by a bounded direction and repeat", mutationBudget: "zero-or-one-browser-input", oneObservationOrMutation: "at-most-one-mutation", positivePostcondition: "fresh aria-valuenow equals the exact tier", negativePostcondition: "range value ambiguity disabled state or readback mismatch fails closed", evidenceSchema: "gpt-child-capability-proof.v2", evidenceBoundary: "hashes-refs-counts-typed-causes-only", failureClassification: ["failed"], replayPolicy: "target-local-per-generation" },
  close_gpt_execution_profile: { childCapabilityId: "close_gpt_execution_profile", contractVersion: 2, semanticIntent: "close the current execution profile popup", owner: "gpt", inputSchema: "gpt.close_gpt_execution_profile.input.v1", requiredTargetKind: "chatgpt", allowedDocumentTransition: "forbidden", profile: "TARGET_LOCAL_MUTATION", boundedWait: false, decisions: ["DONE", "ACT", "FAIL_CLOSED"], precondition: "popup absent or one expanded exact profile trigger", actionQualification: "popup present and trigger uniquely qualified", mutationBudget: "zero-or-one-browser-input", oneObservationOrMutation: "at-most-one-mutation", positivePostcondition: "profile popup absent", negativePostcondition: "ambiguous trigger or retained popup fails closed", evidenceSchema: "gpt-child-capability-proof.v2", evidenceBoundary: "hashes-refs-counts-typed-causes-only", failureClassification: ["failed"], replayPolicy: "target-local-per-generation" },
  open_gpt_attachment_control: { childCapabilityId: "open_gpt_attachment_control", contractVersion: 2, semanticIntent: "open the exact composer attachment menu", owner: "gpt", inputSchema: "gpt.open_gpt_attachment_control.input.v1", requiredTargetKind: "chatgpt", allowedDocumentTransition: "forbidden", profile: "TARGET_LOCAL_MUTATION", boundedWait: false, decisions: ["DONE", "ACT", "FAIL_CLOSED"], precondition: "exact composer scope and unique control or scoped upload leaf", actionQualification: "upload leaf absent and one scoped control", mutationBudget: "zero-or-one-browser-input", oneObservationOrMutation: "at-most-one-mutation", positivePostcondition: "one scoped upload-from-computer leaf", negativePostcondition: "global ambiguity missing scope or incomplete menu fails closed", evidenceSchema: "gpt-child-capability-proof.v2", evidenceBoundary: "hashes-refs-counts-typed-causes-only", failureClassification: ["failed"], replayPolicy: "target-local-per-generation" },
  write_exact_gpt_prompt: { childCapabilityId: "write_exact_gpt_prompt", contractVersion: 2, semanticIntent: "make the composer retain the exact approved prompt", owner: "gpt", inputSchema: "gpt.write_exact_gpt_prompt.input.v1", requiredTargetKind: "chatgpt", allowedDocumentTransition: "forbidden", profile: "TARGET_LOCAL_MUTATION", boundedWait: false, decisions: ["DONE", "ACT", "FAIL_CLOSED"], precondition: "one composer and exact approved prompt", actionQualification: "retained value is not already exact", mutationBudget: "zero-or-one-browser-input", oneObservationOrMutation: "at-most-one-mutation", positivePostcondition: "fresh retained bytes equal the approved prompt", negativePostcondition: "ambiguity disabled composer or retained-value mismatch fails closed", evidenceSchema: "gpt-child-capability-proof.v2", evidenceBoundary: "hashes-refs-counts-typed-causes-only", failureClassification: ["failed"], replayPolicy: "target-local-per-generation" },
  wait_for_stable_gpt_text: { childCapabilityId: "wait_for_stable_gpt_text", contractVersion: 2, semanticIntent: "wait for the exact assistant text to become stable", owner: "gpt", inputSchema: "gpt.wait_for_stable_gpt_text.input.v1", requiredTargetKind: "chatgpt", allowedDocumentTransition: "exact-navigation-only", profile: "TARGET_LOCAL_MUTATION", boundedWait: true, decisions: ["DONE", "ACT", "WAIT", "FAIL_CLOSED"], precondition: "exact conversation user turn marker prompt hash and deadline", actionQualification: "one exact rate-limit dialog may be acknowledged once", mutationBudget: "zero-or-one-browser-input", oneObservationOrMutation: "at-most-one-mutation", positivePostcondition: "one adjacent assistant semantic text is stable for the bounded interval", negativePostcondition: "terminal decline repeated dialog ambiguity drift or deadline fails closed", evidenceSchema: "gpt-child-capability-proof.v2", evidenceBoundary: "hashes-refs-counts-typed-causes-only", failureClassification: ["failed"], replayPolicy: "target-local-per-generation" },
  wait_for_stable_gpt_image: { childCapabilityId: "wait_for_stable_gpt_image", contractVersion: 2, semanticIntent: "wait for the exact assistant image to become stable", owner: "gpt", inputSchema: "gpt.wait_for_stable_gpt_image.input.v1", requiredTargetKind: "chatgpt", allowedDocumentTransition: "exact-navigation-only", profile: "TARGET_LOCAL_MUTATION", boundedWait: true, decisions: ["DONE", "ACT", "WAIT", "FAIL_CLOSED"], precondition: "exact conversation user turn marker prompt hash and deadline", actionQualification: "one exact rate-limit dialog may be acknowledged once", mutationBudget: "zero-or-one-browser-input", oneObservationOrMutation: "at-most-one-mutation", positivePostcondition: "one adjacent assistant semantic media content identity is stable", negativePostcondition: "terminal decline repeated dialog zero multiple changed media or deadline fails closed", evidenceSchema: "gpt-child-capability-proof.v2", evidenceBoundary: "hashes-refs-counts-typed-causes-only", failureClassification: ["failed"], replayPolicy: "target-local-per-generation" },
  open_gpt_checkpoint_actions_menu: { childCapabilityId: "open_gpt_checkpoint_actions_menu", contractVersion: 2, semanticIntent: "open or confirm the exact source checkpoint actions menu", owner: "gpt", inputSchema: "gpt.open_gpt_checkpoint_actions_menu.input.v1", requiredTargetKind: "chatgpt", allowedDocumentTransition: "forbidden", profile: "TARGET_LOCAL_MUTATION", boundedWait: false, decisions: ["DONE", "ACT", "FAIL_CLOSED"], precondition: "exact source conversation assistant turn marker prompt and response hashes", actionQualification: "source-bound menu absent and one source more-actions control", mutationBudget: "zero-or-one-browser-input", oneObservationOrMutation: "at-most-one-mutation", positivePostcondition: "one active source-bound menu and one fork leaf", negativePostcondition: "source mismatch menu or leaf missing ambiguous or unbound fails closed", evidenceSchema: "gpt-child-capability-proof.v2", evidenceBoundary: "hashes-refs-counts-typed-causes-only", failureClassification: ["failed"], replayPolicy: "target-local-per-generation" },
  attach_approved_gpt_files_once: { childCapabilityId: "attach_approved_gpt_files_once", contractVersion: 2, semanticIntent: "select the complete approved file set in one batch", owner: "gpt", inputSchema: "gpt.attach_approved_gpt_files_once.input.v1", requiredTargetKind: "chatgpt", allowedDocumentTransition: "forbidden", profile: "PROVIDER_EFFECT_ONCE", boundedWait: false, decisions: ["DONE", "ACT", "FAIL_CLOSED"], precondition: "exact scoped upload leaf grants file input and immutable content hashes", actionQualification: "one current connected enabled file input accepts the approved batch", mutationBudget: "zero-or-one-browser-input", oneObservationOrMutation: "at-most-one-mutation", positivePostcondition: "one batch selected and exact attachment set readback is possible", negativePostcondition: "grant scope input identity candidate or set mismatch fails closed", evidenceSchema: "gpt-child-capability-proof.v2", evidenceBoundary: "hashes-refs-counts-typed-causes-only", failureClassification: ["failed"], replayPolicy: "provider-effect-once" },
  submit_exact_gpt_turn_once: { childCapabilityId: "submit_exact_gpt_turn_once", contractVersion: 2, semanticIntent: "submit the exact prompt attachments and turn marker once", owner: "gpt", inputSchema: "gpt.submit_exact_gpt_turn_once.input.v1", requiredTargetKind: "chatgpt", allowedDocumentTransition: "exact-navigation-only", profile: "PROVIDER_EFFECT_ONCE", boundedWait: false, decisions: ["DONE", "ACT", "FAIL_CLOSED"], precondition: "exact draft marker approved attachments and one enabled send control", actionQualification: "no exact submitted turn exists and precondition remains current", mutationBudget: "zero-or-one-browser-input", oneObservationOrMutation: "at-most-one-mutation", positivePostcondition: "one exact user turn and permanent conversation locator", negativePostcondition: "changed prompt candidate ambiguity Provider negative or unclosed dispatch fails closed", evidenceSchema: "gpt-child-capability-proof.v2", evidenceBoundary: "hashes-refs-counts-typed-causes-only", failureClassification: ["failed"], replayPolicy: "provider-effect-once" },
  fork_exact_gpt_conversation_at_checkpoint: { childCapabilityId: "fork_exact_gpt_conversation_at_checkpoint", contractVersion: 2, semanticIntent: "fork once from the already-open exact source-bound menu", owner: "gpt", inputSchema: "gpt.fork_exact_gpt_conversation_at_checkpoint.input.v1", requiredTargetKind: "chatgpt", allowedDocumentTransition: "exact-navigation-only", profile: "PROVIDER_EFFECT_ONCE", boundedWait: false, decisions: ["DONE", "ACT", "FAIL_CLOSED"], precondition: "fresh exact source identity active menu and one fork leaf", actionQualification: "no child relation exists and the unique leaf remains source-bound", mutationBudget: "zero-or-one-browser-input", oneObservationOrMutation: "at-most-one-mutation", positivePostcondition: "one child canonical URL and one source-to-child relation", negativePostcondition: "menu source leaf child or relation missing ambiguous changed or unclosed fails closed", evidenceSchema: "gpt-child-capability-proof.v2", evidenceBoundary: "hashes-refs-counts-typed-causes-only", failureClassification: ["failed"], replayPolicy: "provider-effect-once" },
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

export type GptChildCapabilityIntent<K extends GptChildCapabilityId> =
  GptChildExecutionIdentity & Readonly<{
    childCapabilityId: K;
    input: GptChildInputMap[K];
  }>;

export interface GptChildCapabilityProof {
  readonly schemaVersion: "gpt-child-capability-proof.v2";
  readonly childCapabilityId: GptChildCapabilityId;
  readonly childContractVersion: 2;
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
  mutationMode?: "normal" | "readback";
  yieldForProviderWait?: (durationMs: number) => Promise<void>;
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
