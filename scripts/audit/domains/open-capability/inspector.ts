/**
 * inspector.ts — Open capability inspector.
 *
 * Answers exactly 9 governance questions. No generated dashboard.
 * Returns PASS only when all 9 pass.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { OPEN_INSPECTOR_CONFIG as CFG } from "./config.js";

const ROOT = resolve(fileURLToPath(import.meta.url), "../../../../..");
const OPEN_SRC = join(ROOT, "src/capabilities/open");
const MUSCLE_CATALOG = join(ROOT, "src/muscle-memory/generated-catalog.json");

// ─── Helpers ─────────────────────────────────────────────────────────────────

function collectTsFiles(dir: string): string[] {
  try {
    return (readdirSync(dir, { recursive: true }) as string[])
      .map((f) => join(dir, f))
      .filter((f) => {
        try { return statSync(f).isFile() && /\.(ts|tsx|js|jsx|json)$/.test(f); }
        catch { return false; }
      });
  } catch {
    return [];
  }
}

function readAllSource(files: string[]): string {
  return files.map((f) => {
    try { return readFileSync(f, "utf8"); }
    catch { return ""; }
  }).join("\n");
}

// ─── Check Functions ──────────────────────────────────────────────────────────

type CheckResult = { pass: boolean; detail: string };

function checkFileCount(files: string[]): CheckResult {
  const count = files.length;
  const pass = count <= CFG.maxOpenFiles;
  return { pass, detail: `src/capabilities/open file count = ${count} (max ${CFG.maxOpenFiles})` };
}

function checkActiveChildren(source: string): CheckResult {
  const required = CFG.requiredActiveChildren;
  const missing = required.filter((id) => !source.includes(id));
  const pass = missing.length === 0;
  return {
    pass,
    detail: pass
      ? `Active children present: ${required.join(", ")}`
      : `Missing active children: ${missing.join(", ")}`,
  };
}

function checkNoBannedChildren(source: string): CheckResult {
  const found = CFG.bannedChildIds.filter((id) => source.includes(id));
  const pass = found.length === 0;
  return {
    pass,
    detail: pass ? "No banned child IDs found" : `Banned child IDs found: ${found.join(", ")}`,
  };
}

function checkNoPageState(source: string): CheckResult {
  const patterns = ["pageStateHandoff", "pageStateRef", "page-state handoff", "raw page-state"];
  const found = patterns.filter((p) => source.includes(p));
  const pass = found.length === 0;
  return {
    pass,
    detail: pass ? "No page-state patterns found" : `Page-state patterns found: ${found.join(", ")}`,
  };
}

function checkNoFallback(source: string): CheckResult {
  const patterns = ["defaultTargetUrl", "fallbackTargetUrl", "fallbackUrl", "default URL", "fallback to", "default to"];
  const found = patterns.filter((p) => source.toLowerCase().includes(p.toLowerCase()));
  const pass = found.length === 0;
  return {
    pass,
    detail: pass ? "No fallback patterns found" : `Fallback patterns found: ${found.join(", ")}`,
  };
}

function checkNoBindingFields(source: string): CheckResult {
  const patterns = [
    "mapId", "runtimePlanId", "routePlanId", "activationId", "templateId",
    "selectedMapId", "bindingPackageId", "selectedBindingId", "bindingSnapshotRef",
    "branchToken", "deterministicFlow",
  ];
  const found = patterns.filter((p) => source.includes(p));
  const pass = found.length === 0;
  return {
    pass,
    detail: pass ? "No binding/route fields found" : `Binding fields found: ${found.join(", ")}`,
  };
}

function checkNoBannedImports(source: string): CheckResult {
  const found = CFG.bannedImports.filter((imp) => source.includes(imp));
  const pass = found.length === 0;
  return {
    pass,
    detail: pass ? "No banned cross-boundary imports found" : `Banned imports found: ${found.join(", ")}`,
  };
}

function checkNoSemanticTruth(source: string): CheckResult {
  const patterns = [
    "pageReady", "pageCorrect", "feedReady", "semanticSuccess", "businessSuccess",
    "loginSemantic", "captchaSemantic", "safetySemantic", "feedSemantic",
    "videoSemantic", "commentSemantic",
  ];
  const found = patterns.filter((p) => source.includes(p));
  const pass = found.length === 0;
  return {
    pass,
    detail: pass ? "No semantic truth patterns found" : `Semantic patterns found: ${found.join(", ")}`,
  };
}

function checkMuscleMemory(): CheckResult {
  let catalog: { entries?: Array<{ actionCode: string; abilityGroupId?: string }> };
  try {
    catalog = JSON.parse(readFileSync(MUSCLE_CATALOG, "utf8")) as typeof catalog;
  } catch {
    return { pass: false, detail: "MUSCLE_CATALOG_READ_FAILED" };
  }

  const openEntries = (catalog.entries ?? []).filter(
    (e) => e.abilityGroupId === "open" || e.actionCode.startsWith("OPEN_"),
  );
  const actionCodes = openEntries.map((e) => e.actionCode);

  const banned = (CFG.bannedMuscleCodes as readonly string[]).filter((c) => actionCodes.includes(c));
  if (banned.length > 0) {
    return { pass: false, detail: `Banned MuscleMemory codes found: ${banned.join(", ")}` };
  }

  const requiredStrict = ["OPEN_PLATFORM_ENTRY_ONCE"];
  const missingStrict = requiredStrict.filter((c) => !actionCodes.includes(c));
  if (missingStrict.length > 0) {
    return { pass: false, detail: `Required MuscleMemory codes missing: ${missingStrict.join(", ")}` };
  }

  return { pass: true, detail: `MuscleMemory open codes: ${actionCodes.join(", ")}` };
}

// ─── Main Inspector ───────────────────────────────────────────────────────────

export interface OpenInspectorReport {
  overallStatus: "PASS" | "FAIL";
  checks: Array<{ id: string; question: string; pass: boolean; detail: string }>;
}

export function runOpenInspector(): OpenInspectorReport {
  const openFiles = collectTsFiles(OPEN_SRC);
  const openSource = readAllSource(openFiles);

  const checks = [
    { id: "Q1", question: "src/capabilities/open file count <= 14?", ...checkFileCount(openFiles) },
    { id: "Q2", question: "Active children only open-platform-entry-once / open-local-workbench-once?", ...checkActiveChildren(openSource) },
    { id: "Q3", question: "No open-facebook / open-tiktok / open-local-program?", ...checkNoBannedChildren(openSource) },
    { id: "Q4", question: "No page-state handoff / pageStateHandoffRef?", ...checkNoPageState(openSource) },
    { id: "Q5", question: "No default/fallback target URL?", ...checkNoFallback(openSource) },
    { id: "Q6", question: "No map/binding/route/package/selection/branch-token fields?", ...checkNoBindingFields(openSource) },
    { id: "Q7", question: "Open does not import AI/Screenshot/Mouse/Geometry/Orchestration/Forensics runtime?", ...checkNoBannedImports(openSource) },
    { id: "Q8", question: "No page readiness / semantic success fields?", ...checkNoSemanticTruth(openSource) },
    { id: "Q9", question: "MuscleMemory only registers OPEN_PLATFORM_ENTRY_ONCE / OPEN_LOCAL_WORKBENCH_ONCE?", ...checkMuscleMemory() },
  ];

  const overallStatus = checks.every((c) => c.pass) ? "PASS" : "FAIL";
  return { overallStatus, checks };
}
