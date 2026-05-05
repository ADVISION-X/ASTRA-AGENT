import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorContext, InspectorPhase } from "../../core/schema.js";

import { openInspectionConstants } from "./inspection-constants.js";

const {
  CAPABILITY_DOMAIN,
  FINAL_BLUEPRINT_PATH,
  FINAL_LAW_PATH,
  LAW_ENFORCEMENT,
} = {
  CAPABILITY_DOMAIN: "open-capability",
  FINAL_BLUEPRINT_PATH: openInspectionConstants.FINAL_BLUEPRINT_PATH,
  FINAL_LAW_PATH: openInspectionConstants.FINAL_LAW_PATH,
  LAW_ENFORCEMENT: openInspectionConstants.LAW_ENFORCEMENT,
} as const;

const INSPECTOR_ID = "open-capability-owner";
const REQUIRED_LAW_IDS = [
  "GRASSEYE-OPEN-CAPABILITY-001-V2",
  "GRASSEYE-OPEN-CAPABILITY-002-V2",
  "GRASSEYE-OPEN-CAPABILITY-003-V2",
  "GRASSEYE-OPEN-CAPABILITY-004-V2",
  "GRASSEYE-OPEN-CAPABILITY-005-V2",
  "GRASSEYE-OPEN-CAPABILITY-006-V2",
  "GRASSEYE-OPEN-CAPABILITY-007-V2",
  "GRASSEYE-OPEN-CAPABILITY-008-V2",
  "GRASSEYE-OPEN-CAPABILITY-009-V1",
] as const;

type OpenLawRecord = {
  lawId: string;
  line: number;
  relativeFilePath: string;
  enforcementMode: string;
  evidenceMode: string;
  tier: string;
};

type ManifestLike = {
  allowedLawIds: string[];
  manifestPath: string;
  readsLawFiles: string[];
  readsBlueprintFiles?: string[];
};

type MatrixOwnerLike = { lawIds: string[]; manifestPath: string };
type PlanOwnerLike = { lawIds: string[]; entry: string };

function collectMissingLawCoverage(input: {
  actual: readonly string[];
  expected: readonly string[];
  file: string;
  message: string;
}): Finding[] {
  const missingLaws = input.expected.filter((lawId) => !input.actual.includes(lawId));
  return missingLaws.length === 0
    ? []
    : [createFinding({
      lawId: LAW_ENFORCEMENT,
      file: input.file,
      line: 1,
      severity: "fatal",
      message: input.message,
      detail: missingLaws.join(","),
    })];
}

const collectActiveLawFindings = (activeLaws: readonly OpenLawRecord[], activeLawIds: readonly string[]): Finding[] => {
  const findings = collectMissingLawCoverage({
    actual: activeLawIds,
    expected: REQUIRED_LAW_IDS,
    file: FINAL_LAW_PATH,
    message: "Open FINAL law file must register the full V2 law set.",
  });

  for (const law of activeLaws) {
    if (law.enforcementMode !== "machine-blocking") {
      findings.push(createFinding({ lawId: law.lawId, file: law.relativeFilePath, line: law.line, severity: "fatal", message: "Open active law must remain machine-blocking." }));
    }
    if (law.evidenceMode !== "law+inspector+negative-proof") {
      findings.push(createFinding({ lawId: law.lawId, file: law.relativeFilePath, line: law.line, severity: "fatal", message: "Open active law must require law+inspector+negative-proof evidence." }));
    }
    if (law.tier !== "P0") {
      findings.push(createFinding({ lawId: law.lawId, file: law.relativeFilePath, line: law.line, severity: "fatal", message: "Open active law must remain P0." }));
    }
  }

  return findings;
};

const collectManifestFindings = (manifest: ManifestLike | undefined): Finding[] => {
  if (!manifest) {
    return [];
  }

  const findings = collectMissingLawCoverage({
    actual: manifest.allowedLawIds,
    expected: REQUIRED_LAW_IDS,
    file: manifest.manifestPath,
    message: "Open manifest allowedLawIds must include the full V2 law set.",
  });

  if (!manifest.readsLawFiles.includes(FINAL_LAW_PATH)) {
    findings.push(createFinding({ lawId: LAW_ENFORCEMENT, file: manifest.manifestPath, line: 1, severity: "fatal", message: "Open manifest must read the FINAL Open law file." }));
  }
  if (!(manifest.readsBlueprintFiles ?? []).includes(FINAL_BLUEPRINT_PATH)) {
    findings.push(createFinding({ lawId: LAW_ENFORCEMENT, file: manifest.manifestPath, line: 1, severity: "fatal", message: "Open manifest must read the FINAL Open blueprint file." }));
  }

  return findings;
};

const collectGeneratedCoverageFindings = (matrixOwner: MatrixOwnerLike | undefined, planOwner: PlanOwnerLike | undefined): Finding[] => {
  return [
    ...(matrixOwner ? collectMissingLawCoverage({ actual: matrixOwner.lawIds, expected: REQUIRED_LAW_IDS, file: matrixOwner.manifestPath, message: "Open enforcement matrix must include the full V2 law set." }) : []),
    ...(planOwner ? collectMissingLawCoverage({ actual: planOwner.lawIds, expected: REQUIRED_LAW_IDS, file: planOwner.entry, message: "Open audit plan must include the full V2 law set." }) : []),
  ];
};

export async function runOpenEnforcementCoverage(context: InspectorContext): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const activeLaws = context.lawRegistry.laws.filter((law) => {
    return law.relativeFilePath === FINAL_LAW_PATH && REQUIRED_LAW_IDS.includes(law.lawId as (typeof REQUIRED_LAW_IDS)[number]);
  });
  const activeLawIds = activeLaws.map((law) => law.lawId);
  const manifest = context.manifestsByDomain.get(CAPABILITY_DOMAIN);
  const matrixOwner = context.matrixOwnersByDomain.get(CAPABILITY_DOMAIN);
  const planOwner = context.planOwnersByDomain.get(CAPABILITY_DOMAIN);
  const findings = [
    ...collectActiveLawFindings(activeLaws, activeLawIds),
    ...collectManifestFindings(manifest),
    ...collectGeneratedCoverageFindings(matrixOwner, planOwner),
  ];

  const phasePassed = findings.length === 0;
  return {
    findings,
    phase: createPhase(
      "open-enforcement-coverage",
      phasePassed ? "PASS" : "ENFORCEMENT GAP",
      phasePassed,
      phasePassed
        ? "Open FINAL law, manifest, matrix, audit-plan, and runner-summary are aligned."
        : "Open enforcement metadata drifted away from the FINAL V2 law chain.",
    ),
  };
}
