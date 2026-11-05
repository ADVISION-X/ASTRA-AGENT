import { openExactGptRetryMenuHandler } from "./children/open_exact_gpt_retry_menu/handler.js";
import { retryExactGptResponseOnceHandler } from "./children/retry_exact_gpt_response_once/handler.js";
import { getSubmittedGptConversationUrlHandler } from "./children/get_submitted_gpt_conversation_url/handler.js";
import { attachApprovedGptFilesOnceHandler } from "./children/attach_approved_gpt_files_once/handler.js";
import { acknowledgeKnownGptRateLimitHandler } from "./children/acknowledge_known_gpt_rate_limit/handler.js";
import { checkpointGptGeneratedImageHandler } from "./children/checkpoint_gpt_generated_image/handler.js";
import { checkpointGptTextResponseHandler } from "./children/checkpoint_gpt_text_response/handler.js";
import { closeGptExecutionProfileHandler } from "./children/close_gpt_execution_profile/handler.js";
import { selectGptReasoningFromStartV3Handler } from "./children/select_gpt_reasoning_from_start_v3/handler.js";
import { openGptAttachmentControlHandler } from "./children/open_gpt_attachment_control/handler.js";
import { openGptExecutionProfileHandler } from "./children/open_gpt_execution_profile/handler.js";
import { openGptModelSelectorV3Handler } from "./children/open_gpt_model_selector_v3/handler.js";
import { prepareCleanGptChatHandler } from "./children/prepare_clean_gpt_chat/handler.js";
import { prepareCleanGptWorkHandler } from "./children/prepare_clean_gpt_work/handler.js";
import { reconcileGptAttachmentSetHandler } from "./children/reconcile_gpt_attachment_set/handler.js";
import { selectGptModelFromStartV3Handler } from "./children/select_gpt_model_from_start_v3/handler.js";
import { submitExactGptTurnOnceHandler } from "./children/submit_exact_gpt_turn_once/handler.js";
import { writeExactGptPromptHandler } from "./children/write_exact_gpt_prompt/handler.js";
import type { GptChildCapabilityId } from "./contract.js";
import type { GptChildHandler } from "./web/child-handler.js";

export const gptChildHandlers = Object.freeze({
  prepare_clean_gpt_work: prepareCleanGptWorkHandler,
  open_exact_gpt_retry_menu: openExactGptRetryMenuHandler,
  retry_exact_gpt_response_once: retryExactGptResponseOnceHandler,
  acknowledge_known_gpt_rate_limit: acknowledgeKnownGptRateLimitHandler,
  prepare_clean_gpt_chat: prepareCleanGptChatHandler,
  open_gpt_execution_profile: openGptExecutionProfileHandler,
  select_gpt_reasoning_from_start_v3: selectGptReasoningFromStartV3Handler,
  close_gpt_execution_profile: closeGptExecutionProfileHandler,
  open_gpt_model_selector_v3: openGptModelSelectorV3Handler,
  select_gpt_model_from_start_v3: selectGptModelFromStartV3Handler,
  open_gpt_attachment_control: openGptAttachmentControlHandler,
  attach_approved_gpt_files_once: attachApprovedGptFilesOnceHandler,
  reconcile_gpt_attachment_set: reconcileGptAttachmentSetHandler,
  write_exact_gpt_prompt: writeExactGptPromptHandler,
  submit_exact_gpt_turn_once: submitExactGptTurnOnceHandler,
  get_submitted_gpt_conversation_url: getSubmittedGptConversationUrlHandler,
  checkpoint_gpt_text_response: checkpointGptTextResponseHandler,
  checkpoint_gpt_generated_image: checkpointGptGeneratedImageHandler,
} satisfies { readonly [K in GptChildCapabilityId]: GptChildHandler<K> });
