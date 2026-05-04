import { readTextFile } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";

import { indexInspectionConstants } from "./inspection-constants.js";

type ChildContractRow = {
  childContract: string;
  parentOwners: string[];
};

const { BLUEPRINT_FILE } = indexInspectionConstants;

const ACTIVE_ABILITY_GROUPS = [
  "commander-console",
  "orchestration",
  "nerve-bus",
  "ai",
  "open",
  "screenshot",
  "visual-target",
  "geometry-guard",
  "mouse-click",
  "text-input",
  "mouse-scroll",
  "post-action-verification",
  "forensics-persistence",
  "page-state",
] as const;

const FOUNDATION_LAWS = [
  "audit-system",
  "capability-group-governance",
  "code-purity",
  "type-safety",
  "security-privacy",
] as const;

const SUPPORT_GOVERNANCE_DOMAINS = ["map-plugin-package"] as const;
const LOCAL_DEVELOPMENT_TOOLING = ["debug-loop-controller"] as const;

const FORBIDDEN_MACHINE_MARKERS = ["required", "forbidden", "ready"] as const;

const createBlueprintFinding = (input: {
  lawId: string;
  message: string;
  detail?: string;
}): Finding => createFinding({
  lawId: input.lawId,
  file: BLUEPRINT_FILE,
  line: 1,
  severity: "fatal",
  message: input.message,
  ...(input.detail ? { detail: input.detail } : {}),
});

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

const parseBulletList = (sectionLines: string[]): string[] =>
  sectionLines
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim());

const parseOrderedList = (sectionLines: string[]): string[] =>
  sectionLines
    .filter((line) => /^\d+\.\s+/.test(line))
    .map((line) => line.replace(/^\d+\.\s+/, "").trim());

const parseChildContractRows = (sectionLines: string[]): ChildContractRow[] => {
  const rows: ChildContractRow[] = [];
  for (const line of sectionLines) {
    if (!line.startsWith("|")) {
      continue;
    }

    const cells = line.split("|").map((cell) => cell.trim()).filter(Boolean);
    if (cells.length !== 4 || cells[0] === "子契约" || cells[0] === "---") {
      continue;
    }

    const [childContract = "", parentOwners = ""] = cells;
    if (!childContract || !parentOwners) {
      continue;
    }

    rows.push({
      childContract,
      parentOwners: parentOwners.split("/").map((owner) => owner.trim()).filter(Boolean),
    });
  }

  return rows;
};

const containsMachineMarkers = (sectionLines: string[]): boolean =>
  sectionLines.some((line) => {
    const normalized = line.toLowerCase();
    return FORBIDDEN_MACHINE_MARKERS.some((marker) => normalized.includes(marker));
  });

