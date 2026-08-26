import type { InspectorFinding } from "../../shared/inspector-contracts.js";
import { clauseIdForLaw, createFinding } from "../../shared/finding-utils.js";
import type { RuntimeLogSpineFinding } from "./constants.js";

export const toInspectorFinding = (finding: RuntimeLogSpineFinding): InspectorFinding => createFinding({ evidenceMode: "static.ast",
  checkId: finding.checkId,
  lawId: finding.lawId,
  clauseId: clauseIdForLaw(finding.lawId),
  message: finding.message,
  line: finding.line,
  severity: finding.severity,
  hint: finding.hint,
  filePath: finding.file,
});
