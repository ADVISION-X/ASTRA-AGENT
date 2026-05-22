import { readFileSync } from "node:fs";

import { createFinding, selectLawId } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorOutput } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";
import { getRepoSourcePath } from "../../shared/source-files.js";

type Finding = ReturnType<typeof createFinding>;

const pagePath = "src/app/workbench-home-page.ts";
const clientPath = "src/app/workbench-home-client.ts";
const videoDownloadClientPath = "src/app/workbench-video-download-client.ts";
const videoDownloadRoutePath = "src/app/workbench-video-download-routes.ts";
const stylesPath = "src/app/workbench-home-styles.ts";
const serverPath = "src/app/create-workbench-server.ts";
const inspectorPath = "scripts/audit/domains/local-app-shell/inspector.ts";
const publicPluginFacadePathPattern = /^src\/plugins\/[^/]+\/index\.ts$/u;
const publicCapabilityFacadePathPattern = /^src\/capabilities\/[^/]+\/index\.ts$/u;

const readRepoFile = (repoPath: string): string => readFileSync(resolveFromRepo(repoPath), "utf8");

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

const inspectRootSurface = (findings: Finding[], lawId: string): void => {
  const pageText = readRepoFile(pagePath);
  const clientText = readRepoFile(clientPath);
  requireMarker({ findings, lawId, filePath: pagePath, text: pageText, marker: "data-workbench-shell", checkId: "local-app-shell/root-shell" });
  requireMarker({ findings, lawId, filePath: pagePath, text: pageText, marker: "data-job-flow-list", checkId: "local-app-shell/job-list" });
  requireMarker({ findings, lawId, filePath: pagePath, text: pageText, marker: "data-health-status", checkId: "local-app-shell/health-status" });
  requireMarker({ findings, lawId, filePath: pagePath, text: pageText, marker: "data-mode-status", checkId: "local-app-shell/mode-status" });
  requireMarker({ findings, lawId, filePath: clientPath, text: clientText, marker: "/api/health", checkId: "local-app-shell/health-api" });
  requireMarker({ findings, lawId, filePath: clientPath, text: clientText, marker: "/api/mode", checkId: "local-app-shell/mode-api" });
};

const inspectJobInputs = (findings: Finding[], lawId: string): void => {
  const pageText = readRepoFile(pagePath);
  const videoClientText = readRepoFile(videoDownloadClientPath);
  const videoRouteText = readRepoFile(videoDownloadRoutePath);
  const requiredAmazonFields = [
    "marketplace",
    "sellerCentralEntryUrl",
    "amazonOrderId",
    "invoiceNo",
    "invoicePdf",
    "requireHumanFinalSubmit",
  ];
  for (const fieldName of requiredAmazonFields) {
    requireMarker({ findings, lawId, filePath: pagePath, text: pageText, marker: fieldName, checkId: "local-app-shell/amazon-input" });
  }
  requireMarker({ findings, lawId, filePath: pagePath, text: pageText, marker: "data-facebook-form", checkId: "local-app-shell/facebook-input" });
  for (const marker of ["data-video-download-form", "sourcePageUrl", "childCapabilityId", "preferredQuality", "maxMegabytes", "downloadSubtitles"]) {
    requireMarker({ findings, lawId, filePath: pagePath, text: pageText, marker, checkId: "local-app-shell/video-download-input" });
  }
  requireMarker({ findings, lawId, filePath: videoDownloadClientPath, text: videoClientText, marker: "/api/video-download/start", checkId: "local-app-shell/video-download-client" });
  requireMarker({ findings, lawId, filePath: videoDownloadRoutePath, text: videoRouteText, marker: "routeVideoDownloadArtifactJob", checkId: "local-app-shell/video-download-route" });
  requireMarker({ findings, lawId, filePath: videoDownloadRoutePath, text: videoRouteText, marker: "missing_source_page_url", checkId: "local-app-shell/video-download-route" });
  if (/getVideoDownloadAbilityGroup\(\)\.execute/u.test(videoRouteText)) {
    pushFinding(findings, {
      checkId: "local-app-shell/video-download-direct-ability-call",
      lawId,
      filePath: videoDownloadRoutePath,
      message: "Video Download app route must enter mediator and job flow before calling the ability group.",
    });
  }
};

const inspectStatusWindow = (findings: Finding[], lawId: string): void => {
  const pageText = `${readRepoFile(pagePath)}\n${readRepoFile(videoDownloadClientPath)}`;
  for (const marker of ["data-task-status-panel", "data-task-reason", "data-evidence-ref", "data-raw-result"]) {
    requireMarker({ findings, lawId, filePath: pagePath, text: pageText, marker, checkId: "local-app-shell/status-window" });
  }
  requireMarker({ findings, lawId, filePath: videoDownloadClientPath, text: pageText, marker: "reviewRequiredReason", checkId: "local-app-shell/video-download-status" });
};

const inspectForbiddenPageTerms = (findings: Finding[], lawId: string): void => {
  const pageText = `${readRepoFile(pagePath)}\n${readRepoFile(clientPath)}\n${readRepoFile(videoDownloadClientPath)}\n${readRepoFile(stylesPath)}`;
  const forbiddenPatterns = [
    /universal mission dashboard/iu,
    /commander console/iu,
    /visual runtime control/iu,
    /next[- ]action|action plan/iu,
    /data-browser-control|data-dom-control/iu,
  ] as const;
  const matchedPattern = forbiddenPatterns.find((pattern) => pattern.test(pageText));
  if (!matchedPattern) {
    return;
  }
  pushFinding(findings, {
    checkId: "local-app-shell/forbidden-dashboard",
    lawId,
    filePath: pagePath,
    message: "Local app shell contains forbidden dashboard, planner, or control surface.",
    evidence: String(matchedPattern),
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
      if (targetPath.startsWith("src/plugins/") && !publicPluginFacadePathPattern.test(targetPath)) {
        pushFinding(findings, {
          checkId: "local-app-shell/private-plugin-import",
          lawId,
          filePath: repoPath,
          message: `${repoPath} imports plugin-owned code outside the plugin public facade.`,
          evidence: targetPath,
        });
      }
      if (targetPath.startsWith("src/capabilities/") && !publicCapabilityFacadePathPattern.test(targetPath)) {
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
  const findings: Finding[] = [];

  inspectAstProjectAccess(context, findings, boundaryLawId);
  inspectRootSurface(findings, surfaceLawId);
  inspectJobInputs(findings, inputLawId);
  inspectStatusWindow(findings, statusLawId);
  inspectForbiddenPageTerms(findings, boundaryLawId);
  inspectAppImports(context, findings, boundaryLawId);
  inspectLocalRuntimeImports(context, findings, boundaryLawId);

  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,
    findings,
    inspectedFiles: [pagePath, clientPath, videoDownloadClientPath, videoDownloadRoutePath, stylesPath, serverPath, inspectorPath],
  };
};
