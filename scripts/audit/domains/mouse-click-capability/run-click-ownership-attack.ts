import { toRepoRelativePath } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";

import { getSourceFile, makeProject } from "./audit-project.js";
import { PATHS } from "./config.js";

const LAW_ID = "GRASSEYE-MOUSE-CLICK-CAPABILITY-001-V2";
const EXTERNAL_OWNER_ROOTS = ["src/lib/local-runtime/", "src/lib/browser/"] as const;
const BUSINESS_VERBS = ["open_comments", "click_not_interested", "like_or_save_candidate", "continue_next"] as const;
const EXTERNAL_CLICK_OWNER_MARKERS = ["clickStrategy", "executePrimitiveClick", "primitiveClickOwner"] as const;
const BUSINESS_VERB_OWNER_PATHS = ["/runtime/", "/children/", "/ability-group.ts", "/registry.ts"] as const;

function collectPublicContractFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const contractSource = getSourceFile(project, PATHS.CONTRACT);
  if (!contractSource) {
    return [];
  }

  const contractText = contractSource.getFullText();
  return contractText.includes("BrowserController") || contractText.includes("BrowserActionResult") || contractText.includes("BrowserActionId")
    ? [createFinding({ lawId: LAW_ID, file: PATHS.CONTRACT, line: 1, severity: "fatal", message: "Mouse Click public contract must not expose BrowserController or browser primitive result types." })]
    : [];
}

function collectExternalOwnerFindings(project: ReturnType<typeof makeProject>): Finding[] {
  return project.getSourceFiles().flatMap((sourceFile) => {
    const repoPath = toRepoRelativePath(sourceFile.getFilePath());
    if (repoPath === PATHS.PRIMITIVE_ADAPTER || !EXTERNAL_OWNER_ROOTS.some((root) => repoPath.startsWith(root))) {
      return [];
    }

    const sourceText = sourceFile.getFullText();
    const hasExternalClickOwner = EXTERNAL_CLICK_OWNER_MARKERS.some((marker) => sourceText.includes(marker)) || sourceText.includes("browserController.click(");
    return hasExternalClickOwner
      ? [createFinding({ lawId: LAW_ID, file: repoPath, line: 1, severity: "fatal", message: "Platform adapters, runtime, and browser helpers must not own click execution truth or call browser click primitives directly." })]
      : [];
  });
}

function collectActionLogAndVerbFindings(project: ReturnType<typeof makeProject>): Finding[] {
  return project.getSourceFiles().flatMap((sourceFile) => {
    const repoPath = toRepoRelativePath(sourceFile.getFilePath());
    if (!repoPath.startsWith(`${PATHS.ROOT}/`)) {
      return [];
    }

    const sourceText = sourceFile.getFullText();
    const findings: Finding[] = [];
    if (sourceText.includes("actionLogRef") || sourceText.includes("writeActionLog")) {
      findings.push(createFinding({ lawId: LAW_ID, file: repoPath, line: 1, severity: "fatal", message: "Mouse Click must not write or expose final action-log truth." }));
    }
    const isBusinessVerbOwnerPath = BUSINESS_VERB_OWNER_PATHS.some((segment) => repoPath.includes(segment));
    if (isBusinessVerbOwnerPath && BUSINESS_VERBS.some((verb) => sourceText.includes(verb))) {
      findings.push(createFinding({ lawId: LAW_ID, file: repoPath, line: 1, severity: "fatal", message: "Mouse Click must not embed platform business verbs inside the owner boundary." }));
    }
    return findings;
  });
}

export function runClickOwnershipAttack(project: ReturnType<typeof makeProject> = makeProject()): { findings: Finding[]; phase: InspectorPhase } {
  const findings = [
    ...collectPublicContractFindings(project),
    ...collectExternalOwnerFindings(project),
    ...collectActionLogAndVerbFindings(project),
  ];

  const passed = findings.length === 0;
  return {
    findings,
    phase: createPhase(
      "click-ownership-attack",
      passed ? "PASS" : "CODE VIOLATION",
      passed,
      passed
        ? "Mouse Click ownership stays isolated to primitive click execution and post-action handoff only."
        : "Mouse Click ownership drifted into public contract leaks, external click owners, or final action-log/business-verb truth.",
    ),
  };
}