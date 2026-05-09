import { z } from "zod";

import {
  LocalAiVisionProductPresencePayloadSchema,
  type LocalAiVisionTaskRequest,
} from "../../types/local-ai-runtime-vision-contract.js";
import { LocalAiRuntimeError } from "./local-ai-runtime-error.js";
import { extractFirstJsonObject } from "./runtime-adapters/runtime-adapter-utils.js";
import { normalizeVisionRuntimeOutput } from "./local-ai-runtime-vision-normalization.js";

type VisionProductPresenceRequest = Extract<LocalAiVisionTaskRequest, { taskType: "vision.productPresence" }>;

const parseRuntimeJsonOutput = (text: string, taskType: string): unknown => {
  const extractedJson = extractFirstJsonObject(text);
  try {
    return JSON.parse(extractedJson);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new LocalAiRuntimeError("invalid_output", `Local AI returned invalid JSON for ${taskType}: ${message}`, text);
  }
};

export const parseVisionRuntimeOutput = (text: string, request: VisionProductPresenceRequest): {
  adjusted: boolean;
  normalizedFrameCount: number;
  payload: z.infer<typeof LocalAiVisionProductPresencePayloadSchema>;
} => {
  const parsed = parseRuntimeJsonOutput(text, request.taskType);
  const normalizedOutput = normalizeVisionRuntimeOutput(parsed, request);

  try {
    const payload = LocalAiVisionProductPresencePayloadSchema.parse(normalizedOutput.normalized);
    return {
      adjusted: normalizedOutput.adjusted,
      normalizedFrameCount: payload.frameLevelObservations.length,
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
