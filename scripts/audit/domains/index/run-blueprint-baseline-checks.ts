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

const SUPPORT_GOVERNANCE_DOMAINS = [] as const;
const LOCAL_DEVELOPMENT_TOOLING = [] as const;
const CURRENT_PARENT_OWNERS = [
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
] as const;

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

const collectFrozenConclusionFindings = (input: {
  frozenConclusion: string[];
  childContractRows: ChildContractRow[];
}): Finding[] => {
  const findings: Finding[] = [];

  if (!input.frozenConclusion.includes("14 个 active ability groups")) {
    findings.push(createBlueprintFinding({ lawId: "K02-BLUEPRINT-01-SECTION-002-REQ-001", message: "Index blueprint must keep the frozen conclusion active-ability-group count at 14." }));
  }
  if (!input.frozenConclusion.includes("5 个 foundation laws")) {
    findings.push(createBlueprintFinding({ lawId: "K02-BLUEPRINT-01-SECTION-002-REQ-002", message: "Index blueprint must keep the frozen conclusion foundation-law count at 5." }));
  }
  if (!input.frozenConclusion.includes("0 个 support governance domains")) {
    findings.push(createBlueprintFinding({ lawId: "K02-BLUEPRINT-01-SECTION-002-REQ-003", message: "Index blueprint must keep the frozen conclusion support-governance count at 0." }));
  }
  if (!input.frozenConclusion.includes("若干父 owner 子契约法案") || input.childContractRows.length === 0) {
    findings.push(createBlueprintFinding({ lawId: "K02-BLUEPRINT-01-SECTION-002-REQ-004", message: "Index blueprint must keep the frozen conclusion child-contract-law statement and a non-empty child-contract table." }));
  }

  return findings;
};

const collectChildContractParentOwnerFindings = (childContractRows: ChildContractRow[]): Finding[] => {
  const unresolvedParentOwners = childContractRows
    .flatMap((row) => row.parentOwners)
    .filter((parentOwner) => !CURRENT_PARENT_OWNERS.includes(parentOwner as (typeof CURRENT_PARENT_OWNERS)[number]));

  return unresolvedParentOwners.length === 0
    ? []
    : [createBlueprintFinding({ lawId: "K02-BLUEPRINT-01-SECTION-002-REQ-004", message: "Index blueprint child-contract rows must resolve only to current parent owners.", detail: unresolvedParentOwners.join(", ") })];
};

const collectExactBaselineSectionFindings = (input: {
  lines: string[];
  activeAbilityGroups: string[];
  foundationLaws: string[];
  supportGovernanceDomains: string[];
  localDevelopmentTooling: string[];
}) => {
  const section002Findings: Finding[] = [];
  const activeSectionFindings: Finding[] = [];
  const foundationSectionFindings: Finding[] = [];
  const debugLoopFindings: Finding[] = [];

  if (JSON.stringify(input.activeAbilityGroups) !== JSON.stringify(ACTIVE_ABILITY_GROUPS) || containsMachineMarkers(extractSectionLines(input.lines, "## 14 个 active ability groups"))) {
    activeSectionFindings.push(createBlueprintFinding({ lawId: "K02-BLUEPRINT-01-SECTION-003-REQ-001", message: "Index blueprint active-ability-group section must keep the exact 14-group baseline and contain no extra machine rules." }));
  }
  if (JSON.stringify(input.foundationLaws) !== JSON.stringify(FOUNDATION_LAWS) || containsMachineMarkers(extractSectionLines(input.lines, "## 5 个 foundation laws"))) {
    foundationSectionFindings.push(createBlueprintFinding({ lawId: "K02-BLUEPRINT-01-SECTION-004-REQ-001", message: "Index blueprint foundation-law section must keep the exact five-law baseline and contain no extra machine rules." }));
  }
  if (JSON.stringify(input.supportGovernanceDomains) !== JSON.stringify(SUPPORT_GOVERNANCE_DOMAINS)) {
    section002Findings.push(createBlueprintFinding({ lawId: "K02-BLUEPRINT-01-SECTION-002-REQ-003", message: "Index blueprint support-governance section must remain empty after map retirement." }));
  }
  if (JSON.stringify(input.localDevelopmentTooling) !== JSON.stringify(LOCAL_DEVELOPMENT_TOOLING)) {
    debugLoopFindings.push(createBlueprintFinding({ lawId: "K02-BLUEPRINT-01-SECTION-006-REQ-001", message: "Index blueprint local development tooling must match the frozen baseline." }));
  }

  return { section002Findings, activeSectionFindings, foundationSectionFindings, debugLoopFindings };
};

