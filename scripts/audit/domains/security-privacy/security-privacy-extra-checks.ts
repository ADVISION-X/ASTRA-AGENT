import { createPhase } from "../../core/result.js";
import { listFilesRecursive, readTextFile } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { scanFilesForPatterns } from "../_shared/scan-for-patterns.js";
import { readEvidenceStoreSource } from "./evidence-store-source.js";
import { hasLocalSecurityBoundary } from "./local-security-boundary-gate.js";
import { SENSITIVE_PATTERNS } from "./sensitive-pattern-rules.js";

const createLocalBoundaryPhase = (passed: boolean) =>
  createPhase(
    "local-security-boundary",
    passed ? "PASS" : "LAW-SCRIPT DRIFT",
    passed,
    passed
      ? "Local host binding and local evidence storage stay inside the authorized local environment."
      : "Security boundary drifted away from local-only host or storage posture.",
  );

const createSensitiveSurfacePhase = (findingCount: number) =>
  createPhase(
    "sensitive-surface-scan",
    findingCount === 0 ? "PASS" : "CODE VIOLATION",
    findingCount === 0,
    findingCount === 0
      ? "No obvious sensitive export or public exposure pattern was found in source files."
      : "Sensitive export or public exposure pattern was found in source files.",
  );

export const runSecurityPrivacyExtraChecks = async () => {
  const sourceFiles = await listFilesRecursive(pathFromRepoRoot("src"), { extensions: [".ts"] });
  const serverSource = await readTextFile(pathFromRepoRoot("src/app/server.ts"));
  const evidenceStoreSource = await readEvidenceStoreSource();
  const findings = await scanFilesForPatterns(sourceFiles, SENSITIVE_PATTERNS);
  const localBoundaryPassed = hasLocalSecurityBoundary(serverSource, evidenceStoreSource);

  return {
    findings,
    phases: [
      createLocalBoundaryPhase(localBoundaryPassed),
      createSensitiveSurfacePhase(findings.length),
    ],
  };
};
