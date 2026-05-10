import { z } from "zod";

const requiredChainField = z.string().min(1);

export const AiChainFieldSchemas = {
  runId: requiredChainField,
  stepId: requiredChainField,
  capabilityCallId: requiredChainField,
  nerveBusEnvelopeId: requiredChainField,
  promptCatalogVersion: requiredChainField,
} as const;

export const AiRuntimeProofChainFieldSchemas = {
  ...AiChainFieldSchemas,
  promptContractVersion: requiredChainField,
} as const;