export async function runBlueprintBaselineChecks(): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> {
  const content = await readTextFile(pathFromRepoRoot(BLUEPRINT_FILE));
  const lines = content.split("\n");
  const frozenConclusion = parseBulletList(extractSectionLines(lines, "## 冻结结论"));
  const activeAbilityGroups = parseOrderedList(extractSectionLines(lines, "## 14 个 active ability groups"));
  const foundationLaws = parseOrderedList(extractSectionLines(lines, "## 5 个 foundation laws"));
  const supportGovernanceDomains = parseOrderedList(extractSectionLines(lines, "## 1 个 support governance domain"));
  const localDevelopmentTooling = parseBulletList(extractSectionLines(lines, "## 本地开发工具"));
  const childContractSection = extractSectionLines(lines, "## 子契约归属表");
  const childContractRows = parseChildContractRows(childContractSection);

  const section002Findings: Finding[] = [];
  const activeSectionFindings: Finding[] = [];
  const foundationSectionFindings: Finding[] = [];
  const debugLoopFindings: Finding[] = [];

  if (!frozenConclusion.includes("14 个 active ability groups")) {
    section002Findings.push(createBlueprintFinding({
      lawId: "K02-BLUEPRINT-01-SECTION-002-REQ-001",
      message: "Index blueprint must keep the frozen conclusion active-ability-group count at 14.",
    }));
  }
  if (!frozenConclusion.includes("5 个 foundation laws")) {
    section002Findings.push(createBlueprintFinding({
      lawId: "K02-BLUEPRINT-01-SECTION-002-REQ-002",
      message: "Index blueprint must keep the frozen conclusion foundation-law count at 5.",
    }));
  }
  if (!frozenConclusion.includes("1 个 support governance domain")) {
    section002Findings.push(createBlueprintFinding({
      lawId: "K02-BLUEPRINT-01-SECTION-002-REQ-003",
      message: "Index blueprint must keep the frozen conclusion support-governance count at 1.",
    }));
  }
  if (!frozenConclusion.includes("若干父 owner 子契约法案") || childContractRows.length === 0) {
    section002Findings.push(createBlueprintFinding({
      lawId: "K02-BLUEPRINT-01-SECTION-002-REQ-004",
      message: "Index blueprint must keep the frozen conclusion child-contract-law statement and a non-empty child-contract table.",
    }));
  }

  const unresolvedParentOwners = childContractRows
    .flatMap((row) => row.parentOwners)
    .filter((parentOwner) => ![
      ...ACTIVE_ABILITY_GROUPS.map((group) => `${group}-capability`),
      ...FOUNDATION_LAWS,
      "commander-console-capability",
      "orchestration-capability",
      "nerve-bus-capability",
      "ai-capability",
      "open-capability",
      "screenshot-capability",
      "visual-target-capability",
      "geometry-guard-capability",
      "mouse-click-capability",
      "text-input-capability",
      "mouse-scroll-capability",
      "post-action-verification-capability",
      "forensics-persistence-capability",
      "page-state-capability",
    ].includes(parentOwner));
  if (unresolvedParentOwners.length > 0) {
    section002Findings.push(createBlueprintFinding({
      lawId: "K02-BLUEPRINT-01-SECTION-002-REQ-004",
      message: "Index blueprint child-contract rows must resolve only to current parent owners.",
      detail: unresolvedParentOwners.join(", "),
    }));
  }

  if (JSON.stringify(activeAbilityGroups) !== JSON.stringify(ACTIVE_ABILITY_GROUPS) || containsMachineMarkers(extractSectionLines(lines, "## 14 个 active ability groups"))) {
    activeSectionFindings.push(createBlueprintFinding({
      lawId: "K02-BLUEPRINT-01-SECTION-003-REQ-001",
      message: "Index blueprint active-ability-group section must keep the exact 14-group baseline and contain no extra machine rules.",
    }));
  }

  if (JSON.stringify(foundationLaws) !== JSON.stringify(FOUNDATION_LAWS) || containsMachineMarkers(extractSectionLines(lines, "## 5 个 foundation laws"))) {
    foundationSectionFindings.push(createBlueprintFinding({
      lawId: "K02-BLUEPRINT-01-SECTION-004-REQ-001",
      message: "Index blueprint foundation-law section must keep the exact five-law baseline and contain no extra machine rules.",
    }));
  }

  if (JSON.stringify(supportGovernanceDomains) !== JSON.stringify(SUPPORT_GOVERNANCE_DOMAINS)) {
    section002Findings.push(createBlueprintFinding({
      lawId: "K02-BLUEPRINT-01-SECTION-002-REQ-003",
      message: "Index blueprint support-governance section must keep the exact single-domain baseline.",
    }));
  }

  if (JSON.stringify(localDevelopmentTooling) !== JSON.stringify(LOCAL_DEVELOPMENT_TOOLING)) {
    debugLoopFindings.push(createBlueprintFinding({
      lawId: "K02-BLUEPRINT-01-SECTION-006-REQ-001",
      message: "Index blueprint local development tooling must remain debug-loop-controller only.",
    }));
  }

  const findings = [
    ...section002Findings,
    ...activeSectionFindings,
    ...foundationSectionFindings,
    ...debugLoopFindings,
  ];

  return {
    findings,
    phases: [
      createPhase(
        "blueprint-frozen-conclusion",
        section002Findings.length === 0 ? "PASS" : "LAW-SCRIPT DRIFT",
        section002Findings.length === 0,
        section002Findings.length === 0
          ? "Index blueprint frozen conclusion keeps the active, foundation, support, and child-contract freeze statements intact."
          : "Index blueprint frozen conclusion drifted away from the governed freeze statements.",
      ),
      createPhase(
        "blueprint-active-ability-groups",
        activeSectionFindings.length === 0 ? "PASS" : "LAW-SCRIPT DRIFT",
        activeSectionFindings.length === 0,
        activeSectionFindings.length === 0
          ? "Index blueprint active-ability-group section stays exact and contains no extra machine rules."
          : "Index blueprint active-ability-group section drifted away from the governed baseline.",
      ),
      createPhase(
        "blueprint-foundation-laws",
        foundationSectionFindings.length === 0 ? "PASS" : "LAW-SCRIPT DRIFT",
        foundationSectionFindings.length === 0,
        foundationSectionFindings.length === 0
          ? "Index blueprint foundation-law section stays exact and contains no extra machine rules."
          : "Index blueprint foundation-law section drifted away from the governed baseline.",
      ),
      createPhase(
        "blueprint-local-development-tooling",
        debugLoopFindings.length === 0 ? "PASS" : "LAW-SCRIPT DRIFT",
        debugLoopFindings.length === 0,
        debugLoopFindings.length === 0
          ? "Index blueprint local development tooling stays frozen at debug-loop-controller."
          : "Index blueprint local development tooling drifted away from debug-loop-controller.",
      ),
    ],
  };
}