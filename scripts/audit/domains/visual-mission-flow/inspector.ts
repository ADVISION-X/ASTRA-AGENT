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

  // ── CHECK 11: Open gate must use targetProfileRef, not platformId ─────────
  {
    const src = readSrc(CFG.missionLoopPath);
    if (!src) {
      checks.push({ checkId: "VMF-11", question: "Open gate must pass targetProfileRef or targetUrl, never bare platformId?", status: "FAIL", detail: `File not found: ${CFG.missionLoopPath}` });
    } else {
      const hasTargetRef = src.includes(CFG.openGateTargetRefToken);
      // Check platformId only appears as a variable (not as an input field name after ":")
      const hasBadPlatformId = /inputOverrides[^}]*platformId\s*[^:?]/.test(src);
      if (hasTargetRef && !hasBadPlatformId) {
        checks.push({ checkId: "VMF-11", question: "Open gate must pass targetProfileRef or targetUrl, never bare platformId?", status: "PASS", detail: "Open gate uses targetProfileRef in inputOverrides." });
      } else if (!hasTargetRef) {
        checks.push({ checkId: "VMF-11", question: "Open gate must pass targetProfileRef or targetUrl, never bare platformId?", status: "FAIL", detail: "targetProfileRef not found in Open gate inputOverrides." });
      } else {
        checks.push({ checkId: "VMF-11", question: "Open gate must pass targetProfileRef or targetUrl, never bare platformId?", status: "FAIL", detail: "platformId still present in Open gate inputOverrides — rejected by strict Open schema." });
      }
    }
  }

  // ── CHECK 12: Open gate checks result.status before setting openResultRef ─
  {
    const src = readSrc(CFG.missionLoopPath);
    if (!src) {
      checks.push({ checkId: "VMF-12", question: "Open gate must check result.status before setting openResultRef?", status: "FAIL", detail: `File not found: ${CFG.missionLoopPath}` });
    } else if (src.includes(CFG.openGateResultCheckToken)) {
      checks.push({ checkId: "VMF-12", question: "Open gate must check result.status before setting openResultRef?", status: "PASS", detail: "openResult.status check found in Open gate." });
    } else {
      checks.push({ checkId: "VMF-12", question: "Open gate must check result.status before setting openResultRef?", status: "FAIL", detail: "openResult.status not checked — mission continues even if Open fails." });
    }
  }

  // ── CHECK 13: NerveBus dispatcher is pure transport (no ability-group-specific branches) ──
  {
    const src = readSrc(CFG.nerveBusDispatcherPath);
    if (!src) {
      checks.push({ checkId: "VMF-13", question: "NerveBus dispatcher is pure transport (no per-ability-group enrichment branches)?", status: "FAIL", detail: `File not found: ${CFG.nerveBusDispatcherPath}` });
    } else if (src.includes('envelope.abilityGroupId === "open"') || src.includes("envelope.abilityGroupId === 'open'")) {
      checks.push({ checkId: "VMF-13", question: "NerveBus dispatcher is pure transport (no per-ability-group enrichment branches)?", status: "FAIL", detail: "Open-specific branch found — NerveBus is not pure transport; dispatch-sequence must build complete inputs." });
    } else if (src.includes('envelope.abilityGroupId === "mouse-scroll"') || src.includes("envelope.abilityGroupId === 'mouse-scroll'")) {
      checks.push({ checkId: "VMF-13", question: "NerveBus dispatcher is pure transport (no per-ability-group enrichment branches)?", status: "FAIL", detail: "Mouse-scroll branch found — NerveBus is not pure transport." });
    } else {
      checks.push({ checkId: "VMF-13", question: "NerveBus dispatcher is pure transport (no per-ability-group enrichment branches)?", status: "PASS", detail: "No per-ability-group enrichment branches — pure transport confirmed." });
    }
  }

  // ── CHECK 14: product_yes schema uses targetRole + captureMode (not reason regex) ──
  {
    const aiOutputSchemaPath = "src/visual-mission/action-plan/ai-output.schema.ts";
    const src = readSrc(aiOutputSchemaPath);
    if (!src) {
      checks.push({ checkId: "VMF-14", question: "product_yes output schema requires targetRole-based like/comments checks + SAVE with captureMode?", status: "FAIL", detail: `File not found: ${aiOutputSchemaPath}` });
    } else {
      const hasProductYes = src.includes("product_yes") && src.includes("superRefine");
      const hasTargetRoleLike = src.includes("like_button");
      const hasTargetRoleComment = src.includes("comments_button");
      const hasSaveCheck = src.includes("SAVE_CURRENT_VIDEO_EVIDENCE_ONCE");
      const hasCaptureMode = src.includes("fresh_current_viewport");
      const hasReasonRegex = src.includes("/like/i") || src.includes("/comment/i");
      const missing: string[] = [];
      if (!hasProductYes) missing.push("product_yes superRefine");
      if (!hasTargetRoleLike) missing.push("targetRole='like_button' check");
      if (!hasTargetRoleComment) missing.push("targetRole='comments_button' check");
      if (!hasSaveCheck) missing.push("SAVE check");
      if (!hasCaptureMode) missing.push("captureMode='fresh_current_viewport' check");
      if (hasReasonRegex) missing.push("reason regex still present (must be removed)");
      if (missing.length === 0) {
        checks.push({ checkId: "VMF-14", question: "product_yes output schema requires targetRole-based like/comments checks + SAVE with captureMode?", status: "PASS", detail: "product_yes superRefine validates targetRole for like/comments, SAVE with captureMode." });
      } else {
        checks.push({ checkId: "VMF-14", question: "product_yes output schema requires targetRole-based like/comments checks + SAVE with captureMode?", status: "FAIL", detail: `Issues: ${missing.join(", ")}` });
      }
    }
  }

  // ── CHECK 15: product_no schema forbids click/save ─────────────────────────
  {
    const aiOutputSchemaPath = "src/visual-mission/action-plan/ai-output.schema.ts";
    const src = readSrc(aiOutputSchemaPath);
    if (!src) {
      checks.push({ checkId: "VMF-15", question: "product_no output schema forbids click and SAVE?", status: "FAIL", detail: `File not found: ${aiOutputSchemaPath}` });
    } else {
      const hasProductNo = src.includes("product_no");
      const hasClickForbid = src.includes("product_no must not contain click");
      const hasSaveForbid = src.includes("product_no must not contain SAVE");
      if (hasProductNo && hasClickForbid && hasSaveForbid) {
        checks.push({ checkId: "VMF-15", question: "product_no output schema forbids click and SAVE?", status: "PASS", detail: "product_no superRefine forbids clicks and SAVE." });
      } else {
        const missing: string[] = [];
        if (!hasProductNo) missing.push("product_no check");
        if (!hasClickForbid) missing.push("click forbid");
        if (!hasSaveForbid) missing.push("SAVE forbid");
        checks.push({ checkId: "VMF-15", question: "product_no output schema forbids click and SAVE?", status: "FAIL", detail: `Missing: ${missing.join(", ")}` });
      }
    }
  }

  // ── CHECK 16: dispatch-sequence uses captureMode trigger (not reason regex) for fresh screenshot ──
  {
    const src = readSrc(CFG.dispatchSequencePath);
    if (!src) {
      checks.push({ checkId: "VMF-16", question: "dispatch-sequence uses captureMode='fresh_current_viewport' to trigger fresh screenshot (no reason regex)?", status: "FAIL", detail: `File not found: ${CFG.dispatchSequencePath}` });
    } else {
      const hasCaptureModeCheck = src.includes("captureMode") && src.includes("fresh_current_viewport");
      const hasReasonRegex = src.includes("/comment/i") || src.includes("/like/i");
      const hasOldTracking = src.includes("commentPanelOpenAttempted") || src.includes("priorClickCount");
      if (hasCaptureModeCheck && !hasReasonRegex && !hasOldTracking) {
        checks.push({ checkId: "VMF-16", question: "dispatch-sequence uses captureMode='fresh_current_viewport' to trigger fresh screenshot (no reason regex)?", status: "PASS", detail: "captureMode-based fresh screenshot trigger found; no reason-regex flow control." });
      } else {
        const issues: string[] = [];
        if (!hasCaptureModeCheck) issues.push("captureMode='fresh_current_viewport' trigger missing");
        if (hasReasonRegex) issues.push("reason regex still drives flow (/comment/i or /like/i)");
        if (hasOldTracking) issues.push("old tracking variable still present");
        checks.push({ checkId: "VMF-16", question: "dispatch-sequence uses captureMode='fresh_current_viewport' to trigger fresh screenshot (no reason regex)?", status: "FAIL", detail: `Issues: ${issues.join(", ")}` });
      }
    }
  }

  // ── CHECK 17: SAVE evidence record includes freshScreenshotRef when captureMode=fresh ──
  {
    const src = readSrc(CFG.dispatchSequencePath);
    if (!src) {
      checks.push({ checkId: "VMF-17", question: "dispatch-sequence posts freshScreenshotRef in evidence when captureMode='fresh_current_viewport'?", status: "FAIL", detail: `File not found: ${CFG.dispatchSequencePath}` });
    } else if (src.includes("freshScreenshotRef")) {
      checks.push({ checkId: "VMF-17", question: "dispatch-sequence posts freshScreenshotRef in evidence when captureMode='fresh_current_viewport'?", status: "PASS", detail: "freshScreenshotRef present in dispatch-sequence evidence record." });
    } else {
      checks.push({ checkId: "VMF-17", question: "dispatch-sequence posts freshScreenshotRef in evidence when captureMode='fresh_current_viewport'?", status: "FAIL", detail: "freshScreenshotRef not found — fresh viewport screenshot not saved to evidence." });
    }
  }

  // ── CHECK 18: progress counters are state-derived (not hardcoded 0) ────────
  {
    const src = readSrc(CFG.missionLoopPath);
    if (!src) {
      checks.push({ checkId: "VMF-18", question: "roundMissionPacket progress is state-derived (not hardcoded 0)?", status: "FAIL", detail: `File not found: ${CFG.missionLoopPath}` });
    } else if (src.includes(CFG.progressHardcodeToken)) {
      checks.push({ checkId: "VMF-18", question: "roundMissionPacket progress is state-derived (not hardcoded 0)?", status: "FAIL", detail: "savedLeadCount: 0 hardcoded — AI always sees progress as zero." });
    } else if (src.includes("savedEvidenceCount") && src.includes("skippedVideoCount")) {
      checks.push({ checkId: "VMF-18", question: "roundMissionPacket progress is state-derived (not hardcoded 0)?", status: "PASS", detail: "State-derived progress counters found in roundMissionPacket." });
    } else {
      checks.push({ checkId: "VMF-18", question: "roundMissionPacket progress is state-derived (not hardcoded 0)?", status: "FAIL", detail: "State-derived progress counters not found." });
    }
  }

  // ── CHECK 19: runtimeLogger passed to AI ability group ─────────────────────
  {
    const src = readSrc(CFG.workbenchAssemblyPath);
    if (!src) {
      checks.push({ checkId: "VMF-19", question: "runtimeLogger passed to createConfiguredAiAbilityGroup?", status: "FAIL", detail: `File not found: ${CFG.workbenchAssemblyPath}` });
    } else if (src.includes(CFG.aiRuntimeLoggerToken)) {
      checks.push({ checkId: "VMF-19", question: "runtimeLogger passed to createConfiguredAiAbilityGroup?", status: "PASS", detail: "runtimeLogger injected into AI ability group." });
    } else {
      checks.push({ checkId: "VMF-19", question: "runtimeLogger passed to createConfiguredAiAbilityGroup?", status: "FAIL", detail: "runtimeLogger not passed to createConfiguredAiAbilityGroup — AI debug events not emitted." });
    }
  }

  // ── CHECK 20: task-start-debug-writer has no any / eslint-disable ─────────
  {
    const src = readSrc(CFG.debugWriterPath);
    if (!src) {
      checks.push({ checkId: "VMF-20", question: "task-start-debug-writer has no untyped-any or lint-suppress and no wrong event mapping?", status: "FAIL", detail: `File not found: ${CFG.debugWriterPath}` });
    } else {
      const violations = CFG.debugWriterForbiddenTokens.filter((t) => src.includes(t));
      const hasBadMapping = src.includes("MISSION_PREFLIGHT_PASSED") && src.includes("MISSION_STARTED") &&
        /MISSION_PREFLIGHT_PASSED[^,}]*MISSION_STARTED/.test(src);
      if (violations.length === 0 && !hasBadMapping) {
        checks.push({ checkId: "VMF-20", question: "task-start-debug-writer has no untyped-any or lint-suppress and no wrong event mapping?", status: "PASS", detail: "No forbidden tokens; event mapping is correct." });
      } else {
        const issues = [...violations];
        if (hasBadMapping) issues.push("MISSION_PREFLIGHT_PASSED mapped to MISSION_STARTED");
        checks.push({ checkId: "VMF-20", question: "task-start-debug-writer has no untyped-any or lint-suppress and no wrong event mapping?", status: "FAIL", detail: `Violations: ${issues.join(", ")}` });
      }
    }
  }

  // ─── Compute overall status ──────────────────────────────────────────────

  // ── CHECK 21: No reason-regex flow control in orchestration (P0-1 regression) ──
  {
    const files = [CFG.dispatchSequencePath, "src/visual-mission/action-plan/ai-output.schema.ts"];
    const violations: string[] = [];
    for (const f of files) {
      const src = readSrc(f);
      if (src && (src.includes("/comment/i") || src.includes("/like/i"))) {
        violations.push(f);
      }
    }
    if (violations.length === 0) {
      checks.push({ checkId: "VMF-21", question: "No reason-regex (/comment/i, /like/i) flow control in dispatch-sequence or ai-output schema?", status: "PASS", detail: "No reason-regex flow control found." });
    } else {
      checks.push({ checkId: "VMF-21", question: "No reason-regex (/comment/i, /like/i) flow control in dispatch-sequence or ai-output schema?", status: "FAIL", detail: `Reason-regex flow control still present in: ${violations.join(", ")}` });
    }
  }

  // ── CHECK 22: No silent platform fallback in orchestration runtime (P0-5 regression) ──
  {
    const src = readSrc(CFG.missionLoopPath);
    if (!src) {
      checks.push({ checkId: "VMF-22", question: "No silent platform fallback ('facebook-web' default) in orchestration runtime?", status: "FAIL", detail: `File not found: ${CFG.missionLoopPath}` });
    } else if (src.includes('return "facebook-web"') || src.includes("return 'facebook-web'") || src.includes('?? "Mine seed product videos"') || src.includes("?? 'Mine seed product videos'")) {
      checks.push({ checkId: "VMF-22", question: "No silent platform fallback ('facebook-web' default) in orchestration runtime?", status: "FAIL", detail: "Silent fallback to 'facebook-web' or 'Mine seed product videos' default found — must fail closed." });
    } else {
      checks.push({ checkId: "VMF-22", question: "No silent platform fallback ('facebook-web' default) in orchestration runtime?", status: "PASS", detail: "No silent platform fallback found; fail-closed pattern confirmed." });
    }
  }

  // ── CHECK 23: roundIndexDelta only in mission-loop-runner, not dispatch-sequence (P0-3) ──
  {
    const dsSrc = readSrc(CFG.dispatchSequencePath);
    const mlSrc = readSrc(CFG.missionLoopPath);
    if (!dsSrc) {
      checks.push({ checkId: "VMF-23", question: "roundIndexDelta not in dispatch-sequence (only mission-loop-runner is roundIndex owner)?", status: "FAIL", detail: `File not found: ${CFG.dispatchSequencePath}` });
    } else if (dsSrc.includes("roundIndexDelta")) {
      checks.push({ checkId: "VMF-23", question: "roundIndexDelta not in dispatch-sequence (only mission-loop-runner is roundIndex owner)?", status: "FAIL", detail: "roundIndexDelta found in dispatch-sequence — double-increment P0-3 violation." });
    } else if (mlSrc && mlSrc.includes("roundIndex")) {
      checks.push({ checkId: "VMF-23", question: "roundIndexDelta not in dispatch-sequence (only mission-loop-runner is roundIndex owner)?", status: "PASS", detail: "roundIndexDelta absent in dispatch-sequence; mission-loop-runner owns roundIndex." });
    } else {
      checks.push({ checkId: "VMF-23", question: "roundIndexDelta not in dispatch-sequence (only mission-loop-runner is roundIndex owner)?", status: "WARN", detail: "roundIndexDelta absent in dispatch-sequence but mission-loop-runner roundIndex not found." });
    }
  }

  // ── CHECK 24: OPEN_PLATFORM_ENTRY_ONCE.allowedForAiActionPlan = false in catalog (P0-6) ──
  {
    const catalogPath = "src/muscle-memory/generated-catalog.json";
    const src = readSrc(catalogPath);
    if (!src) {
      checks.push({ checkId: "VMF-24", question: "OPEN_PLATFORM_ENTRY_ONCE.allowedForAiActionPlan=false in catalog?", status: "FAIL", detail: `File not found: ${catalogPath}` });
    } else {
      try {
        const catalog = JSON.parse(src) as { entries: Array<{ actionCode: string; allowedForAiActionPlan: boolean }> };
        const openEntry = catalog.entries.find(e => e.actionCode === "OPEN_PLATFORM_ENTRY_ONCE");
        if (!openEntry) {
          checks.push({ checkId: "VMF-24", question: "OPEN_PLATFORM_ENTRY_ONCE.allowedForAiActionPlan=false in catalog?", status: "FAIL", detail: "OPEN_PLATFORM_ENTRY_ONCE not found in catalog." });
        } else if (openEntry.allowedForAiActionPlan === false) {
          checks.push({ checkId: "VMF-24", question: "OPEN_PLATFORM_ENTRY_ONCE.allowedForAiActionPlan=false in catalog?", status: "PASS", detail: "OPEN_PLATFORM_ENTRY_ONCE correctly excluded from AI action plan." });
        } else {
          checks.push({ checkId: "VMF-24", question: "OPEN_PLATFORM_ENTRY_ONCE.allowedForAiActionPlan=false in catalog?", status: "FAIL", detail: `OPEN_PLATFORM_ENTRY_ONCE.allowedForAiActionPlan=${openEntry.allowedForAiActionPlan} — AI must not initiate platform opens.` });
        }
      } catch {
        checks.push({ checkId: "VMF-24", question: "OPEN_PLATFORM_ENTRY_ONCE.allowedForAiActionPlan=false in catalog?", status: "FAIL", detail: "Failed to parse catalog JSON." });
      }
    }
  }

  // ── CHECK 25: emitRuntimeLog not directly imported in orchestration capability files (P0-8) ──
  {
    const orchFiles = [
      CFG.missionLoopPath,
      CFG.dispatchSequencePath,
      "src/capabilities/orchestration/children.ts",
      "src/capabilities/orchestration/ability-group.ts",
    ];
    const violations: string[] = [];
    for (const f of orchFiles) {
      const src = readSrc(f);
      if (src && src.includes("emitRuntimeLog")) {
        violations.push(f);
      }
    }
    if (violations.length === 0) {
      checks.push({ checkId: "VMF-25", question: "emitRuntimeLog not directly used in orchestration capability files (injected runtimeLogger only)?", status: "PASS", detail: "No direct emitRuntimeLog usage in orchestration capability files." });
    } else {
      checks.push({ checkId: "VMF-25", question: "emitRuntimeLog not directly used in orchestration capability files (injected runtimeLogger only)?", status: "FAIL", detail: `emitRuntimeLog used directly in: ${violations.join(", ")}` });
    }
  }

  // ── CHECK 26: NerveBus dispatcher has no abilityGroupId=== branches (P0-4 regression) ──
  {
    const src = readSrc(CFG.nerveBusDispatcherPath);
    if (!src) {
      checks.push({ checkId: "VMF-26", question: "NerveBus dispatcher has no abilityGroupId=== per-group branches (pure transport)?", status: "FAIL", detail: `File not found: ${CFG.nerveBusDispatcherPath}` });
    } else {
      const hasBranch = /envelope\.abilityGroupId\s*===/.test(src) && !/^\s*\/\//.test(src);
      const hasOnlyOrchBranch = src.includes('envelope.abilityGroupId === "orchestration"') &&
        !src.includes('envelope.abilityGroupId === "open"') &&
        !src.includes('envelope.abilityGroupId === "mouse-scroll"') &&
        !src.includes('envelope.abilityGroupId === "mouse-click"');
      if (hasOnlyOrchBranch) {
        checks.push({ checkId: "VMF-26", question: "NerveBus dispatcher has no abilityGroupId=== per-group branches (pure transport)?", status: "PASS", detail: "Only orchestration self-route branch found — pure transport for all other groups." });
      } else if (hasBranch) {
        checks.push({ checkId: "VMF-26", question: "NerveBus dispatcher has no abilityGroupId=== per-group branches (pure transport)?", status: "FAIL", detail: "Per-group abilityGroupId=== branches found in NerveBus dispatcher — not pure transport." });
      } else {
        checks.push({ checkId: "VMF-26", question: "NerveBus dispatcher has no abilityGroupId=== per-group branches (pure transport)?", status: "PASS", detail: "No per-group abilityGroupId=== branches found — pure transport confirmed." });
      }
    }
  }

  const hasAnyFail = checks.some((c) => c.status === "FAIL");
  const hasAnyWarn = checks.some((c) => c.status === "WARN");
  const overallStatus = hasAnyFail ? "FAIL" : hasAnyWarn ? "WARN" : "PASS";

  return { checks, overallStatus };
}
