import { readTextFile } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";

const STANDARD_PACKAGE_BLUEPRINT_FILE = "docs/法案辅助文件/GrassEye_能力组标准包与执法结构统一施工图.md";
const SECTION_23_HEADING = "### 2.3 能力组不得无限膨胀原则";

type SectionRequirement = {
  requirementId: string;
  expectedLine: string;
};

const SECTION_23_REQUIREMENTS: SectionRequirement[] = [
  { requirementId: "K02-BLUEPRINT-02-SECTION-012-REQ-001", expectedLine: "- child capability" },
  { requirementId: "K02-BLUEPRINT-02-SECTION-012-REQ-002", expectedLine: "- execution map" },
  { requirementId: "K02-BLUEPRINT-02-SECTION-012-REQ-003", expectedLine: "- prompt contract" },
  { requirementId: "K02-BLUEPRINT-02-SECTION-012-REQ-004", expectedLine: "- platform profile" },
  { requirementId: "K02-BLUEPRINT-02-SECTION-012-REQ-005", expectedLine: "- policy" },
  { requirementId: "K02-BLUEPRINT-02-SECTION-012-REQ-006", expectedLine: "- inspector rule" },
  { requirementId: "K02-BLUEPRINT-02-SECTION-012-REQ-007", expectedLine: "---" },
] as const;

const extractSectionLines = (lines: string[], heading: string): string[] => {
  const headingIndex = lines.findIndex((line) => line.trim() === heading);
  if (headingIndex === -1) {
    return [];
  }

  const sectionLines: string[] = [];
  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (line.startsWith("## ") || line.startsWith("### ")) {
      break;
    }
    sectionLines.push(line.trim());
  }

  return sectionLines;
};

const buildNeedle = (requirementId: string): string =>
  `Index ability-group-expansion blueprint section 2.3 must keep the exact line for ${requirementId}.`;

const buildPhaseName = (requirementId: string): string =>
  `ability-group-expansion-section-23-${requirementId.toLowerCase()}`;

export async function runAbilityGroupExpansionBlueprintChecks(): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> {
  const content = await readTextFile(pathFromRepoRoot(STANDARD_PACKAGE_BLUEPRINT_FILE));
  const section23Lines = extractSectionLines(content.split(/\r?\n/), SECTION_23_HEADING);

  const findings = SECTION_23_REQUIREMENTS
    .filter((requirement) => !section23Lines.includes(requirement.expectedLine))
    .map((requirement) => createFinding({
      lawId: requirement.requirementId,
      file: STANDARD_PACKAGE_BLUEPRINT_FILE,
      line: 1,
      severity: "fatal",
      message: buildNeedle(requirement.requirementId),
    }));

  return {
    findings,
    phases: SECTION_23_REQUIREMENTS.map((requirement) => {
      const requirementFindings = findings.filter((finding) => finding.lawId === requirement.requirementId);
      return createPhase(
        buildPhaseName(requirement.requirementId),
        requirementFindings.length === 0 ? "PASS" : "LAW-SCRIPT DRIFT",
        requirementFindings.length === 0,
        requirementFindings.length === 0
          ? `${requirement.requirementId} remains exact in blueprint-02 section 2.3.`
          : `${requirement.requirementId} drifted in blueprint-02 section 2.3.`,
      );
    }),
  };
}