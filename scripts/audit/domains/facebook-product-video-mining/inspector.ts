import { existsSync, readFileSync } from "node:fs";

import { SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding, selectLawId } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding, InspectorOutput } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";
import { getRepoSourcePath } from "../../shared/source-files.js";
import {
  inspectFacebookSafetyDefaults,
  inspectMinimalOperatorInput,
  inspectSavedRecordExportSurface,
} from "./input-surface-inspector.js";
import { inspectStateMachineNavigationProof } from "./state-machine-inspector.js";

const requiredPluginFiles = [
  "src/plugins/facebook-product-video-mining/facebook-product-video-mining.schema.ts",
  "src/plugins/facebook-product-video-mining/facebook-product-video-mining.flow.ts",
  "src/plugins/facebook-product-video-mining/facebook-product-video-mining.result.ts",
  "src/plugins/facebook-product-video-mining/facebook-product-video-mining.storage.ts",
  "src/plugins/facebook-product-video-mining/facebook-product-video-mining.dom-probe.ts",
  "src/plugins/facebook-product-video-mining/facebook-product-video-mining.comments.ts",
  "src/plugins/facebook-product-video-mining/facebook-product-video-mining.video.ts",
  "src/plugins/facebook-product-video-mining/facebook-product-video-mining.ai-judge.ts",
  "src/plugins/facebook-product-video-mining/facebook-product-video-mining.ai-timeout.ts",
  "src/plugins/facebook-product-video-mining/facebook-product-video-mining.selection-export.ts",
  "src/plugins/facebook-product-video-mining/facebook-product-video-mining.records.ts",
  "src/plugins/facebook-product-video-mining/facebook-product-video-mining.not-interested.ts",
  "src/plugins/facebook-product-video-mining/facebook-product-video-mining.navigation.ts",
  "src/plugins/facebook-product-video-mining/facebook-product-video-mining.navigation-proof.ts",
  "src/plugins/facebook-product-video-mining/facebook-product-video-mining.navigation-scripts.ts",
  "src/plugins/facebook-product-video-mining/facebook-product-video-mining.round-runtime.ts",
  "src/plugins/facebook-product-video-mining/index.ts",
] as const;

const requiredAcceptanceFiles = [
  "scripts/acceptance/facebook-product-video-mining-storage.acceptance.ts",
  "scripts/acceptance/facebook-product-video-mining-ai-upload.acceptance.ts",
  "scripts/acceptance/facebook-product-video-mining-flow.acceptance.ts",
  "scripts/acceptance/facebook-product-video-mining-dom-probe.acceptance.ts",
  "scripts/acceptance/facebook-live-dom-probe.ts",
] as const;

const hasIdentifier = (sourceFile: SourceFile, identifierName: string): boolean =>
  sourceFile.getDescendantsOfKind(SyntaxKind.Identifier).some((identifier) => identifier.getText() === identifierName);

const hasStringLiteral = (sourceFile: SourceFile, literalValue: string): boolean =>
  sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral).some((literal) => literal.getLiteralValue() === literalValue);

const getRequiredSourceFile = (context: InspectorContext, repoPath: string): SourceFile | undefined =>
  context.project.getSourceFile(resolveFromRepo(repoPath));

const trackSourceFile = (inspectedFiles: Set<string>, sourceFile: SourceFile | undefined): void => {
  if (sourceFile) inspectedFiles.add(getRepoSourcePath(sourceFile));
};

const inspectRequiredPluginFiles = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  for (const repoPath of requiredPluginFiles) {
    inspectedFiles.add(repoPath);
    if (getRequiredSourceFile(context, repoPath)) continue;
    findings.push(createFinding({
      checkId: "facebook-mining/required-plugin-file",
      lawId,
      filePath: repoPath,
      message: `${repoPath} is required for the Facebook mining flow owner surface.`,
    }));
  }
};

const inspectRequiredAcceptanceFiles = (
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  for (const repoPath of requiredAcceptanceFiles) {
    inspectedFiles.add(repoPath);
    if (existsSync(resolveFromRepo(repoPath))) continue;
    findings.push(createFinding({
      checkId: "facebook-mining/required-acceptance-file",
      lawId,
      filePath: repoPath,
      message: `${repoPath} is required for Facebook mining acceptance ownership.`,
    }));
  }
};

const inspectRequiredFiles = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  inspectRequiredPluginFiles(context, findings, inspectedFiles, lawId);
  inspectRequiredAcceptanceFiles(findings, inspectedFiles, lawId);
};

const inspectPluginFacade = (
  findings: InspectorFinding[],
  lawId: string,
  pluginIndex: SourceFile | undefined,
): void => {
  const requiredNames = [
    "startFacebookProductVideoMiningMission",
    "getFacebookProductVideoMiningRunStatus",
    "getLatestFacebookProductVideoMiningRun",
    "listFacebookProductVideoMiningSavedRecords",
    "exportFacebookProductVideoMiningSelectionRecords",
  ];
  if (pluginIndex && requiredNames.every((name) => hasIdentifier(pluginIndex, name))) return;
  findings.push(createFinding({
    checkId: "facebook-mining/plugin-public-surface",
    lawId,
    filePath: "src/plugins/facebook-product-video-mining/index.ts",
    message: "Facebook mining plugin index must expose start/run/latest and records public surfaces.",
  }));
};

