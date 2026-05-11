/**
 * retired-surface-guard/inspector.ts
 *
 * Minimal regression guard: ensures Page State independent ability group
 * remains retired and does not re-emerge as an active surface.
 *
 * Checks 6 questions only — no giant report, no inventory, no matrix.
 */

import fs from "node:fs";
import path from "node:path";

import { createFinding, createPhase } from "../core/result.js";
import type { Finding, InspectorPhase } from "../core/schema.js";
import { pathFromRepoRoot } from "../core/paths.js";

const LAW_ID = "GRASSEYE-PAGE-STATE-RETIRED-001-V1";

function repoPath(relative: string): string {
  return pathFromRepoRoot(relative);
}

function dirExists(relative: string): boolean {
  try {
    return fs.statSync(repoPath(relative)).isDirectory();
  } catch {
    return false;
  }
}

function fileContains(relative: string, token: string): boolean {
  try {
    return fs.readFileSync(repoPath(relative), "utf8").includes(token);
  } catch {
    return false;
  }
}

function collectFindings(): Finding[] {
  const findings: Finding[] = [];

  // Q1: src/capabilities/page-state must not exist
  if (dirExists("src/capabilities/page-state")) {
    findings.push(createFinding({
      lawId: LAW_ID,
      file: "src/capabilities/page-state",
      line: 1,
      severity: "fatal",
      message: "REGRESSION: src/capabilities/page-state must not exist. Page State independent ability group is retired.",
    }));
  }

  // Q2: scripts/audit/domains/page-state-capability must not exist
  if (dirExists("scripts/audit/domains/page-state-capability")) {
    findings.push(createFinding({
      lawId: LAW_ID,
      file: "scripts/audit/domains/page-state-capability",
      line: 1,
      severity: "fatal",
      message: "REGRESSION: scripts/audit/domains/page-state-capability must not exist. Page State audit domain is retired.",
    }));
  }

  // Q3: CI-FULL plan must not include page-state as active step
  if (fileContains("scripts/audit/core/ci-full-plan.ts", '"page-state"')) {
    findings.push(createFinding({
      lawId: LAW_ID,
      file: "scripts/audit/core/ci-full-plan.ts",
      line: 1,
      severity: "fatal",
      message: "REGRESSION: ci-full-plan must not include page-state as an active CI step.",
    }));
  }

  // Q4: frozen-baseline must not include page-state in active ability group map
  if (fileContains("scripts/audit/core/frozen-baseline.ts", '"page-state": "page-state-capability"')) {
    findings.push(createFinding({
      lawId: LAW_ID,
      file: "scripts/audit/core/frozen-baseline.ts",
      line: 1,
      severity: "fatal",
      message: "REGRESSION: frozen-baseline must not map page-state to page-state-capability as active.",
    }));
  }

  // Q5: raw browser observation helper must not output semantic fields
  const helperPath = "src/lib/browser/browser-observation.ts";
  const forbiddenSemanticTokens = [
    "feedReady", "pageReady", "pageCorrect", "pageStateType",
    "loginSemantic", "captchaSemantic", "safetySemantic",
    "feedSemantic", "videoSemantic", "commentSemantic",
    "blockerDecision", "actionSemanticSuccess", "semanticDecision",
    "businessTruth",
  ];
  try {
    const helperText = fs.readFileSync(repoPath(helperPath), "utf8");
    for (const token of forbiddenSemanticTokens) {
      if (helperText.includes(token)) {
        findings.push(createFinding({
          lawId: LAW_ID,
          file: helperPath,
          line: 1,
          severity: "fatal",
          message: `Raw browser observation helper must not output semantic field '${token}'. AI owns all semantic decisions.`,
        }));
      }
    }
  } catch {
    // Helper may not exist; that is acceptable if raw observations are not needed.
  }

  // Q6: MuscleMemory must not register a page-state action
  const muscleMemoryDir = repoPath("src/muscle-memory");
  try {
    const allFiles = fs.readdirSync(muscleMemoryDir, { recursive: true, encoding: "utf8" }) as string[];
    for (const file of allFiles) {
      if (!file.endsWith(".ts") && !file.endsWith(".json")) continue;
      const fullPath = path.join(muscleMemoryDir, file as string);
      try {
        const text = fs.readFileSync(fullPath, "utf8");
        if (text.includes("PAGE_STATE") || text.includes("page-state") || (text.includes("PageState") && !text.includes("pageStateDecision"))) {
          findings.push(createFinding({
            lawId: LAW_ID,
            file: `src/muscle-memory/${file}`,
            line: 1,
            severity: "fatal",
            message: "REGRESSION: MuscleMemory must not register a Page State action.",
          }));
        }
      } catch {
        // Skip unreadable files
      }
    }
  } catch {
    // muscle-memory dir may not exist; not an error
  }

  return findings;
}

export async function inspectRetiredSurfaceGuard(): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> {
  const findings = collectFindings();
  const passed = findings.length === 0;
  const phase = createPhase(
    "retired-surface-guard",
    passed ? "PASS" : "REGRESSION DETECTED",
    passed,
    passed
      ? "Page State independent ability group remains retired. No active page-state surfaces detected."
      : `Page State retirement regression detected: ${findings.length} violation(s).`,
  );
  return { findings, phases: [phase] };
}
