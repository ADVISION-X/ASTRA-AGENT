import type { Project } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { hasCallExpression, hasImportModuleSpecifier } from "../_shared/ast-helpers.js";
import { getSource, listMapPluginFiles } from "./audit-project.js";
import { loadBuiltinPackageRecords } from "./builtin-package-records.js";
import { MAP_PLUGIN_LAWS, MAP_PLUGIN_PATHS } from "./constants.js";

const { BUILTINS_ROOT, ROOT } = MAP_PLUGIN_PATHS;

const FORBIDDEN_TEXT_FRAGMENTS = [
  "import(",
  "child_process",
  "functionbody",
  "npm run",
  "eval(",
  "function ",
  "=>",
  "dynamicimport",
  "node:",
  "onrun",
  "onstep",
  "ontransition",
  "new function",
  "javascript:",
  "require(",
  "system prompt",
  "user prompt",
  "raw prompt",
] as const;
const FORBIDDEN_IMPORT_MARKERS = [
  "/capabilities/orchestration/runtime/",
  "/capabilities/orchestration/maps/",
  "/capabilities/ai/runtime/",
  "/capabilities/ai/children/",
  "/capabilities/nerve-bus/",
  "/lib/browser/",
  "node:child_process",
] as const;

const inspectBuiltinFileSet = async (): Promise<Finding[]> => {
  const mapPluginFiles = await listMapPluginFiles();
  return mapPluginFiles
    .filter((filePath) => filePath.startsWith(`${BUILTINS_ROOT}/`) && filePath !== `${BUILTINS_ROOT}/index.ts` && !filePath.endsWith(".json"))
    .map((file) => createFinding({ lawId: MAP_PLUGIN_LAWS.NO_CODE, file, line: 1, severity: "fatal", message: "Builtin map packages must stay JSON data packages and must not ship executable source files." }));
};

const inspectBuiltinRecordSafety = async (): Promise<Finding[]> => {
  const findings: Finding[] = [];

  for (const record of await loadBuiltinPackageRecords()) {
    const securityIssue = record.validationIssues.find((issue) => issue.code === "security_violation");
    if (securityIssue) {
      findings.push(createFinding({ lawId: MAP_PLUGIN_LAWS.NO_CODE, file: record.file, line: 1, severity: "fatal", message: `Builtin map package contains executable or code-like payload content: ${securityIssue.message}` }));
    }

    const forbiddenFragment = FORBIDDEN_TEXT_FRAGMENTS.find((fragment) => record.text.toLowerCase().includes(fragment));
    if (forbiddenFragment) {
      findings.push(createFinding({ lawId: MAP_PLUGIN_LAWS.NO_CODE, file: record.file, line: 1, severity: "fatal", message: `Builtin map package must not contain executable-like fragment ${forbiddenFragment}.` }));
    }
  }

  return findings;
};

const IPHONE_MIRRORING_PACKAGE_IDS = new Set([
  "builtin.iphone-mirroring-facebook-seeding-video-discovery",
  "builtin.iphone-mirroring-tiktok-seeding-video-discovery",
]);

