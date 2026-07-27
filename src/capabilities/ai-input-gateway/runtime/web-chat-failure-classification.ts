export type WebChatFailureClassification =
  | "recovery_pending"
  | "review_required"
  | "failed";

const reasonFrom = (error: unknown): string =>
  (error instanceof Error ? error.message : String(error))
    .replace(/\s+/gu, " ")
    .trim();

const requiresOperatorIntervention = (reason: string): boolean =>
  /(?:login|log in|sign in|verification|captcha|security barrier|two[- ]factor|2fa|identity mismatch|more than one physical provider tab|apple events javascript is disabled|permission denied|not authorized|credential)/iu.test(reason);

const isTransientProviderUnavailability = (reason: string): boolean =>
  /(?:provider composer (?:unavailable|pending|did not become ready|not ready)|new chat control (?:was )?not found|single controlled provider tab is not open|controlled provider tab (?:is not open|does not have)|temporar(?:y|ily) unavailable|service unavailable|overloaded|try again later|rate limit|request frequency|provider capacity|capacity (?:unavailable|exhausted|limit)|timed out waiting for (?:bounded web-chat capacity|serialized web-chat browser mutation|submission-priority web-chat patrol)|active-tab evaluation .*timed out|browser .*disconnected|network (?:error|unavailable|disconnected)|econnreset|econnrefused|etimedout|fetch failed|worker stopped|wait aborted)/iu.test(reason);

export const classifyWebChatFailure = (
  error: unknown,
  hasDurableSubmission: boolean,
): WebChatFailureClassification => {
  const reason = reasonFrom(error);
  if (requiresOperatorIntervention(reason)) return "review_required";
  if (hasDurableSubmission || isTransientProviderUnavailability(reason)) {
    return "recovery_pending";
  }
  return "failed";
};

export const webChatFailureReason = (error: unknown): string =>
  reasonFrom(error).slice(0, 2_000) || "unknown web-chat execution failure";
