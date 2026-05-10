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
    `taskDecision=${payload.taskDecision}`,
    `pageStateDecision=${payload.pageStateDecision}`,
  ];

  if (!isRecord(rawValue)) {
    return {
      normalizationSummary: [...summaryParts, "rawTaskDecision=missing", "rawActionPlan=missing", "rawOutputShape=non_object"].join("; "),
      parserIssues: ["Raw model output was not a JSON object before normalization."],
      parsedDecision: `${payload.taskDecision}|actions=${payload.actionPlan.actions.length}|issues=1`,
    };
  }

  const rawTaskDecision = normalizeTextField(rawValue.taskDecision);
  const rawActionPlan = isRecord(rawValue.actionPlan) ? rawValue.actionPlan : null;
  const rawFirstActionCode = rawActionPlan && Array.isArray(rawActionPlan.actions)
    ? normalizeTextField((rawActionPlan.actions[0] as Record<string, unknown> | undefined)?.actionCode)
    : null;
  const unexpectedActionFields = collectUnexpectedActionFields(rawValue);
  const parserIssues: string[] = [];

  summaryParts.push(`rawTaskDecision=${rawTaskDecision ?? "missing"}`);
  summaryParts.push(`rawActionCode=${rawFirstActionCode ?? "missing"}`);

  if (rawTaskDecision === null) {
    parserIssues.push("Raw model output omitted required taskDecision.");
  } else if (rawTaskDecision !== payload.taskDecision) {
    parserIssues.push(`Raw model output taskDecision \"${rawTaskDecision}\" normalized to \"${payload.taskDecision}\".`);
  }

  if (rawFirstActionCode === null) {
    parserIssues.push("Raw model output omitted required actionPlan.actions[0].actionCode.");
  } else if (rawFirstActionCode !== payload.actionPlan.actions[0]?.actionCode) {
    parserIssues.push(`Raw model output actionCode \"${rawFirstActionCode}\" normalized to \"${payload.actionPlan.actions[0]?.actionCode ?? "missing"}\".`);
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
    parsedDecision: `${payload.taskDecision}|actions=${payload.actionPlan.actions.length}${parserIssues.length > 0 ? `|issues=${parserIssues.length}` : ""}`,
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
