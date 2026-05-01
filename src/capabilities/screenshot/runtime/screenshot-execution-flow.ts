import type { ScreenshotAbilityInput, ScreenshotAbilityResult } from "../contract.js";
import { createScreenshotFailure } from "../shared/screenshot-failure.js";
import type { ScreenshotChildCapability, ScreenshotChildRegistryEntry } from "./screenshot-child-contract.js";
import type { ScreenshotClockStart } from "./screenshot-clock.js";
import type { ScreenshotExecutionScope } from "./screenshot-execution-failure.js";
import { buildScreenshotPlanValidationFailure } from "./screenshot-execution-failure-builders.js";
import { executeScreenshotExecutionPhases, type ScreenshotExecutionGates } from "./screenshot-execution-phases.js";
import { resolveScreenshotChildCapability } from "./screenshot-child-registry.js";
import type { ScreenshotRuntimeContext } from "./screenshot-runtime-context.js";

type ScreenshotExecutorGates = {
  inputGate: { decision: { status: "passed" | "failed"; reason: string | null }; failure: { message: string } | null };
  payloadBudgetGate: { decision: { status: "passed" | "failed"; reason: string | null }; failure: { message: string } | null };
  sourceGate: { decision: { status: "passed" | "failed"; reason: string | null }; sourceProof: ReturnType<typeof executeScreenshotExecutionPhases> extends Promise<infer _> ? never : never; failure: { message: string } | null };
  browserSessionGate: { decision: { status: "passed" | "failed" | "review_required" | "not_applicable"; reason: string | null }; browserSessionRef: string | null; sourceProof?: never; sessionSnapshot: unknown; failure: { message: string } | null };
  pageStateGate: { decision: { status: "passed" | "failed" | "review_required" | "not_applicable"; reason: string | null }; pageStateProofRef: string | null; failure: { message: string } | null };
  privacyGate: { decision: { status: "passed" | "blocked" | "review_required" | "not_applicable"; reason: string | null }; failure: { message: string } | null };
};

type ScreenshotPlanFlowInput = {
  request: ScreenshotAbilityInput;
  context: ScreenshotRuntimeContext;
  registryEntry: ScreenshotChildRegistryEntry;
  clockStart: ScreenshotClockStart;
  scope: ScreenshotExecutionScope;
  gates: {
    inputGate: ReturnType<typeof import("./screenshot-input-gate.js").runScreenshotInputGate>;
    payloadBudgetGate: ReturnType<typeof import("./screenshot-payload-budget-gate.js").runScreenshotPayloadBudgetGate>;
    sourceGate: Awaited<ReturnType<typeof import("./screenshot-source-gate.js").runScreenshotSourceGate>>;
    browserSessionGate: Awaited<ReturnType<typeof import("./browser-session-gate.js").runBrowserSessionGate>>;
    pageStateGate: ReturnType<typeof import("./page-state-handoff-gate.js").runPageStateHandoffGate>;
    privacyGate: ReturnType<typeof import("./privacy-policy-gate.js").runPrivacyPolicyGate>;
  };
};

const normalizeExecutionGates = (input: ScreenshotPlanFlowInput["gates"]): ScreenshotExecutionGates => ({
  sourceGate: {
    failure: input.sourceGate.failure,
    decision: input.sourceGate.decision,
    sourceProof: input.sourceGate.sourceProof,
  },
  browserSessionGate: {
    failure: input.browserSessionGate.failure,
    decision: input.browserSessionGate.decision,
    browserSessionRef: input.browserSessionGate.browserSessionRef,
  },
  pageStateGate: {
    failure: input.pageStateGate.failure,
    decision: input.pageStateGate.decision,
    pageStateProofRef: input.pageStateGate.pageStateProofRef,
  },
  privacyGate: {
    failure: input.privacyGate.failure,
    decision: input.privacyGate.decision.status === "blocked"
      ? { status: "failed", reason: input.privacyGate.decision.reason }
      : input.privacyGate.decision,
  },
});

function buildExecutionPlanValidationFailure(input: {
  flow: ScreenshotPlanFlowInput;
  normalizedGates: ScreenshotExecutionGates;
  failEarly: ReturnType<typeof createScreenshotFailure>;
  earlyStatus: "failed" | "review_required";
}) {
  return buildScreenshotPlanValidationFailure({
    request: input.flow.request,
    context: input.flow.context,
    scope: input.flow.scope,
    clockStart: input.flow.clockStart,
    sourceGate: input.normalizedGates.sourceGate,
    browserSessionGate: input.normalizedGates.browserSessionGate,
    pageStateGate: input.normalizedGates.pageStateGate,
    privacyGate: input.normalizedGates.privacyGate,
    failEarly: input.failEarly,
    earlyStatus: input.earlyStatus,
  });
}

