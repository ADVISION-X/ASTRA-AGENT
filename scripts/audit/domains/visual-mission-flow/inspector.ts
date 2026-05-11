// Visual Mission Flow Inspector — 10 structural governance checks.
// Verifies the form-submit → seed video mining flow is correctly wired end-to-end.

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { Node, SyntaxKind } from "ts-morph";
import { getAuditProject } from "../../core/ts-morph.js";
import { pathFromRepoRoot } from "../../core/paths.js";
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
      // priorClickCount is the deprecated tracking variable (replaced by targetRole-derived logic).
      // commentPanelOpenAttempted is still valid — it's now derived from targetRole (not reason regex).
      const hasDeprecatedTracking = src.includes("priorClickCount");
      // Check that commentPanelOpenAttempted is derived from targetRole, not hardcoded/let-declared
      const hasReasonRegexDerivedTracking = /let\s+commentPanelOpenAttempted\s*=\s*false/.test(src);
      if (hasCaptureModeCheck && !hasReasonRegex && !hasDeprecatedTracking && !hasReasonRegexDerivedTracking) {
        checks.push({ checkId: "VMF-16", question: "dispatch-sequence uses captureMode='fresh_current_viewport' to trigger fresh screenshot (no reason regex)?", status: "PASS", detail: "captureMode-based fresh screenshot trigger found; no reason-regex flow control; commentPanelOpenAttempted derived from targetRole." });
      } else {
        const issues: string[] = [];
        if (!hasCaptureModeCheck) issues.push("captureMode='fresh_current_viewport' trigger missing");
        if (hasReasonRegex) issues.push("reason regex still drives flow (/comment/i or /like/i)");
        if (hasDeprecatedTracking) issues.push("deprecated priorClickCount tracking variable still present");
        if (hasReasonRegexDerivedTracking) issues.push("commentPanelOpenAttempted still let-declared as false (old reason-regex tracking)");
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

  // ── CHECK 27: Prompt example uses concrete enum values (no pipe-separated options, no string descriptors) ──
  // Root cause prevention: small models (qwen2.5vl:3b) copy pipe-separated values verbatim
  // causing Zod enum validation failures. Example must use one real chosen value.
  {
    const promptPath = "src/capabilities/ai/prompt/visual-mission-judge-prompt.ts";
    const src = readSrc(promptPath);
    if (!src) {
      checks.push({ checkId: "VMF-27", question: "AI prompt example uses concrete enum values (no pipe-separated options or string descriptor placeholders)?", status: "FAIL", detail: `File not found: ${promptPath}` });
    } else {
      // Find the buildOutputSchemaBlock function body
      const blockMatch = src.match(/buildOutputSchemaBlock[\s\S]*?return JSON\.stringify\(([\s\S]*?)\s*,\s*null,\s*2\)/);
      const exampleBlock = blockMatch ? blockMatch[1] : src;

      const hasPipeEnum = /["'][^"'\n]*\|[^"'\n]*["']/.test(exampleBlock ?? "");
      const hasStringDescriptor = /["']string\s*[—\-]/.test(exampleBlock ?? "");

      const violations: string[] = [];
      if (hasPipeEnum) violations.push("pipe-separated enum values found (model will copy verbatim)");
      if (hasStringDescriptor) violations.push("'string —' descriptor placeholder found (model will copy verbatim)");

      if (violations.length === 0) {
        checks.push({ checkId: "VMF-27", question: "AI prompt example uses concrete enum values (no pipe-separated options or string descriptor placeholders)?", status: "PASS", detail: "Prompt example uses concrete enum values — no pipe-separated options or descriptor placeholders." });
      } else {
        checks.push({ checkId: "VMF-27", question: "AI prompt example uses concrete enum values (no pipe-separated options or string descriptor placeholders)?", status: "FAIL", detail: `Prompt example quality issues: ${violations.join("; ")}` });
      }
    }
  }

  // ── CHECK 28: mission-loop-runner sends only grid image to AI model (not both original+grid) ──
  // Root cause prevention: sending 2 large images to qwen2.5vl:3b causes model overload
  // producing broken JSON ("{ \"type=\":0" with no closing brace).
  {
    const src = readSrc(CFG.missionLoopPath);
    if (!src) {
      checks.push({ checkId: "VMF-28", question: "mission-loop-runner sends only grid image (not both original+grid) to AI model?", status: "FAIL", detail: `File not found: ${CFG.missionLoopPath}` });
    } else {
      // The original screenshot entry must NOT have filePath: originalAiPath (image sent to model)
      // Verify the grid image IS sent and original is refs-only
      const hasOriginalFilePath = /id:\s*originalScreenshotRef[\s\S]{0,200}filePath:\s*originalAiPath/.test(src);
      const hasGridFilePath = /id:\s*coordinateGridScreenshotRef[\s\S]{0,200}filePath:\s*gridAiPath/.test(src);

      if (!hasOriginalFilePath && hasGridFilePath) {
        checks.push({ checkId: "VMF-28", question: "mission-loop-runner sends only grid image (not both original+grid) to AI model?", status: "PASS", detail: "Only grid screenshot sent as image bytes to model; original screenshot is ID-ref only." });
      } else if (hasOriginalFilePath) {
        checks.push({ checkId: "VMF-28", question: "mission-loop-runner sends only grid image (not both original+grid) to AI model?", status: "FAIL", detail: "Original screenshot filePath still passed to model — 2-image context overload causes broken JSON output." });
      } else {
        checks.push({ checkId: "VMF-28", question: "mission-loop-runner sends only grid image (not both original+grid) to AI model?", status: "WARN", detail: "Grid filePath not found — verify image delivery to AI model is correct." });
      }
    }
  }

  // ── VMF-AST-001: mission-loop phase order (Open→screenshot→grid→AI→dispatch) ──
  {
    try {
      const project = getAuditProject();
      const sf = project.getSourceFile(pathFromRepoRoot(CFG.missionLoopPath)) ?? project.addSourceFileAtPathIfExists(pathFromRepoRoot(CFG.missionLoopPath));
      if (!sf) {
        checks.push({ checkId: "VMF-AST-001", question: "mission-loop-runner: Open→screenshot→grid→AI→dispatch phase order correct (AST)?", status: "FAIL", detail: `File not found: ${CFG.missionLoopPath}` });
      } else {
        const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
        const openCalls = calls.filter(c => {
          const expr = c.getExpression();
          if (!Node.isPropertyAccessExpression(expr)) return false;
          return expr.getName() === "execute" && expr.getExpression().getText().includes("openAbilityGroup");
        });
        const shotCalls = calls.filter(c => {
          const expr = c.getExpression();
          if (!Node.isPropertyAccessExpression(expr)) return false;
          return expr.getName() === "execute" && expr.getExpression().getText().includes("screenshotAbilityGroup");
        });
        const aiCalls = calls.filter(c => {
          const expr = c.getExpression();
          if (!Node.isPropertyAccessExpression(expr)) return false;
          return expr.getName() === "execute" && expr.getExpression().getText().includes("aiAbilityGroup");
        });
        const dispatchCalls = calls.filter(c => {
          const expr = c.getExpression();
          return Node.isIdentifier(expr) && expr.getText() === "dispatchRegisteredAbilitySequence";
        });
        if (openCalls.length === 0 || shotCalls.length < 2 || aiCalls.length === 0 || dispatchCalls.length === 0) {
          const missing: string[] = [];
          if (openCalls.length === 0) missing.push("openAbilityGroup.execute");
          if (shotCalls.length < 2) missing.push(`screenshotAbilityGroup.execute (found ${shotCalls.length}, need 2)`);
          if (aiCalls.length === 0) missing.push("aiAbilityGroup.execute");
          if (dispatchCalls.length === 0) missing.push("dispatchRegisteredAbilitySequence");
          checks.push({ checkId: "VMF-AST-001", question: "mission-loop-runner: Open→screenshot→grid→AI→dispatch phase order correct (AST)?", status: "FAIL", detail: `Missing AST call nodes: ${missing.join(", ")}` });
        } else {
          const openPos = openCalls[0]!.getStart();
          const shot1Pos = shotCalls[0]!.getStart();
          const shot2Pos = shotCalls[1]!.getStart();
          const aiPos = aiCalls[0]!.getStart();
          const dispatchPos = dispatchCalls[0]!.getStart();
          const inOrder = openPos < shot1Pos && shot1Pos < shot2Pos && shot2Pos < aiPos && aiPos < dispatchPos;
          if (inOrder) {
            checks.push({ checkId: "VMF-AST-001", question: "mission-loop-runner: Open→screenshot→grid→AI→dispatch phase order correct (AST)?", status: "PASS", detail: "All 5 phase call expressions found in correct order via AST position." });
          } else {
            checks.push({ checkId: "VMF-AST-001", question: "mission-loop-runner: Open→screenshot→grid→AI→dispatch phase order correct (AST)?", status: "FAIL", detail: `Phase order wrong: open@${openPos} shot1@${shot1Pos} shot2@${shot2Pos} ai@${aiPos} dispatch@${dispatchPos}` });
          }
        }
      }
    } catch (err) {
      checks.push({ checkId: "VMF-AST-001", question: "mission-loop-runner: Open→screenshot→grid→AI→dispatch phase order correct (AST)?", status: "FAIL", detail: `ts-morph error: ${err instanceof Error ? err.message : String(err)}` });
    }
  }

  // ── VMF-AST-002: dispatch-sequence complete input builder has geometry fields ──
  {
    try {
      const project = getAuditProject();
      const sf = project.getSourceFile(pathFromRepoRoot(CFG.dispatchSequencePath)) ?? project.addSourceFileAtPathIfExists(pathFromRepoRoot(CFG.dispatchSequencePath));
      if (!sf) {
        checks.push({ checkId: "VMF-AST-002", question: "dispatch-sequence complete input builder has geometryGuardNormalizedClickPoint (AST)?", status: "FAIL", detail: `File not found: ${CFG.dispatchSequencePath}` });
      } else {
        const objLiterals = sf.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression);
        const hasGeometryField = objLiterals.some(obj =>
          obj.getProperties().some(p => {
            if (Node.isPropertyAssignment(p)) return p.getName() === "geometryGuardNormalizedClickPoint";
            if (Node.isShorthandPropertyAssignment(p)) return p.getName() === "geometryGuardNormalizedClickPoint";
            return false;
          })
        );
        if (hasGeometryField) {
          checks.push({ checkId: "VMF-AST-002", question: "dispatch-sequence complete input builder has geometryGuardNormalizedClickPoint (AST)?", status: "PASS", detail: "geometryGuardNormalizedClickPoint found as object literal property via AST." });
        } else {
          checks.push({ checkId: "VMF-AST-002", question: "dispatch-sequence complete input builder has geometryGuardNormalizedClickPoint (AST)?", status: "FAIL", detail: "geometryGuardNormalizedClickPoint not found as object property — complete input builder may be incomplete." });
        }
      }
    } catch (err) {
      checks.push({ checkId: "VMF-AST-002", question: "dispatch-sequence complete input builder has geometryGuardNormalizedClickPoint (AST)?", status: "FAIL", detail: `ts-morph error: ${err instanceof Error ? err.message : String(err)}` });
    }
  }

  // ── VMF-AST-003: dispatch-sequence uses completeInput (not partial) for NerveBus dispatch ──
  {
    try {
      const project = getAuditProject();
      const sf = project.getSourceFile(pathFromRepoRoot(CFG.dispatchSequencePath)) ?? project.addSourceFileAtPathIfExists(pathFromRepoRoot(CFG.dispatchSequencePath));
      if (!sf) {
        checks.push({ checkId: "VMF-AST-003", question: "dispatch-sequence uses completeInput variable for NerveBus dispatch (not partial override, AST)?", status: "FAIL", detail: `File not found: ${CFG.dispatchSequencePath}` });
      } else {
        const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
        const dispatchCalls = calls.filter(c => {
          const expr = c.getExpression();
          if (!Node.isPropertyAccessExpression(expr)) return false;
          return expr.getName() === "dispatchAbilityCommand";
        });
        if (dispatchCalls.length === 0) {
          checks.push({ checkId: "VMF-AST-003", question: "dispatch-sequence uses completeInput variable for NerveBus dispatch (not partial override, AST)?", status: "FAIL", detail: "No dispatchAbilityCommand calls found." });
        } else {
          const hasCompleteInput = dispatchCalls.some(c => {
            const args = c.getArguments();
            if (args.length === 0) return false;
            const argObj = args[0];
            if (!Node.isObjectLiteralExpression(argObj)) return false;
            const inputOverridesProp = argObj.getProperties().find(p =>
              Node.isPropertyAssignment(p) && p.getName() === "inputOverrides"
            );
            if (!inputOverridesProp || !Node.isPropertyAssignment(inputOverridesProp)) return false;
            const val = inputOverridesProp.getInitializer();
            return Node.isIdentifier(val) && val.getText() === "completeInput";
          });
          if (hasCompleteInput) {
            checks.push({ checkId: "VMF-AST-003", question: "dispatch-sequence uses completeInput variable for NerveBus dispatch (not partial override, AST)?", status: "PASS", detail: "inputOverrides: completeInput pattern found via AST in dispatchAbilityCommand call." });
          } else {
            checks.push({ checkId: "VMF-AST-003", question: "dispatch-sequence uses completeInput variable for NerveBus dispatch (not partial override, AST)?", status: "FAIL", detail: "inputOverrides: completeInput pattern not found — dispatch may use partial overrides." });
          }
        }
      }
    } catch (err) {
      checks.push({ checkId: "VMF-AST-003", question: "dispatch-sequence uses completeInput variable for NerveBus dispatch (not partial override, AST)?", status: "FAIL", detail: `ts-morph error: ${err instanceof Error ? err.message : String(err)}` });
    }
  }

  // ── VMF-AST-004: targetRole === "comments_button" (not regex) in dispatch-sequence ──
  {
    try {
      const project = getAuditProject();
      const sf = project.getSourceFile(pathFromRepoRoot(CFG.dispatchSequencePath)) ?? project.addSourceFileAtPathIfExists(pathFromRepoRoot(CFG.dispatchSequencePath));
      if (!sf) {
        checks.push({ checkId: "VMF-AST-004", question: "dispatch-sequence uses strict targetRole==='comments_button' comparison (AST)?", status: "FAIL", detail: `File not found: ${CFG.dispatchSequencePath}` });
      } else {
        const binaries = sf.getDescendantsOfKind(SyntaxKind.BinaryExpression);
        const hasTargetRoleCheck = binaries.some(b => {
          const right = b.getRight();
          if (!Node.isStringLiteral(right) || right.getLiteralText() !== "comments_button") return false;
          return b.getLeft().getText().includes("targetRole");
        });
        if (hasTargetRoleCheck) {
          checks.push({ checkId: "VMF-AST-004", question: "dispatch-sequence uses strict targetRole==='comments_button' comparison (AST)?", status: "PASS", detail: "targetRole === 'comments_button' BinaryExpression found via AST." });
        } else {
          checks.push({ checkId: "VMF-AST-004", question: "dispatch-sequence uses strict targetRole==='comments_button' comparison (AST)?", status: "FAIL", detail: "No targetRole==='comments_button' binary comparison found — comment detection may use regex or be missing." });
        }
      }
    } catch (err) {
      checks.push({ checkId: "VMF-AST-004", question: "dispatch-sequence uses strict targetRole==='comments_button' comparison (AST)?", status: "FAIL", detail: `ts-morph error: ${err instanceof Error ? err.message : String(err)}` });
    }
  }

  // ── VMF-AST-005: no regex literals in dispatch-sequence ──
  {
    try {
      const project = getAuditProject();
      const sf = project.getSourceFile(pathFromRepoRoot(CFG.dispatchSequencePath)) ?? project.addSourceFileAtPathIfExists(pathFromRepoRoot(CFG.dispatchSequencePath));
      if (!sf) {
        checks.push({ checkId: "VMF-AST-005", question: "dispatch-sequence has no RegExp literals for flow control (AST)?", status: "FAIL", detail: `File not found: ${CFG.dispatchSequencePath}` });
      } else {
        const regexLiterals = sf.getDescendantsOfKind(SyntaxKind.RegularExpressionLiteral);
        const newRegExpCalls = sf.getDescendantsOfKind(SyntaxKind.NewExpression).filter(n => {
          const expr = n.getExpression();
          return Node.isIdentifier(expr) && expr.getText() === "RegExp";
        });
        if (regexLiterals.length === 0 && newRegExpCalls.length === 0) {
          checks.push({ checkId: "VMF-AST-005", question: "dispatch-sequence has no RegExp literals for flow control (AST)?", status: "PASS", detail: "No regex literals or RegExp constructions in dispatch-sequence (AST)." });
        } else {
          const examples = [...regexLiterals.map(r => r.getText()), ...newRegExpCalls.map(n => n.getText())].slice(0, 3);
          checks.push({ checkId: "VMF-AST-005", question: "dispatch-sequence has no RegExp literals for flow control (AST)?", status: "FAIL", detail: `Regex found: ${examples.join(", ")}` });
        }
      }
    } catch (err) {
      checks.push({ checkId: "VMF-AST-005", question: "dispatch-sequence has no RegExp literals for flow control (AST)?", status: "FAIL", detail: `ts-morph error: ${err instanceof Error ? err.message : String(err)}` });
    }
  }

  // ── VMF-AST-006: SAVE evidence includes postCommentScreenshotRef when comments opened ──
  {
    try {
      const project = getAuditProject();
      const sf = project.getSourceFile(pathFromRepoRoot(CFG.dispatchSequencePath)) ?? project.addSourceFileAtPathIfExists(pathFromRepoRoot(CFG.dispatchSequencePath));
      if (!sf) {
        checks.push({ checkId: "VMF-AST-006", question: "dispatch-sequence SAVE evidence includes postCommentScreenshotRef (AST)?", status: "FAIL", detail: `File not found: ${CFG.dispatchSequencePath}` });
      } else {
        const identifiers = sf.getDescendantsOfKind(SyntaxKind.Identifier).filter(id => id.getText() === "postCommentScreenshotRef");
        const inObjectProperty = identifiers.some(id => {
          const parent = id.getParent();
          return Node.isPropertyAssignment(parent) || Node.isShorthandPropertyAssignment(parent);
        });
        if (inObjectProperty) {
          checks.push({ checkId: "VMF-AST-006", question: "dispatch-sequence SAVE evidence includes postCommentScreenshotRef (AST)?", status: "PASS", detail: "postCommentScreenshotRef found as object property key in dispatch-sequence (AST)." });
        } else if (identifiers.length > 0) {
          checks.push({ checkId: "VMF-AST-006", question: "dispatch-sequence SAVE evidence includes postCommentScreenshotRef (AST)?", status: "WARN", detail: "postCommentScreenshotRef identifier found but not as an object property key." });
        } else {
          checks.push({ checkId: "VMF-AST-006", question: "dispatch-sequence SAVE evidence includes postCommentScreenshotRef (AST)?", status: "FAIL", detail: "postCommentScreenshotRef not found in dispatch-sequence — post-comment evidence screenshot missing." });
        }
      }
    } catch (err) {
      checks.push({ checkId: "VMF-AST-006", question: "dispatch-sequence SAVE evidence includes postCommentScreenshotRef (AST)?", status: "FAIL", detail: `ts-morph error: ${err instanceof Error ? err.message : String(err)}` });
    }
  }

  // ── VMF-AST-007: no roundIndexDelta identifier in dispatch-sequence ──
  {
    try {
      const project = getAuditProject();
      const sf = project.getSourceFile(pathFromRepoRoot(CFG.dispatchSequencePath)) ?? project.addSourceFileAtPathIfExists(pathFromRepoRoot(CFG.dispatchSequencePath));
      if (!sf) {
        checks.push({ checkId: "VMF-AST-007", question: "dispatch-sequence has no roundIndexDelta identifier (AST)?", status: "FAIL", detail: `File not found: ${CFG.dispatchSequencePath}` });
      } else {
        const roundIndexDeltaIds = sf.getDescendantsOfKind(SyntaxKind.Identifier).filter(id => id.getText() === "roundIndexDelta");
        if (roundIndexDeltaIds.length === 0) {
          checks.push({ checkId: "VMF-AST-007", question: "dispatch-sequence has no roundIndexDelta identifier (AST)?", status: "PASS", detail: "roundIndexDelta absent from dispatch-sequence (AST) — no double-increment violation." });
        } else {
          checks.push({ checkId: "VMF-AST-007", question: "dispatch-sequence has no roundIndexDelta identifier (AST)?", status: "FAIL", detail: `roundIndexDelta found ${roundIndexDeltaIds.length} time(s) — double-increment P0-3 violation.` });
        }
      }
    } catch (err) {
      checks.push({ checkId: "VMF-AST-007", question: "dispatch-sequence has no roundIndexDelta identifier (AST)?", status: "FAIL", detail: `ts-morph error: ${err instanceof Error ? err.message : String(err)}` });
    }
  }

  // ── VMF-AST-008: mission-loop-runner increments roundIndex exactly once ──
  {
    try {
      const project = getAuditProject();
      const sf = project.getSourceFile(pathFromRepoRoot(CFG.missionLoopPath)) ?? project.addSourceFileAtPathIfExists(pathFromRepoRoot(CFG.missionLoopPath));
      if (!sf) {
        checks.push({ checkId: "VMF-AST-008", question: "mission-loop-runner increments roundIndex exactly once per round (AST)?", status: "FAIL", detail: `File not found: ${CFG.missionLoopPath}` });
      } else {
        const roundIndexIncrements = sf.getDescendantsOfKind(SyntaxKind.PropertyAssignment).filter(p => {
          if (p.getName() !== "roundIndex") return false;
          const init = p.getInitializer();
          if (!Node.isBinaryExpression(init)) return false;
          const opText = init.getOperatorToken().getText();
          return opText === "+" && init.getRight().getText().trim() === "1";
        });
        const postfixIncrements = sf.getDescendantsOfKind(SyntaxKind.PostfixUnaryExpression).filter(n => {
          return n.getOperand().getText() === "roundIndex";
        });
        const totalIncrements = roundIndexIncrements.length + postfixIncrements.length;
        if (totalIncrements === 1) {
          checks.push({ checkId: "VMF-AST-008", question: "mission-loop-runner increments roundIndex exactly once per round (AST)?", status: "PASS", detail: "roundIndex incremented exactly once (AST)." });
        } else if (totalIncrements === 0) {
          checks.push({ checkId: "VMF-AST-008", question: "mission-loop-runner increments roundIndex exactly once per round (AST)?", status: "FAIL", detail: "roundIndex never incremented — loop will not advance." });
        } else {
          checks.push({ checkId: "VMF-AST-008", question: "mission-loop-runner increments roundIndex exactly once per round (AST)?", status: "FAIL", detail: `roundIndex incremented ${totalIncrements} times — double-increment violation.` });
        }
      }
    } catch (err) {
      checks.push({ checkId: "VMF-AST-008", question: "mission-loop-runner increments roundIndex exactly once per round (AST)?", status: "FAIL", detail: `ts-morph error: ${err instanceof Error ? err.message : String(err)}` });
    }
  }

  // ── VMF-AST-009: AI prompt has no "Do NOT include SCROLL_BROWSER_VIEWPORT_ONCE" text ──
  {
    try {
      const project = getAuditProject();
      const sf = project.getSourceFile(pathFromRepoRoot(CFG.aiPromptPath)) ?? project.addSourceFileAtPathIfExists(pathFromRepoRoot(CFG.aiPromptPath));
      if (!sf) {
        checks.push({ checkId: "VMF-AST-009", question: "AI prompt has no SCROLL prohibition for product_yes (AST)?", status: "FAIL", detail: `File not found: ${CFG.aiPromptPath}` });
      } else {
        const FORBIDDEN_TEXT = "Do NOT include SCROLL_BROWSER_VIEWPORT_ONCE in the same round as product_yes";
        const hasForbidden = sf.getDescendantsOfKind(SyntaxKind.StringLiteral).some(n => n.getLiteralText().includes(FORBIDDEN_TEXT))
          || sf.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral).some(n => n.getLiteralText().includes(FORBIDDEN_TEXT));
        if (!hasForbidden) {
          checks.push({ checkId: "VMF-AST-009", question: "AI prompt has no SCROLL prohibition for product_yes (AST)?", status: "PASS", detail: "No SCROLL prohibition text found in prompt string literals (AST)." });
        } else {
          checks.push({ checkId: "VMF-AST-009", question: "AI prompt has no SCROLL prohibition for product_yes (AST)?", status: "FAIL", detail: "Prompt still contains text prohibiting SCROLL in product_yes round — remove this instruction." });
        }
      }
    } catch (err) {
      checks.push({ checkId: "VMF-AST-009", question: "AI prompt has no SCROLL prohibition for product_yes (AST)?", status: "FAIL", detail: `ts-morph error: ${err instanceof Error ? err.message : String(err)}` });
    }
  }

  // ── VMF-AST-010: ai-output.schema product_yes superRefine requires SCROLL after SAVE ──
  {
    const AI_OUTPUT_SCHEMA_PATH = "src/visual-mission/action-plan/ai-output.schema.ts";
    try {
      const project = getAuditProject();
      const sf = project.getSourceFile(pathFromRepoRoot(AI_OUTPUT_SCHEMA_PATH)) ?? project.addSourceFileAtPathIfExists(pathFromRepoRoot(AI_OUTPUT_SCHEMA_PATH));
      if (!sf) {
        checks.push({ checkId: "VMF-AST-010", question: "ai-output.schema product_yes superRefine requires SCROLL after SAVE (AST)?", status: "FAIL", detail: `File not found: ${AI_OUTPUT_SCHEMA_PATH}` });
      } else {
        const SCROLL_REQUIRED_MSG = "product_yes requires SCROLL_BROWSER_VIEWPORT_ONCE after SAVE_CURRENT_VIDEO_EVIDENCE_ONCE";
        const hasMsg = sf.getDescendantsOfKind(SyntaxKind.StringLiteral).some(sl => sl.getLiteralText().includes(SCROLL_REQUIRED_MSG));
        if (hasMsg) {
          checks.push({ checkId: "VMF-AST-010", question: "ai-output.schema product_yes superRefine requires SCROLL after SAVE (AST)?", status: "PASS", detail: "product_yes SCROLL-required addIssue message found via AST." });
        } else {
          checks.push({ checkId: "VMF-AST-010", question: "ai-output.schema product_yes superRefine requires SCROLL after SAVE (AST)?", status: "FAIL", detail: "No addIssue message requiring SCROLL after SAVE in product_yes — schema does not enforce scroll." });
        }
      }
    } catch (err) {
      checks.push({ checkId: "VMF-AST-010", question: "ai-output.schema product_yes superRefine requires SCROLL after SAVE (AST)?", status: "FAIL", detail: `ts-morph error: ${err instanceof Error ? err.message : String(err)}` });
    }
  }

  // ── VMF-AST-011: product_no superRefine forbids click/save, requires scroll ──
  {
    const AI_OUTPUT_SCHEMA_PATH = "src/visual-mission/action-plan/ai-output.schema.ts";
    try {
      const project = getAuditProject();
      const sf = project.getSourceFile(pathFromRepoRoot(AI_OUTPUT_SCHEMA_PATH)) ?? project.addSourceFileAtPathIfExists(pathFromRepoRoot(AI_OUTPUT_SCHEMA_PATH));
      if (!sf) {
        checks.push({ checkId: "VMF-AST-011", question: "ai-output.schema product_no superRefine forbids click/save and requires scroll (AST)?", status: "FAIL", detail: `File not found: ${AI_OUTPUT_SCHEMA_PATH}` });
      } else {
        const allMessages = sf.getDescendantsOfKind(SyntaxKind.StringLiteral).map(sl => sl.getLiteralText());
        const hasClickForbid = allMessages.some(m => m.includes("product_no must not contain click"));
        const hasSaveForbid = allMessages.some(m => m.includes("product_no must not contain SAVE"));
        const hasScrollRequired = allMessages.some(m => m.includes("product_no must contain SCROLL"));
        const missing: string[] = [];
        if (!hasClickForbid) missing.push("product_no click-forbid message");
        if (!hasSaveForbid) missing.push("product_no SAVE-forbid message");
        if (!hasScrollRequired) missing.push("product_no SCROLL-required message");
        if (missing.length === 0) {
          checks.push({ checkId: "VMF-AST-011", question: "ai-output.schema product_no superRefine forbids click/save and requires scroll (AST)?", status: "PASS", detail: "product_no addIssue messages for click-forbid, SAVE-forbid, and SCROLL-required found (AST)." });
        } else {
          checks.push({ checkId: "VMF-AST-011", question: "ai-output.schema product_no superRefine forbids click/save and requires scroll (AST)?", status: "FAIL", detail: `Missing: ${missing.join(", ")}` });
        }
      }
    } catch (err) {
      checks.push({ checkId: "VMF-AST-011", question: "ai-output.schema product_no superRefine forbids click/save and requires scroll (AST)?", status: "FAIL", detail: `ts-morph error: ${err instanceof Error ? err.message : String(err)}` });
    }
  }

  // ── VMF-AST-012: openResultRef assigned from openResult.openResultRef (not openCallId) ──
  {
    try {
      const project = getAuditProject();
      const sf = project.getSourceFile(pathFromRepoRoot(CFG.missionLoopPath)) ?? project.addSourceFileAtPathIfExists(pathFromRepoRoot(CFG.missionLoopPath));
      if (!sf) {
        checks.push({ checkId: "VMF-AST-012", question: "mission-loop-runner assigns openResultRef from openResult.openResultRef (AST)?", status: "FAIL", detail: `File not found: ${CFG.missionLoopPath}` });
      } else {
        const propAssignments = sf.getDescendantsOfKind(SyntaxKind.PropertyAssignment).filter(p => p.getName() === "openResultRef");
        const hasCorrectSource = propAssignments.some(p => {
          const init = p.getInitializer();
          if (!Node.isPropertyAccessExpression(init)) return false;
          return init.getExpression().getText() === "openResult" && init.getName() === "openResultRef";
        });
        if (hasCorrectSource) {
          checks.push({ checkId: "VMF-AST-012", question: "mission-loop-runner assigns openResultRef from openResult.openResultRef (AST)?", status: "PASS", detail: "openResultRef: openResult.openResultRef PropertyAccess found via AST." });
        } else if (propAssignments.length > 0) {
          const vals = propAssignments.map(p => p.getInitializer()?.getText() ?? "?").join(", ");
          checks.push({ checkId: "VMF-AST-012", question: "mission-loop-runner assigns openResultRef from openResult.openResultRef (AST)?", status: "FAIL", detail: `openResultRef assigned but value is not openResult.openResultRef: [${vals}]` });
        } else {
          checks.push({ checkId: "VMF-AST-012", question: "mission-loop-runner assigns openResultRef from openResult.openResultRef (AST)?", status: "FAIL", detail: "No openResultRef PropertyAssignment found in mission-loop-runner." });
        }
      }
    } catch (err) {
      checks.push({ checkId: "VMF-AST-012", question: "mission-loop-runner assigns openResultRef from openResult.openResultRef (AST)?", status: "FAIL", detail: `ts-morph error: ${err instanceof Error ? err.message : String(err)}` });
    }
  }

  // ── VMF-AST-013: SAVE_CURRENT_VIDEO_EVIDENCE_ONCE in catalog allowedForAiActionPlan=true ──
  {
    const catalogAbsPath = join(ROOT, CFG.catalogPath);
    if (!existsSync(catalogAbsPath)) {
      checks.push({ checkId: "VMF-AST-013", question: "SAVE_CURRENT_VIDEO_EVIDENCE_ONCE in catalog with allowedForAiActionPlan=true?", status: "FAIL", detail: `Catalog not found: ${CFG.catalogPath}` });
    } else {
      try {
        const catalog = JSON.parse(readFileSync(catalogAbsPath, "utf8")) as { entries: Array<{ actionCode: string; allowedForAiActionPlan: boolean }> };
        const entry = catalog.entries.find(e => e.actionCode === "SAVE_CURRENT_VIDEO_EVIDENCE_ONCE");
        if (!entry) {
          checks.push({ checkId: "VMF-AST-013", question: "SAVE_CURRENT_VIDEO_EVIDENCE_ONCE in catalog with allowedForAiActionPlan=true?", status: "FAIL", detail: "SAVE_CURRENT_VIDEO_EVIDENCE_ONCE not in catalog." });
        } else if (entry.allowedForAiActionPlan === true) {
          checks.push({ checkId: "VMF-AST-013", question: "SAVE_CURRENT_VIDEO_EVIDENCE_ONCE in catalog with allowedForAiActionPlan=true?", status: "PASS", detail: "SAVE_CURRENT_VIDEO_EVIDENCE_ONCE.allowedForAiActionPlan=true confirmed via JSON.parse." });
        } else {
          checks.push({ checkId: "VMF-AST-013", question: "SAVE_CURRENT_VIDEO_EVIDENCE_ONCE in catalog with allowedForAiActionPlan=true?", status: "FAIL", detail: `allowedForAiActionPlan=${String(entry.allowedForAiActionPlan)} — AI cannot schedule evidence saves.` });
        }
      } catch {
        checks.push({ checkId: "VMF-AST-013", question: "SAVE_CURRENT_VIDEO_EVIDENCE_ONCE in catalog with allowedForAiActionPlan=true?", status: "FAIL", detail: "Failed to parse catalog JSON." });
      }
    }
  }

  // ── VMF-AST-014: facebook-web profile has no retired actionCodes ──
  {
    const fbProfilePath = "src/platforms/builtins/facebook-web.profile.ts";
    try {
      const project = getAuditProject();
      const sf = project.getSourceFile(pathFromRepoRoot(fbProfilePath)) ?? project.addSourceFileAtPathIfExists(pathFromRepoRoot(fbProfilePath));
      if (!sf) {
        checks.push({ checkId: "VMF-AST-014", question: "facebook-web profile has no retired actionCodes (AST)?", status: "FAIL", detail: `File not found: ${fbProfilePath}` });
      } else {
        const retiredCodes = CFG.forbiddenActionCodes;
        const foundRetired = sf.getDescendantsOfKind(SyntaxKind.StringLiteral)
          .map(sl => sl.getLiteralText())
          .filter(v => retiredCodes.includes(v));
        if (foundRetired.length === 0) {
          checks.push({ checkId: "VMF-AST-014", question: "facebook-web profile has no retired actionCodes (AST)?", status: "PASS", detail: "No retired actionCodes found in facebook-web profile string literals (AST)." });
        } else {
          checks.push({ checkId: "VMF-AST-014", question: "facebook-web profile has no retired actionCodes (AST)?", status: "FAIL", detail: `Retired actionCodes found: ${[...new Set(foundRetired)].join(", ")}` });
        }
      }
    } catch (err) {
      checks.push({ checkId: "VMF-AST-014", question: "facebook-web profile has no retired actionCodes (AST)?", status: "FAIL", detail: `ts-morph error: ${err instanceof Error ? err.message : String(err)}` });
    }
  }

  // ── VMF-AST-015: no legacy import paths in mission-loop-runner / dispatch-sequence ──
  {
    const LEGACY_IMPORT_FRAGMENTS = ["page-state", "visual-action", "platform-action-map", "action-binding", "legacy-pav"];
    const FILES_TO_CHECK = [CFG.missionLoopPath, CFG.dispatchSequencePath];
    const violations: string[] = [];
    try {
      const project = getAuditProject();
      for (const relPath of FILES_TO_CHECK) {
        const sf = project.getSourceFile(pathFromRepoRoot(relPath)) ?? project.addSourceFileAtPathIfExists(pathFromRepoRoot(relPath));
        if (!sf) continue;
        for (const imp of sf.getDescendantsOfKind(SyntaxKind.ImportDeclaration)) {
          const moduleSpec = imp.getModuleSpecifierValue();
          const matchedLegacy = LEGACY_IMPORT_FRAGMENTS.filter(frag => moduleSpec.includes(frag));
          if (matchedLegacy.length > 0) {
            violations.push(`${relPath}: "${moduleSpec}" (${matchedLegacy.join(", ")})`);
          }
        }
      }
      if (violations.length === 0) {
        checks.push({ checkId: "VMF-AST-015", question: "No legacy import paths in mission-loop-runner / dispatch-sequence (AST)?", status: "PASS", detail: "No retired import paths found in import declarations (AST)." });
      } else {
        checks.push({ checkId: "VMF-AST-015", question: "No legacy import paths in mission-loop-runner / dispatch-sequence (AST)?", status: "FAIL", detail: violations.join(" | ") });
      }
    } catch (err) {
      checks.push({ checkId: "VMF-AST-015", question: "No legacy import paths in mission-loop-runner / dispatch-sequence (AST)?", status: "FAIL", detail: `ts-morph error: ${err instanceof Error ? err.message : String(err)}` });
    }
  }

  // ── VMF-29: prompt example places userIntentUnderstanding LAST to prevent 3B nesting collapse ──
  // Root cause prevention: qwen2.5vl:3b (format:"json", no grammar-constrained schema) loses
  // track of nesting depth. If userIntentUnderstanding appears early in the example, the model
  // opens it and writes ALL subsequent top-level fields inside it.
  // Fix: userIntentUnderstanding must be the LAST key in the prompt output schema example.
  {
    const src = readSrc(CFG.aiPromptPath);
    if (!src) {
      checks.push({ checkId: "VMF-29", question: "prompt example places userIntentUnderstanding LAST (3B nesting-collapse prevention)?", status: "FAIL", detail: `File not found: ${CFG.aiPromptPath}` });
    } else {
      // Use unquoted object key form (TypeScript source uses `key:` not `"key":`)
      // lastIndexOf to compare WITHIN buildOutputSchemaBlock (ignores comment mentions)
      const uiuIdx = src.lastIndexOf('userIntentUnderstanding:');
      const summaryIdx = src.lastIndexOf('nonExecutableSummary:');
      // Restrict pipe check to single-line quoted strings ([^"'\n] prevents cross-line matching)
      const hasPipeEnum = /["'][^"'\n]*\|[^"'\n]*["']/.test(src.split("buildOutputSchemaBlock")[1] ?? "");
      if (uiuIdx < 0) {
        checks.push({ checkId: "VMF-29", question: "prompt example places userIntentUnderstanding LAST (3B nesting-collapse prevention)?", status: "FAIL", detail: "userIntentUnderstanding: key not found in prompt file." });
      } else if (summaryIdx < 0) {
        checks.push({ checkId: "VMF-29", question: "prompt example places userIntentUnderstanding LAST (3B nesting-collapse prevention)?", status: "FAIL", detail: "nonExecutableSummary: key not found in prompt file — cannot verify ordering." });
      } else if (uiuIdx < summaryIdx) {
        checks.push({ checkId: "VMF-29", question: "prompt example places userIntentUnderstanding LAST (3B nesting-collapse prevention)?", status: "FAIL", detail: `userIntentUnderstanding (pos ${uiuIdx}) appears before nonExecutableSummary (pos ${summaryIdx}) — 3B model will nest all subsequent fields inside it.` });
      } else if (hasPipeEnum) {
        checks.push({ checkId: "VMF-29", question: "prompt example places userIntentUnderstanding LAST (3B nesting-collapse prevention)?", status: "FAIL", detail: "Pipe-separated enum values found in prompt example — model will copy verbatim." });
      } else {
        checks.push({ checkId: "VMF-29", question: "prompt example places userIntentUnderstanding LAST (3B nesting-collapse prevention)?", status: "PASS", detail: `userIntentUnderstanding: (pos ${uiuIdx}) is after nonExecutableSummary: (pos ${summaryIdx}) — correct last-position placement.` });
      }
    }
  }

  const hasAnyFail = checks.some((c) => c.status === "FAIL");
  const hasAnyWarn = checks.some((c) => c.status === "WARN");
  const overallStatus = hasAnyFail ? "FAIL" : hasAnyWarn ? "WARN" : "PASS";

  return { checks, overallStatus };
}

