import {
  createGptAbilityGroup,
  GPT_CHILD_CAPABILITY_CONTRACTS,
  type GptAbilityGroup,
  type GptChildCapabilityId,
  type GptChildCapabilityIntent,
  type GptChildInputMap,
} from "../index.js";
import type { BrowserTargetLease } from "../../../lib/browser/browser-authority-api.js";
import { hashCanonical } from "../../../lib/local-runtime/production/contracts.js";

type GptExecutionContext = Parameters<GptAbilityGroup["execute"]>[1];

export const createGptAcceptanceHarness = (scope: string) => {
  const gpt = createGptAbilityGroup();
  let ordinal = 0;
  const execute = <K extends GptChildCapabilityId>(
    childCapabilityId: K,
    browser: BrowserTargetLease,
    input: GptChildInputMap[K],
    mutationMode?: "normal" | "readback",
    contextOverrides?: Partial<GptExecutionContext>,
  ) => {
    ordinal += 1;
    const intent = Object.freeze({
      childCapabilityId,
      executionId: `acceptance:${scope}:${childCapabilityId}:${ordinal}`,
      jobId: "job:gpt-exact-target",
      attemptId: "attempt:gpt-exact-target",
      pluginId: "acceptance-product",
      pluginVersion: 1,
      productStepId: `acceptance:${scope}`,
      callId: "acceptance-call",
      inputHash: hashCanonical(input),
      actionOrdinal: ordinal,
      input,
    }) as GptChildCapabilityIntent<K>;
    const context = {
      dataDir: "/tmp/gpt-exact-target", browser,
      ...(mutationMode ? { mutationMode } : {}),
      ...contextOverrides,
    };
    return browser.runAtomicStep({
      productStepId: intent.productStepId,
      callId: intent.callId,
      childCapabilityId,
      inputHash: intent.inputHash,
      actionOrdinal: intent.actionOrdinal,
      replayPolicy: GPT_CHILD_CAPABILITY_CONTRACTS[childCapabilityId].replayPolicy as
        "observation-only" | "target-local-per-generation" | "provider-effect-once",
    }, () => gpt.execute(intent, context));
  };
  return Object.freeze({ gpt, execute });
};
