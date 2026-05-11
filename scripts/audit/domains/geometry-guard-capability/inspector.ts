import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";
import { GEOMETRY_GUARD_AUDIT_CONFIG } from "./config.js";

const WORKSPACE_ROOT = process.cwd();

type CheckResult = { pass: boolean; message: string };

function countFiles(dir: string): number {
  if (!existsSync(join(WORKSPACE_ROOT, dir))) return 0;
  try {
    const output = execSync(
      `find "${join(WORKSPACE_ROOT, dir)}" -type f \\( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.json" \\) | wc -l`,
      { encoding: "utf-8" },
    );
    return parseInt(output.trim(), 10);
  } catch {
    return 0;
  }
}

function readAllTs(dir: string): string {
  const absDir = join(WORKSPACE_ROOT, dir);
  if (!existsSync(absDir)) return "";
  try {
    return execSync(
      `find "${absDir}" -name "*.ts" -exec cat {} \\; 2>/dev/null || true`,
      { encoding: "utf-8" },
    );
  } catch {
    return "";
  }
}

// ── Check 1: Production file count ───────────────────────────────────────────

function checkProductionFileCount(): CheckResult {
  const count = countFiles(GEOMETRY_GUARD_AUDIT_CONFIG.productionRoot);
  const pass = count <= GEOMETRY_GUARD_AUDIT_CONFIG.maxProductionFiles;
  return {
    pass,
    message: `[1] Production files: ${count} (max ${GEOMETRY_GUARD_AUDIT_CONFIG.maxProductionFiles}) → ${pass ? "PASS" : "FAIL"}`,
  };
}

// ── Check 2: Active children are only the two allowed ────────────────────────

function checkActiveChildren(): CheckResult {
  const registryPath = join(
    WORKSPACE_ROOT,
    GEOMETRY_GUARD_AUDIT_CONFIG.productionRoot,
    "registry.ts",
  );
  if (!existsSync(registryPath)) {
    return { pass: false, message: "[2] registry.ts not found → FAIL" };
  }
  const content = readFileSync(registryPath, "utf-8");
  const hasClickGridCell = content.includes("validate-click-grid-cell");
  const hasBboxGridRegion = content.includes("validate-bbox-grid-region");
  const hasForbiddenChild = GEOMETRY_GUARD_AUDIT_CONFIG.forbiddenPatterns.some(
    (p) => content.includes(p),
  );
  const pass = hasClickGridCell && hasBboxGridRegion && !hasForbiddenChild;
  return {
    pass,
    message: `[2] Active children: click-grid-cell=${hasClickGridCell}, bbox-grid-region=${hasBboxGridRegion}, forbidden=${hasForbiddenChild} → ${pass ? "PASS" : "FAIL"}`,
  };
}

// ── Check 3: No map-* child/function/file ────────────────────────────────────

function checkNoMapNaming(): CheckResult {
  const content = readAllTs(GEOMETRY_GUARD_AUDIT_CONFIG.productionRoot);
  const hasMapNaming = /map-|mapAi|mapRegion|MapAi|MapRegion/.test(content);
  const pass = !hasMapNaming;
  return {
    pass,
    message: `[3] No map-* naming: ${pass ? "PASS" : "FAIL (found map-* pattern)"}`,
  };
}

// ── Check 4: No stage machine files ──────────────────────────────────────────

function checkNoStageMachine(): CheckResult {
  const content = readAllTs(GEOMETRY_GUARD_AUDIT_CONFIG.productionRoot);
  const stagePhrases = [
    "stage-gate",
    "stageGate",
    "execution-plan",
    "executionPlan",
    "input-stages",
    "inputStages",
    "geometry-dispatch",
    "geometryDispatch",
    "bounds-gate",
    "boundsGate",
    "coordinate-space-gate",
    "scale-mapping-gate",
    "click-safety-gate",
  ];
  const found = stagePhrases.filter((p) => content.includes(p));
  const pass = found.length === 0;
  return {
    pass,
    message: `[4] No stage machine: ${pass ? "PASS" : `FAIL (found: ${found.join(", ")})`}`,
  };
}

// ── Check 5: No forbidden fields ─────────────────────────────────────────────

