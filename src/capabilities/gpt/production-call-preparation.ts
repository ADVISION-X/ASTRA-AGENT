import type { RuntimeSpanHandle } from "../../lib/runtime-logs/index.js";
import { requireRuntimeLogWrite } from "../../lib/runtime-logs/index.js";
import type {
  GptAbilityGroup, GptAnyChildCapabilityIntent, GptChildCapabilityId,
  GptChildCapabilityIntent,
} from "./contract.js";
import { gptExactCallIdentityHash } from "./contract.js";
import { imageResponseFromEvidence, readPersistedGptImageEvidence, readPersistedGptTextResponse } from "./evidence-artifacts.js";
import type { ProductGptCallInput, ProductGptChildResult } from "./product-api.js";
import {
  executeProductionGptAtomicCall, type ProductionGptAtomicCallResult,
} from "./production-atomic-call.js";
import type {
  ProductionGptBrowserCall, ProductionGptBrowserLifecycle,
} from "./production-browser-lifecycle.js";
import type { BrowserAtomicStepIdentity } from "../../lib/browser/browser-authority-api.js";
import type { GptProductionExecutionInput as ExecutionInput } from "./production-ports.js";
import { productChildResult } from "./production-child-result.js";

export const acquireProductionBrowserCall = async (
  browsers: ProductionGptBrowserLifecycle,
  call: ProductGptCallInput<GptChildCapabilityId> & Readonly<{ sessionKey: string }>,
  requiredTargetKind: "chatgpt" | "none", priorEffectKnown: boolean,
  confirmedSubmission?: ProductionGptBrowserCall["confirmedProviderEffect"],
): Promise<ProductionGptBrowserCall | undefined> => {
  if (requiredTargetKind !== "chatgpt") return undefined;
  if (confirmedSubmission) {
    const active = call.child === "get_submitted_gpt_conversation_url"
      ? await browsers.browserForRateLimitRecovery(call.sessionKey, call.productStepId, call.callId)
      : await browsers.browserForConfirmedReadback(call.sessionKey, call.productStepId, call.callId,
        confirmedSubmission.providerEffectIdentityHash!);
    await browsers.recordConfirmedProviderEffect(active, confirmedSubmission, confirmedSubmission.submitIdentity,
      confirmedSubmission.canonicalConversationUrl, confirmedSubmission.userTurnId);
    return active;
  }
  if (priorEffectKnown && call.child === "acknowledge_known_gpt_rate_limit") {
    return browsers.browserForRateLimitRecovery(call.sessionKey, call.productStepId, call.callId);
  }
  return browsers.browserFor(call.sessionKey, call.productStepId, call.callId,
    call.child === "prepare_clean_gpt_chat" || call.child === "prepare_clean_gpt_work");
};
export const recoverPersistedCheckpoint = async <K extends GptChildCapabilityId>(input: Readonly<{
  evidenceStore: Parameters<typeof readPersistedGptTextResponse>[0]["evidenceStore"];
  execution: ExecutionInput; intent: GptChildCapabilityIntent<K>; call: ProductGptCallInput<K>; span: RuntimeSpanHandle;
  confirmedSubmission?: ProductionGptBrowserCall["confirmedProviderEffect"];
}>): Promise<ProductGptChildResult<K> | null> => {
  if (input.call.child !== "checkpoint_gpt_text_response" && input.call.child !== "checkpoint_gpt_generated_image") return null;
  const identity = { evidenceStore: input.evidenceStore, jobId: input.execution.jobId,
    attemptId: input.confirmedSubmission?.sourceReadback?.sourceAttemptId ?? input.execution.attemptId,
    exactCallIdentityHash: gptExactCallIdentityHash(input.intent) };
  const image = input.call.child === "checkpoint_gpt_generated_image" ? await readPersistedGptImageEvidence(identity) : null;
  const text = input.call.child === "checkpoint_gpt_text_response" ? await readPersistedGptTextResponse(identity) : null;
  const recovered = image ?? text;
  if (!recovered) return null;
  const value = image ? imageResponseFromEvidence(image, input.call.input as Readonly<{
    canonicalConversationUrl: string; userTurnId: string; turnMarker: string;
  }>) : text!.value;
  requireRuntimeLogWrite(input.span.terminal({ outcome: "succeeded" }));
  return productChildResult({ execution: input.execution, intent: input.intent, value,
    browserFact: null, evidenceRef: recovered.artifactRef, evidenceHash: recovered.integrityHash,
    artifactRefs: Object.freeze([image?.originalArtifactRef ?? recovered.artifactRef]) });
};
export const runProductionAtomicPhase = async (input: Readonly<{
  dataDir: string; gpt: GptAbilityGroup; browsers: ProductionGptBrowserLifecycle;
  intent: GptAnyChildCapabilityIntent; browserCall: ProductionGptBrowserCall | undefined;
  signal: AbortSignal; resultRevision: number; childCapabilityId: GptChildCapabilityId;
  confirmedProviderEffectReadback?: import("./contract.js").GptExecutionContext["confirmedProviderEffectReadback"];
  submittedConversationLocator?: import("./contract.js").GptExecutionContext["submittedConversationLocator"];
  browserAtomicIdentity?: BrowserAtomicStepIdentity;
  stoppedEmptyRetryAuthorized?: boolean; stoppedEmptyConversationUrl?: string;
  assertProviderInputAllowed: () => void; rateLimitAckDispatchNotAfter?: number;
  recordConfirmedProviderEffectReadback?: NonNullable<
    import("./contract.js").GptExecutionContext["recordConfirmedProviderEffectReadback"]
  >;
}>): Promise<ProductionGptAtomicCallResult> => executeProductionGptAtomicCall({
  ...(input.stoppedEmptyRetryAuthorized === undefined ? {} : { stoppedEmptyRetryAuthorized: input.stoppedEmptyRetryAuthorized }),
  ...(input.stoppedEmptyConversationUrl === undefined ? {} : { stoppedEmptyConversationUrl: input.stoppedEmptyConversationUrl }),
  dataDir: input.dataDir, gpt: input.gpt, browsers: input.browsers, intent: input.intent,
  browserCall: input.browserCall, signal: input.signal, resultRevision: input.resultRevision,
  ...(input.submittedConversationLocator ? { submittedConversationLocator: input.submittedConversationLocator } : {}),
  ...(input.confirmedProviderEffectReadback ? { confirmedProviderEffectReadback: input.confirmedProviderEffectReadback } : {}),
  ...(input.browserAtomicIdentity ? { browserAtomicIdentity: input.browserAtomicIdentity } : {}),
  ...(["submit_exact_gpt_turn_once", "retry_exact_gpt_response_once"].includes(input.childCapabilityId)
    ? { assertProviderInputAllowed: input.assertProviderInputAllowed } : {}),
  ...(input.rateLimitAckDispatchNotAfter === undefined ? {}
    : { rateLimitAckDispatchNotAfter: input.rateLimitAckDispatchNotAfter }),
  ...(input.recordConfirmedProviderEffectReadback
    ? { recordConfirmedProviderEffectReadback: input.recordConfirmedProviderEffectReadback } : {}),
});
