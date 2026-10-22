import { z } from "zod";

import dependencyArtifact from "../../../../docs/specs/agent-production-runtime/xuanxue-ai-production-v6.dependency.spec.json" with { type: "json" };

const ProductionControlDependencySchema = z.object({
  schemaVersion: z.literal(1),
  status: z.literal("active"),
  specKind: z.literal("cross-repo-dependency"),
  version: z.number().int().positive(),
  contract: z.object({
    contractId: z.literal("ai-acceptance.xuanxue-ai-production-v6"),
    providerRepo: z.literal("ADVISION-X/xuanxue-web"),
    version: z.number().int().positive(),
  }).strict(),
}).passthrough().superRefine((dependency, context) => {
  if (dependency.version !== dependency.contract.version) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "AI_PRODUCTION_DEPENDENCY_VERSION_MISMATCH" });
  }
});

export const parseProductionControlDependency = (value: unknown) =>
  ProductionControlDependencySchema.parse(value);

export const productionControlContractVersion =
  parseProductionControlDependency(dependencyArtifact).contract.version;

export const PRODUCTION_BUSINESS_CAPACITY_MAX = 6 as const;
