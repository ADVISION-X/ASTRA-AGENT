import { Node, SyntaxKind, type Project } from "ts-morph";

import { buildCapabilityCatalog } from "../../../../src/map-plugins/authoring/capability-catalog/index.js";

import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { hasCallExpression, hasCallExpressionPath, hasPropertyAccessPath } from "../_shared/ast-helpers.js";
import { getTypeAliasPropertyNames, getZodObjectPropertyNames } from "../_shared/ast-schema-queries.js";
import { getSource } from "./audit-project.js";
import { missingFiles } from "./audit-files.js";
import { loadBuiltinPackageRecords } from "./builtin-package-records.js";
import { MAP_PLUGIN_LAWS, MAP_PLUGIN_PATHS } from "./constants.js";
import { BUILTIN_PACKAGE_FILES, REQUIRED_SOURCE_FILES } from "./file-lists.js";
import { inspectCapabilityCatalogGeneratedTruth, inspectMapAuthoringCapabilityCatalogGate, inspectRegistryBootstrap } from "./required-shape-runtime.js";

const { ROOT } = MAP_PLUGIN_PATHS;

const AI_DRAFT_PLACEHOLDER_PATH = `${ROOT}/builtins/ai-draft-map-placeholder.map-package.json`;
const AUTHORING_TEMPLATE_PATH = `${ROOT}/authoring/map-authoring-template.ts`;
const AUTHORING_GOVERNED_CATALOGS_PATH = `${ROOT}/authoring/map-authoring-governed-catalogs.ts`;
const AUTHORING_PROMPT_BUILDER_PATH = `${ROOT}/authoring/map-authoring-prompt-builder.ts`;
const AUTHORING_DRAFT_CHAIN_PATH = `${ROOT}/authoring/map-authoring-draft-chain.ts`;
const EXTERNAL_PROVIDER_RUNTIME_MESSAGES_PATH = "src/capabilities/ai/runtime-adapters/external-provider-runtime-messages.ts";
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

const KNOWN_CAPABILITY_ROUTE_LITERALS = Array.from(
  new Set(
    buildCapabilityCatalog().entries.map((entry) => `${entry.abilityGroupId}/${entry.childCapabilityId}`),
  ),
);

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

const inspectAiDraftPlaceholderRecord = (record: Awaited<ReturnType<typeof loadBuiltinPackageRecords>>[number]): Finding[] => {
  if (!record.mapPackage || record.file !== AI_DRAFT_PLACEHOLDER_PATH) {
    return [];
  }

  const findings: Finding[] = [];
  if (!record.mapPackage.manifest.aiGenerated) {
    findings.push(createFinding({ lawId: MAP_PLUGIN_LAWS.AI_DRAFT, file: record.file, line: 1, severity: "fatal", message: "AI draft placeholder must keep manifest.aiGenerated=true." }));
  }
  if (record.mapPackage.manifest.approvalStatus !== "draft") {
    findings.push(createFinding({ lawId: MAP_PLUGIN_LAWS.AI_DRAFT, file: record.file, line: 1, severity: "fatal", message: "AI draft placeholder must keep approvalStatus=draft." }));
  }
  if (record.mapPackage.taskTemplate.availabilityPolicy !== "draft") {
    findings.push(createFinding({ lawId: MAP_PLUGIN_LAWS.AI_DRAFT, file: record.file, line: 1, severity: "fatal", message: "AI draft placeholder must keep availabilityPolicy=draft." }));
  }
  if (record.mapPackage.manifest.authoringPromptRef === null || record.mapPackage.manifest.authoringModelRef === null) {
    findings.push(createFinding({ lawId: MAP_PLUGIN_LAWS.AI_DRAFT, file: record.file, line: 1, severity: "fatal", message: "AI draft placeholder must preserve authoringPromptRef and authoringModelRef." }));
  }

  return findings;
};

