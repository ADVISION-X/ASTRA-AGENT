import type { PageStateChildCapability } from "./page-state-child-contract.js";
import type { PageStateAbilityInput } from "../schema.js";
import type { PageStateClockPort } from "../ports/page-state-clock-port.js";
import type { PageStateProfilePort } from "../ports/page-state-profile-port.js";
import { dispatchPageStateFailure } from "./page-state-dispatch-failure.js";
import { runPageStatePreflight } from "./page-state-preflight.js";
import { buildPageStateSuccessResult } from "./page-state-success-result.js";

export async function executePageState(input: {
  request: PageStateAbilityInput;
  childCapability: PageStateChildCapability;
  clock: PageStateClockPort;
  profilePort: PageStateProfilePort;
}): Promise<import("../schema.js").PageStateAbilityResult> {
  const startedAt = input.clock.now();
  const preflight = runPageStatePreflight({
    request: input.request,
    clock: input.clock,
    profilePort: input.profilePort,
  });
  if (!preflight.ok) {
    return preflight.result;
  }

  try {
    return await buildPageStateSuccessResult({
      request: input.request,
      childCapability: input.childCapability,
      startedAt,
      clock: input.clock,
      preflight: preflight.state,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown page-state execution failure.";
    return dispatchPageStateFailure({
      request: input.request,
      failureReason: "execution_failed",
      stateSummary: `Page State execution failed: ${message}`,
      reviewRequiredReason: null,
      pageStateType: "unknown_page",
      status: "failed",
      decision: "fail",
      dataQualityFlags: ["insufficient_signal"],
      clock: input.clock,
    });
  }
}