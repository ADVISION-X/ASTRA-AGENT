import type { ScreenshotAbilityInput } from "../contract.js";
import { createScreenshotFailure } from "../shared/screenshot-failure.js";
import type { ScreenshotChildRegistryEntry } from "./screenshot-child-contract.js";

function buildScreenshotInputGateFailure(input: {
  request: ScreenshotAbilityInput;
  defaultAiMaxWidth: number;
  reason: string;
  message: string;
}) {
  return {
    decision: { status: "failed" as const, reason: input.reason },
    resolvedMaxAiWidth: input.request.maxAiWidth ?? input.defaultAiMaxWidth,
    failure: createScreenshotFailure({
      code: "input_schema_invalid",
      message: input.message,
    }),
  };
}

function hasContentLinesLimitExceeded(input: {
  request: ScreenshotAbilityInput;
  defaultAiMaxWidth: number;
}) {
  return input.request.contentLines.length > input.request.capturePolicy.maxContentLines;
}

const CONTENT_LINES_LIMIT_EXCEEDED_REASON = "content_lines_limit_exceeded" as const;

const buildContentLinesLimitExceededMessage = (maxContentLines: number): string => `Screenshot contentLines exceed maxContentLines=${maxContentLines}.`;

const buildContentLinesLimitExceededFailure = (input: {
  request: ScreenshotAbilityInput;
  defaultAiMaxWidth: number;
}) => buildScreenshotInputGateFailure({ request: input.request, defaultAiMaxWidth: input.defaultAiMaxWidth, reason: CONTENT_LINES_LIMIT_EXCEEDED_REASON, message: buildContentLinesLimitExceededMessage(input.request.capturePolicy.maxContentLines) });

const resolveContentLinesLimitFailure = (input: {
  request: ScreenshotAbilityInput;
  defaultAiMaxWidth: number;
}) => hasContentLinesLimitExceeded(input) ? buildContentLinesLimitExceededFailure(input) : null;

function resolveContentLineLengthFailure(input: {
  request: ScreenshotAbilityInput;
  defaultAiMaxWidth: number;
}) {
  if (!input.request.contentLines.find((line) => line.length > input.request.capturePolicy.contentLineMaxLength)) {
    return null;
  }

  return buildScreenshotInputGateFailure({
    request: input.request,
    defaultAiMaxWidth: input.defaultAiMaxWidth,
    reason: "content_line_too_long",
    message: "Screenshot content line exceeds contentLineMaxLength.",
  });
}

function resolveRoundIdRequirementFailure(input: {
  request: ScreenshotAbilityInput;
  defaultAiMaxWidth: number;
}) {
  if (input.request.capturePolicy.allowMissingRoundId || input.request.roundId !== null) {
    return null;
  }

  return buildScreenshotInputGateFailure({
    request: input.request,
    defaultAiMaxWidth: input.defaultAiMaxWidth,
    reason: "round_id_required",
    message: "Screenshot request requires roundId under current capture policy.",
  });
}

function resolveVideoVisitIdRequirementFailure(input: {
  request: ScreenshotAbilityInput;
  defaultAiMaxWidth: number;
}) {
  if (input.request.capturePolicy.allowMissingVideoVisitId || input.request.videoVisitId !== null) {
    return null;
  }

  return buildScreenshotInputGateFailure({
    request: input.request,
    defaultAiMaxWidth: input.defaultAiMaxWidth,
    reason: "video_visit_id_required",
    message: "Screenshot request requires videoVisitId under current capture policy.",
  });
}

function resolveMaxAiWidthFailure(input: {
  request: ScreenshotAbilityInput;
  defaultAiMaxWidth: number;
}) {
  const resolvedMaxAiWidth = input.request.maxAiWidth ?? input.request.capturePolicy.maxAiWidth ?? input.defaultAiMaxWidth;
  if (resolvedMaxAiWidth > 0 && Number.isFinite(resolvedMaxAiWidth)) {
    return null;
  }

  return {
    decision: { status: "failed" as const, reason: "invalid_max_ai_width" },
    resolvedMaxAiWidth: input.defaultAiMaxWidth,
    failure: createScreenshotFailure({
      code: "input_schema_invalid",
      message: "Screenshot maxAiWidth must be a finite positive number when provided.",
    }),
  };
}

export function runScreenshotInputGate(input: {
  request: ScreenshotAbilityInput;
  registryEntry: ScreenshotChildRegistryEntry;
  defaultAiMaxWidth: number;
}): {
  decision: { status: "passed" | "failed"; reason: string | null };
  resolvedMaxAiWidth: number;
  failure: ReturnType<typeof createScreenshotFailure> | null;
} {
  return (
    resolveContentLinesLimitFailure(input)
    ?? resolveContentLineLengthFailure(input)
    ?? resolveRoundIdRequirementFailure(input)
    ?? resolveVideoVisitIdRequirementFailure(input)
    ?? resolveMaxAiWidthFailure(input)
    ?? {
      decision: { status: "passed" as const, reason: null },
      resolvedMaxAiWidth: input.request.maxAiWidth ?? input.request.capturePolicy.maxAiWidth ?? input.defaultAiMaxWidth,
      failure: null,
    }
  );
}
