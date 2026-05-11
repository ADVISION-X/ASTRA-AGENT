import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { runQualityKernelInspector } from "./inspector.js";

const repoRoot = process.cwd();

console.log("\n[QUALITY-KERNEL] Running quality kernel inspection...\n");

const result = runQualityKernelInspector();

// --- Retired Surface: HARD (pass-blocking) ---
if (result.hardRetiredSurfaceFindings.length === 0) {
  console.log("[RETIRED SURFACE HARD] PASS — no forbidden retired system patterns found.");
} else {
  console.log(`[RETIRED SURFACE HARD] FAIL — ${result.hardRetiredSurfaceFindings.length} forbidden pattern(s) found:`);
  for (const f of result.hardRetiredSurfaceFindings) {
    console.log(`  - ${f.file}:${f.line} → "${f.pattern}"`);
  }
}

// --- Retired Surface: SOFT (warning only) ---
if (result.softRetiredSurfaceFindings.length === 0) {
  console.log("[RETIRED SURFACE SOFT] CLEAN — no legacy field patterns found.");
} else {
  console.log(`[RETIRED SURFACE SOFT] WARN — ${result.softRetiredSurfaceFindings.length} legacy field(s) found (non-blocking, cleanup recommended):`);
  for (const f of result.softRetiredSurfaceFindings) {
    console.log(`  - ${f.file}:${f.line} → "${f.pattern}"`);
  }
}

// --- Muscle Memory ---
if (result.muscleMemoryFindings.length === 0) {
  console.log("[MUSCLE-MEMORY] PASS — action codes are correct.");
} else {
  console.log(`[MUSCLE-MEMORY] FAIL — ${result.muscleMemoryFindings.length} issue(s):`);
  for (const f of result.muscleMemoryFindings) {
    if (f.kind === "missing-required") {
      console.log(`  - MISSING required: ${f.actionCode}`);
    } else {
      console.log(`  - FORBIDDEN present: ${f.actionCode}`);
    }
  }
}

// --- CI Plan ---
if (result.ciPlanFindings.length === 0) {
  console.log("[CI-PLAN] PASS — ci-full-plan.ts clean.");
} else {
  console.log(`[CI-PLAN] FAIL — ${result.ciPlanFindings.length} violation(s):`);
  for (const f of result.ciPlanFindings) {
    console.log(`  - ${f.pattern}`);
  }
}

// --- File Counts ---
const failItems = result.fileCountFindings.filter((f) => f.status === "fail" || f.status === "retired-exists");
const warnItems = result.fileCountFindings.filter((f) => f.status === "warn");
if (failItems.length === 0) {
  console.log("[FILE-COUNTS] PASS — all limits within bounds.");
  if (warnItems.length > 0) {
    for (const w of warnItems) {
      console.log(`  - [WARN] ${w.module}: ${w.actual} (limit: ${w.limit})`);
    }
  }
} else {
  console.log(`[FILE-COUNTS] FAIL — ${failItems.length} limit(s) exceeded:`);
  for (const f of [...failItems, ...warnItems]) {
    console.log(`  - [${f.status.toUpperCase()}] ${f.module}: ${f.actual} (limit: ${f.limit})`);
  }
}

// --- Code Purity ---
const purityFails = result.codePurityFindings.filter((f) =>
  f.pattern.includes("ts-ignore") || f.pattern.includes("eslint-disable") || f.pattern.includes(": any type")
);
const purityWarns = result.codePurityFindings.filter((f) => !purityFails.includes(f));
if (result.codePurityFindings.length === 0) {
  console.log("[CODE-PURITY] PASS — no violations.");
} else if (purityFails.length > 0) {
  console.log(`[CODE-PURITY] FAIL — ${result.codePurityFindings.length} issue(s):`);
  for (const f of result.codePurityFindings) {
    console.log(`  - ${f.file}:${f.line} → ${f.pattern}`);
  }
} else {
  console.log(`[CODE-PURITY] WARN — ${result.codePurityFindings.length} issue(s) (warnings only):`);
  for (const f of result.codePurityFindings) {
    console.log(`  - ${f.file}:${f.line} → ${f.pattern}`);
  }
}

// --- Summary ---
if (result.pass) {
  console.log("\n[QUALITY-KERNEL] PASS — all hard gates passed.\n");
} else {
  console.log("\n[QUALITY-KERNEL] FAIL — one or more hard gates failed. See above.\n");
}

// Write summary JSON
const outDir = join(repoRoot, "scripts/audit/generated");
try { mkdirSync(outDir, { recursive: true }); } catch {}
const summaryPath = join(outDir, "quality-kernel-summary.generated.json");
const summary = {
  timestamp: new Date().toISOString(),
  pass: result.pass,
  hardRetiredSurface: {
    count: result.hardRetiredSurfaceFindings.length,
    findings: result.hardRetiredSurfaceFindings,
  },
  softRetiredSurface: {
    count: result.softRetiredSurfaceFindings.length,
    findings: result.softRetiredSurfaceFindings,
  },
  muscleMemory: { count: result.muscleMemoryFindings.length, findings: result.muscleMemoryFindings },
  ciPlan: { count: result.ciPlanFindings.length, findings: result.ciPlanFindings },
  fileCounts: result.fileCountFindings,
  codePurity: { count: result.codePurityFindings.length, findings: result.codePurityFindings },
};
writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
console.log(`[QUALITY-KERNEL] Summary written to: ${summaryPath}`);

process.exit(result.pass ? 0 : 1);
