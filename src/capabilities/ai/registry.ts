import type { AiChildCapabilityId, AiChildCapabilityRegistryEntry } from "./contract.js";
import { FutureApiAiChildContract } from "./children/future-api-ai/contract.js";
import { FutureApiAiChildInputSchema, FutureApiAiChildResultSchema } from "./children/future-api-ai/schema.js";
import { createFutureApiAiCapability } from "./children/future-api-ai/implementation.js";
import { InternalSchemaValidatorChildContract } from "./children/internal-schema-validator/contract.js";
import { InternalSchemaValidatorChildInputSchema, InternalSchemaValidatorChildResultSchema } from "./children/internal-schema-validator/schema.js";
import { createInternalSchemaValidatorCapability } from "./children/internal-schema-validator/implementation.js";
import { LocalOcrAiChildContract } from "./children/local-ocr-ai/contract.js";
import { LocalOcrAiChildInputSchema, LocalOcrAiChildResultSchema } from "./children/local-ocr-ai/schema.js";
import { createLocalOcrAiCapability } from "./children/local-ocr-ai/implementation.js";
import { LocalTextAiChildContract } from "./children/local-text-ai/contract.js";
import { LocalTextAiChildInputSchema, LocalTextAiChildResultSchema } from "./children/local-text-ai/schema.js";
import { createLocalTextAiCapability } from "./children/local-text-ai/implementation.js";
import { LocalVisionAiChildContract } from "./children/local-vision-ai/contract.js";
import { LocalVisionAiChildInputSchema, LocalVisionAiChildResultSchema } from "./children/local-vision-ai/schema.js";
import { createLocalVisionAiCapability } from "./children/local-vision-ai/implementation.js";
import { PaidAnalysisAiChildContract } from "./children/paid-analysis-ai/contract.js";
import { PaidAnalysisAiChildInputSchema, PaidAnalysisAiChildResultSchema } from "./children/paid-analysis-ai/schema.js";
import { createPaidAnalysisAiCapability } from "./children/paid-analysis-ai/implementation.js";
import { PaidVisionAiChildContract } from "./children/paid-vision-ai/contract.js";
import { PaidVisionAiChildInputSchema, PaidVisionAiChildResultSchema } from "./children/paid-vision-ai/schema.js";
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

