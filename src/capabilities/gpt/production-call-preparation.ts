import type { RuntimeSpanHandle } from "../../lib/runtime-logs/index.js";
import { requireRuntimeLogWrite } from "../../lib/runtime-logs/index.js";
import type {
  GptAbilityGroup, GptAnyChildCapabilityIntent, GptChildCapabilityId,
  GptChildCapabilityIntent,
} from "./contract.js";
import { gptExactCallIdentityHash } from "./contract.js";
import { readPersistedGptTextResponse } from "./evidence-artifacts.js";
import type { ProductGptCallInput, ProductGptChildResult } from "./product-api.js";
import {
  executeProductionGptAtomicCall, type ProductionGptAtomicCallResult,
} from "./production-atomic-call.js";
import type {
  ProductionGptBrowserCall, ProductionGptBrowserLifecycle,
} from "./production-browser-lifecycle.js";
import type { BrowserAtomicStepIdentity } from "../../lib/browser/browser-authority-api.js";
import type { GptProductionExecutionInput as ExecutionInput } from "./production-child-support.js";
import { productChildResult, recordSettledProviderResult } from "./production-child-result.js";

export const acquireProductionBrowserCall = async (
  browsers: ProductionGptBrowserLifecycle,
  call: ProductGptCallInput<GptChildCapabilityId> & Readonly<{ sessionKey: string }>,
  requiredTargetKind: "chatgpt" | "none",
  priorEffectKnown: boolean,
): Promise<ProductionGptBrowserCall | undefined> => {
  if (requiredTargetKind !== "chatgpt") return undefined;
  return priorEffectKnown && call.child === "acknowledge_known_gpt_rate_limit"
    ? await browsers.browserForRateLimitRecovery(call.sessionKey, call.productStepId, call.callId)
    : await browsers.browserFor(call.sessionKey, call.productStepId, call.callId);
};

export const recoverPersistedTextCheckpoint = async <K extends GptChildCapabilityId>(input: Readonly<{
  evidenceStore: Parameters<typeof readPersistedGptTextResponse>[0]["evidenceStore"];
  execution: ExecutionInput;
  intent: GptChildCapabilityIntent<K>;
  call: ProductGptCallInput<K>;
  browsers: ProductionGptBrowserLifecycle;
  browserCall: ProductionGptBrowserCall | undefined;
  span: RuntimeSpanHandle;
}>): Promise<ProductGptChildResult<K> | null> => {
  if (input.call.child !== "checkpoint_gpt_text_response"
    || !input.browserCall?.confirmedProviderEffect) return null;
  const recovered = await readPersistedGptTextResponse({ evidenceStore: input.evidenceStore,
    jobId: input.execution.jobId, attemptId: input.execution.attemptId,
    exactCallIdentityHash: gptExactCallIdentityHash(input.intent) });
  if (!recovered) return null;
  recordSettledProviderResult(input.call, recovered.value, input.browsers, input.browserCall);
  requireRuntimeLogWrite(input.span.terminal({ outcome: "succeeded" }));
  return productChildResult({ execution: input.execution, intent: input.intent,
    value: recovered.value, browserFact: null, evidenceRef: recovered.artifactRef,
    evidenceHash: recovered.integrityHash, artifactRefs: Object.freeze([recovered.artifactRef]) });
};

export const runProductionAtomicPhase = async (input: Readonly<{
  dataDir: string; gpt: GptAbilityGroup; browsers: ProductionGptBrowserLifecycle;
  intent: GptAnyChildCapabilityIntent; browserCall: ProductionGptBrowserCall | undefined;
  signal: AbortSignal; resultRevision: number; childCapabilityId: GptChildCapabilityId;
  browserAtomicIdentity?: BrowserAtomicStepIdentity;
  assertProviderInputAllowed: () => void; rateLimitAckDispatchNotAfter?: number;
}>): Promise<ProductionGptAtomicCallResult> => executeProductionGptAtomicCall({
  dataDir: input.dataDir, gpt: input.gpt, browsers: input.browsers, intent: input.intent,
  browserCall: input.browserCall, signal: input.signal, resultRevision: input.resultRevision,
  ...(input.browserAtomicIdentity ? { browserAtomicIdentity: input.browserAtomicIdentity } : {}),
  ...(input.childCapabilityId === "submit_exact_gpt_turn_once"
    ? { assertProviderInputAllowed: input.assertProviderInputAllowed } : {}),
  ...(input.rateLimitAckDispatchNotAfter === undefined ? {}
    : { rateLimitAckDispatchNotAfter: input.rateLimitAckDispatchNotAfter }),
});
