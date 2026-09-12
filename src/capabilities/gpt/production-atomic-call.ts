import { createHash } from "node:crypto";

import {
  GPT_CHILD_CAPABILITY_CONTRACTS,
  type GptAbilityGroup,
  type GptAnyChildCapabilityIntent,
  type GptChildCapabilityResult,
  type GptExecutionContext,
} from "./contract.js";
import { ProductionGptBrowserLifecycle } from "./production-browser-lifecycle.js";
import type { ProductionGptBrowserCall } from "./production-browser-lifecycle.js";
import { executionFailure } from "../../lib/execution-failure.js";
import type { BrowserAtomicStepIdentity } from "../../lib/browser/browser-authority-api.js";

type AtomicGptCallInput = Readonly<{
  dataDir: string;
  gpt: GptAbilityGroup;
  browsers: ProductionGptBrowserLifecycle;
  intent: GptAnyChildCapabilityIntent;
  browserCall: ProductionGptBrowserCall | undefined;
  signal: AbortSignal;
  resultRevision: number;
}>;

export const productionGptAtomicIdentity = (
  intent: GptAnyChildCapabilityIntent,
  resultRevision: number,
): BrowserAtomicStepIdentity => {
  const replayPolicy = GPT_CHILD_CAPABILITY_CONTRACTS[intent.childCapabilityId].replayPolicy;
  if (replayPolicy === "transaction-identical-readback") {
    throw new Error("GPT_TRANSACTION_CHILD_CANNOT_ACQUIRE_BROWSER");
  }
  return Object.freeze({
    resultRevision,
    productStepId: intent.productStepId,
    callId: intent.callId,
    childCapabilityId: intent.childCapabilityId,
    inputHash: replayPolicy === "provider-effect-once"
      ? `sha256:${createHash("sha256").update(JSON.stringify([resultRevision, intent.inputHash])).digest("hex")}`
      : intent.inputHash,
    actionOrdinal: intent.actionOrdinal,
    replayPolicy,
  });
};

const executionContext = (
  input: AtomicGptCallInput,
  browser: ProductionGptBrowserCall["facade"] | undefined,
  browserAtomicIdentity?: BrowserAtomicStepIdentity,
): GptExecutionContext => ({
  dataDir: input.dataDir,
  ...(browser ? { browser } : {}),
  ...(browserAtomicIdentity ? { browserAtomicIdentity } : {}),
  signal: input.signal,
  ...(input.browserCall ? {
    yieldForProviderProbe: (canonicalConversationUrl: string, probeDeadlineAt: number) =>
      input.browsers.yieldForProviderProbe(
      input.browserCall!, input.intent.productStepId, input.intent.callId,
      input.intent.childCapabilityId, canonicalConversationUrl, probeDeadlineAt,
      ),
  } : {}),
});

export const executeProductionGptAtomicCall = async (
  input: AtomicGptCallInput,
): Promise<Readonly<{ result: GptChildCapabilityResult; resolveDispatched: boolean }>> => {
  const { gpt, intent, browserCall } = input;
  const browser = browserCall?.facade;
  if (!browser) {
    return { result: await gpt.execute(intent, executionContext(input, browser)), resolveDispatched: false };
  }
  const replayPolicy = GPT_CHILD_CAPABILITY_CONTRACTS[intent.childCapabilityId].replayPolicy;
  const atomicIdentity = productionGptAtomicIdentity(intent, input.resultRevision);
  const context = executionContext(input, browser, atomicIdentity);
  const priorOutcome = browser.readAtomicStepOutcome(atomicIdentity);
  if (!priorOutcome) {
    return {
      result: await browser.runAtomicStep(
        atomicIdentity,
        () => gpt.execute(intent, context),
      ),
      resolveDispatched: false,
    };
  }
  if (replayPolicy === "provider-effect-once"
    && intent.childCapabilityId === "submit_exact_gpt_turn_once"
    && priorOutcome.state === "confirmed"
    && (priorOutcome.mutationOutcome === "no" || priorOutcome.mutationOutcome === "confirmed")
    && priorOutcome.providerEffectIdentityHash
    && priorOutcome.terminalAt && priorOutcome.terminalPayload != null) {
    return {
      result: await gpt.execute(intent, Object.freeze({
        ...context,
        confirmedProviderEffectReadback: Object.freeze({
          terminalPayload: priorOutcome.terminalPayload,
          terminalAt: priorOutcome.terminalAt,
          authorityRef: priorOutcome.authorityRef,
          authorityHash: priorOutcome.authorityHash,
          providerEffectIdentityHash: priorOutcome.providerEffectIdentityHash,
          mutationOutcome: priorOutcome.mutationOutcome,
        }),
      })),
      resolveDispatched: false,
    };
  }
  throw executionFailure("failed", "GPT_ATOMIC_STEP_ALREADY_ATTEMPTED", {
    metadata: {
      mutationOutcome: priorOutcome.mutationOutcome,
      evidence: {
        evidenceRef: priorOutcome.authorityRef,
        evidenceHash: priorOutcome.authorityHash,
      },
      browserEffect: {
        effectScope: replayPolicy === "provider-effect-once" ? "provider_effect" : "target_local",
        childCapabilityId: intent.childCapabilityId,
        browserOutcome: priorOutcome.state.toUpperCase() as "DISPATCHED" | "CONFIRMED" | "REJECTED",
        providerEffectIdentityHash: priorOutcome.providerEffectIdentityHash,
      },
    },
  });
};
