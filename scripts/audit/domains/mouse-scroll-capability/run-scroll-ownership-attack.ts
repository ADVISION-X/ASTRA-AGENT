import { toRepoRelativePath } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";

import { getSourceFile, makeProject } from "./project-access.js";
import { PATHS } from "./config.js";

const LAW_ID = "GRASSEYE-MOUSE-SCROLL-CAPABILITY-001-V2";
const EXTERNAL_SCROLL_ROOTS = ["src/lib/local-runtime/", "src/lib/browser/", "src/features/platform-action/"] as const;
const BUSINESS_VERBS = ["scroll-next-video", "scroll_next_video", "continue_next", "scroll_until_found", "open_comments", "capture_comment_region", "capture_video_region"] as const;
const BUSINESS_VERB_OWNER_PATHS = ["/runtime/", "/children/", "/ability-group.ts", "/registry.ts"] as const;

function collectPublicContractFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const contractSource = getSourceFile(project, PATHS.CONTRACT);
  if (!contractSource) {
    return [];
  }

  const contractText = contractSource.getFullText();
  return contractText.includes("BrowserController") || contractText.includes("BrowserActionResult") || contractText.includes("BrowserActionId")
    ? [createFinding({ lawId: LAW_ID, file: PATHS.CONTRACT, line: 1, severity: "fatal", message: "Mouse Scroll public contract must not expose BrowserController or browser action result types." })]
    : [];
}

function collectExternalScrollOwnerFindings(project: ReturnType<typeof makeProject>): Finding[] {
  return project.getSourceFiles().flatMap((sourceFile) => {
    const repoPath = toRepoRelativePath(sourceFile.getFilePath());
    if (repoPath === PATHS.PRIMITIVE_ADAPTER || !EXTERNAL_SCROLL_ROOTS.some((root) => repoPath.startsWith(root))) {
      return [];
    }

    const sourceText = sourceFile.getFullText();
    return sourceText.includes("browserController.scroll(") || sourceText.includes("scrollStrategy")
      ? [createFinding({ lawId: LAW_ID, file: repoPath, line: 1, severity: "fatal", message: "Platform adapters, runtime, and browser helpers must not own scroll strategy or call browser scroll primitives directly." })]
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
      findings.push(createFinding({ lawId: LAW_ID, file: repoPath, line: 1, severity: "fatal", message: "Mouse Scroll must not write or expose final action-log truth." }));
    }
    if (BUSINESS_VERB_OWNER_PATHS.some((segment) => repoPath.includes(segment)) && BUSINESS_VERBS.some((verb) => sourceText.includes(verb))) {
      findings.push(createFinding({ lawId: LAW_ID, file: repoPath, line: 1, severity: "fatal", message: "Mouse Scroll must not embed platform business verbs inside the owner boundary." }));
    }
    return findings;
  });
}

export function runScrollOwnershipAttack(project: ReturnType<typeof makeProject> = makeProject()): { findings: Finding[]; phase: InspectorPhase } {
  const findings = [
    ...collectPublicContractFindings(project),
    ...collectExternalScrollOwnerFindings(project),
    ...collectActionLogAndVerbFindings(project),
  ];

  const passed = findings.length === 0;
  return {
    findings,
    phase: createPhase(
      "scroll-ownership-attack",
      passed ? "PASS" : "CODE VIOLATION",
      passed,
      passed
        ? "Mouse Scroll ownership stays isolated to governed primitive scroll execution and post-action handoff only."
        : "Mouse Scroll ownership drifted into public contract leaks, external scroll owners, or final action-log/business-verb truth.",
    ),
  };
}