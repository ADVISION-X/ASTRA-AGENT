import type { AiChildCapabilityRegistryEntry } from "./contract.js";
import { LocalTextAiChildContract } from "./children/local-text-ai/contract.js";
import { LocalTextAiChildInputSchema, LocalTextAiChildResultSchema } from "./children/local-text-ai/schema.js";
import { createLocalTextAiCapability } from "./children/local-text-ai/implementation.js";
import { LocalVisionAiChildContract } from "./children/local-vision-ai/contract.js";
import { LocalVisionAiChildInputSchema, LocalVisionAiChildResultSchema } from "./children/local-vision-ai/schema.js";
import { createLocalVisionAiCapability } from "./children/local-vision-ai/implementation.js";

export const LOCAL_AI_RUNTIME_CHILD_REGISTRY_ENTRIES: readonly AiChildCapabilityRegistryEntry[] = [
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
];