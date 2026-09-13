import { GPT_CHILDREN_PATH, GPT_ROOT, gptChildFilePath, gptChildHandlerPath } from "./gpt-inspection-core-paths.js";
export const GPT_TEXT_RESPONSE_HANDLER_PATHS = [
  gptChildHandlerPath("checkpoint_gpt_text_response"),
] as const;
export const GPT_IMAGE_RESPONSE_HANDLER_PATHS = [
  gptChildHandlerPath("checkpoint_gpt_generated_image"),
] as const;
export const GPT_RETIRED_SHARED_SEMANTIC_PATHS = [
  `${GPT_CHILDREN_PATH}/page-handler-exports.ts`, `${GPT_CHILDREN_PATH}/continuation-handler-exports.ts`,
  `${GPT_ROOT}/session/session-children.ts`, `${GPT_ROOT}/web/attachment-control-observation.ts`,
  `${GPT_ROOT}/web/attachment-set-observation.ts`, `${GPT_ROOT}/web/composer-observation.ts`,
  `${GPT_ROOT}/web/conversation-observation.ts`, `${GPT_ROOT}/web/execution-profile-observation.ts`,
  `${GPT_ROOT}/web/fork-menu-state.ts`, `${GPT_ROOT}/web/gpt-page-selectors.ts`,
  `${GPT_ROOT}/web/gpt-response-page.ts`, `${GPT_ROOT}/web/model-selection-v2-observation.ts`,
  `${GPT_ROOT}/web/response-child-support.ts`, `${GPT_ROOT}/web/contracts/attachment.contract.ts`,
  `${GPT_ROOT}/web/contracts/execution-profile.contract.ts`, `${GPT_ROOT}/web/contracts/model-selection-v2.contract.ts`,
  `${GPT_ROOT}/web/children/attachment-children.ts`, `${GPT_ROOT}/web/children/attachment-set-observation.ts`,
  `${GPT_ROOT}/web/children/composer-submission-children.ts`, `${GPT_ROOT}/web/children/conversation-children.ts`,
  `${GPT_ROOT}/web/children/execution-profile-children.ts`, `${GPT_ROOT}/web/children/execution-profile-observation.ts`,
  `${GPT_ROOT}/web/children/image-response-children.ts`, `${GPT_ROOT}/web/children/model-selection-v2-children.ts`,
  `${GPT_ROOT}/web/children/rate-limit-dialog.ts`, `${GPT_ROOT}/web/children/response-child-support.ts`,
  `${GPT_ROOT}/web/children/response-children.ts`, `${GPT_ROOT}/web/children/text-response-children.ts`,
] as const;
export const GPT_CONVERSATION_HANDLER_PATHS = [
  gptChildHandlerPath("prepare_clean_gpt_chat"),
  ...["prepare_clean_gpt_chat"].flatMap((id) => [
    gptChildFilePath(id, "observation.ts"), gptChildFilePath(id, "selectors.ts"),
  ]),
] as const;
export const GPT_RESPONSE_PAGE_PATH = `${GPT_ROOT}/web/gpt-dom-observation.ts`;
export const GPT_TURN_EXECUTOR_PATH = `${GPT_ROOT}/gpt-turn-executor.ts`;
export const GPT_MODEL_SELECTION_V2_HANDLER_PATHS = [
  gptChildHandlerPath("open_gpt_model_selector_v2"), gptChildFilePath("open_gpt_model_selector_v2", "observation.ts"),
  gptChildFilePath("open_gpt_model_selector_v2", "selectors.ts"), gptChildHandlerPath("select_exact_gpt_model_v2"),
  gptChildFilePath("select_exact_gpt_model_v2", "observation.ts"), gptChildFilePath("select_exact_gpt_model_v2", "selectors.ts"),
] as const;
export const GPT_MODEL_SELECTION_V2_CONTRACT_PATH = gptChildFilePath("select_exact_gpt_model_v2", "selectors.ts");
export const GPT_EXECUTION_PROFILE_HANDLER_PATHS = [
  ...["open_gpt_execution_profile", "ensure_gpt_reasoning_requirement", "close_gpt_execution_profile"].flatMap((id) => [
    gptChildHandlerPath(id), gptChildFilePath(id, "observation.ts"), gptChildFilePath(id, "selectors.ts"),
  ]), `${GPT_ROOT}/web/execution-profile-input.ts`,
] as const;
export const GPT_EXECUTION_PROFILE_CONTRACT_PATH = gptChildFilePath("ensure_gpt_reasoning_requirement", "selectors.ts");
export const GPT_ATTACHMENT_HANDLER_PATHS = [
  gptChildHandlerPath("open_gpt_attachment_control"), gptChildFilePath("open_gpt_attachment_control", "observation.ts"),
  gptChildFilePath("open_gpt_attachment_control", "selectors.ts"), gptChildHandlerPath("attach_approved_gpt_files_once"),
  gptChildFilePath("attach_approved_gpt_files_once", "attachment-observation.ts"),
  gptChildFilePath("attach_approved_gpt_files_once", "control-observation.ts"),
  gptChildFilePath("attach_approved_gpt_files_once", "selectors.ts"), gptChildHandlerPath("reconcile_gpt_attachment_set"),
  gptChildFilePath("reconcile_gpt_attachment_set", "observation.ts"), gptChildFilePath("reconcile_gpt_attachment_set", "selectors.ts"),
] as const;
export const GPT_ATTACHMENT_CONTRACT_PATH = gptChildFilePath("attach_approved_gpt_files_once", "selectors.ts");
