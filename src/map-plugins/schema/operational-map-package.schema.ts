import { z } from "zod";

import { MapPluginOperationalMapSchema } from "./operational-map-core.schema.js";

export const OperationalMapProofPolicySchema = z.object({
  runtimeProof: z.literal("required"),
  recordPackageSelection: z.literal(true)
}).strict();

export const OperationalMapPackageSchema = z.object({
  mapVersion: z.string().min(1),
  proofPolicy: OperationalMapProofPolicySchema
}).passthrough().superRefine((value, context) => {
  const { mapVersion: _mapVersion, proofPolicy: _proofPolicy, ...operationalMap } = value;
  const parsed = MapPluginOperationalMapSchema.safeParse(operationalMap);
  if (parsed.success) {
    return;
  }

  for (const issue of parsed.error.issues) {
    context.addIssue(issue);
  }
}).transform((value) => {
  const { mapVersion, proofPolicy, ...operationalMap } = value;
  return {
    ...MapPluginOperationalMapSchema.parse(operationalMap),
    mapVersion,
    proofPolicy
  };
});
