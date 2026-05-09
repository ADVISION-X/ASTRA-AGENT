import type { Project } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { missingFiles } from "./audit-files.js";
import { loadBuiltinPackageRecords } from "./builtin-package-records.js";
import { MAP_PLUGIN_LAWS, MAP_PLUGIN_PATHS } from "./constants.js";
import { BUILTIN_PACKAGE_FILES, REQUIRED_SOURCE_FILES } from "./file-lists.js";
import { inspectLifecycleSources } from "./required-shape-lifecycle-sources.js";
import { inspectSeedingVideoAiInputChain } from "./required-shape-seeding-video.js";
import { inspectCapabilityCatalogGeneratedTruth, inspectMapAuthoringCapabilityCatalogGate, inspectPhase05DiagnosticMapSurface, inspectRegistryBootstrap } from "./required-shape-runtime.js";

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
  if (/"(?:timeoutPolicy|timeoutMs|maxDurationMs)"\s*:/.test(record.text)) {
    return [createFinding({
      lawId: MAP_PLUGIN_LAWS.SCHEMA,
      file: record.file,
      line: 1,
      severity: "fatal",
      message: "Map packages must not declare timeoutPolicy, timeoutMs, or maxDurationMs. Timeout/AND THEN control belongs only to production runtime code.",
    })];
  }

  if (record.parseError) {
    return [createFinding({ lawId: MAP_PLUGIN_LAWS.SCHEMA, file: record.file, line: 1, severity: "fatal", message: `Builtin map package must parse under the governed schema: ${record.parseError}` })];
  }

  if (!record.mapPackage) {
    return [createFinding({ lawId: MAP_PLUGIN_LAWS.SCHEMA, file: record.file, line: 1, severity: "fatal", message: "Builtin map package parsed to null unexpectedly." })];
  }

  const findings: Finding[] = [];
  if (record.mapPackage.manifest.aiGenerated) {
    if (record.mapPackage.manifest.activationGateStatus !== "draft" || record.mapPackage.taskTemplate.availabilityPolicy !== "draft") {
      findings.push(createFinding({ lawId: MAP_PLUGIN_LAWS.AI_DRAFT, file: record.file, line: 1, severity: "fatal", message: "AI-generated map packages must remain draft-only until later governed automation-gate flow exists." }));
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
  const findings = builtinRecords.flatMap((record) => [
    ...inspectBuiltinRecord(record),
    ...inspectSeedingVideoAiInputChain(record),
  ]);

  if (builtinRecords.length !== BUILTIN_PACKAGE_FILES.length) {
    findings.push(createFinding({ lawId: MAP_PLUGIN_LAWS.SCHEMA, file: `${ROOT}/builtins/index.ts`, line: 1, severity: "fatal", message: "Builtin loader and builtin package file set drifted." }));
  }

  return findings;
};

export async function runRequiredShape(project: Project): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const findings = [
    ...(await inspectMissingRequiredFiles()),
    ...(await inspectBuiltinRecords()),
    ...(await inspectCapabilityCatalogGeneratedTruth()),
    ...inspectMapAuthoringCapabilityCatalogGate(),
    ...inspectPhase05DiagnosticMapSurface(),
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
