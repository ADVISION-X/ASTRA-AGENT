import type { Project } from "ts-morph";

import { loadBuiltinMapPackages } from "../../../../src/map-plugins/builtins/index.js";
import { createMapPluginRegistry } from "../../../../src/map-plugins/registry/map-plugin-registry.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { hasCallExpression, hasCallExpressionPath, hasPropertyAccessPath } from "../_shared/ast-helpers.js";
import { getSource } from "./audit-project.js";
import { missingFiles } from "./audit-files.js";
import { loadBuiltinPackageRecords } from "./builtin-package-records.js";
import { ROOT } from "./constants.js";
import { BUILTIN_PACKAGE_FILES, REQUIRED_SOURCE_FILES } from "./file-lists.js";

const inspectMissingRequiredFiles = async (): Promise<Finding[]> => {
  const missing = await missingFiles(REQUIRED_SOURCE_FILES);
  return missing.map((filePath) => createFinding({ lawId: "GRASSEYE-MAP-PLUGIN-003-V1", file: filePath, line: 1, severity: "fatal", message: "Map package required source or builtin file is missing." }));
};

const inspectBuiltinRecord = (record: Awaited<ReturnType<typeof loadBuiltinPackageRecords>>[number]): Finding[] => {
  if (record.parseError) {
    return [createFinding({ lawId: "GRASSEYE-MAP-PLUGIN-003-V1", file: record.file, line: 1, severity: "fatal", message: `Builtin map package must parse under the governed schema: ${record.parseError}` })];
  }

  if (!record.mapPackage) {
    return [createFinding({ lawId: "GRASSEYE-MAP-PLUGIN-003-V1", file: record.file, line: 1, severity: "fatal", message: "Builtin map package parsed to null unexpectedly." })];
  }

  if (record.mapPackage.manifest.aiGenerated) {
    return record.mapPackage.manifest.approvalStatus === "draft" && record.mapPackage.taskTemplate.availabilityPolicy === "draft"
      ? []
      : [createFinding({ lawId: "GRASSEYE-MAP-PLUGIN-006-V1", file: record.file, line: 1, severity: "fatal", message: "AI-generated map packages must remain draft-only until later governed approval flow exists." })];
  }

  return record.validationIssues.length === 0
    ? []
    : [createFinding({ lawId: "GRASSEYE-MAP-PLUGIN-003-V1", file: record.file, line: 1, severity: "fatal", message: `Approved builtin map package must clear validation. Found ${record.validationIssues.length} validation issues.` })];
};

const inspectBuiltinRecords = async (): Promise<Finding[]> => {
  const builtinRecords = await loadBuiltinPackageRecords();
  const findings = builtinRecords.flatMap((record) => inspectBuiltinRecord(record));

  if (builtinRecords.length !== BUILTIN_PACKAGE_FILES.length) {
    findings.push(createFinding({ lawId: "GRASSEYE-MAP-PLUGIN-003-V1", file: `${ROOT}/builtins/index.ts`, line: 1, severity: "fatal", message: "Builtin loader and builtin package file set drifted." }));
  }

  return findings;
};

const inspectBuiltinIndexSource = (project: Project): Finding[] => {
  const builtinsIndexSource = getSource(project, `${ROOT}/builtins/index.ts`);
  return hasCallExpressionPath(builtinsIndexSource, ["MapPackageSchema", "parse"])
    ? []
    : [createFinding({ lawId: "GRASSEYE-MAP-PLUGIN-003-V1", file: `${ROOT}/builtins/index.ts`, line: 1, severity: "fatal", message: "Builtin loader must parse builtin packages through MapPackageSchema.parse." })];
};

const inspectImporterSource = (project: Project): Finding[] => {
  const importerSource = getSource(project, `${ROOT}/import/map-package-importer.ts`);
  return hasCallExpression(importerSource, "validateMapPackage") && hasPropertyAccessPath(importerSource, ["input", "registry", "versions", "set"]) && hasPropertyAccessPath(importerSource, ["input", "registry", "quarantined", "set"])
    ? []
    : [createFinding({ lawId: "GRASSEYE-MAP-PLUGIN-002-V1", file: `${ROOT}/import/map-package-importer.ts`, line: 1, severity: "fatal", message: "Map package import must validate first, store the package version, and enter quarantine." })];
};

const inspectActivationSource = (project: Project): Finding[] => {
  const activationSource = getSource(project, `${ROOT}/import/map-package-activation.ts`);
  return hasPropertyAccessPath(activationSource, ["input", "registry", "activations", "write"]) && hasPropertyAccessPath(activationSource, ["input", "registry", "active", "activate"]) && hasPropertyAccessPath(activationSource, ["input", "registry", "quarantined", "delete"])
    ? []
    : [createFinding({ lawId: "GRASSEYE-MAP-PLUGIN-002-V1", file: `${ROOT}/import/map-package-activation.ts`, line: 1, severity: "fatal", message: "Map package activation must create an activation record, enter the active registry, and leave quarantine." })];
};

