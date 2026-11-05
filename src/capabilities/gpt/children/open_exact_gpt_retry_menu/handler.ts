import { executionFailure } from "../../../../lib/execution-failure.js";
import { declaredFacts, projectBrowserFact, requireBrowser, requireExactInputKeys, success,
  type GptChildHandler } from "../../web/child-handler.js";

export const openExactGptRetryMenuHandler: GptChildHandler<"open_exact_gpt_retry_menu"> = async (intent, context) => {
  requireExactInputKeys(intent, ["originalEffectIdentityHash", "previousEffectIdentityHash", "retryOrdinal",
    "promptHash", "originalUserTurnId", "profileHash", "approvedModel", "turnMarker", "turnMarkerHash"]);
  if (!context.stoppedEmptyConversationUrl || context.stoppedEmptyRetryAuthorized !== true) {
    throw executionFailure("failed", "GPT_STOPPED_EMPTY_RETRY_NOT_AUTHORIZED");
  }
  const raw = await requireBrowser(context).executeDomIntent({ kind: "click",
    selector: "button[aria-label='重新生成回复']", expectedMatches: 1,
    gptStoppedEmpty: { ...intent.input, action: "open-menu", canonicalConversationUrl: context.stoppedEmptyConversationUrl } });
  const reply = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : null;
  const state = reply?.gptRetryState;
  const fact = projectBrowserFact(intent, context)?.fact;
  const revision = reply?.gptRetryObservationRevisionHash;
  if (!fact || fact.browserOutcome !== "CONFIRMED" || !["menu-ready", "response-changed"].includes(String(state))
    || typeof revision !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(revision)) {
    throw executionFailure("failed", "GPT_STOPPED_EMPTY_MENU_UNPROVEN");
  }
  return success({ value: { state: state as "menu-ready" | "response-changed" },
    ...declaredFacts({ decision: fact.mutationOutcome === "no" ? "DONE" : "ACT", mutationOutcome: fact.mutationOutcome,
      browserFact: fact, nativeFailureCode: null, candidateCardinality: { raw: 1, eligible: 1 },
      factResultIds: [fact.evidenceRef], authorityRefHashes: [fact.evidenceHash],
      observationRevisionHash: revision as `sha256:${string}` }) });
};
