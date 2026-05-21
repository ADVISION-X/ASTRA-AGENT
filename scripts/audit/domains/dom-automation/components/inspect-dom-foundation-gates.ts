import { readFileSync } from "node:fs";

import type { InspectorContext } from "../../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../../shared/paths.js";
import type { DomFindingCollector } from "./dom-inspector-support.js";

type FoundationFinding = {
  checkId: string;
  lawId: string;
  message: string;
  filePath?: string;
  evidence?: string;
};

type FoundationReport = {
  findings?: FoundationFinding[];
};

const loadFoundationFindings = (reportPath: string): FoundationFinding[] => {
  const raw = JSON.parse(readFileSync(resolveFromRepo(reportPath), "utf8")) as FoundationReport;
  return raw.findings ?? [];
};

export const inspectDomFoundationGates = (context: InspectorContext, collector: DomFindingCollector): void => {
  const codePurity = context.completedReports["code-purity"];
  if (!codePurity || codePurity.status === "PASS") return;
  const domFindings = loadFoundationFindings(codePurity.reportPath)
    .filter((finding) => finding.filePath?.startsWith("src/capabilities/dom-automation/")
      || finding.filePath?.startsWith("scripts/audit/domains/dom-automation/"));
  for (const finding of domFindings) {
    collector.push({
      checkId: "dom/foundation-code-purity-gate",
      lawId: "APEX-DOM-013-V1",
      evidence: finding.checkId,
      message: `DOM cannot claim readiness while code-purity reports: ${finding.message}`,
      ...(finding.filePath ? { filePath: finding.filePath } : {}),
    });
  }
};
