import { existsSync, readFileSync } from "node:fs";

import type { SourceFile } from "ts-morph";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding, InspectorOutput } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";

const lawPath = ".github/instructions/agent-rules/modules/module-lottery-ticket-plan.instructions.md";
const blueprintPath = "docs/法案辅助文件/GrassEye Lottery Ticket Plan 施工图.md";
const manifestPath = "scripts/audit/domains/lottery-ticket-plan/manifest.json";
const inspectorPath = "scripts/audit/domains/lottery-ticket-plan/inspector.ts";
const acceptancePath = "scripts/acceptance/lottery-ticket-plan.acceptance.ts";
const packagePath = "package.json";
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
  lawPath,
  blueprintPath,
  manifestPath,
  inspectorPath,
  acceptancePath,
  packagePath,
  ...pluginFiles,
  ...appFiles,
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
      addFinding(findings, lawId, filePath, "lottery-ticket-plan/required-marker", `${filePath} must contain ${marker}.`);
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
  for (const repoPath of [...pluginFiles, ...appFiles]) {
    const sourceFile = sourceFileFor(context, repoPath);
    if (!sourceFile) continue;
    for (const declaration of sourceFile.getImportDeclarations()) {
      const importedPath = declaration.getModuleSpecifierValue();
      if (
        importedPath.includes("pick3-is-blind-eval")
        || importedPath.includes("dom-automation")
        || importedPath.includes("lib/browser")
        || importedPath.includes("ai-input-gateway")
      ) {
        addFinding(
          findings,
          lawId,
          repoPath,
          "lottery-ticket-plan/forbidden-import",
          `${repoPath} must not import ${importedPath}.`,
        );
      }
    }
  }
};

const inspectRuntimeMarkers = (
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const pluginText = pluginFiles.map(readText).join("\n");
  requireText(findings, lawId, "src/plugins/lottery-ticket-plan/lottery-ticket-plan.flow.ts", pluginText, [
    "bucketDigits",
    "upper: [5, 6, 7, 8, 9]",
    "lower: [0, 1, 2, 3, 4]",
    "manualPurchaseOnly: true",
    "ticketHash",
    "tickets.length",
  ]);
  for (const forbidden of ["theuaelottery", "My Plan", "checkout", "payment", "localStorage", "cookie"]) {
    if (pluginText.includes(forbidden)) {
      addFinding(findings, lawId, "src/plugins/lottery-ticket-plan", "lottery-ticket-plan/no-purchase-runtime", `Runtime must not contain ${forbidden}.`);
    }
  }
};

export const inspectDomain = async (context: InspectorContext): Promise<InspectorOutput> => {
  const lawId = context.planEntry.lawIds[0] ?? "GRASSEYE-LOTTERY-TICKET-PLAN-001-V1";
  const findings: InspectorFinding[] = [];
  for (const repoPath of inspectedFileList) {
    if (!existsRepo(repoPath)) {
      addFinding(findings, lawId, repoPath, "lottery-ticket-plan/file-present", `${repoPath} must exist.`);
    }
  }
  requireText(findings, lawId, lawPath, readText(lawPath), [
    "\"capabilityDomain\": \"lottery-ticket-plan\"",
    "GRASSEYE-LOTTERY-TICKET-PLAN-001-V1",
    "No betting-site DOM automation",
    "No writing to official site `My Plan`",
  ]);
  requireText(findings, lawId, blueprintPath, readText(blueprintPath), [
    "## Local Plan Boundary",
    "## Plugin File Plan",
    "## App Shell Surface",
    "## QA Plan",
  ]);
  requireText(findings, lawId, packagePath, readText(packagePath), [
    "acceptance:lottery-ticket-plan",
    "audit:lottery-ticket-plan",
  ]);
  requireText(findings, lawId, appFiles[0], readText(appFiles[0]), [
    "data-skill-workspace=\"lottery-ticket-plan\"",
    "data-lottery-ticket-plan-form",
    "data-lottery-ticket-plan-list",
    "Manual purchase only",
  ]);
  inspectRuntimeMarkers(findings, lawId);
  inspectForbiddenImports(context, findings, lawId);
  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,
    findings,
    inspectedFiles: [...inspectedFileList],
  };
};
