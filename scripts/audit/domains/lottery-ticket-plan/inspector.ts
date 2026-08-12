import { existsSync, readFileSync } from "node:fs";

import { SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding, SessionInspectorOutput } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";

const pluginFiles = [
  "src/plugins/lottery-ticket-plan/index.ts",
  "src/plugins/lottery-ticket-plan/lottery-ticket-plan.schema.ts",
  "src/plugins/lottery-ticket-plan/lottery-ticket-plan.flow.ts",
] as const;
const appFiles = [
  "src/app/app-shell/lottery-ticket-plan-workspace.ts",
  "src/app/workbench-home-lottery-ticket-plan-client.ts",
  "src/app/workbench-lottery-ticket-plan-routes.ts",
  "src/lib/local-runtime/workbench-lottery-ticket-plan-support.ts",
] as const;
const inspectedFileList = [
  ".github/instructions/agent-rules/modules/module-lottery-ticket-plan.instructions.md",
  "docs/法案辅助文件/GrassEye Lottery Ticket Plan 施工图.md",
  "scripts/audit/domains/lottery-ticket-plan/manifest.json",
  "scripts/audit/domains/lottery-ticket-plan/inspector.ts",
  "scripts/acceptance/lottery-ticket-plan.acceptance.ts",
  "package.json",
  ...pluginFiles,
  ...appFiles,
] as const;

const sourceFile = (context: InspectorContext, repoPath: string): SourceFile | undefined =>
  context.project.getSourceFile(resolveFromRepo(repoPath));

const sourceValues = (files: readonly SourceFile[]): Set<string> =>
  new Set(files.flatMap((file) => [
    ...file.getDescendantsOfKind(SyntaxKind.Identifier).map((node) => String(node.compilerNode.escapedText)),
    ...file.getDescendantsOfKind(SyntaxKind.StringLiteral).map((node) => node.getLiteralText()),
    ...file.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral).map((node) => node.getLiteralText()),
    ...file.getDescendantsOfKind(SyntaxKind.PropertyAssignment).map((node) => node.getName()),
  ]));

const collectSources = (
  context: InspectorContext,
  findings: InspectorFinding[],
  lawId: string,
  sourcePaths: readonly string[],
): SourceFile[] => sourcePaths.flatMap((repoPath) => {
    const file = sourceFile(context, repoPath);
    if (file) return [file];
    findings.push(createFinding({
      checkId: "lottery-ticket-plan/file-present",
      lawId,
      filePath: repoPath,
      message: `${repoPath} must exist in the audit project.`,
    }));
    return [];
  });

const inspectRequiredPaths = (findings: InspectorFinding[], lawId: string): void => {
  for (const repoPath of inspectedFileList) {
    if (!repoPath.endsWith(".ts") && !existsSync(resolveFromRepo(repoPath))) {
      findings.push(createFinding({
        checkId: "lottery-ticket-plan/file-present",
        lawId,
        filePath: repoPath,
        message: `${repoPath} must exist.`,
      }));
    }
  }
};

const inspectAstContract = (values: ReadonlySet<string>, findings: InspectorFinding[], lawId: string): void => {
  const missing = ["bucketDigits", "manualPurchaseOnly", "ticketHash", "tickets"]
    .filter((value) => !values.has(value));
  if (missing.length > 0) {
    findings.push(createFinding({
      checkId: "lottery-ticket-plan/ast-contract",
      lawId,
      filePath: pluginFiles[2],
      message: `Lottery plan AST contract is missing ${missing.join(", ")}.`,
    }));
  }
};

const inspectNoPurchaseRuntime = (values: ReadonlySet<string>, findings: InspectorFinding[], lawId: string): void => {
  const forbiddenValues = ["theuaelottery", "My Plan", "checkout", "payment", "localStorage", "cookie"];
  const forbidden = forbiddenValues.find((value) => values.has(value));
  if (forbidden) {
    findings.push(createFinding({
      checkId: "lottery-ticket-plan/no-purchase-runtime",
      lawId,
      filePath: pluginFiles[2],
      message: `Lottery plan runtime must not expose purchase surface ${forbidden}.`,
    }));
  }
};

const inspectForbiddenImports = (context: InspectorContext, findings: InspectorFinding[], lawId: string): void => {
  const sourcePaths = [...pluginFiles, ...appFiles];
  for (const repoPath of sourcePaths) {
    const file = sourceFile(context, repoPath);
    for (const declaration of file?.getImportDeclarations() ?? []) {
      const importedPath = declaration.getModuleSpecifierValue();
      if (["pick3-is-blind-eval", "dom-automation", "lib/browser", "ai-input-gateway"].some((part) => importedPath.includes(part))) {
        findings.push(createFinding({
          checkId: "lottery-ticket-plan/forbidden-import",
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
  for (const scriptName of ["acceptance:lottery-ticket-plan", "audit:lottery-ticket-plan"]) {
    if (!packageJson.scripts?.[scriptName]) {
      findings.push(createFinding({
        checkId: "lottery-ticket-plan/package-script",
        lawId,
        filePath: "package.json",
        message: `package.json must expose ${scriptName}.`,
      }));
    }
  }
};

const inspectDomainEvaluation = (context: InspectorContext, lawId: string) => {
  const findings: InspectorFinding[] = [];
  const files: SourceFile[] = collectSources(context, findings, lawId, [...pluginFiles, ...appFiles]);
  inspectRequiredPaths(findings, lawId);
  const values = sourceValues(files);
  inspectAstContract(values, findings, lawId);
  inspectNoPurchaseRuntime(values, findings, lawId);
  inspectForbiddenImports(context, findings, lawId);
  inspectPackageScripts(findings, lawId);
  return { evidenceRefs: [...inspectedFileList, "package.json"], findings };
};

export const inspectDomain = async (context: InspectorContext): Promise<SessionInspectorOutput> => {
  if (!context.checks) throw new Error("lottery-ticket-plan requires a runner-owned check session.");
  const lawId = context.planEntry.lawIds[0] ?? "GRASSEYE-LOTTERY-TICKET-PLAN-001-V1";
  const evaluation = await context.checks.runAll(() => {
    const ownerEvaluation = inspectDomainEvaluation(context, lawId);
    return { findings: ownerEvaluation.findings, evidenceRefs: ownerEvaluation.evidenceRefs };
  });
  const findings = evaluation.findings;
  return context.checks.output({
    reportJson: { generatedAt: new Date().toISOString(), status: findings.length === 0 ? "PASS" : "FAIL", findings },
  });
};
