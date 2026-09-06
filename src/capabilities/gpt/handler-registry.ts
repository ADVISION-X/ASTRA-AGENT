import { acquireGptContinuationLaneHandler } from "./children/acquire_gpt_continuation_lane/handler.js";
import { advanceGptContinuationLaneHandler } from "./children/advance_gpt_continuation_lane/handler.js";
import { attachApprovedGptFilesOnceHandler } from "./children/attach_approved_gpt_files_once/handler.js";
import { checkpointGptGeneratedImageHandler } from "./children/checkpoint_gpt_generated_image/handler.js";
import { checkpointGptTextResponseHandler } from "./children/checkpoint_gpt_text_response/handler.js";
import { closeGptExecutionProfileHandler } from "./children/close_gpt_execution_profile/handler.js";
import { completeExactGptContinuationReservationOnceHandler } from "./children/complete_exact_gpt_continuation_reservation_once/handler.js";
import { ensureGptReasoningRequirementHandler } from "./children/ensure_gpt_reasoning_requirement/handler.js";
import { focusExactGptConversationHandler } from "./children/focus_exact_gpt_conversation/handler.js";
import { forkExactGptConversationAtCheckpointHandler } from "./children/fork_exact_gpt_conversation_at_checkpoint/handler.js";
import { openGptAttachmentControlHandler } from "./children/open_gpt_attachment_control/handler.js";
import { openGptCheckpointActionsMenuHandler } from "./children/open_gpt_checkpoint_actions_menu/handler.js";
import { openGptExecutionProfileHandler } from "./children/open_gpt_execution_profile/handler.js";
import { openGptForkDestinationMenuHandler } from "./children/open_gpt_fork_destination_menu/handler.js";
import { openGptModelSelectorV2Handler } from "./children/open_gpt_model_selector_v2/handler.js";
import { persistGptContinuationHandler } from "./children/persist_gpt_continuation/handler.js";
import { prepareCleanGptChatHandler } from "./children/prepare_clean_gpt_chat/handler.js";
import { reconcileGptAttachmentSetHandler } from "./children/reconcile_gpt_attachment_set/handler.js";
import { reconcileGptDraftHandler } from "./children/reconcile_gpt_draft/handler.js";
import { reconcileGptTurnSubmissionHandler } from "./children/reconcile_gpt_turn_submission/handler.js";
import { releaseGptContinuationLaneHandler } from "./children/release_gpt_continuation_lane/handler.js";
import { reserveExactGptContinuationOnceHandler } from "./children/reserve_exact_gpt_continuation_once/handler.js";
import { selectExactGptModelV2Handler } from "./children/select_exact_gpt_model_v2/handler.js";
import { submitExactGptTurnOnceHandler } from "./children/submit_exact_gpt_turn_once/handler.js";
import { verifyGptConversationIdentityHandler } from "./children/verify_gpt_conversation_identity/handler.js";
import { waitForStableGptImageHandler } from "./children/wait_for_stable_gpt_image/handler.js";
import { waitForStableGptTextHandler } from "./children/wait_for_stable_gpt_text/handler.js";
import { writeExactGptPromptHandler } from "./children/write_exact_gpt_prompt/handler.js";
import type { GptChildCapabilityId } from "./contract.js";
import type { GptChildHandler } from "./web/child-handler.js";

export const gptChildHandlers = Object.freeze({
  prepare_clean_gpt_chat: prepareCleanGptChatHandler,
  focus_exact_gpt_conversation: focusExactGptConversationHandler,
  verify_gpt_conversation_identity: verifyGptConversationIdentityHandler,
  open_gpt_execution_profile: openGptExecutionProfileHandler,
  ensure_gpt_reasoning_requirement: ensureGptReasoningRequirementHandler,
  close_gpt_execution_profile: closeGptExecutionProfileHandler,
  open_gpt_model_selector_v2: openGptModelSelectorV2Handler,
  select_exact_gpt_model_v2: selectExactGptModelV2Handler,
  open_gpt_attachment_control: openGptAttachmentControlHandler,
  attach_approved_gpt_files_once: attachApprovedGptFilesOnceHandler,
  reconcile_gpt_attachment_set: reconcileGptAttachmentSetHandler,
  write_exact_gpt_prompt: writeExactGptPromptHandler,
  reconcile_gpt_draft: reconcileGptDraftHandler,
  submit_exact_gpt_turn_once: submitExactGptTurnOnceHandler,
  reconcile_gpt_turn_submission: reconcileGptTurnSubmissionHandler,
  wait_for_stable_gpt_text: waitForStableGptTextHandler,
  checkpoint_gpt_text_response: checkpointGptTextResponseHandler,
  wait_for_stable_gpt_image: waitForStableGptImageHandler,
  checkpoint_gpt_generated_image: checkpointGptGeneratedImageHandler,
  open_gpt_checkpoint_actions_menu: openGptCheckpointActionsMenuHandler,
  open_gpt_fork_destination_menu: openGptForkDestinationMenuHandler,
  fork_exact_gpt_conversation_at_checkpoint: forkExactGptConversationAtCheckpointHandler,
  persist_gpt_continuation: persistGptContinuationHandler,
  reserve_exact_gpt_continuation_once: reserveExactGptContinuationOnceHandler,
  complete_exact_gpt_continuation_reservation_once: completeExactGptContinuationReservationOnceHandler,
  acquire_gpt_continuation_lane: acquireGptContinuationLaneHandler,
  advance_gpt_continuation_lane: advanceGptContinuationLaneHandler,
  release_gpt_continuation_lane: releaseGptContinuationLaneHandler,
} satisfies { readonly [K in GptChildCapabilityId]: GptChildHandler<K> });
