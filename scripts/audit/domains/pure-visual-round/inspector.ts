import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { pathFromRepoRoot } from "../../core/paths.js";
import { PURE_VISUAL_ROUND_CONFIG } from "./config.js";

type CheckStatus = "PASS" | "FAIL";

type PureVisualRoundCheck = {
  checkId: string;
  question: string;
  status: CheckStatus;
  detail: string;
};

type PureVisualRoundInspectorResult = {
  checks: PureVisualRoundCheck[];
  hardFails: number;
  pass: boolean;
};

function pass(checkId: string, question: string, detail: string): PureVisualRoundCheck {
  return { checkId, question, status: "PASS", detail };
}

function fail(checkId: string, question: string, detail: string): PureVisualRoundCheck {
  return { checkId, question, status: "FAIL", detail };
}

function collectFiles(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (PURE_VISUAL_ROUND_CONFIG.ignoredPathParts.some((part) => fullPath.includes(part))) continue;
    if (entry.isDirectory()) {
      collectFiles(fullPath, out);
      continue;
    }
    if (/\.(ts|tsx|js|mjs|json)$/.test(entry.name)) out.push(fullPath);
  }
  return out;
}

function activeSourceFiles(): string[] {
  return PURE_VISUAL_ROUND_CONFIG.activeSourceRoots.flatMap((root) => collectFiles(pathFromRepoRoot(root)));
}

function rel(file: string): string {
  return relative(pathFromRepoRoot("."), file);
}

function findTokenHits(files: string[], tokens: readonly string[]): string[] {
  const hits: string[] = [];
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    for (const token of tokens) {
      if (text.includes(token)) hits.push(`${rel(file)}:${token}`);
    }
  }
  return hits;
}

function readRequired(relPath: string): string {
  const fullPath = pathFromRepoRoot(relPath);
  if (!existsSync(fullPath)) throw new Error(`File not found: ${relPath}`);
  return readFileSync(fullPath, "utf8");
}

function checkForbiddenAiOutputFields(files: string[]): PureVisualRoundCheck {
  const hits = findTokenHits(files, PURE_VISUAL_ROUND_CONFIG.forbiddenAiOutputFields);
  return hits.length === 0
    ? pass("PVR-001", "Old AI output fields absent from active src?", "No forbidden output fields found.")
    : fail("PVR-001", "Old AI output fields absent from active src?", hits.join("; "));
}

function checkForbiddenDecisionTokens(files: string[]): PureVisualRoundCheck {
  const hits = findTokenHits(files, PURE_VISUAL_ROUND_CONFIG.forbiddenDecisionTokens);
  return hits.length === 0
    ? pass("PVR-002", "Old product yes/no tokens absent from active src?", "No old decision tokens found.")
    : fail("PVR-002", "Old product yes/no tokens absent from active src?", hits.join("; "));
}

function checkNoAiOutputSequence(): PureVisualRoundCheck {
  const files = [
    "src/visual-mission/round/pure-visual-round-output.schema.ts",
    "src/capabilities/ai/schema.ts",
  ].map(pathFromRepoRoot).filter(existsSync);
  const hits = findTokenHits(files, ["actions: z.array", "actions[]"]);
  return hits.length === 0
    ? pass("PVR-003", "AI output schema avoids multi-action sequence?", "No AI output action sequence token found.")
    : fail("PVR-003", "AI output schema avoids multi-action sequence?", hits.join("; "));
}

function checkPureVisualSchemaExists(): PureVisualRoundCheck {
  const text = readRequired("src/visual-mission/round/pure-visual-round-output.schema.ts");
  const missing = PURE_VISUAL_ROUND_CONFIG.requiredPureVisualTokens.filter((token) => !text.includes(token));
  return missing.length === 0
    ? pass("PVR-004", "pureVisualRound.v1 schema exists with required fields?", "Required schema tokens present.")
    : fail("PVR-004", "pureVisualRound.v1 schema exists with required fields?", `Missing: ${missing.join(", ")}`);
}

