import { readTextFile } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { collectStandardPackageStructureFindings } from "./standard-package-structure-checks.js";

const STANDARD_PACKAGE_BLUEPRINT_FILE = "docs/法案辅助文件/GrassEye_能力组标准包与执法结构统一施工图.md";
const SECTION_21_HEADING = "### 2.1 统一模式原则";

type SectionRequirement = {
  requirementId: string;
  expectedLine: string;
};

const SECTION_21_TAIL_REQUIREMENTS: SectionRequirement[] = [
  { requirementId: "K02-BLUEPRINT-02-SECTION-010-REQ-009", expectedLine: "所有能力组必须统一成：" },
  { requirementId: "K02-BLUEPRINT-02-SECTION-010-REQ-010", expectedLine: "Ability Group Standard Package" },
  { requirementId: "K02-BLUEPRINT-02-SECTION-010-REQ-011", expectedLine: "├── ability-group.ts" },
  { requirementId: "K02-BLUEPRINT-02-SECTION-010-REQ-012", expectedLine: "├── contract.ts" },
  { requirementId: "K02-BLUEPRINT-02-SECTION-010-REQ-013", expectedLine: "├── schema.ts" },
  { requirementId: "K02-BLUEPRINT-02-SECTION-010-REQ-014", expectedLine: "├── registry.ts" },
  { requirementId: "K02-BLUEPRINT-02-SECTION-010-REQ-015", expectedLine: "├── index.ts" },
  { requirementId: "K02-BLUEPRINT-02-SECTION-010-REQ-016", expectedLine: "├── runtime/" },
  { requirementId: "K02-BLUEPRINT-02-SECTION-010-REQ-017", expectedLine: "├── children/" },
  { requirementId: "K02-BLUEPRINT-02-SECTION-010-REQ-018", expectedLine: "├── ports/" },
  { requirementId: "K02-BLUEPRINT-02-SECTION-010-REQ-019", expectedLine: "├── shared/" },
  { requirementId: "K02-BLUEPRINT-02-SECTION-010-REQ-020", expectedLine: "└── audit domain inspector" },
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

const buildBlueprintNeedle = (requirementId: string): string =>
  `Index standard-package blueprint section 2.1 must keep the exact line for ${requirementId}.`;

const buildPhaseName = (requirementId: string): string =>
  `standard-package-section-21-${requirementId.toLowerCase()}`;


export async function runStandardPackagePrincipleChecks(): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> {
  const content = await readTextFile(pathFromRepoRoot(STANDARD_PACKAGE_BLUEPRINT_FILE));
  const section21Lines = extractSectionLines(content.split(/\r?\n/), SECTION_21_HEADING);

  const findings = SECTION_21_TAIL_REQUIREMENTS
    .filter((requirement) => !section21Lines.includes(requirement.expectedLine))
    .map((requirement) => createFinding({
      lawId: requirement.requirementId,
      file: STANDARD_PACKAGE_BLUEPRINT_FILE,
      line: 1,
      severity: "fatal",
      message: buildBlueprintNeedle(requirement.requirementId),
    }));

  findings.push(...await collectStandardPackageStructureFindings());

  return {
    findings,
    phases: SECTION_21_TAIL_REQUIREMENTS.map((requirement) => {
      const requirementFindings = findings.filter((finding) => finding.lawId === requirement.requirementId);
      return createPhase(
        buildPhaseName(requirement.requirementId),
        requirementFindings.length === 0 ? "PASS" : "CODE VIOLATION",
        requirementFindings.length === 0,
        requirementFindings.length === 0
          ? `${requirement.requirementId} remains enforced in blueprint-02 section 2.1 and active source structure.`
          : `${requirement.requirementId} drifted in blueprint-02 section 2.1 or active source structure.`,
      );
    }),
  };
}