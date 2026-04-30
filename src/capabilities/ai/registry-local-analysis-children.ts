import type { AiChildCapabilityRegistryEntry } from "./contract.js";
import { InternalSchemaValidatorChildContract } from "./children/internal-schema-validator/contract.js";
import { InternalSchemaValidatorChildInputSchema, InternalSchemaValidatorChildResultSchema } from "./children/internal-schema-validator/schema.js";
import { createInternalSchemaValidatorCapability } from "./children/internal-schema-validator/implementation.js";
import { LocalOcrAiChildContract } from "./children/local-ocr-ai/contract.js";
import { LocalOcrAiChildInputSchema, LocalOcrAiChildResultSchema } from "./children/local-ocr-ai/schema.js";
import { createLocalOcrAiCapability } from "./children/local-ocr-ai/implementation.js";

export const LOCAL_AI_ANALYSIS_CHILD_REGISTRY_ENTRIES: readonly AiChildCapabilityRegistryEntry[] = [
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
];