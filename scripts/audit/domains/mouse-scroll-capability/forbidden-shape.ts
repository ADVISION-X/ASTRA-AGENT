import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { LAW_IDS, FORBIDDEN_TEXT_TOKENS, PATHS } from "./config.js";
import { getMouseScrollSourceFiles, makeProject, toMouseScrollRelativePath } from "./project-access.js";
import { sourceHasDynamicImport, sourceHasExportStar, sourceHasForbiddenImport, sourceHasNewDateOutsideClock, sourceHasPrimitiveScrollCall, sourceHasRequire } from "./source-rules.js";

const ALLOWED_PRIMITIVE_SCROLL_CALL_FILES = new Set<string>([PATHS.RUNNER_PORT_CALL]);

const getForbiddenTokenLawId = (token: string): string => {
  if (token === "scroll_until_found") {
    return LAW_IDS.SCROLL_POLICY;
  }
  if (["scroll-next-video", "scroll_next_video", "continue_next", "open_comments", "capture_comment_region", "capture_video_region"].includes(token)) {
    return LAW_IDS.CHILDREN;
  }
  if (["BrowserActionId", "BrowserActionResult", "postActionVerificationDecision", "fallbackUsed"].includes(token)) {
    return LAW_IDS.RESULT;
  }
  return LAW_IDS.BOUNDARY;
};

function collectStructuralFindings(relativePath: string, sourceText: string, sourceFile: Parameters<typeof sourceHasExportStar>[0]): Finding[] {
  const findings: Finding[] = [];
  if (sourceHasExportStar(sourceFile)) {
    findings.push(createFinding({ lawId: LAW_IDS.EXECUTION, file: relativePath, line: 1, severity: "fatal", message: "Mouse Scroll must not use export *." }));
  }
  if (sourceHasDynamicImport(sourceFile)) {
    findings.push(createFinding({ lawId: LAW_IDS.EXECUTION, file: relativePath, line: 1, severity: "fatal", message: "Mouse Scroll must not use dynamic import escape paths." }));
  }
  if (sourceHasRequire(sourceFile)) {
    findings.push(createFinding({ lawId: LAW_IDS.EXECUTION, file: relativePath, line: 1, severity: "fatal", message: "Mouse Scroll must not use require escape paths." }));
  }
  for (const token of FORBIDDEN_TEXT_TOKENS) {
    if (sourceText.includes(token)) {
      findings.push(createFinding({ lawId: getForbiddenTokenLawId(token), file: relativePath, line: 1, severity: "fatal", message: `Mouse Scroll contains forbidden token ${token}.` }));
    }
  }
  return findings;
}

function collectExecutionFindings(relativePath: string, sourceFile: Parameters<typeof sourceHasExportStar>[0]): Finding[] {
  const findings: Finding[] = [];
  if (relativePath !== PATHS.CLOCK && sourceHasNewDateOutsideClock(sourceFile)) {
    findings.push(createFinding({ lawId: LAW_IDS.TIMING, file: relativePath, line: 1, severity: "fatal", message: "Mouse Scroll must source time from the clock port only." }));
  }
  if (!ALLOWED_PRIMITIVE_SCROLL_CALL_FILES.has(relativePath) && sourceHasPrimitiveScrollCall(sourceFile)) {
    findings.push(createFinding({ lawId: LAW_IDS.EXECUTION, file: relativePath, line: 1, severity: "fatal", message: "primitivePort.scroll must not appear outside primitive-scroll-runner." }));
  }
  if (sourceHasForbiddenImport(sourceFile)) {
    findings.push(createFinding({ lawId: LAW_IDS.BOUNDARY, file: relativePath, line: 1, severity: "fatal", message: "Mouse Scroll must not import forbidden ability internals." }));
  }
  return findings;
}

export function runForbiddenShapeAttack(): { findings: Finding[]; phase: InspectorPhase } {
  const project = makeProject();
  const findings: Finding[] = [];
  for (const sourceFile of getMouseScrollSourceFiles(project)) {
    const relativePath = toMouseScrollRelativePath(sourceFile);
    const fullText = sourceFile.getFullText();
    findings.push(...collectStructuralFindings(relativePath, fullText, sourceFile));
    findings.push(...collectExecutionFindings(relativePath, sourceFile));
  }

  const passed = findings.length === 0;
  return {
    findings,
    phase: createPhase(
      "forbidden-shape",
      passed ? "PASS" : "CODE VIOLATION",
      passed,
      passed
        ? "Mouse Scroll avoids export laundering, direct primitive leaks, wall-clock drift, and escape tokens."
        : "Mouse Scroll still contains forbidden execution shapes or escape hatches.",
    ),
  };
}