const loadBlueprintBaselineState = async () => {
  const content = await readTextFile(pathFromRepoRoot(BLUEPRINT_FILE));
  const lines = content.split("\n");

  return {
    lines,
    frozenConclusion: parseBulletList(extractSectionLines(lines, "## 冻结结论")),
    activeAbilityGroups: parseOrderedList(extractSectionLines(lines, "## 14 个 active ability groups")),
    foundationLaws: parseOrderedList(extractSectionLines(lines, "## 5 个 foundation laws")),
    supportGovernanceDomains: parseOrderedList(extractSectionLines(lines, "## 0 个 support governance domains")),
    localDevelopmentTooling: parseBulletList(extractSectionLines(lines, "## 本地开发工具")),
    childContractRows: parseChildContractRows(extractSectionLines(lines, "## 子契约归属表")),
  };
};

const createBlueprintBaselinePhase = (name: string, findings: Finding[], passMessage: string, failMessage: string): InspectorPhase => {
  return createPhase(
    name,
    findings.length === 0 ? "PASS" : "LAW-SCRIPT DRIFT",
    findings.length === 0,
    findings.length === 0 ? passMessage : failMessage,
  );
};

const buildBlueprintBaselinePhases = (input: {
  section002Findings: Finding[];
  activeSectionFindings: Finding[];
  foundationSectionFindings: Finding[];
  debugLoopFindings: Finding[];
}): InspectorPhase[] => [
  createBlueprintBaselinePhase("blueprint-frozen-conclusion", input.section002Findings, "Index blueprint frozen conclusion keeps the active, foundation, support, and child-contract freeze statements intact.", "Index blueprint frozen conclusion drifted away from the governed freeze statements."),
  createBlueprintBaselinePhase("blueprint-active-ability-groups", input.activeSectionFindings, "Index blueprint active-ability-group section stays exact and contains no extra machine rules.", "Index blueprint active-ability-group section drifted away from the governed baseline."),
  createBlueprintBaselinePhase("blueprint-foundation-laws", input.foundationSectionFindings, "Index blueprint foundation-law section stays exact and contains no extra machine rules.", "Index blueprint foundation-law section drifted away from the governed baseline."),
  createBlueprintBaselinePhase("blueprint-local-development-tooling", input.debugLoopFindings, "Index blueprint local development tooling stays frozen at the defined baseline.", "Index blueprint local development tooling drifted away from the defined baseline."),
];

export async function runBlueprintBaselineChecks(): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> {
  const state = await loadBlueprintBaselineState();
  const section002Findings = [
    ...collectFrozenConclusionFindings({ frozenConclusion: state.frozenConclusion, childContractRows: state.childContractRows }),
    ...collectChildContractParentOwnerFindings(state.childContractRows),
  ];
  const exactBaselineSectionFindings = collectExactBaselineSectionFindings({
    lines: state.lines,
    activeAbilityGroups: state.activeAbilityGroups,
    foundationLaws: state.foundationLaws,
    supportGovernanceDomains: state.supportGovernanceDomains,
    localDevelopmentTooling: state.localDevelopmentTooling,
  });

  const findings = [
    ...section002Findings,
    ...exactBaselineSectionFindings.section002Findings,
    ...exactBaselineSectionFindings.activeSectionFindings,
    ...exactBaselineSectionFindings.foundationSectionFindings,
    ...exactBaselineSectionFindings.debugLoopFindings,
  ];

  return {
    findings,
    phases: buildBlueprintBaselinePhases({
      section002Findings,
      activeSectionFindings: exactBaselineSectionFindings.activeSectionFindings,
      foundationSectionFindings: exactBaselineSectionFindings.foundationSectionFindings,
      debugLoopFindings: exactBaselineSectionFindings.debugLoopFindings,
    }),
  };
}