const inspectWorkbenchHandleSurface = (
  findings: InspectorFinding[],
  lawId: string,
  workbenchHandle: SourceFile | undefined,
): void => {
  const requiredNames = [
    "startFacebookProductVideoMiningMission",
    "getFacebookProductVideoMiningRunStatus",
    "getLatestFacebookProductVideoMiningRun",
    "listFacebookProductVideoMiningSavedRecords",
    "exportFacebookProductVideoMiningSelectionRecords",
  ];
  if (workbenchHandle && requiredNames.every((name) => hasIdentifier(workbenchHandle, name))) return;
  findings.push(createFinding({
    checkId: "facebook-mining/workbench-handle-surface",
    lawId,
    filePath: "src/lib/local-runtime/workbench.ts",
    message: "Workbench handle must expose Facebook mining start/run/latest methods.",
  }));
};

const inspectAppShellRoutes = (
  findings: InspectorFinding[],
  lawId: string,
  appServer: SourceFile | undefined,
): void => {
  const routes = [
    "POST:/api/facebook-product-video-mining/mission",
    "GET:/api/facebook-product-video-mining/run",
    "GET:/api/facebook-product-video-mining/latest",
    "GET:/api/facebook-product-video-mining/results",
    "GET:/api/facebook-product-video-mining/export",
  ];
  if (appServer && routes.every((route) => hasStringLiteral(appServer, route))) return;
  findings.push(createFinding({
    checkId: "facebook-mining/app-shell-routes",
    lawId,
    filePath: "src/app/workbench-facebook-routes.ts",
    message: "Local app shell must expose Facebook mining mission, run, and latest routes.",
  }));
};

const inspectWorkbenchSurface = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  const pluginIndex = getRequiredSourceFile(context, "src/plugins/facebook-product-video-mining/index.ts");
  const workbenchHandle = getRequiredSourceFile(context, "src/lib/local-runtime/workbench.ts");
  const appServer = getRequiredSourceFile(context, "src/app/workbench-facebook-routes.ts");
  for (const sourceFile of [pluginIndex, workbenchHandle, appServer]) trackSourceFile(inspectedFiles, sourceFile);
  inspectPluginFacade(findings, lawId, pluginIndex);
  inspectWorkbenchHandleSurface(findings, lawId, workbenchHandle);
  inspectAppShellRoutes(findings, lawId, appServer);
};

const inspectPackageScripts = (
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  const packagePath = "package.json";
  inspectedFiles.add(packagePath);
  const scripts = (JSON.parse(readFileSync(resolveFromRepo(packagePath), "utf8")) as { scripts?: Record<string, string> }).scripts ?? {};
  for (const scriptName of ["acceptance:facebook-product-video-mining", "audit:facebook-product-video-mining"]) {
    if (scripts[scriptName]) continue;
    findings.push(createFinding({
      checkId: `facebook-mining/package-${scriptName.startsWith("acceptance") ? "acceptance" : "audit"}-script`,
      lawId,
      filePath: packagePath,
      message: `package.json must expose ${scriptName}.`,
    }));
  }
};

export const inspectDomain = async (context: InspectorContext): Promise<InspectorOutput> => {
  const flowLawId = selectLawId(context.planEntry.lawIds, "APEX-FACEBOOK-MINING-001-V1");
  const surfaceLawId = selectLawId(context.planEntry.lawIds, "APEX-FACEBOOK-MINING-002-V1");
  const minimalInputLawId = selectLawId(context.planEntry.lawIds, "APEX-FACEBOOK-MINING-003-V1");
  const safetyLawId = selectLawId(context.planEntry.lawIds, "APEX-FACEBOOK-MINING-004-V1");
  const exportLawId = selectLawId(context.planEntry.lawIds, "APEX-FACEBOOK-MINING-005-V1");
  const stateMachineLawId = selectLawId(context.planEntry.lawIds, "APEX-FACEBOOK-MINING-006-V1");
  const findings: InspectorFinding[] = [];
  const inspectedFiles = new Set<string>();

  inspectRequiredFiles(context, findings, inspectedFiles, flowLawId);
  inspectWorkbenchSurface(context, findings, inspectedFiles, surfaceLawId);
  inspectPackageScripts(findings, inspectedFiles, surfaceLawId);
  inspectMinimalOperatorInput(findings, inspectedFiles, minimalInputLawId);
  inspectFacebookSafetyDefaults(findings, inspectedFiles, safetyLawId);
  inspectSavedRecordExportSurface(findings, inspectedFiles, exportLawId);
  inspectStateMachineNavigationProof(findings, inspectedFiles, stateMachineLawId);

  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,
    findings,
    inspectedFiles: [...inspectedFiles].sort(),
  };
};
