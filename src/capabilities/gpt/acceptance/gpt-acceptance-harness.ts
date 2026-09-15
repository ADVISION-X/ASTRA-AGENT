import {
  createGptAbilityGroup,
  type GptAbilityGroup,
} from "../index.js";
import {
  type GptChildCapabilityId,
  type GptChildCapabilityIntent,
  type GptAnyChildCapabilityIntent,
  type GptChildInputMap,
} from "../contract.js";
import { productionGptAtomicIdentity } from "../production-atomic-call.js";
import type { BrowserTargetLease } from "../../../lib/browser/browser-authority-api.js";
import { hashCanonical } from "../../../lib/local-runtime/production/contracts.js";

type GptExecutionContext = Parameters<GptAbilityGroup["execute"]>[1];

export const createGptAcceptanceHarness = (scope: string) => {
  const gpt = createGptAbilityGroup();
  let ordinal = 0;
  const buildIntent = <K extends GptChildCapabilityId>(
    childCapabilityId: K,
    input: GptChildInputMap[K],
  ): GptChildCapabilityIntent<K> => {
    ordinal += 1;
    return Object.freeze({
      childCapabilityId,
      executionId: `acceptance:${scope}:${childCapabilityId}:${ordinal}`,
      jobId: "job:gpt-exact-target",
      attemptId: "attempt:gpt-exact-target",
      resultRevision: 0,
      productStepId: `acceptance:${scope}`,
      callId: "acceptance-call",
      inputHash: hashCanonical(input),
      actionOrdinal: ordinal,
      input,
    }) as GptChildCapabilityIntent<K>;
  };
  const execute = <K extends GptChildCapabilityId>(
    childCapabilityId: K,
    browser: BrowserTargetLease,
    input: GptChildInputMap[K],
    contextOverrides?: Partial<GptExecutionContext>,
  ) => {
    const intent = buildIntent(childCapabilityId, input);
    const browserAtomicIdentity = productionGptAtomicIdentity(
      intent as GptAnyChildCapabilityIntent,
      0,
    );
    const context = {
      dataDir: "/tmp/gpt-exact-target", browser, browserAtomicIdentity,
      ...contextOverrides,
    };
    return browser.runAtomicStep(browserAtomicIdentity, () => gpt.execute(intent, context));
  };
  return Object.freeze({ gpt, buildIntent, execute });
};
