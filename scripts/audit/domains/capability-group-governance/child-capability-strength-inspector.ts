import { writeJsonFile } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";

import { INVENTORY_RELATIVE_PATH, buildChildCapabilityStrengthInventory, writeChildCapabilityStrengthInventory, type ChildCapabilityStrengthEntry } from "./child-capability-strength-builder.js";

const LAW_STRUCTURE = "GRASSEYE-CAPABILITY-GROUP-002-V1";
const LAW_DISPATCH = "GRASSEYE-CAPABILITY-GROUP-003-V1";
const LAW_EVIDENCE = "GRASSEYE-CAPABILITY-GROUP-005-V1";
const SUMMARY_RELATIVE_PATH = "scripts/audit/generated/child-capability-strength-summary.txt";
const DIRECT_OUTPUT_RELATIVE_PATH = "scripts/audit/generated/child-capability-strength-direct-output.txt";
const IMPLEMENTATION_REASONS = new Set(["CHILD_HAS_NO_IMPLEMENTATION", "CHILD_HAS_NO_EXECUTE", "CHILD_RETURNS_FAKE_SUCCESS", "CHILD_PUBLIC_EXECUTE_THROWS"]);
const CATALOG_REASONS = new Set(["AI_ACTION_WITHOUT_CHILD_PATH", "AI_ACTION_WITHOUT_NERVE_BUS_PATH"]);

const resolveFindingFile = (entry: ChildCapabilityStrengthEntry, reason: string): string => {
  if (reason === "CHILD_NOT_IN_SCHEMA_UNION") {
    return `src/capabilities/${entry.abilityGroupId}/schema.ts`;
  }
  if (IMPLEMENTATION_REASONS.has(reason)) {
    return `src/capabilities/${entry.abilityGroupId}/children/${entry.childCapabilityId}/implementation.ts`;
  }
  return CATALOG_REASONS.has(reason)
    ? "src/muscle-memory/generated-catalog.json"
    : `src/capabilities/${entry.abilityGroupId}/registry.ts`;
};

const buildFindingForReason = (entry: ChildCapabilityStrengthEntry, reason: string): Finding => {
  const detail = entry.aiActionCodes.length > 0
    ? entry.aiActionCodes.join(", ")
    : entry.actionCodes.length > 0
      ? entry.actionCodes.join(", ")
      : null;
  const messageByReason: Record<string, string> = {
    CHILD_NOT_REGISTERED: `CHILD_NOT_REGISTERED: ${entry.abilityGroupId}.${entry.childCapabilityId} exists in active schema/runtime surfaces but is missing from the owner registry.`,
    CHILD_NOT_IN_SCHEMA_UNION: `CHILD_NOT_IN_SCHEMA_UNION: ${entry.abilityGroupId}.${entry.childCapabilityId} is not declared in the owner schema union.`,
    CHILD_HAS_NO_IMPLEMENTATION: `CHILD_HAS_NO_IMPLEMENTATION: ${entry.abilityGroupId}.${entry.childCapabilityId} has no child implementation file.`,
    CHILD_HAS_NO_EXECUTE: `CHILD_HAS_NO_EXECUTE: ${entry.abilityGroupId}.${entry.childCapabilityId} implementation does not expose execute.`,
    CHILD_RETURNS_FAKE_SUCCESS: `CHILD_RETURNS_FAKE_SUCCESS: ${entry.abilityGroupId}.${entry.childCapabilityId} implementation does not prove a governed result path.`,
    CHILD_PUBLIC_EXECUTE_THROWS: `CHILD_PUBLIC_EXECUTE_THROWS: ${entry.abilityGroupId}.${entry.childCapabilityId} leaks throw through the public execute boundary.`,
    AI_ACTION_WITHOUT_CHILD_PATH: `AI_ACTION_WITHOUT_CHILD_PATH: AI-reachable child ${entry.abilityGroupId}.${entry.childCapabilityId} is not fully backed by runtime implementation.`,
    AI_ACTION_WITHOUT_NERVE_BUS_PATH: `AI_ACTION_WITHOUT_NERVE_BUS_PATH: AI-reachable child ${entry.abilityGroupId}.${entry.childCapabilityId} has no local-runtime or Nerve Bus dispatch coverage.`,
    SIDE_EFFECT_ACTION_WITHOUT_FORENSICS: `SIDE_EFFECT_ACTION_WITHOUT_FORENSICS: ${entry.abilityGroupId}.${entry.childCapabilityId} performs side effects without a proven Forensics path.`,
  };

  const lawId = reason === "SIDE_EFFECT_ACTION_WITHOUT_FORENSICS"
    ? LAW_EVIDENCE
    : reason === "AI_ACTION_WITHOUT_NERVE_BUS_PATH"
      ? LAW_DISPATCH
      : LAW_STRUCTURE;

  return createFinding({
    lawId,
    file: resolveFindingFile(entry, reason),
    line: 1,
    severity: "fatal",
    message: messageByReason[reason] ?? `${reason}: ${entry.abilityGroupId}.${entry.childCapabilityId}`,
    ...(detail ? { detail } : {}),
  });
};

