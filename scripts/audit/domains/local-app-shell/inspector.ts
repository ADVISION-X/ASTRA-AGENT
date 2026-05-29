import { readFileSync } from "node:fs";

import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding, selectLawId } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorOutput } from "../../shared/inspector-contracts.js";
import { containsAnyCaseInsensitive, isPublicCapabilityFacadePath, isPublicPluginFacadePath } from "../../shared/no-regex.js";
import { resolveFromRepo } from "../../shared/paths.js";
import { getRepoSourcePath } from "../../shared/source-files.js";
import { inspectDeepResearchCaseReaderUi } from "./components/scan-deep-research-case-reader-ui.js";
import { inspectDeepResearchCleanRawIndexUi } from "./components/scan-deep-research-clean-raw-index-ui.js";
import { inspectDeepResearchFormPollingUi } from "./components/scan-deep-research-form-polling-ui.js";
import { inspectDeepResearchHtmlDeliveryStatusUi } from "./components/scan-deep-research-html-delivery-status-ui.js";
import { inspectDeepResearchPromptBundleUi } from "./components/scan-deep-research-promptbundle-ui.js";

type Finding = ReturnType<typeof createFinding>;

const pagePath = "src/app/workbench-home-page.ts";
const clientPath = "src/app/workbench-home-client.ts";
const appShellPath = "src/app/app-shell/app-shell.ts";
const appShellLayoutPath = "src/app/app-shell/app-shell-layout.ts";
const appShellAmazonInvoiceWorkspacePath = "src/app/app-shell/amazon-invoice-workspace.ts";
const appShellSidebarPath = "src/app/app-shell/sidebar.ts";
const appShellCommandBarPath = "src/app/app-shell/command-bar.ts";
const appShellInspectorPath = "src/app/app-shell/inspector.ts";
const appShellRuntimeConsolePath = "src/app/app-shell/runtime-console.ts";
const videoDownloadClientPath = "src/app/workbench-video-download-client.ts";
const deepResearchPanelPath = "src/app/workbench-deep-research-panel.ts";
const deepResearchClientPath = "src/app/workbench-deep-research-client.ts";
const deepResearchRoutePath = "src/app/workbench-deep-research-routes.ts";
const videoDownloadRoutePath = "src/app/workbench-video-download-routes.ts";
const stylesPath = "src/app/workbench-home-styles.ts";
const serverPath = "src/app/create-workbench-server.ts";
const inspectorPath = "scripts/audit/domains/local-app-shell/inspector.ts";

const readRepoFile = (repoPath: string): string => readFileSync(resolveFromRepo(repoPath), "utf8");

const readAppShellSurfaceText = (): string => [
  pagePath,
  appShellPath,
  appShellLayoutPath,
  appShellAmazonInvoiceWorkspacePath,
  appShellSidebarPath,
  appShellCommandBarPath,
  appShellInspectorPath,
  appShellRuntimeConsolePath,
].map(readRepoFile).join("\n");

const getSourceFile = (context: InspectorContext, repoPath: string): SourceFile | undefined =>
  context.project.getSourceFile(resolveFromRepo(repoPath));

const pushFinding = (
  findings: Finding[],
  input: {
    checkId: string;
    lawId: string;
    filePath: string;
    message: string;
    evidence?: string | undefined;
  },
): void => {
  findings.push(createFinding(input));
};

const requireMarker = (input: {
  findings: Finding[];
  lawId: string;
  filePath: string;
  text: string;
  marker: string;
  checkId: string;
}): void => {
  if (input.text.includes(input.marker)) {
    return;
  }
  pushFinding(input.findings, {
    checkId: input.checkId,
    lawId: input.lawId,
    filePath: input.filePath,
    message: `${input.filePath} is missing ${input.marker}.`,
  });
};

const requireImport = (input: {
  findings: Finding[];
  lawId: string;
  filePath: string;
  symbolName: string;
  moduleSuffix: string;
  checkId: string;
  context: InspectorContext;
}): void => {
  const sourceFile = getSourceFile(input.context, input.filePath);
  const found = sourceFile?.getImportDeclarations().some((declaration) =>
    declaration.getModuleSpecifierValue().endsWith(input.moduleSuffix)
    && declaration.getNamedImports().some((namedImport) => namedImport.getName() === input.symbolName),
  );
  if (found) return;
  pushFinding(input.findings, {
    checkId: input.checkId,
    lawId: input.lawId,
    filePath: input.filePath,
    message: `${input.filePath} must import ${input.symbolName} from ${input.moduleSuffix}.`,
  });
};

