import { readJsonFile, readTextFile } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";

const STANDARD_PACKAGE_BLUEPRINT_FILE = "docs/法案辅助文件/GrassEye_能力组标准包与执法结构统一施工图.md";

type SectionRequirement = {
  requirementId: string;
  expectedLine: string;
};

type AuditPlanOwner = {
  capabilityDomain?: string;
};

type AuditPlan = {
  owners?: AuditPlanOwner[];
};

type EnforcementMatrixOwner = {
  capabilityDomain?: string;
};

type EnforcementMatrix = {
  owners?: EnforcementMatrixOwner[];
};

type PhaseGate = {
  activeLawDomains?: string[];
};

const SECTION_0_REQUIREMENTS: SectionRequirement[] = [
  {
    requirementId: "K02-BLUEPRINT-02-SECTION-002-REQ-001",
    expectedLine: "3. 每个能力组必须具备什么目录结构。",
  },
  {
    requirementId: "K02-BLUEPRINT-02-SECTION-002-REQ-002",
    expectedLine: "4. 每个子能力必须具备什么结构。",
  },
  {
    requirementId: "K02-BLUEPRINT-02-SECTION-002-REQ-003",
    expectedLine: "5. 每个能力组的执法系统必须如何建设。",
  },
  {
    requirementId: "K02-BLUEPRINT-02-SECTION-002-REQ-004",
    expectedLine: "6. 四方攻击如何验收。",
  },
  {
    requirementId: "K02-BLUEPRINT-02-SECTION-002-REQ-005",
    expectedLine: "8. Codex 每轮交付必须满足什么标准。",
  },
  {
    requirementId: "K02-BLUEPRINT-02-SECTION-002-REQ-006",
    expectedLine: "> 能力组是器官，子能力是组织，执行地图是神经程序，执法系统是免疫系统。本文件定义每个器官如何被生产级制造、验收和固化。",
  },
  {
    requirementId: "K02-BLUEPRINT-02-SECTION-002-REQ-007",
    expectedLine: "---",
  },
] as const;

const SECTION_1_REQUIREMENTS: SectionRequirement[] = [
  {
    requirementId: "K02-BLUEPRINT-02-SECTION-003-REQ-001",
    expectedLine: "后续施工不得修改：",
  },
  {
    requirementId: "K02-BLUEPRINT-02-SECTION-003-REQ-002",
    expectedLine: "- `.github/instructions/cursor-rules/**`",
  },
  {
    requirementId: "K02-BLUEPRINT-02-SECTION-003-REQ-003",
    expectedLine: "- `docs/法案辅助文件/GrassEye 法案冻结基线.md`",
  },
  {
    requirementId: "K02-BLUEPRINT-02-SECTION-003-REQ-004",
    expectedLine: "解冻法案",
  },
  {
    requirementId: "K02-BLUEPRINT-02-SECTION-003-REQ-005",
    expectedLine: "否则所有迭代都必须让代码、执法、生成物服从冻结法案。",
  },
] as const;

const SECTION_15_DELETED_OWNER_REQUIREMENTS: SectionRequirement[] = [
  {
    requirementId: "K02-BLUEPRINT-02-SECTION-008-REQ-002",
    expectedLine: "- local-data",
  },
  {
    requirementId: "K02-BLUEPRINT-02-SECTION-008-REQ-003",
    expectedLine: "- localization",
  },
  {
    requirementId: "K02-BLUEPRINT-02-SECTION-008-REQ-004",
    expectedLine: "- platform-action as action owner",
  },
  {
    requirementId: "K02-BLUEPRINT-02-SECTION-008-REQ-005",
    expectedLine: "- local-ai-runtime as independent owner",
  },
  {
    requirementId: "K02-BLUEPRINT-02-SECTION-008-REQ-006",
    expectedLine: "- local-browser-session as independent owner",
  },
  {
    requirementId: "K02-BLUEPRINT-02-SECTION-008-REQ-007",
    expectedLine: "- local-app-shell as independent owner",
  },
  {
    requirementId: "K02-BLUEPRINT-02-SECTION-008-REQ-008",
    expectedLine: "- startup-entrypoint as independent owner",
  },
  {
    requirementId: "K02-BLUEPRINT-02-SECTION-008-REQ-009",
    expectedLine: "- structured-logging as independent owner",
  },
  {
    requirementId: "K02-BLUEPRINT-02-SECTION-008-REQ-010",
    expectedLine: "- local-persistence-schema as independent owner",
  },
  {
    requirementId: "K02-BLUEPRINT-02-SECTION-008-REQ-011",
    expectedLine: "- multi-frame-evidence as independent owner",
  },
  {
    requirementId: "K02-BLUEPRINT-02-SECTION-008-REQ-012",
    expectedLine: "- code-topology as independent owner",
  },
  {
    requirementId: "K02-BLUEPRINT-02-SECTION-008-REQ-013",
    expectedLine: "- code-purity as independent owner",
  },
  {
    requirementId: "K02-BLUEPRINT-02-SECTION-008-REQ-014",
    expectedLine: "---",
  },
] as const;

