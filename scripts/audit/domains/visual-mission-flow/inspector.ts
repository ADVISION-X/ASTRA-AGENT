// Visual Mission Flow Inspector — 10 structural governance checks.
// Verifies the form-submit → seed video mining flow is correctly wired end-to-end.

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { VISUAL_MISSION_FLOW_CONFIG as CFG } from "./config.js";

const ROOT = process.cwd();

function readSrc(relPath: string): string {
  const p = join(ROOT, relPath);
  if (!existsSync(p)) return "";
  return readFileSync(p, "utf8");
}

// ─── Check Types ─────────────────────────────────────────────────────────────

export type VMFCheckResult = {
  checkId: string;
  question: string;
  status: "PASS" | "FAIL" | "WARN";
  detail: string;
};

export type VMFInspectorResult = {
  checks: VMFCheckResult[];
  overallStatus: "PASS" | "FAIL" | "WARN";
};

// ─── Inspector ───────────────────────────────────────────────────────────────

export function runVisualMissionFlowInspector(): VMFInspectorResult {
  const checks: VMFCheckResult[] = [];

  // ── CHECK 1: handleStartMission fires runMissionRoundLoop ────────────────
  {
    const src = readSrc(CFG.childrenPath);
    const hasMissionLoop = src.includes(CFG.fireAndForgetToken);
    const hasFireForget = src.includes("void runMissionRoundLoop") || src.includes("void runMissionRoundLoop(");
    if (!src) {
      checks.push({ checkId: "VMF-01", question: "handleStartMission fires runMissionRoundLoop fire-and-forget?", status: "FAIL", detail: `File not found: ${CFG.childrenPath}` });
    } else if (hasMissionLoop && hasFireForget) {
      checks.push({ checkId: "VMF-01", question: "handleStartMission fires runMissionRoundLoop fire-and-forget?", status: "PASS", detail: "runMissionRoundLoop called as fire-and-forget." });
    } else if (hasMissionLoop) {
      checks.push({ checkId: "VMF-01", question: "handleStartMission fires runMissionRoundLoop fire-and-forget?", status: "WARN", detail: "runMissionRoundLoop is imported/called but not as void fire-and-forget." });
    } else {
      checks.push({ checkId: "VMF-01", question: "handleStartMission fires runMissionRoundLoop fire-and-forget?", status: "FAIL", detail: "runMissionRoundLoop not found in children.ts — mission loop never starts." });
    }
  }

  // ── CHECK 2: Round loop has screenshot → grid → AI → dispatch order ──────
  {
    const src = readSrc(CFG.missionLoopPath);
    if (!src) {
      checks.push({ checkId: "VMF-02", question: "Round loop has screenshot → grid → AI → dispatch order?", status: "FAIL", detail: `File not found: ${CFG.missionLoopPath}` });
    } else {
      const missing = CFG.roundLoopKeywords.filter((kw) => !src.includes(kw));
      if (missing.length === 0) {
        // Verify order: screenshot < grid < AI < dispatch-registered-ability-sequence (actual call, not comment)
        const idxScreenshot = src.indexOf("screenshotAbilityGroup");
        const idxGrid = src.indexOf("render-coordinate-grid");
        const idxAi = src.indexOf("aiAbilityGroup");
        const idxDispatch = src.indexOf(CFG.roundLoopDispatchOrderToken);
        const inOrder = idxScreenshot < idxGrid && idxGrid < idxAi && idxAi < idxDispatch;
        if (inOrder) {
          checks.push({ checkId: "VMF-02", question: "Round loop has screenshot → grid → AI → dispatch order?", status: "PASS", detail: "All 4 phase tokens present and in correct order." });
        } else {
          checks.push({ checkId: "VMF-02", question: "Round loop has screenshot → grid → AI → dispatch order?", status: "FAIL", detail: "All 4 phase tokens present but order is wrong — check mission-loop-runner.ts." });
        }
      } else {
        checks.push({ checkId: "VMF-02", question: "Round loop has screenshot → grid → AI → dispatch order?", status: "FAIL", detail: `Missing round loop tokens: ${missing.join(", ")}` });
      }
    }
  }

  // ── CHECK 3: dispatch-sequence resolves IDs from MuscleMemory ─────────────
  {
    const src = readSrc(CFG.dispatchSequencePath);
    if (!src) {
      checks.push({ checkId: "VMF-03", question: "dispatch-sequence resolves abilityGroupId/childCapabilityId from MuscleMemory?", status: "FAIL", detail: `File not found: ${CFG.dispatchSequencePath}` });
    } else if (src.includes(CFG.dispatchMuscleMemoryToken)) {
      checks.push({ checkId: "VMF-03", question: "dispatch-sequence resolves abilityGroupId/childCapabilityId from MuscleMemory?", status: "PASS", detail: "findMuscleMemoryEntry found in dispatch-sequence.ts." });
    } else {
      checks.push({ checkId: "VMF-03", question: "dispatch-sequence resolves abilityGroupId/childCapabilityId from MuscleMemory?", status: "FAIL", detail: "findMuscleMemoryEntry not found — IDs may be hardcoded or AI-provided." });
    }
  }

  // ── CHECK 4: AI prompt does NOT output abilityGroupId / childCapabilityId ─
  {
    const src = readSrc(CFG.aiPromptPath);
    if (!src) {
      checks.push({ checkId: "VMF-04", question: "AI prompt does not instruct AI to output abilityGroupId/childCapabilityId?", status: "FAIL", detail: `File not found: ${CFG.aiPromptPath}` });
    } else {
      const forbidden = CFG.forbiddenAiOutputFields.filter((f) => {
        // Allow in comments/law notes — detect if it appears in prompt string literals
        const regex = new RegExp(`["'\`]${f}["'\`]`, "g");
        return regex.test(src);
      });
      if (forbidden.length === 0) {
        checks.push({ checkId: "VMF-04", question: "AI prompt does not instruct AI to output abilityGroupId/childCapabilityId?", status: "PASS", detail: "Neither abilityGroupId nor childCapabilityId appear in prompt string literals." });
      } else {
        checks.push({ checkId: "VMF-04", question: "AI prompt does not instruct AI to output abilityGroupId/childCapabilityId?", status: "FAIL", detail: `Forbidden fields in prompt strings: ${forbidden.join(", ")} — AI may try to emit these.` });
      }
    }
  }

  // ── CHECK 5: AI prompt has no hardcoded forbidden actionCodes ─────────────
  {
    const src = readSrc(CFG.aiPromptPath);
    if (!src) {
      checks.push({ checkId: "VMF-05", question: "AI prompt has no hardcoded forbidden actionCodes (SAVE_LEAD, CLICK_CELL, etc.)?", status: "FAIL", detail: `File not found: ${CFG.aiPromptPath}` });
    } else {
      const found = CFG.forbiddenActionCodes.filter((code) => src.includes(code));
      if (found.length === 0) {
        checks.push({ checkId: "VMF-05", question: "AI prompt has no hardcoded forbidden actionCodes (SAVE_LEAD, CLICK_CELL, etc.)?", status: "PASS", detail: "No forbidden actionCodes in AI prompt." });
      } else {
        checks.push({ checkId: "VMF-05", question: "AI prompt has no hardcoded forbidden actionCodes (SAVE_LEAD, CLICK_CELL, etc.)?", status: "FAIL", detail: `Forbidden codes found in prompt: ${found.join(", ")}` });
      }
    }
  }

  // ── CHECK 6: Geometry Guard is integrated in dispatch-sequence ────────────
  {
    const src = readSrc(CFG.dispatchSequencePath);
    if (!src) {
      checks.push({ checkId: "VMF-06", question: "Geometry Guard preflight integrated in dispatch-sequence?", status: "FAIL", detail: `File not found: ${CFG.dispatchSequencePath}` });
    } else {
      const hasGuard = src.includes(CFG.geometryGuardToken);
      const hasProofField = src.includes(CFG.geometryGuardProofField);
      if (hasGuard && hasProofField) {
        checks.push({ checkId: "VMF-06", question: "Geometry Guard preflight integrated in dispatch-sequence?", status: "PASS", detail: "geometryGuard and requiresGeometryProof both present in dispatch-sequence." });
      } else {
        const missing: string[] = [];
        if (!hasGuard) missing.push("geometryGuard");
        if (!hasProofField) missing.push("requiresGeometryProof");
        checks.push({ checkId: "VMF-06", question: "Geometry Guard preflight integrated in dispatch-sequence?", status: "FAIL", detail: `Missing in dispatch-sequence: ${missing.join(", ")}` });
      }
    }
  }

  // ── CHECK 7: SAVE_CURRENT_VIDEO_EVIDENCE_ONCE in catalog (allowedForAiActionPlan=true) ─
  {
    const src = readSrc(CFG.catalogPath);
    if (!src) {
      checks.push({ checkId: "VMF-07", question: "SAVE_CURRENT_VIDEO_EVIDENCE_ONCE in MuscleMemory catalog with allowedForAiActionPlan=true?", status: "FAIL", detail: `File not found: ${CFG.catalogPath}` });
    } else {
      const hasSaveCode = src.includes(CFG.evidenceSaveActionCode);
      if (!hasSaveCode) {
        checks.push({ checkId: "VMF-07", question: "SAVE_CURRENT_VIDEO_EVIDENCE_ONCE in MuscleMemory catalog with allowedForAiActionPlan=true?", status: "FAIL", detail: "SAVE_CURRENT_VIDEO_EVIDENCE_ONCE not found in catalog." });
      } else {
        // Find the entry block and check allowedForAiActionPlan
        const idx = src.indexOf(CFG.evidenceSaveActionCode);
        const block = src.slice(idx, idx + 1200);
        if (block.includes('"allowedForAiActionPlan": true')) {
          checks.push({ checkId: "VMF-07", question: "SAVE_CURRENT_VIDEO_EVIDENCE_ONCE in MuscleMemory catalog with allowedForAiActionPlan=true?", status: "PASS", detail: "SAVE_CURRENT_VIDEO_EVIDENCE_ONCE present with allowedForAiActionPlan=true." });
        } else {
          checks.push({ checkId: "VMF-07", question: "SAVE_CURRENT_VIDEO_EVIDENCE_ONCE in MuscleMemory catalog with allowedForAiActionPlan=true?", status: "FAIL", detail: "Entry found but allowedForAiActionPlan is not true — AI cannot schedule evidence saves." });
        }
      }
    }
  }

  // ── CHECK 8: Platform profiles use current MuscleMemory actionCodes ───────
  {
    const forbidden = CFG.forbiddenActionCodes;
    const violations: string[] = [];
    for (const profilePath of CFG.platformProfiles) {
      const src = readSrc(profilePath);
      if (!src) {
        violations.push(`${profilePath}: file not found`);
        continue;
      }
      const found = forbidden.filter((code) => src.includes(code));
      if (found.length > 0) {
        violations.push(`${profilePath}: ${found.join(", ")}`);
      }
    }
    if (violations.length === 0) {
      checks.push({ checkId: "VMF-08", question: "Platform profiles use current MuscleMemory actionCodes (no forbidden codes)?", status: "PASS", detail: "Both platform profiles are clean of forbidden actionCodes." });
    } else {
      checks.push({ checkId: "VMF-08", question: "Platform profiles use current MuscleMemory actionCodes (no forbidden codes)?", status: "FAIL", detail: violations.join(" | ") });
    }
  }

  // ── CHECK 9: task-start-debug-writer is NOT a no-op ───────────────────────
  {
    const src = readSrc(CFG.debugWriterPath);
    if (!src) {
      checks.push({ checkId: "VMF-09", question: "task-start-debug-writer.ts is not a no-op?", status: "FAIL", detail: `File not found: ${CFG.debugWriterPath}` });
    } else if (src.includes(CFG.noOpSignature)) {
      checks.push({ checkId: "VMF-09", question: "task-start-debug-writer.ts is not a no-op?", status: "FAIL", detail: "No-op comment still present — debug events are silently dropped." });
    } else if (src.includes("emitRuntimeLog")) {
      checks.push({ checkId: "VMF-09", question: "task-start-debug-writer.ts is not a no-op?", status: "PASS", detail: "emitRuntimeLog found — debug writer is active." });
    } else {
      checks.push({ checkId: "VMF-09", question: "task-start-debug-writer.ts is not a no-op?", status: "FAIL", detail: "Neither emitRuntimeLog nor no-op — debug writer state is unknown." });
    }
  }

  // ── CHECK 10: RuntimeLogger injected in workbench-assembly.ts ─────────────
  {
    const src = readSrc(CFG.workbenchAssemblyPath);
    if (!src) {
      checks.push({ checkId: "VMF-10", question: "RuntimeLogger created and set as default in workbench-assembly.ts?", status: "FAIL", detail: `File not found: ${CFG.workbenchAssemblyPath}` });
    } else {
      const missing = CFG.runtimeLoggerTokens.filter((t) => !src.includes(t));
      if (missing.length === 0) {
        checks.push({ checkId: "VMF-10", question: "RuntimeLogger created and set as default in workbench-assembly.ts?", status: "PASS", detail: "Both createRuntimeLogger and setDefaultRuntimeLogger found." });
      } else {
        checks.push({ checkId: "VMF-10", question: "RuntimeLogger created and set as default in workbench-assembly.ts?", status: "FAIL", detail: `Missing: ${missing.join(", ")} — RuntimeLogger not injected into main chain.` });
      }
    }
  }

  // ─── Compute overall status ──────────────────────────────────────────────
  const hasAnyFail = checks.some((c) => c.status === "FAIL");
  const hasAnyWarn = checks.some((c) => c.status === "WARN");
  const overallStatus = hasAnyFail ? "FAIL" : hasAnyWarn ? "WARN" : "PASS";

  return { checks, overallStatus };
}