const inspectIphoneMirroringMapBoundary = async (): Promise<Finding[]> => {
  const findings: Finding[] = [];

  for (const record of await loadBuiltinPackageRecords()) {
    const mapPackage = record.mapPackage;
    if (!mapPackage || !IPHONE_MIRRORING_PACKAGE_IDS.has(mapPackage.manifest.packageId)) {
      continue;
    }

    const steps = mapPackage.operationalMap.steps;
    const initialStep = steps.find((step) => step.stepId === mapPackage.operationalMap.initialStepId);
    const childIds = new Set(steps.map((step) => step.childCapabilityId));
    const requestedPlatformId = mapPackage.taskTemplate.requestedPlatformId;
    const stepUsesTargetUrl = steps.some((step) => step.inputRefs.includes("targetUrl"));
    const actionSteps = steps.filter((step) => step.targetAbilityGroupId === "mouse-click" || step.targetAbilityGroupId === "mouse-scroll");
    const actionWithoutVisualGeometryOrPav = actionSteps.find((step) =>
      !step.inputRefs.includes("visualTargetRef") || !step.inputRefs.includes("geometryProofRef") || step.postActionVerification === null
    );

    if (initialStep?.childCapabilityId !== "open-local-program") {
      findings.push(createFinding({ lawId: MAP_PLUGIN_LAWS.NO_CODE, file: record.file, line: 1, severity: "fatal", message: "iPhone Mirroring maps must start through open-local-program." }));
    }
    if (childIds.has("open-local-workbench") || childIds.has("open-facebook") || childIds.has("open-tiktok")) {
      findings.push(createFinding({ lawId: MAP_PLUGIN_LAWS.NO_CODE, file: record.file, line: 1, severity: "fatal", message: "iPhone Mirroring maps must not use local workbench or web-platform Open children." }));
    }
    if (requestedPlatformId === "facebook-web" || requestedPlatformId === "tiktok-web") {
      findings.push(createFinding({ lawId: MAP_PLUGIN_LAWS.NO_CODE, file: record.file, line: 1, severity: "fatal", message: "iPhone Mirroring maps must not bind to web requestedPlatformId values." }));
    }
    if (stepUsesTargetUrl) {
      findings.push(createFinding({ lawId: MAP_PLUGIN_LAWS.NO_CODE, file: record.file, line: 1, severity: "fatal", message: "iPhone Mirroring maps must not route through targetUrl or web URL fallback input refs." }));
    }
    if (actionWithoutVisualGeometryOrPav) {
      findings.push(createFinding({ lawId: MAP_PLUGIN_LAWS.NO_CODE, file: record.file, line: 1, severity: "fatal", message: "iPhone Mirroring internal app actions must carry visualTargetRef, geometryProofRef, and postActionVerification.", detail: actionWithoutVisualGeometryOrPav.stepId }));
    }
  }

  return findings;
};

const inspectSourceFileImports = async (project: Project): Promise<Finding[]> => {
  const findings: Finding[] = [];
  const sourceFiles = (await listMapPluginFiles()).filter((filePath) => filePath.endsWith(".ts"));

  for (const filePath of sourceFiles) {
    const source = getSource(project, filePath);
    const forbiddenImport = FORBIDDEN_IMPORT_MARKERS.find((marker) => hasImportModuleSpecifier(source, marker));
    if (forbiddenImport) {
      findings.push(createFinding({ lawId: MAP_PLUGIN_LAWS.NO_CODE, file: filePath, line: 1, severity: "fatal", message: `Map package source must not depend on executable runtime internals through ${forbiddenImport}.` }));
    }

    if (hasCallExpression(source, "eval") || hasCallExpression(source, "Function") || hasCallExpression(source, "exec") || hasCallExpression(source, "spawn")) {
      findings.push(createFinding({ lawId: MAP_PLUGIN_LAWS.NO_CODE, file: filePath, line: 1, severity: "fatal", message: "Map package source must not introduce executable payload helpers or shell escapes." }));
    }
  }

  return findings;
};

export async function runForbiddenShape(project: Project): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const findings = [
    ...(await inspectBuiltinFileSet()),
    ...(await inspectBuiltinRecordSafety()),
    ...(await inspectIphoneMirroringMapBoundary()),
    ...(await inspectSourceFileImports(project)),
  ];

  const passed = findings.length === 0;
  return {
    findings,
    phase: createPhase(
      "forbidden-shape",
      passed ? "PASS" : "CODE VIOLATION",
      passed,
      passed
        ? "Map package builtins remain declarative JSON and the package layer has no executable escape surfaces."
        : "Map package layer still contains executable payload or forbidden runtime escape shapes.",
    ),
  };
}
