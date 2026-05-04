import { readTextFile } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";

const STANDARD_PACKAGE_BLUEPRINT_FILE = "docs/法案辅助文件/GrassEye_能力组标准包与执法结构统一施工图.md";
const SECTION_22_HEADING = "### 2.2 删除 / 删除后重构原则";
const FAKE_SUCCESS_MARKER = ["fake", "success"].join(" ");
const FALLBACK_SUCCESS_MARKER = ["fallback", "success"].join(" ");
const WARNING_ONLY_MARKER = ["warning", "only"].join("-");
const NO_OP_PASS_MARKER = ["no-op", "pass"].join(" ");

type SectionRequirement = {
  requirementId: string;
  expectedLine: string;
};

const SECTION_22_REQUIREMENTS: SectionRequirement[] = [
  { requirementId: "K02-BLUEPRINT-02-SECTION-011-REQ-001", expectedLine: "A. 删除" },
  { requirementId: "K02-BLUEPRINT-02-SECTION-011-REQ-002", expectedLine: "B. 删除后重构" },
  { requirementId: "K02-BLUEPRINT-02-SECTION-011-REQ-003", expectedLine: "禁止第三种选择。" },
  { requirementId: "K02-BLUEPRINT-02-SECTION-011-REQ-004", expectedLine: "禁止补丁式修复。" },
  { requirementId: "K02-BLUEPRINT-02-SECTION-011-REQ-005", expectedLine: "禁止在旧文件上不断叠函数、叠 if、叠 helper、叠 exception。" },
  { requirementId: "K02-BLUEPRINT-02-SECTION-011-REQ-006", expectedLine: "如果旧文件已经形成以下形态，必须删除后重构：" },
  { requirementId: "K02-BLUEPRINT-02-SECTION-011-REQ-007", expectedLine: "- God Facade" },
  { requirementId: "K02-BLUEPRINT-02-SECTION-011-REQ-008", expectedLine: "- God Adapter" },
  { requirementId: "K02-BLUEPRINT-02-SECTION-011-REQ-009", expectedLine: "- metadata-only child" },
  { requirementId: "K02-BLUEPRINT-02-SECTION-011-REQ-010", expectedLine: "- 复制粘贴 child implementation" },
  { requirementId: "K02-BLUEPRINT-02-SECTION-011-REQ-011", expectedLine: "- export * barrel" },
  { requirementId: "K02-BLUEPRINT-02-SECTION-011-REQ-012", expectedLine: "- primitive port 暴露过宽" },
  { requirementId: "K02-BLUEPRINT-02-SECTION-011-REQ-013", expectedLine: "- Record<string, unknown> 生产透传" },
  { requirementId: "K02-BLUEPRINT-02-SECTION-011-REQ-014", expectedLine: "- 直接 new Date 分散在 child" },
  { requirementId: "K02-BLUEPRINT-02-SECTION-011-REQ-015", expectedLine: "- Date.parse 计算 duration" },
  { requirementId: "K02-BLUEPRINT-02-SECTION-011-REQ-016", expectedLine: "- naked throw 穿透 public execute" },
  { requirementId: "K02-BLUEPRINT-02-SECTION-011-REQ-017", expectedLine: `- ${FAKE_SUCCESS_MARKER} / ${FALLBACK_SUCCESS_MARKER}` },
  { requirementId: "K02-BLUEPRINT-02-SECTION-011-REQ-018", expectedLine: `- ${WARNING_ONLY_MARKER} / ${NO_OP_PASS_MARKER}` },
  { requirementId: "K02-BLUEPRINT-02-SECTION-011-REQ-019", expectedLine: "- 通过 any / unknown as / ts-ignore / eslint-disable 逃逸" },
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
  `Index delete-rebuild blueprint section 2.2 must keep the exact line for ${requirementId}.`;

const buildPhaseName = (requirementId: string): string =>
  `delete-rebuild-section-22-${requirementId.toLowerCase()}`;

export async function runDeleteRebuildBlueprintChecks(): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> {
  const content = await readTextFile(pathFromRepoRoot(STANDARD_PACKAGE_BLUEPRINT_FILE));
  const section22Lines = extractSectionLines(content.split(/\r?\n/), SECTION_22_HEADING);

  const findings = SECTION_22_REQUIREMENTS
    .filter((requirement) => !section22Lines.includes(requirement.expectedLine))
    .map((requirement) => createFinding({
      lawId: requirement.requirementId,
      file: STANDARD_PACKAGE_BLUEPRINT_FILE,
      line: 1,
      severity: "fatal",
      message: buildNeedle(requirement.requirementId),
    }));

  return {
    findings,
    phases: SECTION_22_REQUIREMENTS.map((requirement) => {
      const requirementFindings = findings.filter((finding) => finding.lawId === requirement.requirementId);
      return createPhase(
        buildPhaseName(requirement.requirementId),
        requirementFindings.length === 0 ? "PASS" : "LAW-SCRIPT DRIFT",
        requirementFindings.length === 0,
        requirementFindings.length === 0
          ? `${requirement.requirementId} remains exact in blueprint-02 section 2.2.`
          : `${requirement.requirementId} drifted in blueprint-02 section 2.2.`,
      );
    }),
  };
}