import { execSync } from "node:child_process";
import path from "node:path";

import { createPhase, finalizeInspectorResult } from "../../core/result.js";
import type { DomainInspector, Finding, InspectorPhase } from "../../core/schema.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const VT_SRC_ROOT = "src/capabilities/visual-target";
const VT_AUDIT_ROOT = "scripts/audit/domains/visual-target-capability";

const ACTIVE_CHILDREN = [
  "package-grid-cell-target-once",
  "package-grid-region-target-once",
  "package-bbox-target-once",
] as const;

const FORBIDDEN_CHILDREN = [
  "observe-like-button",
  "observe-save-button",
  "observe-comments-button",
  "observe-close-comments-button",
  "observe-comments-panel",
  "observe-next-video-region",
  "observe-next-item-target-candidate",
  "observe-not-interested-button",
  "observe-metric-like-count",
  "observe-metric-comment-count",
];

const FORBIDDEN_GATE_PATTERNS = [
  "target-selection-gate",
  "page-state-consistency-gate",
  "visual-target-selection",
  "ambiguity-gate",
  "ai-result-proof-gate",
  "candidate-readiness-gate",
  "candidate-source-gate",
  "execution-stage",
  "visual-target-chain",
  "visual-target-executor",
];

const FORBIDDEN_EXECUTABLE_PATTERNS = [
  "executableX",
  "executableY",
  "normalizedClickPoint",
  "clickResult",
  "scrollResult",
  "primitiveExecution",
  "approve execution",
  "executionApproved",
];

const FORBIDDEN_BUSINESS_SEMANTIC_PATTERNS = [
  "businessVerb",
  "semanticTarget",
  "visualMeaning",
  "likeButtonTruth",
  "commentButtonTruth",
  "saveButtonTruth",
  "nextVideoTruth",
  "metricTruth",
  "businessSuccess",
  "pageMeaning",
];

const FORBIDDEN_RETIRED_FIELD_PATTERNS = [
  "mapId",
  "runtimePlanId",
  "routePlanId",
  "activationId",
  "templateId",
  "selectedMapId",
  "bindingPackageId",
  "bindingPackageVersion",
  "selectedBindingId",
  "bindingVersion",
  "bindingSnapshotRef",
  "branchToken",
  "deterministicFlow",
];

