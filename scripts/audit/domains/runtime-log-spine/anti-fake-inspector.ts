import { SyntaxKind } from "ts-morph";

import type { InspectorContext } from "../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../shared/source-files.js";
import { RuntimeLogSpineLaw, type RuntimeLogSpineFinding } from "./constants.js";

const governedInspectorPattern = /^scripts\/audit\/domains\/(?:runtime-log-spine|facebook-product-video-mining-log-coverage)\/inspector\.ts$/u;

export const collectAntiFakeInspectorFindings = (context: InspectorContext): {
  findings: RuntimeLogSpineFinding[];
  inspectedFiles: string[];
} => {
  const findings: RuntimeLogSpineFinding[] = [];
  const inspectedFiles: string[] = [];

  for (const sourceFile of context.project.getSourceFiles()) {
    const repoPath = getRepoSourcePath(sourceFile);
    if (!governedInspectorPattern.test(repoPath)) continue;
    inspectedFiles.push(repoPath);
    const text = sourceFile.getText();
    const hasEmptyFindingsLiteral = /findings\s*:\s*\[\s*\]/u.test(text);
    const hasEmptyInspectedFilesLiteral = /inspectedFiles\s*:\s*\[\s*\]/u.test(text);
    const readsSourceFiles = /getSourceFiles|SourceFile|collect[A-Z]\w+/u.test(text);
    const writesReport = /write[A-Z]\w*Report|reportJson|reportMarkdown/u.test(text);
    const detectionFunctions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).filter((call) => /collect[A-Z]|write[A-Z]|render[A-Z]/u.test(call.getExpression().getText()));

    if ((!readsSourceFiles && detectionFunctions.length === 0) || !writesReport || (hasEmptyFindingsLiteral && hasEmptyInspectedFilesLiteral)) {
      findings.push({
        checkId: "runtime-log-spine/anti-fake-inspector",
        lawId: RuntimeLogSpineLaw.COVERAGE_REPORT,
        file: repoPath,
        line: 1,
        severity: "fatal",
        message: "inspector is a no-op shell returning empty findings and inspectedFiles",
        hint: "Replace no-op inspector with AST/symbol implementation and generated coverage report.",
      });
    }
  }

  return { findings, inspectedFiles };
};
