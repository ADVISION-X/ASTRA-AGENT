import { existsSync, readFileSync } from "node:fs";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorFinding } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";

const staleCodePurityTextReportPath = ".audit-code-purity.txt";

export const pushStaleCodePurityTextReportFindings = (
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  chainLawId: string,
): void => {
  inspectedFiles.add(staleCodePurityTextReportPath);
  if (!existsSync(resolveFromRepo(staleCodePurityTextReportPath))) {
    return;
  }
  findings.push(
    createFinding({
      checkId: "audit-system/stale-code-purity-text-report",
      lawId: chainLawId,
      filePath: staleCodePurityTextReportPath,
      message: `${staleCodePurityTextReportPath} is a retired standalone code-purity report surface; CI-FULL must use the generated-plan code-purity report only.`,
      evidence: readFileSync(resolveFromRepo(staleCodePurityTextReportPath), "utf8").trim(),
    }),
  );
};
