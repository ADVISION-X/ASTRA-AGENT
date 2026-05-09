import { Node, SyntaxKind, type Project } from "ts-morph";

import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { hasCallExpression, hasCallExpressionPath, hasPropertyAccessPath } from "../_shared/ast-helpers.js";
import { getTypeAliasPropertyNames, getZodObjectPropertyNames } from "../_shared/ast-schema-queries.js";
import { getSource } from "./audit-project.js";
import { MAP_PLUGIN_LAWS, MAP_PLUGIN_PATHS } from "./constants.js";
import { BUILTIN_PACKAGE_FILES } from "./file-lists.js";
import { inspectAuthoringPromptSources } from "./required-shape-authoring-prompts.js";
import { inspectPromptTemplateRequiredOutputSchema } from "./required-shape-prompt-template-checks.js";

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
  "gateActor",
  "activatedAt",
  "reason",
  "automationGateRef",
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
  "automationGateRef",
] as const;

const BUILTIN_INDEX_PATH = `${ROOT}/builtins/index.ts`;
const BUILTIN_PARSER_PATH = `${ROOT}/builtin-loader/builtin-map-package-parser.ts`;
const TRANSITION_EVALUATOR_PATH = "src/capabilities/orchestration/runtime/transition-evaluator.ts";

const collectMissingTypeFieldFindings = (input: {
  fieldSet: Set<string>;
  file: string;
  message: string;
  requiredFields: readonly string[];
}): Finding[] => {
  const missingFields = input.requiredFields.filter((fieldName) => !input.fieldSet.has(fieldName));
  return missingFields.length === 0
    ? []
    : [createFinding({ lawId: MAP_PLUGIN_LAWS.LIFECYCLE, file: input.file, line: 1, severity: "fatal", message: input.message, detail: missingFields.join(", ") })];
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
  return propertyNames.size === 0
    ? []
    : [createFinding({ lawId: MAP_PLUGIN_LAWS.BRANCH_DSL, file: `${ROOT}/schema/operational-map-payload.schema.ts`, line: 1, severity: "fatal", message: "Map transition condition schema must stay physically absent; AI Prompt Contract owns branch semantics and production runtime consumes AI decision output." })];
};

const inspectStepSchemaSource = (project: Project): Finding[] => {
  const schemaSource = getSource(project, `${ROOT}/schema/operational-map-step.schema.ts`);
  const propertyNames = getZodObjectPropertyNames(schemaSource, "MapPluginOperationalMapStepSchema");
  const forbiddenFields = ["successCondition", "failureBranch", "reviewBranch", "postActionVerification", "proofPolicy"].filter((fieldName) => propertyNames.has(fieldName));
  return forbiddenFields.length === 0
    ? []
    : [createFinding({ lawId: MAP_PLUGIN_LAWS.SCHEMA, file: `${ROOT}/schema/operational-map-step.schema.ts`, line: 1, severity: "fatal", message: "Map step schema must not declare constraint/policy/judgment fields.", detail: forbiddenFields.join(", ") })];
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

const inspectTransitionEvaluatorRouteBoundary = (project: Project): Finding[] => {
  const source = getSource(project, TRANSITION_EVALUATOR_PATH);
  const sourceText = source.getFullText();
  if (
    sourceText.includes("productyes")
    || sourceText.includes("productno")
    || sourceText.includes("getDecisionRouteAliases")
    || !sourceText.includes("branchFieldValues.routeLabel")
    || !sourceText.includes("transitionMatchesRouteLabel")
  ) {
    return [createFinding({
      lawId: MAP_PLUGIN_LAWS.BRANCH_DSL,
      file: TRANSITION_EVALUATOR_PATH,
      line: 1,
      severity: "fatal",
      message: "Orchestration transition evaluator must not infer routes from product_yes/product_no. It may only mechanically match AI-provided branchFieldValues.routeLabel against map route labels.",
    })];
  }
  return [];
};

export const inspectLifecycleSources = (project: Project): Finding[] => {
  return [
    ...inspectBuiltinIndexSource(project),
    ...inspectImporterSource(project),
    ...inspectActivationSource(project),
    ...inspectRollbackSource(project),
    ...inspectTransitionConditionDslSource(project),
    ...inspectStepSchemaSource(project),
    ...inspectActivationTypes(project),
    ...inspectAuthoringPromptSources(project),
    ...inspectPromptTemplateRequiredOutputSchema(project),
    ...inspectTransitionEvaluatorRouteBoundary(project),
  ];
};