import { existsSync, readFileSync } from "node:fs";

import type { SourceFile } from "ts-morph";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding, InspectorOutput } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";

const lawPath = ".github/instructions/agent-rules/modules/module-xuanyuan.instructions.md";
const blueprintPath = "docs/法案辅助文件/GrassEye Xuanyuan API 临时实现施工图.md";
const manifestPath = "scripts/audit/domains/xuanyuan/manifest.json";
const inspectorPath = "scripts/audit/domains/xuanyuan/inspector.ts";
const acceptancePath = "scripts/acceptance/xuanyuan.acceptance.ts";
const packagePath = "package.json";
const boundaryPath = "src/app/workbench-api-boundary.ts";
const serverPath = "src/app/create-workbench-server.ts";
const handlePath = "src/lib/local-runtime/workbench-handle.ts";
const runtimePath = "src/lib/local-runtime/workbench.ts";
const routePath = "src/app/workbench-xuanyuan-routes.ts";
const webChatClipboardPath = "src/capabilities/ai-input-gateway/providers/web-chat-clipboard.ts";
const webChatUploadPath = "src/capabilities/ai-input-gateway/providers/web-chat-upload.ts";
const webChatComposerScriptsPath = "src/capabilities/ai-input-gateway/providers/web-chat-composer-scripts.ts";
const pluginFiles = [
  "src/plugins/xuanyuan/index.ts",
  "src/plugins/xuanyuan/xuanyuan.schema.ts",
  "src/plugins/xuanyuan/xuanyuan.flow.ts",
] as const;
const inspectedFileList = [
  lawPath,
  blueprintPath,
  manifestPath,
  inspectorPath,
  acceptancePath,
  packagePath,
  boundaryPath,
  serverPath,
  handlePath,
  runtimePath,
  routePath,
  webChatClipboardPath,
  webChatUploadPath,
  webChatComposerScriptsPath,
  ...pluginFiles,
] as const;

const readText = (repoPath: string): string => readFileSync(resolveFromRepo(repoPath), "utf8");
const existsRepo = (repoPath: string): boolean => existsSync(resolveFromRepo(repoPath));

const addFinding = (
  findings: InspectorFinding[],
  lawId: string,
  filePath: string,
  checkId: string,
  message: string,
): void => {
  findings.push(createFinding({ lawId, filePath, checkId, message }));
};

const requireText = (
  findings: InspectorFinding[],
  lawId: string,
  filePath: string,
  text: string,
  markers: readonly string[],
): void => {
  for (const marker of markers) {
    if (!text.includes(marker)) {
      addFinding(findings, lawId, filePath, "xuanyuan/required-marker", `${filePath} must contain ${marker}.`);
    }
  }
};

const sourceFileFor = (context: InspectorContext, repoPath: string): SourceFile | undefined =>
  context.project.getSourceFile(resolveFromRepo(repoPath));

const inspectForbiddenImports = (
  context: InspectorContext,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  for (const repoPath of pluginFiles) {
    const sourceFile = sourceFileFor(context, repoPath);
    if (!sourceFile) continue;
    for (const declaration of sourceFile.getImportDeclarations()) {
      const importedPath = declaration.getModuleSpecifierValue();
      if (
        importedPath.includes("ai-input-gateway/providers")
        || importedPath.includes("lib/browser")
        || importedPath.includes("dom-automation")
        || importedPath.includes("openai")
        || importedPath.includes("gemini")
        || importedPath.includes("chatgpt")
      ) {
        addFinding(findings, lawId, repoPath, "xuanyuan/forbidden-provider-import", `${repoPath} must not import ${importedPath}.`);
      }
    }
  }
};

const inspectRuntimeMarkers = (
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const pluginText = pluginFiles.map(readText).join("\n");
  requireText(findings, lawId, "src/plugins/xuanyuan", pluginText, [
    "XUANYUAN_JOB_ID",
    "gpt-web-chat",
    "promptPackageSnapshot",
    "aiInputGateway.execute",
    "providerProof",
    "rawResponseText",
    "response_captured",
    "transportWarnings",
  ]);
  for (const forbidden of ["fallback success", "mock production", "provider SDK", "browserCommand"]) {
    if (pluginText.includes(forbidden)) {
      addFinding(findings, lawId, "src/plugins/xuanyuan", "xuanyuan/no-forbidden-runtime-text", `Runtime must not contain ${forbidden}.`);
    }
  }
};

export const inspectDomain = async (context: InspectorContext): Promise<InspectorOutput> => {
  const lawId = context.planEntry.lawIds[0] ?? "GRASSEYE-XUANYUAN-001-V1";
  const findings: InspectorFinding[] = [];
  for (const repoPath of inspectedFileList) {
    if (!existsRepo(repoPath)) {
      addFinding(findings, lawId, repoPath, "xuanyuan/file-present", `${repoPath} must exist.`);
    }
  }
  requireText(findings, lawId, lawPath, readText(lawPath), [
    "\"capabilityDomain\": \"xuanyuan\"",
    "GRASSEYE-XUANYUAN-001-V1",
    "Workbench API Boundary",
    "AI Input Gateway",
  ]);
  requireText(findings, lawId, blueprintPath, readText(blueprintPath), [
    "## Xuanyuan Boundary",
    "## API Flow",
    "## Plugin File Plan",
    "## Route Plan",
    "## QA Plan",
  ]);
  requireText(findings, lawId, packagePath, readText(packagePath), [
    "acceptance:xuanyuan",
    "audit:xuanyuan",
  ]);
  requireText(findings, lawId, boundaryPath, readText(boundaryPath), [
    "/api/xuanyuan/simulate",
    "/api/xuanyuan/status",
    "/api/xuanyuan/latest",
    "/api/xuanyuan/history",
    "jobOwner: \"xuanyuan\"",
    "externalApiAllowed: true",
    "requiresApiKey: true",
  ]);
  requireText(findings, lawId, serverPath, readText(serverPath), [
    "handleXuanyuanRequest",
  ]);
  requireText(findings, lawId, handlePath, readText(handlePath), [
    "startXuanyuanTask",
    "startXuanyuanTaskAsync",
    "getXuanyuanTaskStatus",
    "getLatestXuanyuanTask",
    "listXuanyuanHistory",
  ]);
  inspectRuntimeMarkers(findings, lawId);
  requireText(findings, lawId, webChatClipboardPath, readText(webChatClipboardPath), [
    "tell process \"Finder\"",
    "keystroke \"c\" using command down",
    "keystroke \"v\" using command down",
  ]);
  requireText(findings, lawId, webChatUploadPath, readText(webChatUploadPath), [
    "provider one-file Command+C then Command+V",
    "waitForExactAttachmentCount",
  ]);
  requireText(findings, lawId, webChatComposerScriptsPath, readText(webChatComposerScriptsPath), [
    "buildWaitForExactAttachmentCountScript",
    "result.count === expectedCount",
    "result.count > expectedCount",
  ]);
  inspectForbiddenImports(context, findings, lawId);
  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,
    findings,
    inspectedFiles: [...inspectedFileList],
  };
};
