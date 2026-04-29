import type { AiChildCapability, AiChildCapabilityId } from "./contract.js";
import { createFutureApiAiCapability } from "./children/future-api-ai/implementation.js";
import { createInternalSchemaValidatorCapability } from "./children/internal-schema-validator/implementation.js";
import { createLocalOcrAiCapability } from "./children/local-ocr-ai/implementation.js";
import { createLocalTextAiCapability } from "./children/local-text-ai/implementation.js";
import { createLocalVisionAiCapability } from "./children/local-vision-ai/implementation.js";
import { createPaidAnalysisAiCapability } from "./children/paid-analysis-ai/implementation.js";
import { createPaidVisionAiCapability } from "./children/paid-vision-ai/implementation.js";

export function listAiChildren(): AiChildCapabilityId[] {
  return [
    "local-vision-ai",
    "local-text-ai",
    "local-ocr-ai",
    "internal-schema-validator",
    "paid-vision-ai",
    "paid-analysis-ai",
    "future-api-ai",
  ];
}

export function createAiCapabilityRegistry(): Map<AiChildCapabilityId, AiChildCapability> {
  return new Map<AiChildCapabilityId, AiChildCapability>([
    ["local-vision-ai", createLocalVisionAiCapability()],
    ["local-text-ai", createLocalTextAiCapability()],
    ["local-ocr-ai", createLocalOcrAiCapability()],
    ["internal-schema-validator", createInternalSchemaValidatorCapability()],
    ["paid-vision-ai", createPaidVisionAiCapability()],
    ["paid-analysis-ai", createPaidAnalysisAiCapability()],
    ["future-api-ai", createFutureApiAiCapability()],
  ]);
}