const requireCall = (input: {
  findings: Finding[];
  lawId: string;
  filePath: string;
  symbolName: string;
  checkId: string;
  context: InspectorContext;
}): void => {
  const sourceFile = getSourceFile(input.context, input.filePath);
  const found = sourceFile?.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) =>
    call.getExpression().getText() === input.symbolName,
  );
  if (found) return;
  pushFinding(input.findings, {
    checkId: input.checkId,
    lawId: input.lawId,
    filePath: input.filePath,
    message: `${input.filePath} must call ${input.symbolName}.`,
  });
};

const inspectRootSurface = (findings: Finding[], lawId: string): void => {
  const pageText = readAppShellSurfaceText();
  const clientText = readRepoFile(clientPath);
  requireMarker({ findings, lawId, filePath: pagePath, text: pageText, marker: "data-workbench-shell", checkId: "local-app-shell/root-shell" });
  requireMarker({ findings, lawId, filePath: pagePath, text: pageText, marker: "data-job-flow-list", checkId: "local-app-shell/job-list" });
  requireMarker({ findings, lawId, filePath: pagePath, text: pageText, marker: "data-health-status", checkId: "local-app-shell/health-status" });
  requireMarker({ findings, lawId, filePath: pagePath, text: pageText, marker: "data-mode-status", checkId: "local-app-shell/mode-status" });
  requireMarker({ findings, lawId, filePath: clientPath, text: clientText, marker: "/api/health", checkId: "local-app-shell/health-api" });
  requireMarker({ findings, lawId, filePath: clientPath, text: clientText, marker: "/api/mode", checkId: "local-app-shell/mode-api" });
};

const inspectJobInputs = (findings: Finding[], lawId: string): void => {
  const pageText = readAppShellSurfaceText();
  const videoClientText = readRepoFile(videoDownloadClientPath);
  const videoRouteText = readRepoFile(videoDownloadRoutePath);
  const requiredAmazonFields = [
    "marketplace",
    "sellerCentralEntryUrl",
    "amazonOrderId",
    "invoiceNo",
    "invoicePdf",
  ];
  for (const fieldName of requiredAmazonFields) {
    requireMarker({ findings, lawId, filePath: pagePath, text: pageText, marker: fieldName, checkId: "local-app-shell/amazon-input" });
  }
  requireMarker({ findings, lawId, filePath: pagePath, text: pageText, marker: "data-facebook-form", checkId: "local-app-shell/facebook-input" });
  for (const marker of ["data-video-download-form", "sourcePageUrl", "platform", "preferredQuality", "maxMegabytes", "downloadSubtitles", "telegram-web", "data-video-platform-tabs", "data-video-detect-source", "data-video-download-telegram-boundary"]) {
    requireMarker({ findings, lawId, filePath: pagePath, text: pageText, marker, checkId: "local-app-shell/video-download-input" });
  }
  requireMarker({ findings, lawId, filePath: videoDownloadClientPath, text: videoClientText, marker: "/api/video-download/start", checkId: "local-app-shell/video-download-client" });
  requireMarker({ findings, lawId, filePath: videoDownloadRoutePath, text: videoRouteText, marker: "routeVideoDownloadArtifactJob", checkId: "local-app-shell/video-download-route" });
  requireMarker({ findings, lawId, filePath: videoDownloadRoutePath, text: videoRouteText, marker: "/api/video-download/source-page", checkId: "local-app-shell/video-download-source-page" });
  requireMarker({ findings, lawId, filePath: videoDownloadRoutePath, text: videoRouteText, marker: "missing_source_page_url", checkId: "local-app-shell/video-download-route" });
  if (videoRouteText.includes("getVideoDownloadAbilityGroup().execute")) {
    pushFinding(findings, {
      checkId: "local-app-shell/video-download-direct-ability-call",
      lawId,
      filePath: videoDownloadRoutePath,
      message: "Video Download app route must enter mediator and job flow before calling the ability group.",
    });
  }
};

