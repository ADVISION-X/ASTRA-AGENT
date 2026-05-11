import path from "node:path";

import { FILE_LIMITS } from "./purity-thresholds.js";

type PurityFileCategory = {
  kind: keyof typeof FILE_LIMITS;
  label: string;
  hardLimit: number;
};

const SCHEMA_TYPE_CATEGORY: PurityFileCategory = { kind: "schemaType", label: "schema/type", hardLimit: FILE_LIMITS.schemaType };
const APP_HANDLER_CATEGORY: PurityFileCategory = { kind: "appHandler", label: "app/api handler", hardLimit: FILE_LIMITS.appHandler };
const AUDIT_INSPECTOR_CATEGORY: PurityFileCategory = { kind: "auditInspector", label: "audit inspector", hardLimit: FILE_LIMITS.auditInspector };
const AUDIT_PHASE_CATEGORY: PurityFileCategory = { kind: "auditPhase", label: "audit phase", hardLimit: FILE_LIMITS.auditPhase };
const JSON_CONTRACT_CATEGORY: PurityFileCategory = { kind: "jsonContract", label: "json map/prompt contract", hardLimit: FILE_LIMITS.jsonContract };
const GENERATED_ARTIFACT_CATEGORY: PurityFileCategory = { kind: "generatedArtifact", label: "generated artifact", hardLimit: FILE_LIMITS.generatedArtifact };
const ORCHESTRATION_COORDINATOR_CATEGORY: PurityFileCategory = {
  kind: "orchestrationCoordinator",
  label: "orchestration coordinator",
  hardLimit: FILE_LIMITS.orchestrationCoordinator,
};
const RUNTIME_CATEGORY: PurityFileCategory = { kind: "runtime", label: "runtime/implementation", hardLimit: FILE_LIMITS.runtime };
const ORDINARY_CATEGORY: PurityFileCategory = { kind: "ordinary", label: "ordinary implementation", hardLimit: FILE_LIMITS.ordinary };

const isSchemaTypeFile = (relativePath: string): boolean =>
  relativePath.startsWith("src/types/") || relativePath.endsWith("schema.ts") || relativePath.endsWith("schema.tsx");

const isJsonLikeFile = (relativePath: string): boolean => relativePath.endsWith(".json") || relativePath.endsWith(".jsonc");

const isGeneratedArtifactFile = (relativePath: string): boolean =>
  relativePath.startsWith("scripts/audit/generated/") || relativePath.endsWith(".generated.json") || relativePath.endsWith(".generated.jsonc");

export const isGovernedMapPackageArtifact = (relativePath: string): boolean =>
  relativePath.startsWith("src/map-plugins/")
  && relativePath.endsWith(".meta.map-package.json");

const isJsonContractFile = (relativePath: string): boolean =>
  isJsonLikeFile(relativePath)
  && !isGeneratedArtifactFile(relativePath)
  && (relativePath.startsWith("src/map-plugins/") || relativePath.includes("/prompt-contracts/"));

const isAuditInspectorFile = (relativePath: string): boolean =>
  relativePath.startsWith("scripts/audit/domains/") && path.basename(relativePath) === "inspector.ts";

const isOrchestrationCoordinatorFile = (relativePath: string): boolean =>
  relativePath.includes("orchestration") && (relativePath.includes("executor") || relativePath.includes("runtime"));

const isRuntimeFile = (relativePath: string): boolean =>
  relativePath.includes("/runtime/") || relativePath.includes("executor") || relativePath.includes("adapter") || relativePath.includes("controller");

const CATEGORY_MATCHERS: Array<{ matches: (relativePath: string) => boolean; category: PurityFileCategory }> = [
  { matches: isSchemaTypeFile, category: SCHEMA_TYPE_CATEGORY },
  { matches: isGeneratedArtifactFile, category: GENERATED_ARTIFACT_CATEGORY },
  { matches: isJsonContractFile, category: JSON_CONTRACT_CATEGORY },
  { matches: (relativePath) => relativePath.startsWith("src/app/"), category: APP_HANDLER_CATEGORY },
  { matches: isAuditInspectorFile, category: AUDIT_INSPECTOR_CATEGORY },
  { matches: (relativePath) => relativePath.startsWith("scripts/audit/"), category: AUDIT_PHASE_CATEGORY },
  { matches: isOrchestrationCoordinatorFile, category: ORCHESTRATION_COORDINATOR_CATEGORY },
  { matches: isRuntimeFile, category: RUNTIME_CATEGORY },
];

export const classifyPurityFileCategory = (relativePath: string): PurityFileCategory =>
  CATEGORY_MATCHERS.find((matcher) => matcher.matches(relativePath))?.category ?? ORDINARY_CATEGORY;
