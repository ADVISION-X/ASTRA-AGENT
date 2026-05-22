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
  "src/plugins/facebook-product-video-mining/index.ts",
] as const;

const requiredAcceptanceFiles = [
  "scripts/acceptance/facebook-product-video-mining-storage.acceptance.ts",
  "scripts/acceptance/facebook-product-video-mining-ai-upload.acceptance.ts",
  "scripts/acceptance/facebook-product-video-mining-flow.acceptance.ts",
  "scripts/acceptance/facebook-product-video-mining-dom-probe.acceptance.ts",
  "scripts/acceptance/facebook-live-dom-probe.ts",
] as const;

const hasNamedExport = (sourceFile: SourceFile, moduleSpecifier: string, exportName: string): boolean =>
  sourceFile.getExportDeclarations().some((declaration) =>
    declaration.getModuleSpecifierValue() === moduleSpecifier
    && declaration.getNamedExports().some((namedExport) => namedExport.getName() === exportName),
  );

const hasIdentifier = (sourceFile: SourceFile, identifierName: string): boolean =>
  sourceFile.getDescendantsOfKind(SyntaxKind.Identifier).some((identifier) => identifier.getText() === identifierName);

const hasStringLiteral = (sourceFile: SourceFile, literalValue: string): boolean =>
  sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral).some((literal) => literal.getLiteralValue() === literalValue);

const getRequiredSourceFile = (context: InspectorContext, repoPath: string): SourceFile | undefined =>
  context.project.getSourceFile(resolveFromRepo(repoPath));

const trackSourceFile = (inspectedFiles: Set<string>, sourceFile: SourceFile | undefined): void => {
  if (sourceFile) {
    inspectedFiles.add(getRepoSourcePath(sourceFile));
  }
};

const inspectRequiredFiles = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  for (const repoPath of requiredPluginFiles) {
    inspectedFiles.add(repoPath);
    if (getRequiredSourceFile(context, repoPath)) {
      continue;
    }
    findings.push(createFinding({
      checkId: "facebook-mining/required-plugin-file",
      lawId,
      filePath: repoPath,
      message: `${repoPath} is required for the Facebook mining flow owner surface.`,
    }));
  }
  for (const repoPath of requiredAcceptanceFiles) {
    inspectedFiles.add(repoPath);
    if (existsSync(resolveFromRepo(repoPath))) {
      continue;
    }
    findings.push(createFinding({
      checkId: "facebook-mining/required-acceptance-file",
      lawId,
      filePath: repoPath,
      message: `${repoPath} is required for Facebook mining acceptance ownership.`,
    }));
  }
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

  trackSourceFile(inspectedFiles, pluginIndex);
  trackSourceFile(inspectedFiles, workbenchHandle);
  trackSourceFile(inspectedFiles, appServer);
  inspectPluginFacade(findings, lawId, pluginIndex);
  inspectWorkbenchHandleSurface(findings, lawId, workbenchHandle);
  inspectAppShellRoutes(findings, lawId, appServer);
};

const inspectPluginFacade = (
  findings: InspectorFinding[],
  lawId: string,
  pluginIndex: SourceFile | undefined,
): void => {
  if (pluginIndex
    && hasIdentifier(pluginIndex, "startFacebookProductVideoMiningMission")
    && hasIdentifier(pluginIndex, "getFacebookProductVideoMiningRunStatus")
    && hasIdentifier(pluginIndex, "getLatestFacebookProductVideoMiningRun")
    && hasIdentifier(pluginIndex, "listFacebookProductVideoMiningSavedRecords")
    && hasIdentifier(pluginIndex, "exportFacebookProductVideoMiningSelectionRecords")) {
    return;
  }
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
  if (workbenchHandle
    && hasIdentifier(workbenchHandle, "startFacebookProductVideoMiningMission")
    && hasIdentifier(workbenchHandle, "getFacebookProductVideoMiningRunStatus")
    && hasIdentifier(workbenchHandle, "getLatestFacebookProductVideoMiningRun")
    && hasIdentifier(workbenchHandle, "listFacebookProductVideoMiningSavedRecords")
    && hasIdentifier(workbenchHandle, "exportFacebookProductVideoMiningSelectionRecords")) {
    return;
  }
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
  if (appServer
    && hasStringLiteral(appServer, "POST:/api/facebook-product-video-mining/mission")
    && hasStringLiteral(appServer, "GET:/api/facebook-product-video-mining/run")
    && hasStringLiteral(appServer, "GET:/api/facebook-product-video-mining/latest")
    && hasStringLiteral(appServer, "GET:/api/facebook-product-video-mining/results")
    && hasStringLiteral(appServer, "GET:/api/facebook-product-video-mining/export")) {
    return;
  }
  findings.push(createFinding({
    checkId: "facebook-mining/app-shell-routes",
    lawId,
    filePath: "src/app/workbench-facebook-routes.ts",
    message: "Local app shell must expose Facebook mining mission, run, and latest routes.",
  }));
};

const inspectPackageScripts = (
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  const packagePath = "package.json";
  inspectedFiles.add(packagePath);
  const packageJson = JSON.parse(readFileSync(resolveFromRepo(packagePath), "utf8")) as {
    scripts?: Record<string, string>;
  };
  const scripts = packageJson.scripts ?? {};
  if (!scripts["acceptance:facebook-product-video-mining"]) {
    findings.push(createFinding({
      checkId: "facebook-mining/package-acceptance-script",
      lawId,
      filePath: packagePath,
      message: "package.json must expose acceptance:facebook-product-video-mining.",
    }));
  }
  if (!scripts["audit:facebook-product-video-mining"]) {
    findings.push(createFinding({
      checkId: "facebook-mining/package-audit-script",
      lawId,
      filePath: packagePath,
      message: "package.json must expose audit:facebook-product-video-mining.",
    }));
  }
};

export const inspectDomain = async (context: InspectorContext): Promise<InspectorOutput> => {
  const flowLawId = selectLawId(context.planEntry.lawIds, "APEX-FACEBOOK-MINING-001-V1");
  const surfaceLawId = selectLawId(context.planEntry.lawIds, "APEX-FACEBOOK-MINING-002-V1");
  const minimalInputLawId = selectLawId(context.planEntry.lawIds, "APEX-FACEBOOK-MINING-003-V1");
  const safetyLawId = selectLawId(context.planEntry.lawIds, "APEX-FACEBOOK-MINING-004-V1");
  const exportLawId = selectLawId(context.planEntry.lawIds, "APEX-FACEBOOK-MINING-005-V1");
  const findings: InspectorFinding[] = [];
  const inspectedFiles = new Set<string>();

  inspectRequiredFiles(context, findings, inspectedFiles, flowLawId);
  inspectWorkbenchSurface(context, findings, inspectedFiles, surfaceLawId);
  inspectPackageScripts(findings, inspectedFiles, surfaceLawId);
  inspectMinimalOperatorInput(findings, inspectedFiles, minimalInputLawId);
  inspectFacebookSafetyDefaults(findings, inspectedFiles, safetyLawId);
  inspectSavedRecordExportSurface(findings, inspectedFiles, exportLawId);

  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,
    findings,
    inspectedFiles: [...inspectedFiles].sort(),
  };
};
