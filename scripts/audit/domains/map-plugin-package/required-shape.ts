import { Node, SyntaxKind, type Project } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { hasCallExpression, hasCallExpressionPath, hasPropertyAccessPath } from "../_shared/ast-helpers.js";
import { getTypeAliasPropertyNames, getZodObjectPropertyNames } from "../_shared/ast-schema-queries.js";
import { getSource } from "./audit-project.js";
import { missingFiles } from "./audit-files.js";
import { loadBuiltinPackageRecords } from "./builtin-package-records.js";
import { MAP_PLUGIN_LAWS, MAP_PLUGIN_PATHS } from "./constants.js";
import { BUILTIN_PACKAGE_FILES, REQUIRED_SOURCE_FILES } from "./file-lists.js";
import { inspectAuthoringPromptSources } from "./required-shape-authoring-prompts.js";
import { inspectCapabilityCatalogGeneratedTruth, inspectMapAuthoringCapabilityCatalogGate, inspectRegistryBootstrap } from "./required-shape-runtime.js";

const { ROOT } = MAP_PLUGIN_PATHS;

const ACTIVATION_REQUIRED_FIELDS = [
  "activationId",
  "activationSnapshotRef",
  "activationSnapshotHash",
  "mapPackageId",
  "mapPackageVersion",
  "mapVersion",
  "taskTemplateId",
  "requestedPlatformId",
  "approvedBy",
  "activatedAt",
  "reason",
  "humanApprovalRef",
  "validationReportRef",
  "capabilityCatalogVersion",
  "promptCatalogVersion",
  "validationReportRef",
  "operationalMapHash",
  "mapPackageHash",
] as const;
const ACTIVE_RECORD_REQUIRED_FIELDS = [
  "activationId",
  "activationSnapshotRef",
  "activationSnapshotHash",
  "mapPackageHash",
  "operationalMapHash",
  "capabilityCatalogVersion",
  "promptCatalogVersion",
  "validationReportRef",
  "humanApprovalRef",
  "proofPolicy",
] as const;
const BUILTIN_INDEX_PATH = `${ROOT}/builtins/index.ts`;
const BUILTIN_PARSER_PATH = `${ROOT}/builtin-loader/builtin-map-package-parser.ts`;

const collectMissingTypeFieldFindings = (input: {
  fieldSet: Set<string>;
  requiredFields: readonly string[];
  file: string;
  message: string;
}): Finding[] => {
  const missingFields = input.requiredFields.filter((fieldName) => !input.fieldSet.has(fieldName));
  return missingFields.length === 0
    ? []
    : [createFinding({ lawId: MAP_PLUGIN_LAWS.LIFECYCLE, file: input.file, line: 1, severity: "fatal", message: input.message, detail: missingFields.join(", ") })];
};

const inspectMissingRequiredFiles = async (): Promise<Finding[]> => {
  const missing = await missingFiles(REQUIRED_SOURCE_FILES);
  return missing.map((filePath) => createFinding({ lawId: MAP_PLUGIN_LAWS.SCHEMA, file: filePath, line: 1, severity: "fatal", message: "Map package required source or builtin file is missing." }));
};

const inspectBuiltinRecord = (record: Awaited<ReturnType<typeof loadBuiltinPackageRecords>>[number]): Finding[] => {
  if (record.parseError) {
    return [createFinding({ lawId: MAP_PLUGIN_LAWS.SCHEMA, file: record.file, line: 1, severity: "fatal", message: `Builtin map package must parse under the governed schema: ${record.parseError}` })];
  }

  if (!record.mapPackage) {
    return [createFinding({ lawId: MAP_PLUGIN_LAWS.SCHEMA, file: record.file, line: 1, severity: "fatal", message: "Builtin map package parsed to null unexpectedly." })];
  }

  const findings: Finding[] = [];
  if (record.mapPackage.manifest.aiGenerated) {
    if (record.mapPackage.manifest.approvalStatus !== "draft" || record.mapPackage.taskTemplate.availabilityPolicy !== "draft") {
      findings.push(createFinding({ lawId: MAP_PLUGIN_LAWS.AI_DRAFT, file: record.file, line: 1, severity: "fatal", message: "AI-generated map packages must remain draft-only until later governed approval flow exists." }));
    }
    return findings;
  }

  if (record.validationIssues.length > 0) {
    findings.push(createFinding({ lawId: MAP_PLUGIN_LAWS.SCHEMA, file: record.file, line: 1, severity: "fatal", message: `Approved builtin map package must clear validation. Found ${record.validationIssues.length} validation issues.` }));
  }
  return findings;
};

