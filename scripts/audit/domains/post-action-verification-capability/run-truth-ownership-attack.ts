import type { Project } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";

import { LAW_IDS, PATHS } from "./config.js";
import { createPostActionAuditProject, getRepoPath } from "./project-access.js";

const EXTERNAL_VERIFICATION_OWNER_ROOTS = [
  "src/capabilities/open/",
  "src/capabilities/mouse-click/",
  "src/capabilities/mouse-scroll/",
  "src/capabilities/text-input/",
  "src/capabilities/orchestration/",
  "src/capabilities/forensics-persistence/",
] as const;
const EXTERNAL_BUNDLE_TOKENS = ["postActionObservationRef", "actionObservationBundleRef"] as const;

function collectExternalTruthFindings(project: Project): Finding[] {
  return project.getSourceFiles().flatMap((sourceFile) => {
    const repoPath = getRepoPath(sourceFile);
    if (repoPath.startsWith(`${PATHS.ROOT}/`) || !EXTERNAL_VERIFICATION_OWNER_ROOTS.some((root) => repoPath.startsWith(root))) {
      return [];
    }

    const sourceText = sourceFile.getFullText();
    return EXTERNAL_BUNDLE_TOKENS.some((token) => sourceText.includes(token))
      ? [createFinding({ lawId: LAW_IDS.PUBLIC, file: repoPath, line: 1, severity: "fatal", message: "External action owners must not fabricate or expose PAV observation-bundle refs outside Post Action Verification." })]
      : [];
  });
}

export function runTruthOwnershipAttack(project: Project = createPostActionAuditProject()): { findings: Finding[]; phase: InspectorPhase } {
  const findings = collectExternalTruthFindings(project);
  const passed = findings.length === 0;
  return {
    findings,
    phase: createPhase(
      "truth-ownership",
      passed ? "PASS" : "CODE VIOLATION",
      passed,
      passed
        ? "Post Action Verification remains the only owner of post-action observation-bundle refs."
        : "Post Action Verification bundle refs leaked into external action, page-state, orchestration, or forensics owners.",
    ),
  };
}