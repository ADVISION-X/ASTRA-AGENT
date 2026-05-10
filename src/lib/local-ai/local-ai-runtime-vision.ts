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

const buildNonObjectNormalizationDiagnostics = (
  payload: z.infer<typeof LocalAiVisionProductPresencePayloadSchema>,
) => ({
  normalizationSummary: [
    `taskDecision=${payload.taskDecision}`,
    `pageStateDecision=${payload.pageStateDecision}`,
    "rawTaskDecision=missing",
    "rawActionPlan=missing",
    "rawOutputShape=non_object",
  ].join("; "),
  parserIssues: ["Raw model output was not a JSON object before normalization."],
  parsedDecision: `${payload.taskDecision}|actions=${payload.actionPlan.actions.length}|issues=1`,
});

const resolveRawFirstActionCode = (value: JsonRecord): string | null => {
  const rawActionPlan = isRecord(value.actionPlan) ? value.actionPlan : null;
  return rawActionPlan && Array.isArray(rawActionPlan.actions)
    ? normalizeTextField((rawActionPlan.actions[0] as Record<string, unknown> | undefined)?.actionCode)
    : null;
};

const buildParserIssues = (input: {
  rawTaskDecision: string | null;
  rawFirstActionCode: string | null;
  payload: z.infer<typeof LocalAiVisionProductPresencePayloadSchema>;
  unexpectedActionFields: string[];
}): string[] => {
  const parserIssues: string[] = [];

  if (input.rawTaskDecision === null) {
    parserIssues.push("Raw model output omitted required taskDecision.");
  } else if (input.rawTaskDecision !== input.payload.taskDecision) {
    parserIssues.push(`Raw model output taskDecision "${input.rawTaskDecision}" normalized to "${input.payload.taskDecision}".`);
  }

  if (input.rawFirstActionCode === null) {
    parserIssues.push("Raw model output omitted required actionPlan.actions[0].actionCode.");
  } else if (input.rawFirstActionCode !== input.payload.actionPlan.actions[0]?.actionCode) {
    parserIssues.push(`Raw model output actionCode "${input.rawFirstActionCode}" normalized to "${input.payload.actionPlan.actions[0]?.actionCode ?? "missing"}".`);
  }

  parserIssues.push(
    ...input.unexpectedActionFields.map((fieldName) =>
      `Raw model output returned forbidden executable field "${fieldName}".`,
    ),
  );

  return parserIssues;
};

const buildVisionNormalizationDiagnostics = (
  rawValue: unknown,
  payload: z.infer<typeof LocalAiVisionProductPresencePayloadSchema>,
): {
  normalizationSummary: string;
  parserIssues: string[];
  parsedDecision: string;
} => {
  if (!isRecord(rawValue)) {
    return buildNonObjectNormalizationDiagnostics(payload);
  }

  const rawTaskDecision = normalizeTextField(rawValue.taskDecision);
  const rawFirstActionCode = resolveRawFirstActionCode(rawValue);
  const unexpectedActionFields = collectUnexpectedActionFields(rawValue);
  const summaryParts = [
    `taskDecision=${payload.taskDecision}`,
    `pageStateDecision=${payload.pageStateDecision}`,
    `rawTaskDecision=${rawTaskDecision ?? "missing"}`,
    `rawActionCode=${rawFirstActionCode ?? "missing"}`,
  ];
  const parserIssues = buildParserIssues({ rawTaskDecision, rawFirstActionCode, payload, unexpectedActionFields });

  if (unexpectedActionFields.length > 0) {
    summaryParts.push(`stripped=${unexpectedActionFields.join(",")}`);
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