const inspectRollbackSource = (project: Project): Finding[] => {
  const rollbackSource = getSource(project, `${ROOT}/import/map-package-rollback.ts`);
  return hasPropertyAccessPath(rollbackSource, ["input", "registry", "active", "deactivate"]) && hasPropertyAccessPath(rollbackSource, ["input", "registry", "rollbacks", "write"])
    ? []
    : [createFinding({ lawId: "GRASSEYE-MAP-PLUGIN-002-V1", file: `${ROOT}/import/map-package-rollback.ts`, line: 1, severity: "fatal", message: "Map package rollback must deactivate the active map and persist a rollback record." })];
};

const inspectLifecycleSources = (project: Project): Finding[] => {
  return [
    ...inspectBuiltinIndexSource(project),
    ...inspectImporterSource(project),
    ...inspectActivationSource(project),
    ...inspectRollbackSource(project),
  ];
};

const collectRegistryBootstrapFindings = (registry: ReturnType<typeof createMapPluginRegistry>): Finding[] => {
  const findings: Finding[] = [];
  const activePackages = registry.active.listActivePackages();
  const ordinaryTemplates = registry.active.listOrdinaryTaskTemplates();

  if (activePackages.length < 2) {
    findings.push(createFinding({ lawId: "GRASSEYE-MAP-PLUGIN-002-V1", file: `${ROOT}/registry/map-plugin-registry.ts`, line: 1, severity: "fatal", message: "Approved builtin map packages must bootstrap into the active registry." }));
  }
  if (ordinaryTemplates.some((item) => item.taskTemplateId === "ai-generated-map-placeholder")) {
    findings.push(createFinding({ lawId: "GRASSEYE-MAP-PLUGIN-006-V1", file: `${ROOT}/registry/active-map-registry.ts`, line: 1, severity: "fatal", message: "AI draft placeholder must never appear in the approved active task-template feed." }));
  }
  if (ordinaryTemplates.some((item) => "mapId" in (item as object) || "requestedPlatformId" in (item as object))) {
    findings.push(createFinding({ lawId: "GRASSEYE-MAP-PLUGIN-005-V1", file: `${ROOT}/registry/active-map-registry.ts`, line: 1, severity: "fatal", message: "Ordinary task-template feed must not expose internal map binding fields." }));
  }
  if (activePackages.some((mapPackage) => mapPackage.manifest.aiGenerated)) {
    findings.push(createFinding({ lawId: "GRASSEYE-MAP-PLUGIN-006-V1", file: `${ROOT}/registry/active-map-registry.ts`, line: 1, severity: "fatal", message: "AI-generated map packages must not enter the active registry." }));
  }
  if (!registry.active.getTaskTemplateDeveloperBinding("tiktok-product-discovery")) {
    findings.push(createFinding({ lawId: "GRASSEYE-MAP-PLUGIN-002-V1", file: `${ROOT}/registry/active-map-registry.ts`, line: 1, severity: "fatal", message: "Active registry must resolve a developer binding for an approved task template." }));
  }

  return findings;
};

const bootstrapRegistry = (): ReturnType<typeof createMapPluginRegistry> => {
  const registry = createMapPluginRegistry();
  for (const builtinPackage of loadBuiltinMapPackages()) {
    registry.importPackage(builtinPackage, "audit-required-shape");
    if (builtinPackage.manifest.approvalStatus === "approved" && builtinPackage.taskTemplate.availabilityPolicy === "active") {
      registry.activatePackage(builtinPackage.manifest.packageId, builtinPackage.manifest.packageVersion, "audit-required-shape", "audit bootstrap");
    }
  }

  return registry;
};

const inspectRegistryBootstrap = (): Finding[] => {
  try {
    return collectRegistryBootstrapFindings(bootstrapRegistry());
  } catch (error) {
    return [createFinding({ lawId: "GRASSEYE-MAP-PLUGIN-003-V1", file: `${ROOT}/registry/map-plugin-registry.ts`, line: 1, severity: "fatal", message: error instanceof Error ? error.message : "Map registry bootstrap failed during audit." })];
  }
};

export async function runRequiredShape(project: Project): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const findings = [
    ...(await inspectMissingRequiredFiles()),
    ...(await inspectBuiltinRecords()),
    ...inspectLifecycleSources(project),
    ...inspectRegistryBootstrap(),
  ];

  const passed = findings.length === 0;
  return {
    findings,
    phase: createPhase(
      "required-shape",
      passed ? "PASS" : "CODE VIOLATION",
      passed,
      passed
        ? "Map package schema, quarantine lifecycle, builtin payloads, and registry bootstrap are present."
        : "Map package schema, builtin payload, or lifecycle enforcement shape is incomplete.",
    ),
  };
}
