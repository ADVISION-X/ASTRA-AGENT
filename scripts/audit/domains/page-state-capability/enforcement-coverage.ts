import { readFile } from "node:fs/promises";

import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorContext, InspectorPhase } from "../../core/schema.js";

const CAPABILITY_DOMAIN = "page-state-capability";
const INSPECTOR_ID = "page-state-capability-owner";
const FINAL_LAW_PATH = ".github/instructions/cursor-rules/modules/module-page-state-capability.instructions.md";
const FINAL_BLUEPRINT_PATH = "docs/法案辅助文件/GrassEye Page State 页面状态感知能力组施工图.md";
const RUNNER_SUMMARY_PATH = "scripts/audit/generated/runner-summary.json";
const DIRECT_OWNER_AUDIT_ENV = "GRASSEYE_DIRECT_PAGE_STATE_OWNER_AUDIT";
const REQUIRED_LAW_IDS = [
  "GRASSEYE-PAGE-STATE-CAPABILITY-001-V2",
  "GRASSEYE-PAGE-STATE-CAPABILITY-002-V2",
  "GRASSEYE-PAGE-STATE-CAPABILITY-003-V2",
  "GRASSEYE-PAGE-STATE-CAPABILITY-004-V2",
  "GRASSEYE-PAGE-STATE-CAPABILITY-005-V2",
  "GRASSEYE-PAGE-STATE-CAPABILITY-006-V2",
  "GRASSEYE-PAGE-STATE-CAPABILITY-007-V2",
  "GRASSEYE-PAGE-STATE-CAPABILITY-008-V2",
] as const;

type RunnerSummary = {
  results?: Array<{
    capabilityDomain?: string;
    inspectorId?: string;
  }>;
};

async function inspectFinalLawBaseline(): Promise<Finding[]> {
  try {
    const raw = await readFile(pathFromRepoRoot(FINAL_LAW_PATH), "utf8");
    const findings: Finding[] = [];

    if (!raw.includes("tier: P0")) {
      findings.push(createFinding({
        lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-008-V2",
        file: FINAL_LAW_PATH,
        line: 1,
        severity: "fatal",
        message: "Page State FINAL law baseline must remain P0.",
      }));
    }

    if (!raw.includes("enforcementMode: machine-blocking")) {
      findings.push(createFinding({
        lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-008-V2",
        file: FINAL_LAW_PATH,
        line: 1,
        severity: "fatal",
        message: "Page State FINAL law baseline must remain machine-blocking.",
      }));
    }

    if (!raw.includes("evidenceMode: law+inspector")) {
      findings.push(createFinding({
        lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-008-V2",
        file: FINAL_LAW_PATH,
        line: 1,
        severity: "fatal",
        message: "Page State FINAL law baseline must require law+inspector evidence.",
      }));
    }

    return findings;
  } catch {
    return [createFinding({
      lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-008-V2",
      file: FINAL_LAW_PATH,
      line: 1,
      severity: "fatal",
      message: "Page State FINAL law file is missing or unreadable.",
    })];
  }
}

function compareLawSets(input: {
  actual: readonly string[];
  expected: readonly string[];
  file: string;
  message: string;
}): Finding[] {
  const actual = [...input.actual].sort();
  const expected = [...input.expected].sort();
  if (actual.length === expected.length && actual.every((lawId, index) => lawId === expected[index])) {
    return [];
  }

  return [createFinding({
    lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-008-V2",
    file: input.file,
    line: 1,
    severity: "fatal",
    message: input.message,
    detail: `expected=${expected.join(",")} actual=${actual.join(",")}`,
  })];
}