const FORBIDDEN_RUNTIME_IMPORTS = [
  "mouse-click/runtime",
  "geometry-guard/runtime",
  "screenshot/runtime",
  "capabilities/ai/runtime",
  "orchestration/runtime",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function ripgrepSync(pattern: string, paths: string[]): string[] {
  try {
    const result = execSync(
      `rg -l --include="*.ts" -e ${JSON.stringify(pattern)} ${paths.join(" ")}`,
      { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
    );
    return result.trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

function countFiles(dir: string): number {
  try {
    const result = execSync(
      `find ${JSON.stringify(dir)} -type f \\( -name "*.ts" -o -name "*.json" \\) 2>/dev/null | wc -l`,
      { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
    );
    return parseInt(result.trim(), 10) || 0;
  } catch {
    return 0;
  }
}

function fileExists(filePath: string): boolean {
  try {
    execSync(`test -f ${JSON.stringify(filePath)}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function grepInFiles(pattern: string, dir: string): string[] {
  try {
    const result = execSync(
      `rg -l --include="*.ts" -e ${JSON.stringify(pattern)} ${JSON.stringify(dir)} 2>/dev/null`,
      { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
    );
    return result.trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

// ── Check 1: file count ───────────────────────────────────────────────────────

function checkFileCount(): { phase: InspectorPhase; findings: Finding[] } {
  const srcCount = countFiles(VT_SRC_ROOT);
  const auditCount = countFiles(VT_AUDIT_ROOT);

  const findings: Finding[] = [];

  if (srcCount > 14) {
    findings.push({
      lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-003-V1",
      file: VT_SRC_ROOT,
      line: 0,
      severity: "error",
      message: `src/capabilities/visual-target has ${srcCount} files. Max allowed: 14.`,
      hint: "Delete unnecessary runtime gate files. Visual Target is a simple non-executable wrapper.",
    });
  }
  if (auditCount > 3) {
    findings.push({
      lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-003-V1",
      file: VT_AUDIT_ROOT,
      line: 0,
      severity: "error",
      message: `scripts/audit/domains/visual-target-capability has ${auditCount} files. Max allowed: 3.`,
    });
  }

  const passed = findings.length === 0;
  return {
    findings,
    phase: createPhase(
      "vt-file-count",
      passed ? "PASS" : "CODE VIOLATION",
      passed,
      passed
        ? `File count within limits: src=${srcCount} (≤14), audit=${auditCount} (≤3).`
        : `File count exceeded: src=${srcCount}, audit=${auditCount}.`,
    ),
  };
}

// ── Check 2: active children ──────────────────────────────────────────────────

function checkActiveChildren(): { phase: InspectorPhase; findings: Finding[] } {
  const findings: Finding[] = [];

  for (const child of ACTIVE_CHILDREN) {
    const childFile = path.join(VT_SRC_ROOT, "children", `${child}.ts`);
    if (!fileExists(childFile)) {
      findings.push({
        lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-001-V3",
        file: childFile,
        line: 0,
        severity: "error",
        message: `Required child capability missing: ${child}`,
        hint: "Create the missing child file.",
      });
    }
  }

  const passed = findings.length === 0;
  return {
    findings,
    phase: createPhase(
      "vt-active-children",
      passed ? "PASS" : "CODE VIOLATION",
      passed,
      passed
        ? "All required child capabilities present: package-grid-cell-target-once, package-grid-region-target-once, package-bbox-target-once."
        : "Required child capabilities missing.",
    ),
  };
}

// ── Check 3: no forbidden business children ───────────────────────────────────

function checkForbiddenChildren(): { phase: InspectorPhase; findings: Finding[] } {
  const findings: Finding[] = [];

  for (const forbidden of FORBIDDEN_CHILDREN) {
    const matches = grepInFiles(forbidden, VT_SRC_ROOT);
    for (const file of matches) {
      findings.push({
        lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-001-V3",
        file,
        line: 0,
        severity: "fatal",
        message: `Forbidden business observation child found: ${forbidden}`,
        hint: "Delete this child. Business target discovery belongs to AI Visual Mission Judge.",
      });
    }
  }

  const passed = findings.length === 0;
  return {
    findings,
    phase: createPhase(
      "vt-forbidden-children",
      passed ? "PASS" : "CODE VIOLATION",
      passed,
      passed
        ? "No forbidden business observation children (observe-like/comment/save/next/metric) found."
        : "Forbidden business observation children found.",
    ),
  };
}

// ── Check 4: no gate universe ─────────────────────────────────────────────────

function checkNoGateUniverse(): { phase: InspectorPhase; findings: Finding[] } {
  const findings: Finding[] = [];

  for (const pattern of FORBIDDEN_GATE_PATTERNS) {
    const matches = grepInFiles(pattern, VT_SRC_ROOT);
    for (const file of matches) {
      findings.push({
        lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-001-V3",
        file,
        line: 0,
        severity: "error",
        message: `Forbidden gate pattern found: ${pattern}`,
        hint: "Gate universes are forbidden in Visual Target. Use at most 1-2 inline checks.",
      });
    }
  }

  const passed = findings.length === 0;
  return {
    findings,
    phase: createPhase(
      "vt-no-gate-universe",
      passed ? "PASS" : "CODE VIOLATION",
      passed,
      passed
        ? "No gate universe patterns found in Visual Target."
        : "Gate universe patterns found in Visual Target.",
    ),
  };
}

// ── Check 5: no executable truth ─────────────────────────────────────────────

function checkNoExecutableTruth(): { phase: InspectorPhase; findings: Finding[] } {
  const findings: Finding[] = [];

  for (const pattern of FORBIDDEN_EXECUTABLE_PATTERNS) {
    const matches = grepInFiles(pattern, VT_SRC_ROOT);
    for (const file of matches) {
      findings.push({
        lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-002-V3",
        file,
        line: 0,
        severity: "fatal",
        message: `Forbidden executable truth field found: ${pattern}`,
        hint: "Visual Target must not output executable coordinates. Geometry Guard owns executable truth.",
      });
    }
  }

  const passed = findings.length === 0;
  return {
    findings,
    phase: createPhase(
      "vt-no-executable-truth",
      passed ? "PASS" : "CODE VIOLATION",
      passed,
      passed
        ? "No forbidden executable truth fields found."
        : "Forbidden executable truth fields found in Visual Target.",
    ),
  };
}

// ── Check 6: no business semantic truth ──────────────────────────────────────

function checkNoBusinessSemanticTruth(): { phase: InspectorPhase; findings: Finding[] } {
  const findings: Finding[] = [];

  for (const pattern of FORBIDDEN_BUSINESS_SEMANTIC_PATTERNS) {
    const matches = grepInFiles(pattern, VT_SRC_ROOT);
    for (const file of matches) {
      findings.push({
        lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-002-V3",
        file,
        line: 0,
        severity: "fatal",
        message: `Forbidden business semantic truth field found: ${pattern}`,
        hint: "Business semantic truth belongs to AI Visual Mission Judge.",
      });
    }
  }

  const passed = findings.length === 0;
  return {
    findings,
    phase: createPhase(
      "vt-no-business-semantic",
      passed ? "PASS" : "CODE VIOLATION",
      passed,
      passed
        ? "No business semantic truth fields found."
        : "Business semantic truth fields found in Visual Target.",
    ),
  };
}

// ── Check 7: no retired field patterns ───────────────────────────────────────

function checkNoRetiredFields(): { phase: InspectorPhase; findings: Finding[] } {
  const findings: Finding[] = [];

  for (const pattern of FORBIDDEN_RETIRED_FIELD_PATTERNS) {
    const matches = grepInFiles(pattern, VT_SRC_ROOT);
    for (const file of matches) {
      findings.push({
        lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-001-V3",
        file,
        line: 0,
        severity: "error",
        message: `Forbidden retired field pattern found: ${pattern}`,
        hint: "Retired map/binding/route/selection fields are forbidden in Visual Target.",
      });
    }
  }

  const passed = findings.length === 0;
  return {
    findings,
    phase: createPhase(
      "vt-no-retired-fields",
      passed ? "PASS" : "CODE VIOLATION",
      passed,
      passed
        ? "No retired map/binding/route/selection fields found."
        : "Retired field patterns found in Visual Target.",
    ),
  };
}

// ── Check 8: no forbidden runtime imports ────────────────────────────────────

function checkNoForbiddenImports(): { phase: InspectorPhase; findings: Finding[] } {
  const findings: Finding[] = [];

  for (const pattern of FORBIDDEN_RUNTIME_IMPORTS) {
    const matches = grepInFiles(pattern, VT_SRC_ROOT);
    for (const file of matches) {
      findings.push({
        lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-001-V3",
        file,
        line: 0,
        severity: "error",
        message: `Forbidden runtime import found: ${pattern}`,
        hint: "Visual Target must not import mouse-click, geometry-guard, screenshot, AI, or orchestration runtime.",
      });
    }
  }

  const passed = findings.length === 0;
  return {
    findings,
    phase: createPhase(
      "vt-no-forbidden-imports",
      passed ? "PASS" : "CODE VIOLATION",
      passed,
      passed
        ? "No forbidden runtime imports found in Visual Target."
        : "Forbidden runtime imports found in Visual Target.",
    ),
  };
}

// ── Check 9: nonExecutable = true is present in schema/output ────────────────

function checkNonExecutableFlag(): { phase: InspectorPhase; findings: Finding[] } {
  const findings: Finding[] = [];

  const schemaFile = path.join(VT_SRC_ROOT, "schema.ts");
  const hasNonExecutable = (() => {
    try {
      const result = execSync(
        `rg -l "nonExecutable" ${JSON.stringify(schemaFile)} 2>/dev/null`,
        { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
      );
      return result.trim().length > 0;
    } catch {
      return false;
    }
  })();

  if (!hasNonExecutable) {
    findings.push({
      lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-002-V3",
      file: schemaFile,
      line: 0,
      severity: "error",
      message: "nonExecutable flag not found in Visual Target schema.",
      hint: "VisualTargetPackageSchema must include nonExecutable: z.literal(true).",
    });
  }

  const passed = findings.length === 0;
  return {
    findings,
    phase: createPhase(
      "vt-non-executable-flag",
      passed ? "PASS" : "CODE VIOLATION",
      passed,
      passed
        ? "nonExecutable flag present in Visual Target schema."
        : "nonExecutable flag missing from Visual Target schema.",
    ),
  };
}

// ── Main inspector ────────────────────────────────────────────────────────────

export const inspector: DomainInspector = async (_context) => {
  const checks = [
    checkFileCount(),
    checkActiveChildren(),
    checkForbiddenChildren(),
    checkNoGateUniverse(),
    checkNoExecutableTruth(),
    checkNoBusinessSemanticTruth(),
    checkNoRetiredFields(),
    checkNoForbiddenImports(),
    checkNonExecutableFlag(),
  ];

  const allFindings: Finding[] = checks.flatMap((c) => c.findings);
  const allPhases: InspectorPhase[] = checks.map((c) => c.phase);

  return finalizeInspectorResult({
    inspector: "visual-target-capability-owner",
    inspectorId: "visual-target-capability-owner",
    capabilityDomain: "visual-target-capability",
    findings: allFindings,
    phases: allPhases,
    summary:
      allFindings.length === 0
        ? "Visual Target: non-executable packaging only. Active children: package-grid-cell-target-once, package-grid-region-target-once, package-bbox-target-once. No business observation children. No gate universe. No executable truth."
        : `Visual Target inspector found ${allFindings.length} violation(s).`,
  });
};

// Named export for inspector registry compatibility
export const visualTargetCapabilityInspector = inspector;
