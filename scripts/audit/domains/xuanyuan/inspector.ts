import { existsSync, readFileSync } from "node:fs";

import { SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../shared/finding-utils.js";
import { executedChecksForPlan, type InspectorContext, type InspectorFinding, type InspectorOutput } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";

const pluginFiles = [
  "src/plugins/xuanyuan/index.ts",
  "src/plugins/xuanyuan/xuanyuan.schema.ts",
  "src/plugins/xuanyuan/xuanyuan.flow.ts",
] as const;
const sourcePaths = [
  "src/app/workbench-api-boundary.ts",
  "src/app/create-workbench-server.ts",
  "src/lib/local-runtime/workbench-handle.ts",
  "src/lib/local-runtime/workbench.ts",
  "src/app/workbench-xuanyuan-routes.ts",
  ...pluginFiles,
] as const;
const inspectedFiles = [
  ".github/instructions/agent-rules/modules/module-xuanyuan.instructions.md",
  "docs/法案辅助文件/GrassEye Xuanyuan API 临时实现施工图.md",
  "scripts/audit/domains/xuanyuan/manifest.json",
  "scripts/audit/domains/xuanyuan/inspector.ts",
  "scripts/acceptance/xuanyuan.acceptance.ts",
  "package.json",
  ...sourcePaths,
] as const;

const sourceFile = (context: InspectorContext, repoPath: string): SourceFile | undefined =>
  context.project.getSourceFile(resolveFromRepo(repoPath));

const sourceValues = (files: readonly SourceFile[]): Set<string> =>
  new Set(files.flatMap((file) => [
    ...file.getDescendantsOfKind(SyntaxKind.Identifier).map((node) => String(node.compilerNode.escapedText)),
    ...file.getDescendantsOfKind(SyntaxKind.StringLiteral).map((node) => node.getLiteralText()),
    ...file.getDescendantsOfKind(SyntaxKind.PropertyAssignment).map((node) => node.getName()),
  ]));

const collectSources = (
  context: InspectorContext,
  findings: InspectorFinding[],
  lawId: string,
): SourceFile[] => sourcePaths.flatMap((repoPath) => {
    const file = sourceFile(context, repoPath);
    if (file) return [file];
    findings.push(createFinding({
      checkId: "xuanyuan/file-present",
      lawId,
      filePath: repoPath,
      message: `${repoPath} must exist in the audit project.`,
    }));
    return [];
  });

const inspectRequiredPaths = (findings: InspectorFinding[], lawId: string): void => {
  for (const repoPath of inspectedFiles) {
    if (!repoPath.endsWith(".ts") && !existsSync(resolveFromRepo(repoPath))) {
      findings.push(createFinding({
        checkId: "xuanyuan/file-present",
        lawId,
        filePath: repoPath,
        message: `${repoPath} must exist.`,
      }));
    }
  }
};

const inspectAstContract = (files: readonly SourceFile[], findings: InspectorFinding[], lawId: string): void => {
  const values = sourceValues(files);
  const requiredValues = [
    "XUANYUAN_JOB_ID",
    "gpt-web-chat",
    "promptPackageSnapshot",
    "aiInputGateway",
    "providerProof",
    "rawResponseText",
    "response_captured",
    "transportWarnings",
    "/api/xuanyuan/simulate",
    "/api/xuanyuan/status",
    "/api/xuanyuan/latest",
    "/api/xuanyuan/history",
  ];
  const missing = requiredValues.filter((value) => !values.has(value));
  if (missing.length > 0) {
    findings.push(createFinding({
      checkId: "xuanyuan/ast-contract",
      lawId,
      filePath: pluginFiles[2],
      message: `Xuanyuan AST contract is missing ${missing.join(", ")}.`,
    }));
  }
};

const inspectForbiddenImports = (context: InspectorContext, findings: InspectorFinding[], lawId: string): void => {
  for (const repoPath of pluginFiles) {
    const file = sourceFile(context, repoPath);
    for (const declaration of file?.getImportDeclarations() ?? []) {
      const importedPath = declaration.getModuleSpecifierValue();
      if (["ai-input-gateway/providers", "lib/browser", "dom-automation", "openai", "gemini", "chatgpt"].some((part) => importedPath.includes(part))) {
        findings.push(createFinding({
          checkId: "xuanyuan/forbidden-provider-import",
          lawId,
          filePath: repoPath,
          message: `${repoPath} must not import ${importedPath}.`,
        }));
      }
    }
  }
};

const inspectPackageScripts = (findings: InspectorFinding[], lawId: string): void => {
  const packageJson = JSON.parse(readFileSync(resolveFromRepo("package.json"), "utf8")) as {
    scripts?: Record<string, string>;
  };
  for (const scriptName of ["acceptance:xuanyuan", "audit:xuanyuan"]) {
    if (!packageJson.scripts?.[scriptName]) {
      findings.push(createFinding({
        checkId: "xuanyuan/package-script",
        lawId,
        filePath: "package.json",
        message: `package.json must expose ${scriptName}.`,
      }));
    }
  }
};

export const inspectDomain = async (context: InspectorContext): Promise<InspectorOutput> => {
  const lawId = context.planEntry.lawIds[0] ?? "GRASSEYE-XUANYUAN-001-V1";
  const findings: InspectorFinding[] = [];
  const files = collectSources(context, findings, lawId);
  inspectRequiredPaths(findings, lawId);
  inspectAstContract(files, findings, lawId);
  inspectForbiddenImports(context, findings, lawId);
  inspectPackageScripts(findings, lawId);
  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,
    executedChecks: executedChecksForPlan(context),
    findings,
    inspectedFiles: [...inspectedFiles],
  };
};
