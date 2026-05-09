import { readFile } from "node:fs/promises";

import { listFilesRecursive } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";

import { LAW_IDS, PATHS } from "./config.js";

const EXTRA_TRANSPORT_FILES = [
  PATHS.WORKBENCH,
  PATHS.HUMAN_COMMAND_DISPATCH,
  PATHS.COMMANDER_COMMAND_TRANSPORT,
  PATHS.ORCHESTRATION_ADAPTER,
  PATHS.ORCHESTRATION_ENVELOPE_BUILDERS,
  PATHS.STEP_DISPATCHER,
] as const;

const FORBIDDEN_JOINT_RESULT_TOKENS = [
  "geometryGuardHandoff",
  "geometryGuardHandoffRef",
  "normalizedClickPoint",
  "postActionVerificationHandoffRef",
  "resolveVisualTargetGeometryHandoff",
  "resolveGeometryGuardClickHandoff",
  "resolveMouseClickPostVerificationHandoff",
  "parseVisualTargetGeometryGuardHandoff",
  "parseGeometryGuardMouseClickHandoff",
  "parseMouseClickPostVerificationHandoff",
] as const;

type BoundaryCheckResult = {
  findings: Finding[];
  phase: InspectorPhase;
};

const readRepoFile = (file: string) => readFile(pathFromRepoRoot(file), "utf8");

async function collectTransportFiles(): Promise<string[]> {
  const nerveBusFiles = (await listFilesRecursive(pathFromRepoRoot(PATHS.ROOT)))
    .filter((file) => file.endsWith(".ts"))
    .map((file) => file.slice(pathFromRepoRoot(".").length + 1));
  return [...new Set([...nerveBusFiles, ...EXTRA_TRANSPORT_FILES])];
}

function collectForbiddenTokenFindings(file: string, text: string): Finding[] {
  return FORBIDDEN_JOINT_RESULT_TOKENS.flatMap((token) => {
    return text.includes(token)
      ? [createFinding({ lawId: LAW_IDS.BOUNDARY, file, line: 1, severity: "fatal", message: `Nerve Bus transport must not inspect or parse muscle-joint result contracts: ${token}.` })]
      : [];
  });
}

export async function runJointResultContractBoundaryCheck(): Promise<BoundaryCheckResult> {
  const files = await collectTransportFiles();
  const texts = await Promise.all(files.map(async (file) => ({ file, text: await readRepoFile(file) })));
  const findings = texts.flatMap(({ file, text }) => collectForbiddenTokenFindings(file, text));

  return {
    findings,
    phase: createPhase(
      "joint-result-contract-boundary",
      findings.length === 0 ? "PASS" : "CODE VIOLATION",
      findings.length === 0,
      findings.length === 0
        ? "Nerve Bus stays transport-only and does not inspect muscle-joint result contracts."
        : "Nerve Bus drifted into muscle-joint contract parsing or interpretation.",
    ),
  };
}