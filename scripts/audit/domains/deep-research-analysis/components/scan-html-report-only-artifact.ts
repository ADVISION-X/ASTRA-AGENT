import { readFileSync } from "node:fs";

import { SyntaxKind, type SourceFile } from "ts-morph";
import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../../shared/paths.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";

const decode = (value: string): string => Buffer.from(value, "base64").toString("utf8");
const hasRepoText = (repoPath: string, value: string): boolean => readFileSync(resolveFromRepo(repoPath), "utf8").includes(value);

export const inspectHtmlReportOnlyArtifact = (input: {
  sourceFiles: readonly SourceFile[];
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
}): void => {
  for (const sourceFile of input.sourceFiles) {
    const repoPath = getRepoSourcePath(sourceFile);
    input.inspectedFiles.add(repoPath);
    const strings = sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral).map((literal) => literal.getLiteralValue().toLowerCase());
    const identifiers = sourceFile.getDescendantsOfKind(SyntaxKind.Identifier).map((identifier) => identifier.getText());
    const hasForbiddenArtifact = strings.some((value) => value.includes(decode("LnBwdA==")) || value.includes(decode("YnVzaW5lc3MtZGVjaw==")))
      || identifiers.some((value) => value === decode("YnVzaW5lc3NEZWNr") || value === decode("cHB0eEV4cG9ydA=="));
    if (!hasForbiddenArtifact) continue;
    input.findings.push(createFinding({
      checkId: "deep-research/html-only-final-artifact",
      lawId: input.lawId,
      filePath: repoPath,
      message: "Deep Research final artifact surface must only expose business-report.html.",
    }));
  }

  const repoChecks = [
    { ok: hasRepoText("src/plugins/deep-research-analysis/deep-research-analysis.record-contracts.ts", "business-report.html"), filePath: "src/plugins/deep-research-analysis/deep-research-analysis.record-contracts.ts", message: "Record contracts must expose business-report.html." },
    { ok: hasRepoText("src/app/workbench-deep-research-routes.ts", "business-report.html"), filePath: "src/app/workbench-deep-research-routes.ts", message: "Workbench routes must allow business-report.html." },
    { ok: hasRepoText("src/app/workbench-deep-research-report-view.ts", "data-deep-research-primary-business-report"), filePath: "src/app/workbench-deep-research-report-view.ts", message: "Report view must expose the primary business report section." },
    { ok: hasRepoText("src/app/workbench-deep-research-client-delivery-sections.ts", "Open HTML Report") && hasRepoText("src/app/workbench-deep-research-client-delivery-sections.ts", "Download HTML Report"), filePath: "src/app/workbench-deep-research-client-delivery-sections.ts", message: "Client delivery sections must expose HTML report actions." },
    { ok: hasRepoText("scripts/acceptance/deep-research-html-report-only.acceptance.ts", "deep-research-html-report-only"), filePath: "scripts/acceptance/deep-research-html-report-only.acceptance.ts", message: "HTML-report-only acceptance must exist." },
    { ok: hasRepoText("scripts/audit/ci-full.ts", "acceptance:deep-research-html-report-only"), filePath: "scripts/audit/ci-full.ts", message: "ci:full must execute acceptance:deep-research-html-report-only." },
  ];
  for (const check of repoChecks) {
    input.inspectedFiles.add(check.filePath);
    if (check.ok) {
      continue;
    }
    input.findings.push(createFinding({
      checkId: "deep-research/html-only-final-artifact-required-surface",
      lawId: input.lawId,
      filePath: check.filePath,
      message: check.message,
    }));
  }
};
