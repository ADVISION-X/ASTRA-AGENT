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

type AtomicGptCallInput = Readonly<{
  dataDir: string;
  gpt: GptAbilityGroup;
  browsers: ProductionGptBrowserLifecycle;
  intent: GptAnyChildCapabilityIntent;
  browserCall: ProductionGptBrowserCall | undefined;
  signal: AbortSignal;
}>;

const executionContext = (
  input: AtomicGptCallInput,
  browser: ProductionGptBrowserCall["facade"] | undefined,
): GptExecutionContext => ({
  dataDir: input.dataDir,
  ...(browser ? { browser } : {}),
  signal: input.signal,
  ...(input.browserCall ? {
    yieldForProviderWait: (durationMs: number) => input.browsers.yieldForProviderWait(
      input.browserCall!, input.intent.productStepId, input.intent.callId,
      input.intent.childCapabilityId, durationMs,
    ),
    navigateCrossConversationPoll: (canonicalConversationUrl: string, probeDeadlineAt: number) =>
      input.browsers.navigateCrossConversationPoll(
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
  const context = executionContext(input, browser);
  if (!browser) return { result: await gpt.execute(intent, context), resolveDispatched: false };
  const replayPolicy = GPT_CHILD_CAPABILITY_CONTRACTS[intent.childCapabilityId].replayPolicy;
  if (replayPolicy === "transaction-identical-readback") {
    throw new Error("GPT_TRANSACTION_CHILD_CANNOT_ACQUIRE_BROWSER");
  }
  const atomicIdentity = {
    productStepId: intent.productStepId,
    callId: intent.callId,
    childCapabilityId: intent.childCapabilityId,
    inputHash: intent.inputHash,
    actionOrdinal: intent.actionOrdinal,
    replayPolicy,
  } as const;
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
      },
    },
  });
};
