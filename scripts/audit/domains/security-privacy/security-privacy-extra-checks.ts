import { createPhase } from "../../core/result.js";
import { listFilesRecursive } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createAuditProject, getSourceFileOrThrow } from "../_shared/ast-helpers.js";
import { scanFilesForPatterns } from "../_shared/scan-for-patterns.js";
import { resolveEvidenceStorePath } from "./evidence-store-source.js";
import { hasLocalSecurityBoundary } from "./local-security-boundary-gate.js";
import { runNegativeProofHarness } from "./negative-proof-harness.js";
import { SENSITIVE_PATTERNS } from "./sensitive-pattern-rules.js";

const SKIP_NEGATIVE_PROOF_ENV = "GRASSEYE_SKIP_SECURITY_PRIVACY_NEGATIVE_PROOF";

const createLocalBoundaryPhase = (passed: boolean) =>
  createPhase(
    "local-security-boundary",
    passed ? "PASS" : "CODE VIOLATION",
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
  const project = createAuditProject();
  const sourceFiles = await listFilesRecursive(pathFromRepoRoot("src"), { extensions: [".ts"] });
  const evidenceStorePath = await resolveEvidenceStorePath();
  const serverSource = getSourceFileOrThrow(project, "src/app/server.ts");
  const evidenceStoreSource = getSourceFileOrThrow(project, evidenceStorePath);
  const findings = await scanFilesForPatterns(sourceFiles, SENSITIVE_PATTERNS);
  const localBoundaryPassed = hasLocalSecurityBoundary(serverSource, evidenceStoreSource);
  const negativeProof = process.env[SKIP_NEGATIVE_PROOF_ENV] === "1"
    ? {
        findings: [],
        phase: createPhase(
          "negative-proof-harness",
          "PASS",
          true,
          "Security privacy negative-proof harness was skipped for nested inspector execution.",
        ),
      }
    : await runNegativeProofHarness();

  return {
    findings: [...findings, ...negativeProof.findings],
    phases: [
      createLocalBoundaryPhase(localBoundaryPassed),
      createSensitiveSurfacePhase(findings.length),
      negativeProof.phase,
    ],
  };
};