const SECTION_21_REQUIREMENTS: SectionRequirement[] = [
  {
    requirementId: "K02-BLUEPRINT-02-SECTION-010-REQ-001",
    expectedLine: "后续所有能力组必须使用统一模式。",
  },
  {
    requirementId: "K02-BLUEPRINT-02-SECTION-010-REQ-002",
    expectedLine: "禁止每个能力组各写一套风格。",
  },
  {
    requirementId: "K02-BLUEPRINT-02-SECTION-010-REQ-003",
    expectedLine: "禁止：",
  },
  {
    requirementId: "K02-BLUEPRINT-02-SECTION-010-REQ-004",
    expectedLine: "- 这个能力组用大 adapter。",
  },
  {
    requirementId: "K02-BLUEPRINT-02-SECTION-010-REQ-005",
    expectedLine: "- 那个能力组用 God Facade。",
  },
  {
    requirementId: "K02-BLUEPRINT-02-SECTION-010-REQ-006",
    expectedLine: "- 另一个能力组用 metadata-only child。",
  },
  {
    requirementId: "K02-BLUEPRINT-02-SECTION-010-REQ-007",
    expectedLine: "- 某个能力组只靠 inspector 补洞。",
  },
  {
    requirementId: "K02-BLUEPRINT-02-SECTION-010-REQ-008",
    expectedLine: "- 某个能力组通过 helper 拼凑生产链。",
  },
] as const;

const SECTION_15_INTRO_LINE = "以下不得重新进入 active owner、phase gate、audit plan、runner：";
const DELETED_OWNER_DOMAINS = [
  "local-data",
  "localization",
  "platform-action",
  "local-ai-runtime",
  "local-browser-session",
  "local-app-shell",
  "startup-entrypoint",
  "structured-logging",
  "local-persistence-schema",
  "multi-frame-evidence",
  "code-topology",
  "code-purity",
] as const;

const extractSectionLines = (lines: string[], heading: string): string[] => {
  const headingIndex = lines.findIndex((line) => line.trim() === heading);
  if (headingIndex === -1) {
    return [];
  }

  const sectionLines: string[] = [];
  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (line.startsWith("## ")) {
      break;
    }
    sectionLines.push(line.trim());
  }

  return sectionLines;
};

const buildNeedle = (requirementId: string): string =>
  `Index standard-package blueprint section 0 must keep the exact line for ${requirementId}.`;

const buildPhaseName = (requirementId: string): string =>
  `standard-package-section-0-${requirementId.toLowerCase()}`;

