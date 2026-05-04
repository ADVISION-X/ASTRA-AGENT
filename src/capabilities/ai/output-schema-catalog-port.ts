import { AI_OUTPUT_SCHEMA_BY_TASK_TYPE, type AiOutputSchemaDescriptor } from "./shared/ai-output-schema-catalog.js";

export type { AiOutputSchemaDescriptor };

export const findAiOutputSchemaDescriptor = (
  taskType: string,
): AiOutputSchemaDescriptor | null => {
  return AI_OUTPUT_SCHEMA_BY_TASK_TYPE[taskType] ?? null;
};

export const requireAiOutputSchemaDescriptor = (
  taskType: string,
): AiOutputSchemaDescriptor => {
  const descriptor = findAiOutputSchemaDescriptor(taskType);
  if (!descriptor) {
    throw new Error(`AI output schema descriptor is missing for taskType=${taskType}.`);
  }

  return descriptor;
};