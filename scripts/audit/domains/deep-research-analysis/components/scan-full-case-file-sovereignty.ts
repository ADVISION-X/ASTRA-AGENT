import { existsSync, readFileSync } from "node:fs";

import { SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../../shared/paths.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";

const fileExists = (repoPath: string): boolean => existsSync(resolveFromRepo(repoPath));
const hasRepoText = (repoPath: string, value: string): boolean => readFileSync(resolveFromRepo(repoPath), "utf8").includes(value);
const hasCiFullAcceptance = (acceptanceScript: string): boolean =>
  hasRepoText("scripts/audit/ci-full.ts", acceptanceScript)
  || hasRepoText("scripts/audit/ci-full-phase-plan.ts", acceptanceScript);
const hasIdentifier = (sourceFile: SourceFile | undefined, value: string): boolean =>
  Boolean(sourceFile?.getDescendantsOfKind(SyntaxKind.Identifier).some((identifier) => identifier.getText() === value));

type FullCaseFileInspectionInput = {
  finalAdjudicationPromptFile: SourceFile | undefined;
  htmlReportPromptFile: SourceFile | undefined;
  fullCaseFileFile: SourceFile | undefined;
  exportFile: SourceFile | undefined;
  recordContractsFile: SourceFile | undefined;
  recordInteractionOpsFile: SourceFile | undefined;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
};

const inspectRequiredFullCaseFiles = (input: FullCaseFileInspectionInput): void => {
  const required = [
    "src/plugins/deep-research-analysis/deep-research-analysis.full-case-file.ts",
    "src/plugins/deep-research-analysis/deep-research-analysis.full-case-file.ts",
    "src/plugins/deep-research-analysis/deep-research-analysis.full-case-file.ts",
  ];
  for (const repoPath of required) {
    input.inspectedFiles.add(repoPath);
    if (fileExists(repoPath)) continue;
    input.findings.push(createFinding({
      checkId: "deep-research/full-case-file-required-file",
      lawId: input.lawId,
      filePath: repoPath,
      message: `${repoPath} is required.`,
    }));
  }
};

const inspectFullCaseFileSourceChecks = (input: FullCaseFileInspectionInput): void => {
  for (const sourceFile of [
    input.finalAdjudicationPromptFile,
    input.htmlReportPromptFile,
    input.fullCaseFileFile,
    input.exportFile,
    input.recordContractsFile,
    input.recordInteractionOpsFile,
  ]) {
    if (sourceFile) input.inspectedFiles.add(getRepoSourcePath(sourceFile));
  }

  const checks = [
    { ok: hasIdentifier(input.finalAdjudicationPromptFile, "fullCaseFile"), filePath: "src/plugins/deep-research-analysis/deep-research-analysis.prompts.ts", message: "Final adjudication prompt must include fullCaseFile." },
    { ok: hasIdentifier(input.htmlReportPromptFile, "fullCaseFile"), filePath: "src/plugins/deep-research-analysis/deep-research-analysis.prompts.ts", message: "HTML report prompt must include fullCaseFile." },
    { ok: hasIdentifier(input.fullCaseFileFile, "rawResponseText") && hasIdentifier(input.fullCaseFileFile, "renderedPromptText"), filePath: "src/plugins/deep-research-analysis/deep-research-analysis.full-case-file.ts", message: "Full case file must include rawResponseText and renderedPromptText." },
    { ok: hasIdentifier(input.exportFile, "saveFullCaseFileExports") && hasIdentifier(input.exportFile, "fullCaseFileExports"), filePath: "src/plugins/deep-research-analysis/deep-research-analysis.export-artifacts.ts", message: "Exports must include both full case file artifacts." },
    { ok: hasIdentifier(input.recordContractsFile, "renderedPromptText") && hasIdentifier(input.recordContractsFile, "rawResponseText") && hasIdentifier(input.recordContractsFile, "rawResponseHash") && hasIdentifier(input.recordContractsFile, "parseStatus"), filePath: "src/plugins/deep-research-analysis/deep-research-analysis.records.ts", message: "Interaction contracts must preserve raw prompt/response evidence." },
    { ok: hasIdentifier(input.recordInteractionOpsFile, "createInteraction") && hasIdentifier(input.recordInteractionOpsFile, "rawResponseText") && hasIdentifier(input.recordInteractionOpsFile, "rawResponseHash") && hasIdentifier(input.recordInteractionOpsFile, "parseStatus"), filePath: "src/plugins/deep-research-analysis/deep-research-analysis.record-interaction-ops.ts", message: "Interaction persistence must preserve raw prompt/response evidence." },
  ] as const;
  for (const check of checks) {
    if (check.ok) continue;
    input.findings.push(createFinding({
      checkId: "deep-research/full-case-file-sovereignty",
      lawId: input.lawId,
      filePath: check.filePath,
      message: check.message,
    }));
  }
};

const inspectFullCaseFileRepoSurfaces = (input: FullCaseFileInspectionInput): void => {
  input.inspectedFiles.add("scripts/audit/ci-full.ts");
  input.inspectedFiles.add("scripts/audit/ci-full-phase-plan.ts");
  const repoChecks = [
    { ok: hasRepoText("src/app/workbench-deep-research-routes.ts", "full-case-file.md") && hasRepoText("src/app/workbench-deep-research-routes.ts", "full-case-file.json"), filePath: "src/app/workbench-deep-research-routes.ts", message: "Workbench routes must allow both full case file artifacts." },
    { ok: hasRepoText("src/app/workbench-deep-research-report-view.ts", "data-deep-research-full-case-file"), filePath: "src/app/workbench-deep-research-report-view.ts", message: "Report view must expose the Full Case File section." },
    { ok: hasRepoText("src/app/workbench-deep-research-client-delivery-sections.ts", "Open Full Case File") && hasRepoText("src/app/workbench-deep-research-client-delivery-sections.ts", "Download full-case-file.json"), filePath: "src/app/workbench-deep-research-client-delivery-sections.ts", message: "Client delivery sections must expose full case file actions." },
    { ok: hasRepoText("scripts/acceptance/deep-research-full-case-file.acceptance.ts", "deep-research-full-case-file"), filePath: "scripts/acceptance/deep-research-full-case-file.acceptance.ts", message: "Full-case-file acceptance must exist." },
    { ok: hasCiFullAcceptance("acceptance:deep-research-full-case-file"), filePath: "scripts/audit/ci-full-phase-plan.ts", message: "ci:full must execute acceptance:deep-research-full-case-file." },
  ] as const;
  for (const check of repoChecks) {
    input.inspectedFiles.add(check.filePath);
    if (check.ok) continue;
    input.findings.push(createFinding({
      checkId: "deep-research/full-case-file-sovereignty-surface",
      lawId: input.lawId,
      filePath: check.filePath,
      message: check.message,
    }));
  }
};

export const inspectFullCaseFileSovereignty = (input: FullCaseFileInspectionInput): void => {
  inspectRequiredFullCaseFiles(input);
  inspectFullCaseFileSourceChecks(input);
  inspectFullCaseFileRepoSurfaces(input);
};