function checkNoForbiddenFields(): CheckResult {
  const content = readAllTs(GEOMETRY_GUARD_AUDIT_CONFIG.productionRoot);
  const found = GEOMETRY_GUARD_AUDIT_CONFIG.forbiddenFields.filter((f) =>
    content.includes(f),
  );
  const pass = found.length === 0;
  return {
    pass,
    message: `[5] No forbidden fields: ${pass ? "PASS" : `FAIL (found: ${found.join(", ")})`}`,
  };
}

// ── Check 6: Output/proof only contains geometry truth ───────────────────────

function checkGeometryTruthOnly(): CheckResult {
  const content = readAllTs(GEOMETRY_GUARD_AUDIT_CONFIG.productionRoot);
  const forbidden = [
    "actionPlan",
    "fallbackRecipe",
    "businessVerb",
    "clickSuccess",
    "businessSuccess",
    "pageStateTruth",
    "visualTargetTruth",
  ];
  const found = forbidden.filter((f) => content.includes(f));
  const pass = found.length === 0;
  return {
    pass,
    message: `[6] Output/proof geometry-truth-only: ${pass ? "PASS" : `FAIL (found: ${found.join(", ")})`}`,
  };
}

// ── Check 7: No forbidden imports ────────────────────────────────────────────

function checkNoForbiddenImports(): CheckResult {
  const content = readAllTs(GEOMETRY_GUARD_AUDIT_CONFIG.productionRoot);
  const found = GEOMETRY_GUARD_AUDIT_CONFIG.forbiddenImports.filter((imp) =>
    content.includes(imp),
  );
  const pass = found.length === 0;
  return {
    pass,
    message: `[7] No forbidden imports: ${pass ? "PASS" : `FAIL (found: ${found.join(", ")})`}`,
  };
}

// ── Check 8: Geometry Guard does not import execution modules ────────────────

function checkNoExecutionImports(): CheckResult {
  const content = readAllTs(GEOMETRY_GUARD_AUDIT_CONFIG.productionRoot);
  const executionModules = [
    "mouse-click",
    "mouse-scroll",
    "screenshot",
    "BrowserController",
    "capabilities/ai",
    "capabilities/orchestration/runtime",
  ];
  const found = executionModules.filter((m) => content.includes(m));
  const pass = found.length === 0;
  return {
    pass,
    message: `[8] Geometry Guard no execution imports: ${pass ? "PASS" : `FAIL (found: ${found.join(", ")})`}`,
  };
}

// ── Run all checks ────────────────────────────────────────────────────────────

export function runGeometryGuardInspector(): {
  pass: boolean;
  results: CheckResult[];
} {
  const results: CheckResult[] = [
    checkProductionFileCount(),
    checkActiveChildren(),
    checkNoMapNaming(),
    checkNoStageMachine(),
    checkNoForbiddenFields(),
    checkGeometryTruthOnly(),
    checkNoForbiddenImports(),
    checkNoExecutionImports(),
  ];

  const pass = results.every((r) => r.pass);
  return { pass, results };
}

// ── DomainInspector export ────────────────────────────────────────────────────

export const geometryGuardCapabilityInspector = createPendingDomainInspector({
  inspector: "GrassEye Geometry Guard Capability Inspector",
  inspectorId: "geometry-guard-capability-owner",
  capabilityDomain: "geometry-guard-capability",
  inspectorEntry:
    "scripts/audit/domains/geometry-guard-capability/inspector.ts",
  ownedPaths: [GEOMETRY_GUARD_AUDIT_CONFIG.productionRoot],
  pendingSummary:
    "geometry-guard-capability: coordinate safety gate implementation.",
  implementedSummary:
    "geometry-guard-capability: minimal coordinate safety gate with 2 active children.",
  extraChecks: async () => {
    const { results } = runGeometryGuardInspector();
    const findings = results
      .filter((r) => !r.pass)
      .map((r) => ({
        lawId: "geometry-guard-capability",
        file: GEOMETRY_GUARD_AUDIT_CONFIG.productionRoot,
        line: 0,
        severity: "error" as const,
        message: r.message,
      }));
    return { findings };
  },
});