async function inspectRunnerSummary(): Promise<Finding[]> {
  if (process.env[DIRECT_OWNER_AUDIT_ENV] === "1") {
    return [];
  }

  try {
    const raw = await readFile(pathFromRepoRoot(RUNNER_SUMMARY_PATH), "utf8");
    const runnerSummary = JSON.parse(raw) as RunnerSummary;
    return Array.isArray(runnerSummary.results)
      ? []
      : [createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-008-V2", file: RUNNER_SUMMARY_PATH, line: 1, severity: "fatal", message: "runner-summary must remain readable structured JSON while Page State enforcement coverage runs." })];
  } catch {
    return [createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-008-V2", file: RUNNER_SUMMARY_PATH, line: 1, severity: "fatal", message: "runner-summary is missing or unreadable for Page State enforcement coverage." })];
  }
}

function collectActiveLawSetFindings(activeLawIds: readonly string[]): Finding[] {
  return compareLawSets({
    actual: activeLawIds,
    expected: REQUIRED_LAW_IDS,
    file: FINAL_LAW_PATH,
    message: "Page State active law set must exactly match the FINAL V2 law registry.",
  });
}

function collectActiveLawMetadataFindings(activeLaws: Array<{
  lawId: string;
  relativeFilePath: string;
  line: number;
  enforcementMode: string;
  evidenceMode: string;
  tier: string;
}>): Finding[] {
  const findings: Finding[] = [];

  for (const law of activeLaws) {
    if (law.enforcementMode !== "machine-blocking") {
      findings.push(createFinding({ lawId: law.lawId, file: law.relativeFilePath, line: law.line, severity: "fatal", message: "Page State active law must be machine-blocking." }));
    }
    if (law.evidenceMode !== "law+inspector") {
      findings.push(createFinding({ lawId: law.lawId, file: law.relativeFilePath, line: law.line, severity: "fatal", message: "Page State active law must require law+inspector evidence." }));
    }
    if (law.tier !== "P0") {
      findings.push(createFinding({ lawId: law.lawId, file: law.relativeFilePath, line: law.line, severity: "fatal", message: "Page State active law must remain P0." }));
    }
  }

  return findings;
}

function collectManifestCoverageFindings(manifest: {
  allowedLawIds: readonly string[];
  manifestPath: string;
  readsLawFiles: readonly string[];
  readsBlueprintFiles?: readonly string[];
} | undefined): Finding[] {
  if (!manifest) {
    return [];
  }

  const findings = compareLawSets({
    actual: manifest.allowedLawIds,
    expected: REQUIRED_LAW_IDS,
    file: manifest.manifestPath,
    message: "Page State manifest allowedLawIds must exactly match active V2 laws.",
  });

  if (!manifest.readsLawFiles.includes(FINAL_LAW_PATH)) {
    findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-008-V2", file: manifest.manifestPath, line: 1, severity: "fatal", message: "Page State manifest must read the FINAL law file." }));
  }
  if (!(manifest.readsBlueprintFiles ?? []).includes(FINAL_BLUEPRINT_PATH)) {
    findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-008-V2", file: manifest.manifestPath, line: 1, severity: "fatal", message: "Page State manifest must read the FINAL blueprint file." }));
  }

  return findings;
}

function collectMatrixCoverageFindings(matrixOwner: { lawIds: readonly string[]; manifestPath: string } | undefined): Finding[] {
  return matrixOwner
    ? compareLawSets({
        actual: matrixOwner.lawIds,
        expected: REQUIRED_LAW_IDS,
        file: matrixOwner.manifestPath,
        message: "Page State enforcement matrix must carry the full V2 law set.",
      })
    : [];
}

function collectPlanCoverageFindings(planOwner: { lawIds: readonly string[]; entry: string } | undefined): Finding[] {
  return planOwner
    ? compareLawSets({
        actual: planOwner.lawIds,
        expected: REQUIRED_LAW_IDS,
        file: planOwner.entry,
        message: "Page State audit plan must carry the full V2 law set.",
      })
    : [];
}

export async function runEnforcementCoverage(context: InspectorContext): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const activeLaws = context.lawRegistry.laws.filter((law) => law.capabilityDomain === CAPABILITY_DOMAIN);
  const activeLawIds = activeLaws.map((law) => law.lawId);
  const manifest = context.manifestsByDomain.get(CAPABILITY_DOMAIN);
  const matrixOwner = context.matrixOwnersByDomain.get(CAPABILITY_DOMAIN);
  const planOwner = context.planOwnersByDomain.get(CAPABILITY_DOMAIN);
  const findings = [
    ...await inspectFinalLawBaseline(),
    ...collectActiveLawSetFindings(activeLawIds),
    ...collectActiveLawMetadataFindings(activeLaws),
    ...collectManifestCoverageFindings(manifest),
    ...collectMatrixCoverageFindings(matrixOwner),
    ...collectPlanCoverageFindings(planOwner),
    ...await inspectRunnerSummary(),
  ];

  const phasePassed = findings.length === 0;
  return {
    findings,
    phase: createPhase(
      "page-state-enforcement-coverage",
      phasePassed ? "PASS" : "ENFORCEMENT GAP",
      phasePassed,
      phasePassed
        ? "Page State FINAL law, manifest, matrix, audit-plan, and runner-summary are aligned."
        : "Page State enforcement metadata drifted from the FINAL V2 law chain.",
    ),
  };
}