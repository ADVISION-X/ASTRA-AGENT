import type { AiChildCapabilityRegistryEntry } from "./contract.js";
import { FutureApiAiChildContract } from "./children/future-api-ai/contract.js";
import { FutureApiAiChildInputSchema, FutureApiAiChildResultSchema } from "./children/future-api-ai/schema.js";
import { createFutureApiAiCapability } from "./children/future-api-ai/implementation.js";
import { PaidAnalysisAiChildContract } from "./children/paid-analysis-ai/contract.js";
import { PaidAnalysisAiChildInputSchema, PaidAnalysisAiChildResultSchema } from "./children/paid-analysis-ai/schema.js";
import { createPaidAnalysisAiCapability } from "./children/paid-analysis-ai/implementation.js";
import { PaidVisionAiChildContract } from "./children/paid-vision-ai/contract.js";
import { PaidVisionAiChildInputSchema, PaidVisionAiChildResultSchema } from "./children/paid-vision-ai/schema.js";
import { createPaidVisionAiCapability } from "./children/paid-vision-ai/implementation.js";

export const DISABLED_AI_CHILD_REGISTRY_ENTRIES: readonly AiChildCapabilityRegistryEntry[] = [
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