function resolveBrowserSessionFailure(input: ScreenshotPlanFlowInput) {
  if (input.gates.browserSessionGate.decision.status !== "failed" && input.gates.browserSessionGate.decision.status !== "review_required") {
    return null;
  }

  return {
    failEarly:
      input.gates.browserSessionGate.failure ??
      createScreenshotFailure({
        code: "browser_session_invalid",
        message: input.gates.browserSessionGate.decision.reason ?? "Screenshot browser session gate blocked execution.",
      }),
    earlyStatus: input.gates.browserSessionGate.decision.status,
  } as const;
}

function resolvePageStateFailure(input: ScreenshotPlanFlowInput) {
  if (input.gates.pageStateGate.decision.status !== "failed" && input.gates.pageStateGate.decision.status !== "review_required") {
    return null;
  }

  return {
    failEarly:
      input.gates.pageStateGate.failure ??
      createScreenshotFailure({
        code: "page_state_invalid",
        message: input.gates.pageStateGate.decision.reason ?? "Screenshot page state handoff gate blocked execution.",
      }),
    earlyStatus: input.gates.pageStateGate.decision.status,
  } as const;
}

function resolvePrivacyFailure(input: ScreenshotPlanFlowInput) {
  if (input.gates.privacyGate.decision.status !== "blocked" && input.gates.privacyGate.decision.status !== "review_required") {
    return null;
  }

  return {
    failEarly:
      input.gates.privacyGate.failure ??
      createScreenshotFailure({
        code: "privacy_policy_blocked",
        message: input.gates.privacyGate.decision.reason ?? "Screenshot privacy policy gate blocked execution.",
      }),
    earlyStatus: input.gates.privacyGate.decision.status === "blocked" ? "failed" : "review_required",
  } as const;
}

async function executeResolvedScreenshotPlan(input: {
  flow: ScreenshotPlanFlowInput;
  normalizedGates: ScreenshotExecutionGates;
  childCapability: ScreenshotChildCapability;
}): Promise<ScreenshotAbilityResult> {
  const plan = await input.childCapability.execute({
    request: input.flow.request,
    context: input.flow.context,
  });

  return executeScreenshotExecutionPhases({
    plan,
    request: input.flow.request,
    context: input.flow.context,
    registryEntry: input.flow.registryEntry,
    clockStart: input.flow.clockStart,
    scope: input.flow.scope,
    gates: input.normalizedGates,
  });
}

function resolveImmediateGateFailure(input: ScreenshotPlanFlowInput) {
  if (input.gates.inputGate.decision.status === "failed") {
    return { failEarly: input.gates.inputGate.failure, earlyStatus: "failed" as const };
  }

  if (input.gates.payloadBudgetGate.decision.status === "failed") {
    return { failEarly: input.gates.payloadBudgetGate.failure, earlyStatus: "failed" as const };
  }

  if (input.gates.sourceGate.decision.status === "failed") {
    return { failEarly: input.gates.sourceGate.failure, earlyStatus: "failed" as const };
  }

  return null;
}

const resolveEarlyFailure = (input: ScreenshotPlanFlowInput): {
  failEarly: ReturnType<typeof createScreenshotFailure> | null;
  earlyStatus: "failed" | "review_required";
} | null => {
  const immediateGateFailure = resolveImmediateGateFailure(input);
  if (immediateGateFailure) {
    return immediateGateFailure;
  }

  const browserSessionFailure = resolveBrowserSessionFailure(input);
  if (browserSessionFailure) {
    return browserSessionFailure;
  }

  const pageStateFailure = resolvePageStateFailure(input);
  if (pageStateFailure) {
    return pageStateFailure;
  }

  const privacyFailure = resolvePrivacyFailure(input);
  if (privacyFailure) {
    return privacyFailure;
  }

  return null;
};

export async function executeScreenshotExecutionFlow(input: ScreenshotPlanFlowInput): Promise<ScreenshotAbilityResult> {
  const normalizedGates = normalizeExecutionGates(input.gates);
  const earlyFailure = resolveEarlyFailure(input);
  if (earlyFailure) {
    return buildExecutionPlanValidationFailure({
      flow: input,
      normalizedGates,
      failEarly: earlyFailure.failEarly ?? createScreenshotFailure({
        code: "dispatch_failure",
        message: "Screenshot execution failed before child plan execution.",
      }),
      earlyStatus: earlyFailure.earlyStatus,
    });
  }

  const childCapability = resolveScreenshotChildCapability(input.request.childCapabilityId);
  if (!childCapability) {
    return buildExecutionPlanValidationFailure({
      flow: input,
      normalizedGates,
      failEarly: createScreenshotFailure({
        code: "dispatch_failure",
        message: `Screenshot child capability is not implemented for ${input.request.childCapabilityId}.`,
      }),
      earlyStatus: "failed",
    });
  }

  try {
    return executeResolvedScreenshotPlan({
      flow: input,
      normalizedGates,
      childCapability,
    });
  } catch (error) {
    return buildExecutionPlanValidationFailure({
      flow: input,
      normalizedGates,
      failEarly: createScreenshotFailure({
        code: "dispatch_failure",
        message: error instanceof Error ? error.message : "Screenshot execution plan build failed.",
      }),
      earlyStatus: "failed",
    });
  }
}