const AI_CHILD_REGISTRY_ENTRIES: readonly AiChildCapabilityRegistryEntry[] = [
  {
    childCapabilityId: "local-vision-ai",
    providerKind: LocalVisionAiChildContract.providerKind,
    allowedTaskTypes: LocalVisionAiChildContract.executionPolicy.allowedTaskTypes,
    executable: LocalVisionAiChildContract.executionPolicy.executable,
    inputSchema: LocalVisionAiChildInputSchema,
    outputSchema: LocalVisionAiChildResultSchema,
    boundaryPolicy: LocalVisionAiChildContract.boundaryPolicy,
    proofPolicy: LocalVisionAiChildContract.proofPolicy,
    disabledPolicy: "enabled",
    contract: LocalVisionAiChildContract,
    implementation: createLocalVisionAiCapability().implementation,
  },
  {
    childCapabilityId: "local-text-ai",
    providerKind: LocalTextAiChildContract.providerKind,
    allowedTaskTypes: LocalTextAiChildContract.executionPolicy.allowedTaskTypes,
    executable: LocalTextAiChildContract.executionPolicy.executable,
    inputSchema: LocalTextAiChildInputSchema,
    outputSchema: LocalTextAiChildResultSchema,
    boundaryPolicy: LocalTextAiChildContract.boundaryPolicy,
    proofPolicy: LocalTextAiChildContract.proofPolicy,
    disabledPolicy: "enabled",
    contract: LocalTextAiChildContract,
    implementation: createLocalTextAiCapability().implementation,
  },
  {
    childCapabilityId: "local-ocr-ai",
    providerKind: LocalOcrAiChildContract.providerKind,
    allowedTaskTypes: LocalOcrAiChildContract.executionPolicy.allowedTaskTypes,
    executable: LocalOcrAiChildContract.executionPolicy.executable,
    inputSchema: LocalOcrAiChildInputSchema,
    outputSchema: LocalOcrAiChildResultSchema,
    boundaryPolicy: LocalOcrAiChildContract.boundaryPolicy,
    proofPolicy: LocalOcrAiChildContract.proofPolicy,
    disabledPolicy: "enabled",
    contract: LocalOcrAiChildContract,
    implementation: createLocalOcrAiCapability().implementation,
  },
  {
    childCapabilityId: "internal-schema-validator",
    providerKind: InternalSchemaValidatorChildContract.providerKind,
    allowedTaskTypes: InternalSchemaValidatorChildContract.executionPolicy.allowedTaskTypes,
    executable: InternalSchemaValidatorChildContract.executionPolicy.executable,
    inputSchema: InternalSchemaValidatorChildInputSchema,
    outputSchema: InternalSchemaValidatorChildResultSchema,
    boundaryPolicy: InternalSchemaValidatorChildContract.boundaryPolicy,
    proofPolicy: InternalSchemaValidatorChildContract.proofPolicy,
    disabledPolicy: "enabled",
    contract: InternalSchemaValidatorChildContract,
    implementation: createInternalSchemaValidatorCapability().implementation,
  },
  {
    childCapabilityId: "paid-vision-ai",
    providerKind: PaidVisionAiChildContract.providerKind,
    allowedTaskTypes: PaidVisionAiChildContract.executionPolicy.allowedTaskTypes,
    executable: PaidVisionAiChildContract.executionPolicy.executable,
    inputSchema: PaidVisionAiChildInputSchema,
    outputSchema: PaidVisionAiChildResultSchema,
    boundaryPolicy: PaidVisionAiChildContract.boundaryPolicy,
    proofPolicy: PaidVisionAiChildContract.proofPolicy,
    disabledPolicy: "disabled_by_policy",
    contract: PaidVisionAiChildContract,
    implementation: createPaidVisionAiCapability().implementation,
  },
  {
    childCapabilityId: "paid-analysis-ai",
    providerKind: PaidAnalysisAiChildContract.providerKind,
    allowedTaskTypes: PaidAnalysisAiChildContract.executionPolicy.allowedTaskTypes,
    executable: PaidAnalysisAiChildContract.executionPolicy.executable,
    inputSchema: PaidAnalysisAiChildInputSchema,
    outputSchema: PaidAnalysisAiChildResultSchema,
    boundaryPolicy: PaidAnalysisAiChildContract.boundaryPolicy,
    proofPolicy: PaidAnalysisAiChildContract.proofPolicy,
    disabledPolicy: "disabled_by_policy",
    contract: PaidAnalysisAiChildContract,
    implementation: createPaidAnalysisAiCapability().implementation,
  },
  {
    childCapabilityId: "future-api-ai",
    providerKind: FutureApiAiChildContract.providerKind,
    allowedTaskTypes: FutureApiAiChildContract.executionPolicy.allowedTaskTypes,
    executable: FutureApiAiChildContract.executionPolicy.executable,
    inputSchema: FutureApiAiChildInputSchema,
    outputSchema: FutureApiAiChildResultSchema,
    boundaryPolicy: FutureApiAiChildContract.boundaryPolicy,
    proofPolicy: FutureApiAiChildContract.proofPolicy,
    disabledPolicy: "disabled_by_policy",
    contract: FutureApiAiChildContract,
    implementation: createFutureApiAiCapability().implementation,
  },
];

export function createAiCapabilityRegistry(): ReadonlyMap<AiChildCapabilityId, AiChildCapabilityRegistryEntry> {
  return new Map<AiChildCapabilityId, AiChildCapabilityRegistryEntry>(
    AI_CHILD_REGISTRY_ENTRIES.map((entry) => [entry.childCapabilityId, entry]),
  );
}
