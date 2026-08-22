export type WebChatFailureClassification =
  | "recovery_pending"
  | "review_required"
  | "failed";

const reasonFrom = (error: unknown): string =>
  (error instanceof Error ? error.message : String(error))
    .replace(/\s+/gu, " ")
    .trim();

const terminalRootReason = (reason: string): string | null => {
  const match = reason.match(
    /^review_required: web-chat execution is terminal: [^;]+; root=(.+)$/iu,
  );
  return match?.[1]?.trim() || null;
};

const requiresOperatorIntervention = (reason: string): boolean =>
  /(?:login|log in|sign in|verification|captcha|security barrier|two[- ]factor|2fa|identity mismatch|more than one physical provider tab|apple events javascript is disabled|permission denied|not authorized|credential|GPT_WEB_EXECUTION_PROFILE_(?:MODEL|REASONING)_AMBIGUOUS|GPT_WEB_EXECUTION_PROFILE_(?:MODEL|REASONING)_UNAVAILABLE|GPT_WEB_EXECUTION_PROFILE_READBACK_MISMATCH|CHATGPT_(?:TITLE|RENAME|SEARCH_DISCOVERY)_.*AMBIGUOUS|CHATGPT_TITLE_PROOF_BINDING_MISMATCH)/iu.test(reason);

const isPhysicalProviderTabInterference = (reason: string): boolean =>
  /more than one physical provider tab/iu.test(reason);

const isImmutableInputFailure = (reason: string): boolean =>
  /AI_INPUT_GATEWAY_(?:PROVIDER_EXECUTION_PROFILE_HASH_MISMATCH|PROVIDER_EXECUTION_PROFILE_CANONICAL_VOCABULARY_INVALID|REASONING_TIER_UNSUPPORTED|CONTINUATION_TITLE_HASH_MISMATCH)|GPT_WEB_TITLE_POLICY_(?:INVALID|UNSAFE)/iu.test(reason);

const isTransientBrowserAuthorityFailure = (reason: string): boolean =>
  /\b(?:BROWSER_EXTENSION_CHANNEL_UNAVAILABLE|BROWSER_LIVENESS_EXPIRED|BROWSER_SESSION_WORKSPACE_REQUIRED|BROWSER_TARGET_INVALID|BROWSER_DOCUMENT_INVALID|BROWSER_BACKPRESSURE|BROWSER_AUTH_TRANSCRIPT_INVALID|BROWSER_CAPABILITY_REJECTED)\b/u.test(reason);

const isTransientProviderUnavailability = (reason: string): boolean =>
  /(?:WEB_CHAT_(?:FOREIGN_TURN_REBOUND|FRESH_CONVERSATION_(?:REBOUND|HYDRATION_PENDING)|CONTINUATION_CONVERSATION_DRIFT|CONTINUATION_HISTORY_NOT_STABLE|CANONICAL_CONVERSATION_ALREADY_BOUND|COMPOSER_CLEAR_ACTION_UNPROVEN|TITLE_FINALIZATION_NOT_READY|DOCUMENT_CHANGED|SEARCH_RESULT_NOT_READY)|GPT_WEB_EXECUTION_PROFILE_MENU_NOT_READY|CHATGPT_NEW_CHAT_CONTROL_AMBIGUOUS|ChatGPT fresh conversation (?:pending|was not established)|GPT_PROMPT_MISMATCH|TRANSPORT_DISCONNECTED(?::(?:TARGET_EVALUATION_FAILED|Detached while handling command|Native host disconnected|controller transport closed|Native host is not connected|browser message exceeds maximum size))?|DEVTOOLS_ATTACHMENT_CONFLICT:.*No tab with given id|TARGET_NOT_FOUND:.*(?:No tab with given id|tab identity|not already open)|OUTCOME_UNKNOWN:.*(?:TRANSPORT_DISCONNECTED|Detached while handling command|No tab with given id)|exact provider target is not acquired|provider composer (?:unavailable|pending|did not become ready|not ready|not uniquely found|root not uniquely proven)|new chat control (?:was )?not found|single controlled provider tab is not open|controlled provider tab (?:is not open|does not have)|controlled chrome (?:tab|window) (?:is not active|is not available)|NATIVE_(?:PICKER_(?:NOT_READY|TIMEOUT|ABORTED|AUTOMATION_FAILED|DID_NOT_CLOSE)|FOLDER_FIELD_NOT_FOCUSED|FILE_(?:LIST_(?:COUNT_MISMATCH|MISMATCH|NOT_FOCUSED)|SORT_(?:HEADER_MISSING|CONTROL_MISSING|DID_NOT_NORMALIZE|SORTED_LIST_MISMATCH))|SELECTION_UNPROVEN|OPEN_BUTTON_(?:AMBIGUOUS|DISABLED))|不能获取对象|osascript exited with code (?:unknown|-?\d+)|temporar(?:y|ily) unavailable|service unavailable|overloaded|try again later|rate limit|request frequency|provider capacity|capacity (?:unavailable|exhausted|limit)|timed out waiting for (?:bounded web-chat capacity|serialized web-chat browser mutation|submission-priority web-chat patrol)|COMMAND_TIMEOUT|browser command .*exceeded|browser .*disconnected|network (?:error|unavailable|disconnected)|econnreset|econnrefused|etimedout|fetch failed|worker stopped|wait aborted)/iu.test(reason);

export const classifyWebChatFailure = (
  error: unknown,
  hasDurableSubmission: boolean,
  _priorFailureReasons: readonly string[] = [],
): WebChatFailureClassification => {
  const reason = reasonFrom(error);
  const rootReason = terminalRootReason(reason);
  if (rootReason) {
    return classifyWebChatFailure(
      new Error(rootReason),
      hasDurableSubmission,
      _priorFailureReasons,
    );
  }
  if (isImmutableInputFailure(reason)) return "failed";
  if (isTransientBrowserAuthorityFailure(reason)) return "recovery_pending";
  if (/^review_required: web-chat execution is terminal:/iu.test(reason)) {
    return "recovery_pending";
  }
  if (hasDurableSubmission && isPhysicalProviderTabInterference(reason)) {
    return "recovery_pending";
  }
  if (requiresOperatorIntervention(reason)) return "review_required";
  if (hasDurableSubmission || isTransientProviderUnavailability(reason)) {
    return "recovery_pending";
  }
  return "failed";
};

export const webChatFailureReason = (error: unknown): string =>
  reasonFrom(error).slice(0, 2_000) || "unknown web-chat execution failure";
