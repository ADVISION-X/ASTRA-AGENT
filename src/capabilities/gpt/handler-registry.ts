import { attachApprovedGptFilesOnceHandler } from "./children/attach_approved_gpt_files_once/handler.js";
import { checkpointGptGeneratedImageHandler } from "./children/checkpoint_gpt_generated_image/handler.js";
import { checkpointGptTextResponseHandler } from "./children/checkpoint_gpt_text_response/handler.js";
import { closeGptExecutionProfileHandler } from "./children/close_gpt_execution_profile/handler.js";
import { ensureGptReasoningRequirementHandler } from "./children/ensure_gpt_reasoning_requirement/handler.js";
import { openGptAttachmentControlHandler } from "./children/open_gpt_attachment_control/handler.js";
import { openGptExecutionProfileHandler } from "./children/open_gpt_execution_profile/handler.js";
import { openGptModelSelectorV2Handler } from "./children/open_gpt_model_selector_v2/handler.js";
import { prepareCleanGptChatHandler } from "./children/prepare_clean_gpt_chat/handler.js";
import { renameSettledGptConversationHandler } from "./children/rename_settled_gpt_conversation/handler.js";
import { reconcileGptAttachmentSetHandler } from "./children/reconcile_gpt_attachment_set/handler.js";
import { selectExactGptModelV2Handler } from "./children/select_exact_gpt_model_v2/handler.js";
import { submitExactGptTurnOnceHandler } from "./children/submit_exact_gpt_turn_once/handler.js";
import { writeExactGptPromptHandler } from "./children/write_exact_gpt_prompt/handler.js";
import type { GptChildCapabilityId } from "./contract.js";
import type { GptChildHandler } from "./web/child-handler.js";

export const gptChildHandlers = Object.freeze({
  prepare_clean_gpt_chat: prepareCleanGptChatHandler,
  open_gpt_execution_profile: openGptExecutionProfileHandler,
  ensure_gpt_reasoning_requirement: ensureGptReasoningRequirementHandler,
  close_gpt_execution_profile: closeGptExecutionProfileHandler,
  open_gpt_model_selector_v2: openGptModelSelectorV2Handler,
  select_exact_gpt_model_v2: selectExactGptModelV2Handler,
  open_gpt_attachment_control: openGptAttachmentControlHandler,
  attach_approved_gpt_files_once: attachApprovedGptFilesOnceHandler,
  reconcile_gpt_attachment_set: reconcileGptAttachmentSetHandler,
  write_exact_gpt_prompt: writeExactGptPromptHandler,
  submit_exact_gpt_turn_once: submitExactGptTurnOnceHandler,
  checkpoint_gpt_text_response: checkpointGptTextResponseHandler,
  checkpoint_gpt_generated_image: checkpointGptGeneratedImageHandler,
  rename_settled_gpt_conversation: renameSettledGptConversationHandler,
} satisfies { readonly [K in GptChildCapabilityId]: GptChildHandler<K> });
