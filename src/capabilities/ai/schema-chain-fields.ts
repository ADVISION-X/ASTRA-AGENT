import { z } from "zod";

const requiredChainField = z.string().min(1);

export const AiChainFieldSchemas = {
  runId: requiredChainField,
  stepId: requiredChainField,
  capabilityCallId: requiredChainField,
  nerveBusEnvelopeId: requiredChainField,
  mapPackageId: requiredChainField,
  mapPackageVersion: requiredChainField,
  selectedMapId: requiredChainField,
  selectedMapVersion: requiredChainField,
  activationSnapshotRef: requiredChainField,
  promptCatalogVersion: requiredChainField,
} as const;

export const AiRuntimeProofChainFieldSchemas = {
  ...AiChainFieldSchemas,
  promptContractVersion: requiredChainField,
} as const;