export async function runStandardPackageBlueprintChecks(): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> {
  const [content, auditPlan, enforcementMatrix, phaseGate] = await Promise.all([
    readTextFile(pathFromRepoRoot(STANDARD_PACKAGE_BLUEPRINT_FILE)),
    readJsonFile<AuditPlan>(pathFromRepoRoot("scripts/audit/generated/audit-plan.generated.json")),
    readJsonFile<EnforcementMatrix>(pathFromRepoRoot("scripts/audit/generated/enforcement-matrix.generated.json")),
    readJsonFile<PhaseGate>(pathFromRepoRoot("scripts/audit/phase-gates/phase-04-full-enforcement.json")),
  ]);
  const lines = content.split(/\r?\n/);
  const section0Lines = extractSectionLines(lines, "## 0. 文件定位");
  const section1Lines = extractSectionLines(lines, "## 1. 当前冻结基线");
  const section15Lines = extractSectionLines(lines, "### 1.5 禁止恢复的旧 owner");
  const section21Lines = extractSectionLines(lines, "### 2.1 统一模式原则");
  const auditPlanDomains = new Set((auditPlan.owners ?? []).flatMap((owner) => owner.capabilityDomain ? [owner.capabilityDomain] : []));
  const enforcementMatrixDomains = new Set((enforcementMatrix.owners ?? []).flatMap((owner) => owner.capabilityDomain ? [owner.capabilityDomain] : []));
  const phaseGateDomains = new Set(phaseGate.activeLawDomains ?? []);

  const findings = SECTION_0_REQUIREMENTS
    .filter((requirement) => !section0Lines.includes(requirement.expectedLine))
    .map((requirement) => createFinding({
      lawId: requirement.requirementId,
      file: STANDARD_PACKAGE_BLUEPRINT_FILE,
      line: 1,
      severity: "fatal",
      message: buildNeedle(requirement.requirementId),
    }));

  findings.push(...SECTION_1_REQUIREMENTS
    .filter((requirement) => !section1Lines.includes(requirement.expectedLine))
    .map((requirement) => createFinding({
      lawId: requirement.requirementId,
      file: STANDARD_PACKAGE_BLUEPRINT_FILE,
      line: 1,
      severity: "fatal",
      message: buildNeedle(requirement.requirementId),
    })));

  if (!section15Lines.includes(SECTION_15_INTRO_LINE)
    || DELETED_OWNER_DOMAINS.some((domain) => auditPlanDomains.has(domain) || enforcementMatrixDomains.has(domain) || phaseGateDomains.has(domain))) {
    findings.push(createFinding({
      lawId: "K02-BLUEPRINT-02-SECTION-008-REQ-001",
      file: STANDARD_PACKAGE_BLUEPRINT_FILE,
      line: 1,
      severity: "fatal",
      message: "Index standard-package blueprint section 1.5 must keep deleted owners out of active owner, phase gate, audit plan, and runner.",
    }));
  }

  findings.push(...SECTION_15_DELETED_OWNER_REQUIREMENTS
    .filter((requirement) => !section15Lines.includes(requirement.expectedLine))
    .map((requirement) => createFinding({
      lawId: requirement.requirementId,
      file: STANDARD_PACKAGE_BLUEPRINT_FILE,
      line: 1,
      severity: "fatal",
      message: buildNeedle(requirement.requirementId),
    })));

  findings.push(...SECTION_21_REQUIREMENTS
    .filter((requirement) => !section21Lines.includes(requirement.expectedLine))
    .map((requirement) => createFinding({
      lawId: requirement.requirementId,
      file: STANDARD_PACKAGE_BLUEPRINT_FILE,
      line: 1,
      severity: "fatal",
      message: buildNeedle(requirement.requirementId),
    })));

  return {
    findings,
    phases: [
      ...SECTION_0_REQUIREMENTS.map((requirement) => {
        const requirementFindings = findings.filter((finding) => finding.lawId === requirement.requirementId);
        return createPhase(
          buildPhaseName(requirement.requirementId),
          requirementFindings.length === 0 ? "PASS" : "LAW-SCRIPT DRIFT",
          requirementFindings.length === 0,
          requirementFindings.length === 0
            ? `${requirement.requirementId} remains exact in blueprint-02 section 0.`
            : `${requirement.requirementId} drifted in blueprint-02 section 0.`,
        );
      }),
      ...SECTION_1_REQUIREMENTS.map((requirement) => {
        const requirementFindings = findings.filter((finding) => finding.lawId === requirement.requirementId);
        return createPhase(
          buildPhaseName(requirement.requirementId),
          requirementFindings.length === 0 ? "PASS" : "LAW-SCRIPT DRIFT",
          requirementFindings.length === 0,
          requirementFindings.length === 0
            ? `${requirement.requirementId} remains exact in blueprint-02 section 1.`
            : `${requirement.requirementId} drifted in blueprint-02 section 1.`,
        );
      }),
      createPhase(
        buildPhaseName("K02-BLUEPRINT-02-SECTION-008-REQ-001"),
        findings.filter((finding) => finding.lawId === "K02-BLUEPRINT-02-SECTION-008-REQ-001").length === 0 ? "PASS" : "CODE VIOLATION",
        findings.filter((finding) => finding.lawId === "K02-BLUEPRINT-02-SECTION-008-REQ-001").length === 0,
        findings.filter((finding) => finding.lawId === "K02-BLUEPRINT-02-SECTION-008-REQ-001").length === 0
          ? "Blueprint-02 section 1.5 keeps deleted owners out of active owner, phase gate, audit plan, and runner."
          : "Blueprint-02 section 1.5 drifted into reviving deleted owners.",
      ),
      ...SECTION_15_DELETED_OWNER_REQUIREMENTS.map((requirement) => {
        const requirementFindings = findings.filter((finding) => finding.lawId === requirement.requirementId);
        return createPhase(
          buildPhaseName(requirement.requirementId),
          requirementFindings.length === 0 ? "PASS" : "LAW-SCRIPT DRIFT",
          requirementFindings.length === 0,
          requirementFindings.length === 0
            ? `${requirement.requirementId} remains exact in blueprint-02 section 1.5.`
            : `${requirement.requirementId} drifted in blueprint-02 section 1.5.`,
        );
      }),
      ...SECTION_21_REQUIREMENTS.map((requirement) => {
        const requirementFindings = findings.filter((finding) => finding.lawId === requirement.requirementId);
        return createPhase(
          buildPhaseName(requirement.requirementId),
          requirementFindings.length === 0 ? "PASS" : "LAW-SCRIPT DRIFT",
          requirementFindings.length === 0,
          requirementFindings.length === 0
            ? `${requirement.requirementId} remains exact in blueprint-02 section 2.1.`
            : `${requirement.requirementId} drifted in blueprint-02 section 2.1.`,
        );
      }),
    ],
  };
}