const inspectBuiltinRecords = async (): Promise<Finding[]> => {
  const builtinRecords = await loadBuiltinPackageRecords();
  const findings = builtinRecords.flatMap((record) => inspectBuiltinRecord(record));

  if (builtinRecords.length !== BUILTIN_PACKAGE_FILES.length) {
    findings.push(createFinding({ lawId: MAP_PLUGIN_LAWS.SCHEMA, file: `${ROOT}/builtins/index.ts`, line: 1, severity: "fatal", message: "Builtin loader and builtin package file set drifted." }));
  }

  return findings;
};

const inspectBuiltinIndexSource = (project: Project): Finding[] => {
  const builtinsIndexSource = getSource(project, BUILTIN_INDEX_PATH);
  const parserSource = getSource(project, BUILTIN_PARSER_PATH);
  const parseFindings = hasCallExpressionPath(parserSource, ["MapPackageSchema", "parse"])
    ? []
    : [createFinding({ lawId: MAP_PLUGIN_LAWS.SCHEMA, file: BUILTIN_PARSER_PATH, line: 1, severity: "fatal", message: "Builtin loader must parse builtin packages through MapPackageSchema.parse." })];
  return [
    ...parseFindings,
    ...inspectBuiltinLoaderFileRefs(builtinsIndexSource),
  ];
};

const collectBuiltinLoaderFileNames = (source: import("ts-morph").SourceFile): string[] => {
  const loader = source.getFunction("loadBuiltinMapPackages");
  if (!loader) {
    return [];
  }

  return loader.getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((callExpression) => callExpression.getExpression().getText() === "readBuiltin")
    .map((callExpression) => callExpression.getArguments()[0])
    .filter((argument): argument is import("ts-morph").StringLiteral => Node.isStringLiteral(argument))
    .map((argument) => argument.getLiteralText());
};

const inspectBuiltinLoaderFileRefs = (source: import("ts-morph").SourceFile): Finding[] => {
  const expected = new Set(BUILTIN_PACKAGE_FILES.map((file) => file.split("/").at(-1)!));
  const declared = new Set(collectBuiltinLoaderFileNames(source));
  const missing = [...expected].filter((file) => !declared.has(file));
  const extra = [...declared].filter((file) => !expected.has(file));
  return [
    ...(missing.length > 0
      ? [createFinding({ lawId: MAP_PLUGIN_LAWS.SCHEMA, file: BUILTIN_INDEX_PATH, line: 1, severity: "fatal", message: "Builtin loader omitted governed builtin package files.", detail: missing.join(", ") })]
      : []),
    ...(extra.length > 0
      ? [createFinding({ lawId: MAP_PLUGIN_LAWS.SCHEMA, file: BUILTIN_INDEX_PATH, line: 1, severity: "fatal", message: "Builtin loader references files outside the governed builtin package file list.", detail: extra.join(", ") })]
      : []),
  ];
};

const inspectImporterSource = (project: Project): Finding[] => {
  const importerSource = getSource(project, `${ROOT}/import/map-package-importer.ts`);
  return hasCallExpression(importerSource, "validateMapPackage") && hasPropertyAccessPath(importerSource, ["input", "registry", "versions", "set"]) && hasPropertyAccessPath(importerSource, ["input", "registry", "quarantined", "set"])
    ? []
    : [createFinding({ lawId: MAP_PLUGIN_LAWS.LIFECYCLE, file: `${ROOT}/import/map-package-importer.ts`, line: 1, severity: "fatal", message: "Map package import must validate first, store the package version, and enter quarantine." })];
};

const inspectActivationSource = (project: Project): Finding[] => {
  const activationSource = getSource(project, `${ROOT}/import/map-package-activation.ts`);
  return hasPropertyAccessPath(activationSource, ["input", "registry", "activations", "write"]) && hasPropertyAccessPath(activationSource, ["input", "registry", "active", "activate"]) && hasPropertyAccessPath(activationSource, ["input", "registry", "quarantined", "delete"])
    ? []
    : [createFinding({ lawId: MAP_PLUGIN_LAWS.LIFECYCLE, file: `${ROOT}/import/map-package-activation.ts`, line: 1, severity: "fatal", message: "Map package activation must create an activation record, enter the active registry, and leave quarantine." })];
};