function checkAiCannotCallForensics(): PureVisualRoundCheck {
  const catalog = JSON.parse(readRequired("src/muscle-memory/generated-catalog.json")) as {
    entries?: Array<{ actionCode?: string; allowedForAiActionPlan?: boolean }>;
  };
  const forbidden = new Set(["SAVE_RECORD_ONCE", "APPEND_ARTIFACT_ONCE", "READ_RECORD_ONCE"]);
  const bad = (catalog.entries ?? [])
    .filter((entry) => entry.actionCode && forbidden.has(entry.actionCode) && entry.allowedForAiActionPlan === true)
    .map((entry) => entry.actionCode);
  return bad.length === 0
    ? pass("PVR-005", "AI cannot call forensics catalog entries?", "Forensics entries are not AI-visible.")
    : fail("PVR-005", "AI cannot call forensics catalog entries?", `AI-visible forensics entries: ${bad.join(", ")}`);
}

function checkPlatformHints(files: string[]): PureVisualRoundCheck {
  const hits = findTokenHits(files, PURE_VISUAL_ROUND_CONFIG.forbiddenPlatformHints);
  return hits.length === 0
    ? pass("PVR-006", "Platform profiles contain no semantic action hints?", "No forbidden platform hint fields found.")
    : fail("PVR-006", "Platform profiles contain no semantic action hints?", hits.join("; "));
}

function checkSaveBeforeAction(): PureVisualRoundCheck {
  const text = readRequired("src/capabilities/orchestration/runtime/mission-loop-runner.ts");
  const conditionIndex = text.indexOf("if (aiOutput.save)");
  if (conditionIndex < 0) {
    return fail("PVR-007", "Orchestration saves before action?", "Missing aiOutput.save branch or system save call.");
  }
  const saveIndex = text.indexOf("systemSaveCurrentRoundEvidence", conditionIndex);
  const dispatchIndex = text.indexOf("dispatchRegisteredAbilitySequence", conditionIndex);
  if (saveIndex < 0) {
    return fail("PVR-007", "Orchestration saves before action?", "Missing system save call after aiOutput.save branch.");
  }
  if (dispatchIndex < 0) {
    return fail("PVR-007", "Orchestration saves before action?", "Missing dispatch call.");
  }
  return saveIndex < dispatchIndex
    ? pass("PVR-007", "Orchestration saves before action?", "systemSaveCurrentRoundEvidence appears before dispatchRegisteredAbilitySequence.")
    : fail("PVR-007", "Orchestration saves before action?", "Dispatch appears before system save.");
}

function checkEveryRoundVisualEvidence(): PureVisualRoundCheck {
  const text = readRequired("src/capabilities/orchestration/runtime/mission-loop-runner.ts");
  const required = ["capture-browser-viewport", "render-coordinate-grid", "visual_mission_judgment"];
  const missing = required.filter((token) => !text.includes(token));
  return missing.length === 0
    ? pass("PVR-008", "Every round has screenshot, coordinate grid, and AI call?", "Required round-loop tokens present.")
    : fail("PVR-008", "Every round has screenshot, coordinate grid, and AI call?", `Missing: ${missing.join(", ")}`);
}

export function runPureVisualRoundInspector(): PureVisualRoundInspectorResult {
  const files = activeSourceFiles();
  const checks = [
    checkForbiddenAiOutputFields(files),
    checkForbiddenDecisionTokens(files),
    checkNoAiOutputSequence(),
    checkPureVisualSchemaExists(),
    checkAiCannotCallForensics(),
    checkPlatformHints(files),
    checkSaveBeforeAction(),
    checkEveryRoundVisualEvidence(),
  ];
  const hardFails = checks.filter((check) => check.status === "FAIL").length;
  return { checks, hardFails, pass: hardFails === 0 };
}

export type { PureVisualRoundCheck, PureVisualRoundInspectorResult };
