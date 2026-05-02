import type { Project } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { hasCallExpression, hasCallExpressionPath, hasPropertyAccessPath } from "../_shared/ast-helpers.js";
import { getTypeAliasPropertyNames, getZodObjectPropertyNames } from "../_shared/ast-schema-queries.js";
import { getSource } from "./audit-project.js";
import { missingFiles } from "./audit-files.js";
import { loadBuiltinPackageRecords } from "./builtin-package-records.js";
import { ROOT } from "./constants.js";
import { BUILTIN_PACKAGE_FILES, REQUIRED_SOURCE_FILES } from "./file-lists.js";
import { inspectCapabilityCatalogGeneratedTruth, inspectRegistryBootstrap } from "./required-shape-runtime.js";

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

const inspectTransitionConditionDslSource = (project: Project): Finding[] => {
  const schemaSource = getSource(project, `${ROOT}/schema/operational-map-payload.schema.ts`);
  const propertyNames = getZodObjectPropertyNames(schemaSource, "MapPluginTransitionConditionSchema");
  const requiredFields = ["conditionType", "leftRef", "operator", "rightValue", "onTrue", "onFalse"] as const;
  const missingFields = requiredFields.filter((fieldName) => !propertyNames.has(fieldName));
  const forbiddenFields = ["source", "equals"].filter((fieldName) => propertyNames.has(fieldName));
  const findings: Finding[] = [];
  if (missingFields.length > 0) {
    findings.push(createFinding({ lawId: "GRASSEYE-MAP-PLUGIN-001-V1", file: `${ROOT}/schema/operational-map-payload.schema.ts`, line: 1, severity: "fatal", message: "Map transition condition schema must use governed branch DSL fields.", detail: missingFields.join(", ") }));
  }
  if (forbiddenFields.length > 0) {
    findings.push(createFinding({ lawId: "GRASSEYE-MAP-PLUGIN-001-V1", file: `${ROOT}/schema/operational-map-payload.schema.ts`, line: 1, severity: "fatal", message: "Legacy source/equals branch DSL must not remain active truth.", detail: forbiddenFields.join(", ") }));
  }
  return findings;
};

const inspectStepSchemaSource = (project: Project): Finding[] => {
  const schemaSource = getSource(project, `${ROOT}/schema/operational-map-step.schema.ts`);
  const propertyNames = getZodObjectPropertyNames(schemaSource, "MapPluginOperationalMapStepSchema");
  return propertyNames.has("postActionVerification")
    ? []
    : [createFinding({ lawId: "GRASSEYE-MAP-PLUGIN-003-V1", file: `${ROOT}/schema/operational-map-step.schema.ts`, line: 1, severity: "fatal", message: "Map step schema must declare postActionVerification as schema-level action policy." })];
};

const inspectActivationTypes = (project: Project): Finding[] => {
  const activationProofSource = getSource(project, `${ROOT}/shared/map-package-proof.ts`);
  const activationRecordFields = getTypeAliasPropertyNames(activationProofSource, "MapActivationRecord");
  const activeRecordSource = getSource(project, `${ROOT}/shared/map-package-registry-types.ts`);
  const activeRecordFields = getTypeAliasPropertyNames(activeRecordSource, "ActiveOperationalMapRecord");
  const activationRequiredFields = [
    "activationSnapshotRef",
    "activationSnapshotHash",
    "mapPackageId",
    "mapPackageVersion",
    "mapVersion",
    "taskTemplateId",
    "requestedPlatformId",
    "validationReportRef",
    "operationalMapHash",
    "mapPackageHash",
  ] as const;
  const activeRequiredFields = [
    "activationSnapshotRef",
    "activationSnapshotHash",
    "mapPackageHash",
    "operationalMapHash",
    "capabilityCatalogVersion",
    "promptCatalogVersion",
    "proofPolicy",
  ] as const;

  const findings: Finding[] = [];
  const missingActivationFields = activationRequiredFields.filter((fieldName) => !activationRecordFields.has(fieldName));
  if (missingActivationFields.length > 0) {
    findings.push(createFinding({ lawId: "GRASSEYE-MAP-PLUGIN-002-V1", file: `${ROOT}/shared/map-package-proof.ts`, line: 1, severity: "fatal", message: "Activation record must capture immutable frozen snapshot proof fields.", detail: missingActivationFields.join(", ") }));
  }

  const missingActiveFields = activeRequiredFields.filter((fieldName) => !activeRecordFields.has(fieldName));
  if (missingActiveFields.length > 0) {
    findings.push(createFinding({ lawId: "GRASSEYE-MAP-PLUGIN-002-V1", file: `${ROOT}/shared/map-package-registry-types.ts`, line: 1, severity: "fatal", message: "Active operational map record must expose frozen activation metadata and governance fields.", detail: missingActiveFields.join(", ") }));
  }

  return findings;
};

const inspectLifecycleSources = (project: Project): Finding[] => {
  return [
    ...inspectBuiltinIndexSource(project),
    ...inspectImporterSource(project),
    ...inspectActivationSource(project),
    ...inspectRollbackSource(project),
    ...inspectTransitionConditionDslSource(project),
    ...inspectStepSchemaSource(project),
    ...inspectActivationTypes(project),
  ];
};

export async function runRequiredShape(project: Project): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const findings = [
    ...(await inspectMissingRequiredFiles()),
    ...(await inspectBuiltinRecords()),
    ...(await inspectCapabilityCatalogGeneratedTruth()),
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
        : "Map package schema, builtin payload, branch DSL, or lifecycle enforcement shape is incomplete.",
    ),
  };
}