const inspectDeepResearchAppSurface = (
  context: InspectorContext,
  findings: Finding[],
  inspectedFiles: Set<string>,
  lawId: string,
  deliveryLawId: string,
): void => {
  const pageText = readAppShellSurfaceText();
  requireImport({ context, findings, lawId, filePath: appShellLayoutPath, symbolName: "renderDeepResearchPanel", moduleSuffix: "../workbench-deep-research-panel.js", checkId: "local-app-shell/deep-research-ui-import" });
  requireImport({ context, findings, lawId, filePath: serverPath, symbolName: "handleDeepResearchRequest", moduleSuffix: "./workbench-deep-research-routes.js", checkId: "local-app-shell/deep-research-route-import" });
  requireCall({ context, findings, lawId, filePath: appShellLayoutPath, symbolName: "renderDeepResearchPanel", checkId: "local-app-shell/deep-research-panel-call" });
  requireCall({ context, findings, lawId, filePath: serverPath, symbolName: "handleDeepResearchRequest", checkId: "local-app-shell/deep-research-route-call" });
  requireMarker({ findings, lawId, filePath: appShellLayoutPath, text: pageText, marker: "data-skill-workspace=\"deep-research-analysis\"", checkId: "local-app-shell/deep-research-surface" });
  inspectDeepResearchCaseReaderUi({
    context,
    findings,
    inspectedFiles,
    lawId: deliveryLawId,
  });
  inspectDeepResearchPromptBundleUi({
    context,
    findings,
    inspectedFiles,
    lawId: deliveryLawId,
  });
  inspectDeepResearchFormPollingUi({
    context,
    findings,
    inspectedFiles,
    lawId,
  });
  inspectDeepResearchCleanRawIndexUi({
    context,
    findings,
    inspectedFiles,
    lawId: deliveryLawId,
  });
  inspectDeepResearchHtmlDeliveryStatusUi({
    context,
    findings,
    inspectedFiles,
    lawId: deliveryLawId,
  });
};

const inspectDeepResearchAppBoundary = (
  context: InspectorContext,
  findings: Finding[],
  lawId: string,
): void => {
  const routeSource = getSourceFile(context, deepResearchRoutePath);
  const forbiddenImport = routeSource?.getImportDeclarations().find((declaration) =>
    declaration.getModuleSpecifierValue().includes("plugins/deep-research-analysis"),
  );
  if (forbiddenImport) {
    pushFinding(findings, {
      checkId: "local-app-shell/deep-research-private-import",
      lawId,
      filePath: deepResearchRoutePath,
      message: "Deep Research app route must call WorkbenchHandle instead of importing plugin code.",
    });
  }
  const appSources = [deepResearchPanelPath, deepResearchClientPath, deepResearchRoutePath]
    .map((repoPath) => getSourceFile(context, repoPath))
    .filter((sourceFile): sourceFile is SourceFile => Boolean(sourceFile));
  const promptLikeNode = appSources.flatMap((sourceFile) =>
    sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral).filter((literal) =>
      containsAnyCaseInsensitive(literal.getLiteralValue(), ["output contract", "return json", "positiveAnalysisPrompt", "falsificationPrompt"]),
    ).map((literal) => ({ sourceFile, literal })),
  )[0];
  if (promptLikeNode) {
    pushFinding(findings, {
      checkId: "local-app-shell/deep-research-business-logic",
      lawId,
      filePath: getRepoSourcePath(promptLikeNode.sourceFile),
      message: "Deep Research APP files must not contain business prompt or parser logic.",
      evidence: Node.isStringLiteral(promptLikeNode.literal) ? promptLikeNode.literal.getLiteralValue() : undefined,
    });
  }
};

const inspectStatusWindow = (findings: Finding[], lawId: string): void => {
  const pageText = `${readAppShellSurfaceText()}\n${readRepoFile(videoDownloadClientPath)}`;
  for (const marker of ["data-task-status-panel", "data-task-reason", "data-evidence-ref", "data-raw-result"]) {
    requireMarker({ findings, lawId, filePath: pagePath, text: pageText, marker, checkId: "local-app-shell/status-window" });
  }
  requireMarker({ findings, lawId, filePath: videoDownloadClientPath, text: pageText, marker: "reviewRequiredReason", checkId: "local-app-shell/video-download-status" });
};

const inspectForbiddenPageTerms = (findings: Finding[], lawId: string): void => {
  const pageText = `${readAppShellSurfaceText()}\n${readRepoFile(clientPath)}\n${readRepoFile(videoDownloadClientPath)}\n${readRepoFile(stylesPath)}`;
  const forbiddenMarkers = [
    "universal mission dashboard",
    "commander console",
    "visual runtime control",
    "next-action",
    "next action",
    "action plan",
    "data-browser-control",
    "data-dom-control",
  ] as const;
  const matchedMarker = forbiddenMarkers.find((marker) => pageText.toLowerCase().includes(marker));
  if (!matchedMarker) {
    return;
  }
  pushFinding(findings, {
    checkId: "local-app-shell/forbidden-dashboard",
    lawId,
    filePath: pagePath,
    message: "Local app shell contains forbidden dashboard, planner, or control surface.",
    evidence: matchedMarker,
  });
};

