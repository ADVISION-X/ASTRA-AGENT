import { z } from "zod";

import {
  LocalAiVisionProductPresencePayloadSchema,
  type LocalAiVisionTaskRequest,
} from "../../types/local-ai-runtime-vision-contract.js";
import { LocalAiRuntimeError } from "./local-ai-runtime-error.js";
import { extractFirstJsonObject } from "./runtime-adapters/runtime-adapter-utils.js";
import { normalizeVisionRuntimeOutput } from "./local-ai-runtime-vision-normalization.js";

type VisionProductPresenceRequest = Extract<LocalAiVisionTaskRequest, { taskType: "vision.productPresence" }>;
type JsonRecord = Record<string, unknown>;

const parseRuntimeJsonOutput = (text: string, taskType: string): unknown => {
  const extractedJson = extractFirstJsonObject(text);
  try {
    return JSON.parse(extractedJson);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new LocalAiRuntimeError("invalid_output", `Local AI returned invalid JSON for ${taskType}: ${message}`, text);
  }
};

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const normalizeTextField = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const collectUnexpectedActionFields = (value: JsonRecord): string[] =>
  ["suggestedNextAction", "nextIntent", "actionIntent", "action_intent"].filter((fieldName) =>
    normalizeTextField(value[fieldName]) !== null,
  );

const buildVisionNormalizationDiagnostics = (
  rawValue: unknown,
  payload: z.infer<typeof LocalAiVisionProductPresencePayloadSchema>,
): {
  normalizationSummary: string;
  parserIssues: string[];
  parsedDecision: string;
} => {
  const summaryParts = [
    `decision=${payload.decision}`,
    `routeLabel=${payload.routeLabel}`,
  ];

  if (!isRecord(rawValue)) {
    return {
      normalizationSummary: [...summaryParts, "rawDecision=missing", "rawRouteLabel=missing", "rawOutputShape=non_object"].join("; "),
      parserIssues: ["Raw model output was not a JSON object before normalization."],
      parsedDecision: `${payload.decision}|${payload.routeLabel}|issues=1`,
    };
  }

  const rawDecision = normalizeTextField(rawValue.decision);
  const rawRouteLabel = normalizeTextField(rawValue.routeLabel);
  const unexpectedActionFields = collectUnexpectedActionFields(rawValue);
  const parserIssues: string[] = [];

  summaryParts.push(`rawDecision=${rawDecision ?? "missing"}`);
  summaryParts.push(`rawRouteLabel=${rawRouteLabel ?? "missing"}`);

  if (rawDecision === null) {
    parserIssues.push("Raw model output omitted required decision.");
  } else if (rawDecision !== payload.decision) {
    parserIssues.push(`Raw model output decision \"${rawDecision}\" normalized to \"${payload.decision}\".`);
  }

  if (rawRouteLabel === null) {
    parserIssues.push("Raw model output omitted required routeLabel.");
  } else if (rawRouteLabel !== payload.routeLabel) {
    parserIssues.push(`Raw model output routeLabel \"${rawRouteLabel}\" normalized to \"${payload.routeLabel}\".`);
  }

  if (unexpectedActionFields.length > 0) {
    summaryParts.push(`stripped=${unexpectedActionFields.join(",")}`);
    parserIssues.push(
      ...unexpectedActionFields.map((fieldName) =>
        `Raw model output returned forbidden executable field \"${fieldName}\".`,
      ),
    );
  }

  return {
    normalizationSummary: summaryParts.join("; "),
    parserIssues,
    parsedDecision: `${payload.decision}|${payload.routeLabel}${parserIssues.length > 0 ? `|issues=${parserIssues.length}` : ""}`,
  };
};

export const parseVisionRuntimeOutput = (text: string, request: VisionProductPresenceRequest): {
  adjusted: boolean;
  normalizedFrameCount: number;
  normalizationSummary: string;
  parserIssues: string[];
  parsedDecision: string;
  payload: z.infer<typeof LocalAiVisionProductPresencePayloadSchema>;
} => {
  const parsed = parseRuntimeJsonOutput(text, request.taskType);
  const normalizedOutput = normalizeVisionRuntimeOutput(parsed, request);

  try {
    const payload = LocalAiVisionProductPresencePayloadSchema.parse(normalizedOutput.normalized);
    const diagnostics = buildVisionNormalizationDiagnostics(parsed, payload);
    return {
      adjusted: normalizedOutput.adjusted,
      normalizedFrameCount: payload.frameLevelObservations.length,
      normalizationSummary: diagnostics.normalizationSummary,
      parserIssues: diagnostics.parserIssues,
      parsedDecision: diagnostics.parsedDecision,
      payload,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new LocalAiRuntimeError(
      "invalid_output",
      `Local AI output failed schema validation for ${request.taskType}: ${message}`,
      extractFirstJsonObject(text),
    );
  }
};
