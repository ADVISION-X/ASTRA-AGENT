import { readTextFile } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";

import { kernelInspectionConstants } from "./inspection-constants.js";

type ChildContractRow = {
  childContract: string;
  parentOwner: string;
  activeOwner: string;
  inspectorOwner: string;
};

const EXPECTED_CHILD_CONTRACT_ROWS: ChildContractRow[] = [
  { childContract: "local-ai-runtime", parentOwner: "ai-capability", activeOwner: "否", inspectorOwner: "ai-capability" },
  { childContract: "local-browser-session", parentOwner: "open-capability", activeOwner: "否", inspectorOwner: "open-capability" },
  { childContract: "local-app-shell", parentOwner: "commander-console-capability", activeOwner: "否", inspectorOwner: "commander-console-capability" },
  { childContract: "startup-entrypoint", parentOwner: "commander-console-capability", activeOwner: "否", inspectorOwner: "commander-console-capability" },
  { childContract: "structured-logging", parentOwner: "forensics-persistence-capability / capability-group-governance", activeOwner: "否", inspectorOwner: "forensics-persistence-capability" },
  { childContract: "local-persistence-schema", parentOwner: "forensics-persistence-capability", activeOwner: "否", inspectorOwner: "forensics-persistence-capability" },
  { childContract: "platform-action", parentOwner: "open-capability", activeOwner: "否", inspectorOwner: "open-capability" },
  { childContract: "code-topology", parentOwner: "capability-group-governance", activeOwner: "否", inspectorOwner: "capability-group-governance" },
  { childContract: "code-purity", parentOwner: "audit-system", activeOwner: "否", inspectorOwner: "audit-system" },
] as const;

const {
  BLUEPRINT_FILE,
  REQUIREMENT_ID_BLUEPRINT_007_001,
} = kernelInspectionConstants;

const createRequirementFinding = (detail: string): Finding => createFinding({
  lawId: REQUIREMENT_ID_BLUEPRINT_007_001,
  file: BLUEPRINT_FILE,
  line: 1,
  severity: "fatal",
  message: "Frozen baseline child-contract ownership table must match the governed parent-owner mapping.",
  detail,
});

const extractChildContractTableLines = (content: string): string[] => {
  const lines = content.split(/\r?\n/);
  const headingIndex = lines.findIndex((line) => line.trim() === "## 子契约归属表");
  if (headingIndex === -1) {
    return [];
  }

  const tableLines: string[] = [];
  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    const line = lines[index]?.trim() ?? "";
    if (line.startsWith("## ")) {
      break;
    }
    if (line) {
      tableLines.push(line);
    }
  }

  return tableLines;
};

const parseChildContractLine = (line: string): ChildContractRow | null => {
  if (!line.startsWith("|")) {
    return null;
  }

  const cells = line.split("|").map((cell) => cell.trim()).filter((cell) => cell.length > 0);
  if (cells.length !== 4 || cells[0] === "子契约" || cells[0] === "---") {
    return null;
  }

  return {
    childContract: cells[0]!,
    parentOwner: cells[1]!,
    activeOwner: cells[2]!,
    inspectorOwner: cells[3]!,
  };
};

const parseChildContractTable = (content: string): ChildContractRow[] => {
  return extractChildContractTableLines(content)
    .map((line) => parseChildContractLine(line))
    .filter((row): row is ChildContractRow => row !== null);
};

const serializeRows = (rows: readonly ChildContractRow[]): string[] => rows.map((row) => [
  row.childContract,
  row.parentOwner,
  row.activeOwner,
  row.inspectorOwner,
].join(" | "));

const collectChildContractTableFindings = (actualRows: ChildContractRow[]): Finding[] => {
  const actual = serializeRows(actualRows);
  const expected = serializeRows(EXPECTED_CHILD_CONTRACT_ROWS);
  const missing = expected.filter((row) => !actual.includes(row));
  const unexpected = actual.filter((row) => !expected.includes(row));

  return missing.length === 0 && unexpected.length === 0 && actual.length === expected.length
    ? []
    : [createRequirementFinding([
        missing.length > 0 ? `missing: ${missing.join(", ")}` : null,
        unexpected.length > 0 ? `unexpected: ${unexpected.join(", ")}` : null,
        actual.length !== expected.length ? `count=${actual.length}, expected=${expected.length}` : null,
      ].filter(Boolean).join("; "))];
};

export async function runChildContractGovernanceChecks(): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> {
  const content = await readTextFile(pathFromRepoRoot(BLUEPRINT_FILE));
  const findings = collectChildContractTableFindings(parseChildContractTable(content));

  return {
    findings,
    phases: [
      createPhase(
        "child-contract-ownership-table",
        findings.length === 0 ? "PASS" : "CODE VIOLATION",
        findings.length === 0,
        findings.length === 0
          ? "Frozen baseline child-contract ownership table matches the governed parent-owner mapping."
          : "Frozen baseline child-contract ownership table drifted away from the governed parent-owner mapping.",
      ),
    ],
  };
}