const inspectBuiltinRecord = (record: Awaited<ReturnType<typeof loadBuiltinPackageRecords>>[number]): Finding[] => {
  if (record.parseError) {
    return [createFinding({ lawId: MAP_PLUGIN_LAWS.SCHEMA, file: record.file, line: 1, severity: "fatal", message: `Builtin map package must parse under the governed schema: ${record.parseError}` })];
  }

  if (!record.mapPackage) {
    return [createFinding({ lawId: MAP_PLUGIN_LAWS.SCHEMA, file: record.file, line: 1, severity: "fatal", message: "Builtin map package parsed to null unexpectedly." })];
  }

  const findings = inspectAiDraftPlaceholderRecord(record);
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
  const builtinsIndexSource = getSource(project, `${ROOT}/builtins/index.ts`);
  return hasCallExpressionPath(builtinsIndexSource, ["MapPackageSchema", "parse"])
    ? []
    : [createFinding({ lawId: MAP_PLUGIN_LAWS.SCHEMA, file: `${ROOT}/builtins/index.ts`, line: 1, severity: "fatal", message: "Builtin loader must parse builtin packages through MapPackageSchema.parse." })];
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

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const hasQuotedLiteral = (sourceText: string, literal: string): boolean => {
  const escapedLiteral = escapeRegExp(literal);
  return new RegExp(`["'\`][^"'\`]*${escapedLiteral}[^"'\`]*["'\`]`).test(sourceText);
};

const inspectAuthoringTemplateSingleTruth = (project: Project): Finding[] => {
  const templateSource = getSource(project, AUTHORING_TEMPLATE_PATH);
  const sourceText = templateSource.getFullText();
  const findings: Finding[] = [];

  if (hasCallExpression(templateSource, "buildCapabilityCatalog") || hasCallExpression(templateSource, "listPromptContractCatalogEntries")) {
    findings.push(createFinding({ lawId: MAP_PLUGIN_LAWS.AUTHORING_INPUT_PACKAGE, file: AUTHORING_TEMPLATE_PATH, line: 1, severity: "fatal", message: "Map authoring prompt template must consume governed catalog input and must not assemble catalog truth internally." }));
  }

  const hardcodedCapabilityLiteral = KNOWN_CAPABILITY_ROUTE_LITERALS.find((literal) => hasQuotedLiteral(sourceText, literal));
  if (hardcodedCapabilityLiteral) {
    findings.push(createFinding({ lawId: MAP_PLUGIN_LAWS.CAPABILITY_CATALOG_DETAIL, file: AUTHORING_TEMPLATE_PATH, line: 1, severity: "fatal", message: `Map authoring prompt template must not hardcode catalog literal ${hardcodedCapabilityLiteral}.` }));
  }

  const templateDeclaration = templateSource.getVariableDeclaration("buildMapAuthoringTemplate");
  const templateInitializer = templateDeclaration?.getInitializer();
  const joinCall = templateInitializer && Node.isArrowFunction(templateInitializer)
    ? templateInitializer.getDescendantsOfKind(SyntaxKind.ReturnStatement)[0]?.getExpression()
    : undefined;
  const templateArray = joinCall
    && Node.isCallExpression(joinCall)
    && Node.isPropertyAccessExpression(joinCall.getExpression())
    && joinCall.getExpression().getName() === "join"
    && Node.isArrayLiteralExpression(joinCall.getExpression().getExpression())
      ? joinCall.getExpression().getExpression()
      : undefined;

  if (!templateArray) {
    findings.push(createFinding({ lawId: MAP_PLUGIN_LAWS.AUTHORING_INPUT_PACKAGE, file: AUTHORING_TEMPLATE_PATH, line: 1, severity: "fatal", message: "Map authoring prompt template must keep its top-level section assembly parseable for governed catalog enforcement." }));
    return findings;
  }

  const elements = templateArray.getElements();
  const allowedCapabilitiesIndex = elements.findIndex((element) => Node.isStringLiteral(element) && element.getLiteralValue() === "Allowed Capabilities:");
  const allowedPromptContractsIndex = elements.findIndex((element) => Node.isStringLiteral(element) && element.getLiteralValue() === "Allowed Prompt Contracts:");
  const capabilitySectionElements = allowedCapabilitiesIndex >= 0 && allowedPromptContractsIndex > allowedCapabilitiesIndex
    ? elements.slice(allowedCapabilitiesIndex + 1, allowedPromptContractsIndex)
    : [];
  const capabilitySectionIsGoverned = capabilitySectionElements.length === 1
    && Node.isCallExpression(capabilitySectionElements[0])
    && capabilitySectionElements[0].getExpression().getText() === "formatCapabilitySection";

  if (!capabilitySectionIsGoverned) {
    findings.push(createFinding({ lawId: MAP_PLUGIN_LAWS.CAPABILITY_CATALOG_DETAIL, file: AUTHORING_TEMPLATE_PATH, line: 1, severity: "fatal", message: "Map authoring prompt template must keep the Allowed Capabilities section sourced only from formatCapabilitySection(inputPackage)." }));
  }

  return findings;
};

const inspectAuthoringCatalogGateSource = (project: Project): Finding[] => {
  const governedCatalogSource = getSource(project, AUTHORING_GOVERNED_CATALOGS_PATH);
  const sourceText = governedCatalogSource.getFullText();
  return hasCallExpression(governedCatalogSource, "buildCapabilityCatalog")
    && hasCallExpression(governedCatalogSource, "readFileSync")
    && sourceText.includes("BLOCKED_CAPABILITY_CATALOG_STALE")
    ? []
    : [createFinding({ lawId: MAP_PLUGIN_LAWS.AUTHORING_INPUT_PACKAGE, file: AUTHORING_GOVERNED_CATALOGS_PATH, line: 1, severity: "fatal", message: "Map authoring must gate governed capability catalog freshness and block stale catalog truth." })];
};

const inspectAuthoringCatalogConsumers = (project: Project): Finding[] => {
  const findings: Finding[] = [];
  const catalogConsumerFiles = [
    AUTHORING_PROMPT_BUILDER_PATH,
    AUTHORING_DRAFT_CHAIN_PATH,
    EXTERNAL_PROVIDER_RUNTIME_MESSAGES_PATH,
  ] as const;

  for (const filePath of catalogConsumerFiles) {
    const source = getSource(project, filePath);
    if (hasCallExpression(source, "buildMapAuthoringGovernedCatalogs")) {
      findings.push(createFinding({ lawId: MAP_PLUGIN_LAWS.AUTHORING_INPUT_PACKAGE, file: filePath, line: 1, severity: "fatal", message: "Map authoring prompt consumers must not rebuild governed catalogs once a complete input package exists." }));
      continue;
    }

    if (filePath === AUTHORING_PROMPT_BUILDER_PATH && !hasCallExpressionPath(source, ["MapAuthoringInputPackageSchema", "parse"])) {
      findings.push(createFinding({ lawId: MAP_PLUGIN_LAWS.AUTHORING_INPUT_PACKAGE, file: filePath, line: 1, severity: "fatal", message: "Map authoring prompt builder must parse a full input package before building prompt text." }));
      continue;
    }

    if (!source.getFullText().includes("inputPackage") && !source.getFullText().includes("request.input")) {
      findings.push(createFinding({ lawId: MAP_PLUGIN_LAWS.AUTHORING_INPUT_PACKAGE, file: filePath, line: 1, severity: "fatal", message: "Map authoring prompt consumers must receive governed input package data before building prompt text." }));
    }
  }

  return findings;
};

const inspectAuthoringPromptSources = (project: Project): Finding[] => {
  return [
    ...inspectAuthoringTemplateSingleTruth(project),
    ...inspectAuthoringCatalogGateSource(project),
    ...inspectAuthoringCatalogConsumers(project),
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
