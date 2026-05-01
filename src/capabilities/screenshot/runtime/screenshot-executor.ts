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
import type { ScreenshotRuntimeContext } from "./screenshot-runtime-context.js";

export async function executeScreenshotRequest(input: {
  request: ScreenshotAbilityInput;
  context: ScreenshotRuntimeContext;
}): Promise<ScreenshotAbilityResult> {
  const registryEntry = getScreenshotChildRegistryEntry(input.request.childCapabilityId);
  const clockStart = startScreenshotClock(input.context.clockPort);
  const scope = buildScreenshotExecutionScope({ request: input.request, registryEntry });
  const inputGate = runScreenshotInputGate({
    request: input.request,
    registryEntry,
    defaultAiMaxWidth: input.context.defaultAiMaxWidth,
  });
  const payloadBudgetGate = runScreenshotPayloadBudgetGate({
    request: input.request,
  });
  const sourceGate = await runScreenshotSourceGate({
    request: input.request,
    registryEntry,
    context: input.context,
  });
  const browserSessionGate = await runBrowserSessionGate({
    request: input.request,
    registryEntry,
    context: input.context,
  });
  const pageStateGate = runPageStateHandoffGate({
    request: input.request,
    registryEntry,
  });
  const privacyGate = runPrivacyPolicyGate({
    request: input.request,
    registryEntry,
  });
  return executeScreenshotExecutionFlow({
    request: input.request,
    context: input.context,
    registryEntry,
    clockStart,
    scope,
    gates: {
      inputGate,
      payloadBudgetGate,
      sourceGate,
      browserSessionGate,
      pageStateGate,
      privacyGate,
    },
  });
}
