import { existsSync, readFileSync } from "node:fs";

import { SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding, selectLawId } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding, InspectorOutput } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";
import { getRepoSourcePath } from "../../shared/source-files.js";

const requiredPluginFiles = [
  "src/plugins/facebook-product-video-mining/facebook-product-video-mining.schema.ts",
  "src/plugins/facebook-product-video-mining/facebook-product-video-mining.flow.ts",
  "src/plugins/facebook-product-video-mining/facebook-product-video-mining.result.ts",
  "src/plugins/facebook-product-video-mining/facebook-product-video-mining.storage.ts",
  "src/plugins/facebook-product-video-mining/facebook-product-video-mining.dom-probe.ts",
  "src/plugins/facebook-product-video-mining/facebook-product-video-mining.comments.ts",
  "src/plugins/facebook-product-video-mining/facebook-product-video-mining.video.ts",
  "src/plugins/facebook-product-video-mining/facebook-product-video-mining.ai-judge.ts",
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

const facebookPagePath = "src/app/workbench-home-page.ts";
const facebookClientPath = "src/app/workbench-home-client.ts";
const facebookSchemaPath = "src/plugins/facebook-product-video-mining/facebook-product-video-mining.schema.ts";

const hasNamedExport = (sourceFile: SourceFile, moduleSpecifier: string, exportName: string): boolean =>
  sourceFile.getExportDeclarations().some((declaration) =>
    declaration.getModuleSpecifierValue() === moduleSpecifier
    && declaration.getNamedExports().some((namedExport) => namedExport.getName() === exportName),
  );

const hasIdentifier = (sourceFile: SourceFile, identifierName: string): boolean =>
  sourceFile.getDescendantsOfKind(SyntaxKind.Identifier).some((identifier) => identifier.getText() === identifierName);

const hasStringLiteral = (sourceFile: SourceFile, literalValue: string): boolean =>
  sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral).some((literal) => literal.getLiteralValue() === literalValue);

const readRepoText = (repoPath: string): string => readFileSync(resolveFromRepo(repoPath), "utf8");

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
  const taskExports = getRequiredSourceFile(context, "src/plugins/local-workbench-plugin-tasks.ts");
  const workbenchHandle = getRequiredSourceFile(context, "src/lib/local-runtime/workbench.ts");
  const appServer = getRequiredSourceFile(context, "src/app/workbench-facebook-routes.ts");

  trackSourceFile(inspectedFiles, taskExports);
  trackSourceFile(inspectedFiles, workbenchHandle);
  trackSourceFile(inspectedFiles, appServer);
  inspectTaskExports(findings, lawId, taskExports);
  inspectWorkbenchHandleSurface(findings, lawId, workbenchHandle);
  inspectAppShellRoutes(findings, lawId, appServer);
};

