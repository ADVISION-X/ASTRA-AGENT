import type { ScreenshotAbilityInput, ScreenshotAbilityResult } from "../contract.js";
import { getScreenshotChildRegistryEntry } from "../registry.js";
import { runScreenshotInputGate } from "./screenshot-input-gate.js";
import { runScreenshotPayloadBudgetGate } from "./screenshot-payload-budget-gate.js";
import { runScreenshotSourceGate } from "./screenshot-source-gate.js";
import { runBrowserSessionGate } from "./browser-session-gate.js";
import { runPageStateHandoffGate } from "./page-state-handoff-gate.js";
import { runPrivacyPolicyGate } from "./privacy-policy-gate.js";
import { buildScreenshotExecutionScope, dispatchScreenshotExecutionFailure } from "./screenshot-execution-failure.js";
import { executeScreenshotExecutionFlow } from "./screenshot-execution-flow.js";
import { startScreenshotClock } from "./screenshot-clock.js";
import type { ScreenshotChildRegistryEntry } from "./screenshot-child-contract.js";

type ScreenshotRuntimeContext = Parameters<typeof runBrowserSessionGate>[0]["context"];

const initializeScreenshotGates = async (input: {
  request: ScreenshotAbilityInput;
  context: ScreenshotRuntimeContext;
  registryEntry: ScreenshotChildRegistryEntry;
}) => ({
  inputGate: runScreenshotInputGate({
    request: input.request,
    registryEntry: input.registryEntry,
    defaultAiMaxWidth: input.context.defaultAiMaxWidth,
  }),
  payloadBudgetGate: runScreenshotPayloadBudgetGate({
    request: input.request,
  }),
  sourceGate: await runScreenshotSourceGate({
    request: input.request,
    registryEntry: input.registryEntry,
    context: input.context,
  }),
  browserSessionGate: await runBrowserSessionGate({
    request: input.request,
    registryEntry: input.registryEntry,
    context: input.context,
  }),
  pageStateGate: runPageStateHandoffGate({
    request: input.request,
    registryEntry: input.registryEntry,
  }),
  privacyGate: runPrivacyPolicyGate({
    request: input.request,
    registryEntry: input.registryEntry,
  }),
});

export async function executeScreenshotRequest(input: {
  request: ScreenshotAbilityInput;
  context: ScreenshotRuntimeContext;
}): Promise<ScreenshotAbilityResult> {
  const registryEntry = getScreenshotChildRegistryEntry(input.request.childCapabilityId);
  if (!registryEntry) {
    throw new Error(`Screenshot child capability is not registered for ${input.request.childCapabilityId}.`);
  }
  const clockStart = startScreenshotClock(input.context.clockPort);
  const scope = buildScreenshotExecutionScope({ request: input.request, registryEntry });
  const gates = await initializeScreenshotGates({ request: input.request, context: input.context, registryEntry });
  return executeScreenshotExecutionFlow({
    request: input.request,
    context: input.context,
    registryEntry,
    clockStart,
    scope,
    gates,
  });
}