const inspectAppImports = (context: InspectorContext, findings: Finding[], lawId: string): void => {
  for (const sourceFile of context.project.getSourceFiles()) {
    const repoPath = getRepoSourcePath(sourceFile);
    if (!repoPath.startsWith("src/app/")) {
      continue;
    }
    for (const importDeclaration of sourceFile.getImportDeclarations()) {
      const target = importDeclaration.getModuleSpecifierSourceFile();
      if (!target) {
        continue;
      }
      const targetPath = getRepoSourcePath(target);
      if (!targetPath.startsWith("src/plugins/") && !targetPath.startsWith("src/capabilities/")) {
        continue;
      }
      pushFinding(findings, {
        checkId: "local-app-shell/private-owner-import",
        lawId,
        filePath: repoPath,
        message: `${repoPath} imports job or ability owner code directly.`,
        evidence: targetPath,
      });
    }
  }
};

const inspectLocalRuntimeImports = (context: InspectorContext, findings: Finding[], lawId: string): void => {
  for (const sourceFile of context.project.getSourceFiles()) {
    const repoPath = getRepoSourcePath(sourceFile);
    if (!repoPath.startsWith("src/lib/local-runtime/")) {
      continue;
    }
    for (const importDeclaration of sourceFile.getImportDeclarations()) {
      const target = importDeclaration.getModuleSpecifierSourceFile();
      if (!target) {
        continue;
      }
      const targetPath = getRepoSourcePath(target);
      if (targetPath.startsWith("src/plugins/") && !isPublicPluginFacadePath(targetPath)) {
        pushFinding(findings, {
          checkId: "local-app-shell/private-plugin-import",
          lawId,
          filePath: repoPath,
          message: `${repoPath} imports plugin-owned code outside the plugin public facade.`,
          evidence: targetPath,
        });
      }
      if (targetPath.startsWith("src/capabilities/") && !isPublicCapabilityFacadePath(targetPath)) {
        pushFinding(findings, {
          checkId: "local-app-shell/private-capability-import",
          lawId,
          filePath: repoPath,
          message: `${repoPath} imports ability-group code outside the public facade.`,
          evidence: targetPath,
        });
      }
    }
  }
};

const inspectAstProjectAccess = (context: InspectorContext, findings: Finding[], lawId: string): void => {
  if (context.project.getSourceFile(resolveFromRepo(inspectorPath))) {
    return;
  }
  pushFinding(findings, {
    checkId: "local-app-shell/inspector-ast-project",
    lawId,
    filePath: inspectorPath,
    message: "Local app shell inspector must be visible to the audit ts-morph project.",
  });
};

export const inspectDomain = async (context: InspectorContext): Promise<InspectorOutput> => {
  const surfaceLawId = selectLawId(context.planEntry.lawIds, "APEX-LOCAL-APP-SHELL-001-V1");
  const inputLawId = selectLawId(context.planEntry.lawIds, "APEX-LOCAL-APP-SHELL-002-V1");
  const statusLawId = selectLawId(context.planEntry.lawIds, "APEX-LOCAL-APP-SHELL-003-V1");
  const boundaryLawId = selectLawId(context.planEntry.lawIds, "APEX-LOCAL-APP-SHELL-004-V1");
  const deliveryLawId = selectLawId(context.planEntry.lawIds, "APEX-LOCAL-APP-SHELL-005-V1");
  const findings: Finding[] = [];
  const inspectedFiles = new Set<string>([
    pagePath,
    clientPath,
    appShellPath,
    appShellLayoutPath,
    appShellAmazonInvoiceWorkspacePath,
    appShellSidebarPath,
    appShellCommandBarPath,
    appShellInspectorPath,
    appShellRuntimeConsolePath,
    videoDownloadClientPath,
    videoDownloadRoutePath,
    deepResearchPanelPath,
    deepResearchClientPath,
    deepResearchRoutePath,
    stylesPath,
    serverPath,
    inspectorPath,
  ]);

  inspectAstProjectAccess(context, findings, boundaryLawId);
  inspectRootSurface(findings, surfaceLawId);
  inspectJobInputs(findings, inputLawId);
  inspectDeepResearchAppSurface(context, findings, inspectedFiles, inputLawId, deliveryLawId);
  inspectStatusWindow(findings, statusLawId);
  inspectForbiddenPageTerms(findings, boundaryLawId);
  inspectDeepResearchAppBoundary(context, findings, boundaryLawId);
  inspectAppImports(context, findings, boundaryLawId);
  inspectLocalRuntimeImports(context, findings, boundaryLawId);

  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,
    findings,
    inspectedFiles: [...inspectedFiles].sort(),
  };
};