const inspectRollbackSource = (project: Project): Finding[] => {
  const rollbackSource = getSource(project, `${ROOT}/import/map-package-rollback.ts`);
  return hasPropertyAccessPath(rollbackSource, ["input", "registry", "active", "deactivate"]) && hasPropertyAccessPath(rollbackSource, ["input", "registry", "rollbacks", "write"])
    ? []
    : [createFinding({ lawId: MAP_PLUGIN_LAWS.LIFECYCLE, file: `${ROOT}/import/map-package-rollback.ts`, line: 1, severity: "fatal", message: "Map package rollback must deactivate the active map and persist a rollback record." })];
};

const inspectTransitionConditionDslSource = (project: Project): Finding[] => {
  const schemaSource = getSource(project, `${ROOT}/schema/operational-map-payload.schema.ts`);
  const propertyNames = getZodObjectPropertyNames(schemaSource, "MapPluginTransitionConditionSchema");
  const requiredFields = ["conditionType", "leftRef", "operator", "rightValue", "onTrue", "onFalse"] as const;
  const missingFields = requiredFields.filter((fieldName) => !propertyNames.has(fieldName));
  const forbiddenFields = ["source", "equals"].filter((fieldName) => propertyNames.has(fieldName));
  const findings: Finding[] = [];
  if (missingFields.length > 0) {
    findings.push(createFinding({ lawId: MAP_PLUGIN_LAWS.BRANCH_DSL, file: `${ROOT}/schema/operational-map-payload.schema.ts`, line: 1, severity: "fatal", message: "Map transition condition schema must use governed branch DSL fields.", detail: missingFields.join(", ") }));
  }
  if (forbiddenFields.length > 0) {
    findings.push(createFinding({ lawId: MAP_PLUGIN_LAWS.BRANCH_DSL, file: `${ROOT}/schema/operational-map-payload.schema.ts`, line: 1, severity: "fatal", message: "Legacy source/equals branch DSL must not remain active truth.", detail: forbiddenFields.join(", ") }));
  }
  return findings;
};

const inspectStepSchemaSource = (project: Project): Finding[] => {
  const schemaSource = getSource(project, `${ROOT}/schema/operational-map-step.schema.ts`);
  const propertyNames = getZodObjectPropertyNames(schemaSource, "MapPluginOperationalMapStepSchema");
  return propertyNames.has("postActionVerification")
    ? []
    : [createFinding({ lawId: MAP_PLUGIN_LAWS.SCHEMA, file: `${ROOT}/schema/operational-map-step.schema.ts`, line: 1, severity: "fatal", message: "Map step schema must declare postActionVerification as schema-level action policy." })];
};

const inspectActivationTypes = (project: Project): Finding[] => {
  const activationProofSource = getSource(project, `${ROOT}/shared/map-package-proof.ts`);
  const activationRecordFields = getTypeAliasPropertyNames(activationProofSource, "MapActivationRecord");
  const activeRecordSource = getSource(project, `${ROOT}/shared/map-package-registry-types.ts`);
  const activeRecordFields = getTypeAliasPropertyNames(activeRecordSource, "ActiveOperationalMapRecord");
  return [
    ...collectMissingTypeFieldFindings({
      fieldSet: activationRecordFields,
      requiredFields: ACTIVATION_REQUIRED_FIELDS,
      file: `${ROOT}/shared/map-package-proof.ts`,
      message: "Activation record must capture immutable frozen snapshot proof fields.",
    }),
    ...collectMissingTypeFieldFindings({
      fieldSet: activeRecordFields,
      requiredFields: ACTIVE_RECORD_REQUIRED_FIELDS,
      file: `${ROOT}/shared/map-package-registry-types.ts`,
      message: "Active operational map record must expose frozen activation metadata and governance fields.",
    }),
  ];
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
    ...inspectAuthoringPromptSources(project),
  ];
};

export async function runRequiredShape(project: Project): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const findings = [
    ...(await inspectMissingRequiredFiles()),
    ...(await inspectBuiltinRecords()),
    ...(await inspectCapabilityCatalogGeneratedTruth()),
    ...inspectMapAuthoringCapabilityCatalogGate(),
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
