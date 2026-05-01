import type { ScreenshotAbilityInput, ScreenshotAbilityResult } from "../contract.js";
import { createScreenshotFailure } from "../shared/screenshot-failure.js";
import { captureBrowserViewportChildCapability } from "../children/capture-browser-viewport/implementation.js";
import { captureDesktopScreenChildCapability } from "../children/capture-desktop-screen/implementation.js";
import { captureRegionChildCapability } from "../children/capture-region/implementation.js";
import { optimizeLosslessChildCapability } from "../children/optimize-lossless/implementation.js";
import { prepareAiInputChildCapability } from "../children/prepare-ai-input/implementation.js";
import type { ScreenshotChildCapability, ScreenshotChildRegistryEntry } from "./screenshot-child-contract.js";
import type { ScreenshotClockStart } from "./screenshot-clock.js";
import type { ScreenshotExecutionScope } from "./screenshot-execution-failure.js";
import { buildScreenshotPlanValidationFailure } from "./screenshot-execution-failure-builders.js";
import { executeScreenshotExecutionPhases, type ScreenshotExecutionGates } from "./screenshot-execution-phases.js";
import type { ScreenshotRuntimeContext } from "./screenshot-runtime-context.js";

const SCREENSHOT_CHILD_CAPABILITIES = new Map<ScreenshotAbilityInput["childCapabilityId"], ScreenshotChildCapability>([
  [captureBrowserViewportChildCapability.childCapabilityId, captureBrowserViewportChildCapability],
  [captureDesktopScreenChildCapability.childCapabilityId, captureDesktopScreenChildCapability],
  [captureRegionChildCapability.childCapabilityId, captureRegionChildCapability],
  [optimizeLosslessChildCapability.childCapabilityId, optimizeLosslessChildCapability],
  [prepareAiInputChildCapability.childCapabilityId, prepareAiInputChildCapability],
]);

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

const resolveEarlyFailure = (input: ScreenshotPlanFlowInput): {
  failEarly: ReturnType<typeof createScreenshotFailure> | null;
  earlyStatus: "failed" | "review_required";
} | null => {
  if (input.gates.inputGate.decision.status === "failed") {
    return { failEarly: input.gates.inputGate.failure, earlyStatus: "failed" as const };
  }

  if (input.gates.payloadBudgetGate.decision.status === "failed") {
    return { failEarly: input.gates.payloadBudgetGate.failure, earlyStatus: "failed" as const };
  }

  if (input.gates.sourceGate.decision.status === "failed") {
    return { failEarly: input.gates.sourceGate.failure, earlyStatus: "failed" as const };
  }

  if (input.gates.browserSessionGate.decision.status === "failed" || input.gates.browserSessionGate.decision.status === "review_required") {
    return {
      failEarly:
        input.gates.browserSessionGate.failure ??
        createScreenshotFailure({
          code: "browser_session_invalid",
          message: input.gates.browserSessionGate.decision.reason ?? "Screenshot browser session gate blocked execution.",
        }),
      earlyStatus: input.gates.browserSessionGate.decision.status,
    };
  }

  if (input.gates.pageStateGate.decision.status === "failed" || input.gates.pageStateGate.decision.status === "review_required") {
    return {
      failEarly:
        input.gates.pageStateGate.failure ??
        createScreenshotFailure({
          code: "page_state_invalid",
          message: input.gates.pageStateGate.decision.reason ?? "Screenshot page state handoff gate blocked execution.",
        }),
      earlyStatus: input.gates.pageStateGate.decision.status,
    };
  }

  if (input.gates.privacyGate.decision.status === "blocked" || input.gates.privacyGate.decision.status === "review_required") {
    return {
      failEarly:
        input.gates.privacyGate.failure ??
        createScreenshotFailure({
          code: "privacy_policy_blocked",
          message: input.gates.privacyGate.decision.reason ?? "Screenshot privacy policy gate blocked execution.",
        }),
      earlyStatus: input.gates.privacyGate.decision.status === "blocked" ? "failed" : "review_required",
    };
  }

  return null;
};

const resolveScreenshotChildCapability = (childCapabilityId: ScreenshotAbilityInput["childCapabilityId"]): ScreenshotChildCapability | null => {
  return SCREENSHOT_CHILD_CAPABILITIES.get(childCapabilityId) ?? null;
};

export async function executeScreenshotExecutionFlow(input: ScreenshotPlanFlowInput): Promise<ScreenshotAbilityResult> {
  const normalizedGates = normalizeExecutionGates(input.gates);
  const earlyFailure = resolveEarlyFailure(input);
  if (earlyFailure) {
    return buildScreenshotPlanValidationFailure({
      request: input.request,
      context: input.context,
      scope: input.scope,
      clockStart: input.clockStart,
      sourceGate: normalizedGates.sourceGate,
      browserSessionGate: normalizedGates.browserSessionGate,
      pageStateGate: normalizedGates.pageStateGate,
      privacyGate: normalizedGates.privacyGate,
      ...earlyFailure,
    });
  }

  const childCapability = resolveScreenshotChildCapability(input.request.childCapabilityId);
  if (!childCapability) {
    return buildScreenshotPlanValidationFailure({
      request: input.request,
      context: input.context,
      scope: input.scope,
      clockStart: input.clockStart,
      sourceGate: normalizedGates.sourceGate,
      browserSessionGate: normalizedGates.browserSessionGate,
      pageStateGate: normalizedGates.pageStateGate,
      privacyGate: normalizedGates.privacyGate,
      failEarly: createScreenshotFailure({
        code: "dispatch_failure",
        message: `Screenshot child capability is not implemented for ${input.request.childCapabilityId}.`,
      }),
      earlyStatus: "failed",
    });
  }

  try {
    const plan = await childCapability.execute({
      request: input.request,
      context: input.context,
    });

    return executeScreenshotExecutionPhases({
      plan,
      request: input.request,
      context: input.context,
      registryEntry: input.registryEntry,
      clockStart: input.clockStart,
      scope: input.scope,
      gates: normalizedGates,
    });
  } catch (error) {
    return buildScreenshotPlanValidationFailure({
      request: input.request,
      context: input.context,
      scope: input.scope,
      clockStart: input.clockStart,
      sourceGate: normalizedGates.sourceGate,
      browserSessionGate: normalizedGates.browserSessionGate,
      pageStateGate: normalizedGates.pageStateGate,
      privacyGate: normalizedGates.privacyGate,
      failEarly: createScreenshotFailure({
        code: "dispatch_failure",
        message: error instanceof Error ? error.message : "Screenshot execution plan build failed.",
      }),
      earlyStatus: "failed",
    });
  }
}