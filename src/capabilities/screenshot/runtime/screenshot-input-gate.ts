import type { ScreenshotAbilityInput, ScreenshotChildRegistryEntry } from "../contract.js";
import { createScreenshotFailure } from "../shared/screenshot-failure.js";

export function runScreenshotInputGate(input: {
  request: ScreenshotAbilityInput;
  registryEntry: ScreenshotChildRegistryEntry;
  defaultAiMaxWidth: number;
}): {
  decision: { status: "passed" | "failed"; reason: string | null };
  resolvedMaxAiWidth: number;
  failure: ReturnType<typeof createScreenshotFailure> | null;
} {
  const contentLineLimit = input.request.capturePolicy.maxContentLines;
  if (input.request.contentLines.length > contentLineLimit) {
    return {
      decision: { status: "failed", reason: "content_lines_limit_exceeded" },
      resolvedMaxAiWidth: input.request.maxAiWidth ?? input.defaultAiMaxWidth,
      failure: createScreenshotFailure({
        code: "input_schema_invalid",
        message: `Screenshot contentLines exceed maxContentLines=${contentLineLimit}.`,
      }),
    };
  }

  const invalidLine = input.request.contentLines.find((line) => line.length > input.request.capturePolicy.contentLineMaxLength);
  if (invalidLine) {
    return {
      decision: { status: "failed", reason: "content_line_too_long" },
      resolvedMaxAiWidth: input.request.maxAiWidth ?? input.defaultAiMaxWidth,
      failure: createScreenshotFailure({
        code: "input_schema_invalid",
        message: "Screenshot content line exceeds contentLineMaxLength.",
      }),
    };
  }

  if (!input.request.capturePolicy.allowMissingRoundId && input.request.roundId === null) {
    return {
      decision: { status: "failed", reason: "round_id_required" },
      resolvedMaxAiWidth: input.request.maxAiWidth ?? input.defaultAiMaxWidth,
      failure: createScreenshotFailure({
        code: "input_schema_invalid",
        message: "Screenshot request requires roundId under current capture policy.",
      }),
    };
  }

  if (!input.request.capturePolicy.allowMissingVideoVisitId && input.request.videoVisitId === null) {
    return {
      decision: { status: "failed", reason: "video_visit_id_required" },
      resolvedMaxAiWidth: input.request.maxAiWidth ?? input.defaultAiMaxWidth,
      failure: createScreenshotFailure({
        code: "input_schema_invalid",
        message: "Screenshot request requires videoVisitId under current capture policy.",
      }),
    };
  }

  const resolvedMaxAiWidth = input.request.maxAiWidth ?? input.request.capturePolicy.maxAiWidth ?? input.defaultAiMaxWidth;
  if (resolvedMaxAiWidth <= 0 || !Number.isFinite(resolvedMaxAiWidth)) {
    return {
      decision: { status: "failed", reason: "invalid_max_ai_width" },
      resolvedMaxAiWidth: input.defaultAiMaxWidth,
      failure: createScreenshotFailure({
        code: "input_schema_invalid",
        message: "Screenshot maxAiWidth must be a finite positive number when provided.",
      }),
    };
  }

  return {
    decision: { status: "passed", reason: null },
    resolvedMaxAiWidth,
    failure: null,
  };
}
