import {
  GPT_CHILD_CAPABILITY_CONTRACTS,
  type GptAbilityGroup,
  type GptChildCapabilityIntent,
  type GptChildCapabilityResult,
} from "../../../capabilities/gpt/index.js";
import { ProductionGptBrowserLifecycle } from "./production-gpt-browser-lifecycle.js";
import {
  recoveredGptChildResult,
  type ProductionGptBrowserCall,
} from "./production-gpt-browser-lifecycle.js";
import type { ProductionRuntimeStore } from "./store.js";

type AtomicGptCallInput = Readonly<{
  dataDir: string;
  gpt: GptAbilityGroup;
  store: ProductionRuntimeStore;
  browsers: ProductionGptBrowserLifecycle;
  intent: GptChildCapabilityIntent;
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
  const atomicIdentity = {
    productStepId: intent.productStepId,
    callId: intent.callId,
    childCapabilityId: intent.childCapabilityId,
    inputHash: intent.inputHash,
    actionOrdinal: intent.actionOrdinal,
    replayPolicy: GPT_CHILD_CAPABILITY_CONTRACTS[intent.childCapabilityId].replayPolicy,
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
        authorityRef: recovery.authorityRef,
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
      authorityRef: recovery.authorityRef,
      state: "confirmed",
    }),
    resolveDispatched: recovery.state === "dispatched",
  };
};