const inspectTaskExports = (
  findings: InspectorFinding[],
  lawId: string,
  taskExports: SourceFile | undefined,
): void => {
  if (taskExports
    && hasNamedExport(taskExports, "./facebook-product-video-mining/index.js", "startFacebookProductVideoMiningMission")
    && hasNamedExport(taskExports, "./facebook-product-video-mining/index.js", "getFacebookProductVideoMiningRunStatus")
    && hasNamedExport(taskExports, "./facebook-product-video-mining/index.js", "getLatestFacebookProductVideoMiningRun")) {
    return;
  }
  findings.push(createFinding({
    checkId: "facebook-mining/local-workbench-export",
    lawId,
    filePath: "src/plugins/local-workbench-plugin-tasks.ts",
    message: "Local workbench plugin tasks must re-export Facebook mining start/run/latest public surfaces.",
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
    && hasIdentifier(workbenchHandle, "getLatestFacebookProductVideoMiningRun")) {
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
    && hasStringLiteral(appServer, "GET:/api/facebook-product-video-mining/latest")) {
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

const inspectMinimalOperatorInput = (
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  inspectedFiles.add(facebookPagePath);
  inspectedFiles.add(facebookClientPath);
  inspectedFiles.add(facebookSchemaPath);
  const pageText = readRepoText(facebookPagePath);
  const clientText = readRepoText(facebookClientPath);
  const schemaText = readRepoText(facebookSchemaPath);
  inspectTargetCountInput(findings, lawId, pageText);
  inspectForbiddenVisibleInputs(findings, lawId, pageText);
  inspectForbiddenClientPayload(findings, lawId, clientText);
  inspectSchemaDefaultMarkers(findings, lawId, schemaText);
};

const inspectTargetCountInput = (
  findings: InspectorFinding[],
  lawId: string,
  pageText: string,
): void => {
  if (!pageText.includes('name="targetProductCount"')) {
    findings.push(createFinding({
      checkId: "facebook-mining/minimal-target-count-input",
      lawId,
      filePath: facebookPagePath,
      message: "Facebook workbench must expose targetProductCount as the only operator mission input.",
    }));
  }
};

const inspectForbiddenVisibleInputs = (
  findings: InspectorFinding[],
  lawId: string,
  pageText: string,
): void => {
  const forbiddenVisibleFields = /name="(?:feedEntryUrl|providerKind|modelName|maxRounds|maxMinutes)"/u;
  if (forbiddenVisibleFields.test(pageText)) {
    findings.push(createFinding({
      checkId: "facebook-mining/forbidden-visible-advanced-input",
      lawId,
      filePath: facebookPagePath,
      message: "Facebook workbench must not expose feed URL, provider, model, max rounds, or max minutes inputs.",
      evidence: String(forbiddenVisibleFields),
    }));
  }
};

const inspectForbiddenClientPayload = (
  findings: InspectorFinding[],
  lawId: string,
  clientText: string,
): void => {
  const forbiddenClientPayload = /feedEntryUrl:\s*form\.|providerKind:\s*form\.|modelName:\s*form\.|maxRounds:\s*Number|maxMinutes:\s*Number/u;
  if (forbiddenClientPayload.test(clientText)) {
    findings.push(createFinding({
      checkId: "facebook-mining/forbidden-client-payload-advanced-input",
      lawId,
      filePath: facebookClientPath,
      message: "Facebook client mission payload must submit only targetProductCount from the visible form.",
      evidence: String(forbiddenClientPayload),
    }));
  }
};

const inspectSchemaDefaultMarkers = (
  findings: InspectorFinding[],
  lawId: string,
  schemaText: string,
): void => {
  for (const marker of [
    "DEFAULT_FACEBOOK_MINING_FEED_ENTRY_URL",
    "DEFAULT_FACEBOOK_MINING_PROVIDER_KIND",
    "DEFAULT_FACEBOOK_MINING_MAX_MINUTES",
    "FACEBOOK_MINING_ROUNDS_PER_TARGET",
  ]) {
    if (!schemaText.includes(marker)) {
      findings.push(createFinding({
        checkId: "facebook-mining/schema-default-mission-parameter",
        lawId,
        filePath: facebookSchemaPath,
        message: `Facebook mission schema must own automatic default marker ${marker}.`,
      }));
    }
  }
};

export const inspectDomain = async (context: InspectorContext): Promise<InspectorOutput> => {
  const flowLawId = selectLawId(context.planEntry.lawIds, "APEX-FACEBOOK-MINING-001-V1");
  const surfaceLawId = selectLawId(context.planEntry.lawIds, "APEX-FACEBOOK-MINING-002-V1");
  const minimalInputLawId = selectLawId(context.planEntry.lawIds, "APEX-FACEBOOK-MINING-003-V1");
  const findings: InspectorFinding[] = [];
  const inspectedFiles = new Set<string>();

  inspectRequiredFiles(context, findings, inspectedFiles, flowLawId);
  inspectWorkbenchSurface(context, findings, inspectedFiles, surfaceLawId);
  inspectPackageScripts(findings, inspectedFiles, surfaceLawId);
  inspectMinimalOperatorInput(findings, inspectedFiles, minimalInputLawId);

  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,
    findings,
    inspectedFiles: [...inspectedFiles].sort(),
  };
};