const collectBlockingFindings = (entries: ChildCapabilityStrengthEntry[]): Finding[] => {
  return entries.flatMap((entry) => entry.blockingReasons.map((reason) => buildFindingForReason(entry, reason)));
};

const rankWeakestAiReachableEntries = (entries: ChildCapabilityStrengthEntry[]) => entries
  .filter((entry) => entry.allowedForAiActionPlan)
  .sort((left, right) => {
    if (left.strengthLevel !== right.strengthLevel) {
      return left.strengthLevel - right.strengthLevel;
    }
    return `${left.abilityGroupId}.${left.childCapabilityId}`.localeCompare(`${right.abilityGroupId}.${right.childCapabilityId}`);
  })
  .slice(0, 5)
  .map((entry) => ({
    abilityGroupId: entry.abilityGroupId,
    childCapabilityId: entry.childCapabilityId,
    strengthLevel: entry.strengthLevel,
    aiActionCodes: entry.aiActionCodes,
    blockingReasons: entry.blockingReasons,
  }));

const writeChildCapabilityStrengthReports = async (input: {
  entries: ChildCapabilityStrengthEntry[];
  findings: Finding[];
  phases: InspectorPhase[];
}): Promise<void> => {
  const summaryPayload = {
    findingCount: input.findings.length,
    weakestAiReachableChildren: rankWeakestAiReachableEntries(input.entries),
  };
  const directOutputPayload = {
    findingCount: input.findings.length,
    firstFinding: input.findings[0] ?? null,
    firstPhase: input.phases[0] ?? null,
  };

  await Promise.all([
    writeJsonFile(pathFromRepoRoot(SUMMARY_RELATIVE_PATH), summaryPayload),
    writeJsonFile(pathFromRepoRoot(DIRECT_OUTPUT_RELATIVE_PATH), directOutputPayload),
  ]);
};

export async function runChildCapabilityStrengthInspector(): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> {
  const inventory = await buildChildCapabilityStrengthInventory();
  const findings = [
    ...collectBlockingFindings(inventory.entries),
  ];
  if (findings.length > 0) {
    await writeChildCapabilityStrengthInventory();
  }
  const phases = [createPhase(
    "child-capability-strength",
    findings.length === 0 ? "PASS" : "CODE VIOLATION",
    findings.length === 0,
    findings.length === 0
      ? "AI-reachable child capabilities meet the current executable-strength minimum without emitting support inventory."
      : `Child capability strength support inventory written to ${INVENTORY_RELATIVE_PATH}.`,
  )];

  await writeChildCapabilityStrengthReports({ entries: inventory.entries, findings, phases });

  return { findings, phases };
}