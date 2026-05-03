import type { ScreenshotAbilityInput } from "../contract.js";
import { createScreenshotFailure } from "../shared/screenshot-failure.js";
import { evaluateScreenshotArtifactBudget, resolveScreenshotRetentionClass } from "./screenshot-artifact-lifecycle.js";

export function runScreenshotPayloadBudgetGate(input: {
  request: ScreenshotAbilityInput;
}): {
  decision: { status: "passed" | "failed"; reason: string | null };
  failure: ReturnType<typeof createScreenshotFailure> | null;
} {
  const { request } = input;

  if (request.contentLines.length > request.capturePolicy.maxContentLines) {
    return {
      decision: { status: "failed", reason: "content_lines_budget_exceeded" },
      failure: createScreenshotFailure({
        code: "input_schema_invalid",
        message: "Screenshot contentLines exceeded capturePolicy.maxContentLines.",
      }),
    };
  }

  const oversizedLine = request.contentLines.find((line) => line.length > request.capturePolicy.contentLineMaxLength);
  if (oversizedLine) {
    return {
      decision: { status: "failed", reason: "content_line_length_exceeded" },
      failure: createScreenshotFailure({
        code: "input_schema_invalid",
        message: "Screenshot contentLines contains a line that exceeded capturePolicy.contentLineMaxLength.",
      }),
    };
  }

  const artifactBudgetFailure = evaluateScreenshotArtifactBudget({
    request,
    byteSize: 0,
    retentionClass: resolveScreenshotRetentionClass(request.childCapabilityId),
  });
  if (artifactBudgetFailure) {
    return {
      decision: { status: "failed", reason: artifactBudgetFailure.reason },
      failure: createScreenshotFailure({
        code: "artifact_budget_exceeded",
        message: artifactBudgetFailure.message,
      }),
    };
  }

  return {
    decision: { status: "passed", reason: null },
    failure: null,
  };
}