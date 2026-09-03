import {
  GPT_CHILD_CAPABILITY_CONTRACTS,
  type GptAbilityGroup,
  type GptAnyChildCapabilityIntent,
  type GptChildCapabilityResult,
} from "./contract.js";
import { ProductionGptBrowserLifecycle } from "./production-browser-lifecycle.js";
import {
  recoveredGptChildResult,
  type ProductionGptBrowserCall,
} from "./production-browser-lifecycle.js";
import type { GptContinuationStorePort } from "./session/gpt-continuation-store-port.js";

type AtomicGptCallInput = Readonly<{
  dataDir: string;
  gpt: GptAbilityGroup;
  store: GptContinuationStorePort;
  browsers: ProductionGptBrowserLifecycle;
  intent: GptAnyChildCapabilityIntent;
  browserCall: ProductionGptBrowserCall | undefined;
  signal: AbortSignal;
}>;

export const executeProductionGptAtomicCall = async (
  input: AtomicGptCallInput,
): Promise<Readonly<{ result: GptChildCapabilityResult; resolveDispatched: boolean }>> => {
  const { dataDir, gpt, store, browsers, intent, browserCall, signal } = input;
  const browser = browserCall?.facade;
  const context = {
    dataDir,
    ...(browser ? { browser } : {}),
    signal,
    continuationStore: store,
    ...(browserCall ? {
      yieldForProviderWait: (durationMs: number) => browsers.yieldForProviderWait(
        browserCall, intent.productStepId, intent.callId,
        intent.childCapabilityId, durationMs,
      ),
    } : {}),
  };
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
  const recovery = browser.readAtomicStepRecovery(atomicIdentity);
  if (!recovery) {
    return {
      result: await browser.runAtomicStep(
        atomicIdentity,
        () => gpt.execute(intent, context),
      ),
      resolveDispatched: false,
    };
  }
  if (recovery.state === "rejected") {
    return {
      result: recoveredGptChildResult({
        intent,
        browser,
        readback: null,
        recovery,
        state: "rejected",
      }),
      resolveDispatched: false,
    };
  }
  const readback = await browser.runAtomicStep(
    atomicIdentity,
    () => gpt.execute(intent, { ...context, mutationMode: "readback" }),
  );
  if (readback.status !== "success") return { result: readback, resolveDispatched: false };
  return {
    result: recoveredGptChildResult({
      intent,
      browser,
      readback,
      recovery,
      state: "confirmed",
    }),
    resolveDispatched: recovery.state === "dispatched",
  };
};
