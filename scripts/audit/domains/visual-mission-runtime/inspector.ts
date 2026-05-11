// Visual Mission Runtime Inspector — 12 structural governance checks.
// Verifies all Break-2.x runtime wiring fixes are present and correct.

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { VISUAL_MISSION_RUNTIME_CONFIG as CFG } from "./config.js";

const ROOT = process.cwd();

function readSrc(relPath: string): string {
  const p = join(ROOT, relPath);
  if (!existsSync(p)) return "";
  return readFileSync(p, "utf8");
}

// ─── Check Types ─────────────────────────────────────────────────────────────

export type VMRCheckResult = {
  checkId: string;
  question: string;
  status: "PASS" | "FAIL" | "WARN";
  detail: string;
};

export type VMRInspectorResult = {
  checks: VMRCheckResult[];
  overallStatus: "PASS" | "FAIL" | "WARN";
};

// ─── Inspector ───────────────────────────────────────────────────────────────

export function runVisualMissionRuntimeInspector(): VMRInspectorResult {
  const checks: VMRCheckResult[] = [];

  // ── CHECK 1: MissionStateSchema has targetProfileRef / targetUrl / targetTitle ─
  {
    const src = readSrc(CFG.orchestrationSchemaPath);
    if (!src) {
      checks.push({ checkId: "VMR-01", question: "MissionStateSchema has targetProfileRef/targetUrl/targetTitle?", status: "FAIL", detail: `File not found: ${CFG.orchestrationSchemaPath}` });
    } else {
      const missing = CFG.missionStateTargetFields.filter(f => !src.includes(`${f}:`));
      if (missing.length === 0) {
        checks.push({ checkId: "VMR-01", question: "MissionStateSchema has targetProfileRef/targetUrl/targetTitle?", status: "PASS", detail: "All 3 target fields present in orchestration schema." });
      } else {
        checks.push({ checkId: "VMR-01", question: "MissionStateSchema has targetProfileRef/targetUrl/targetTitle?", status: "FAIL", detail: `Missing target fields in schema: ${missing.join(", ")}` });
      }
    }
  }

  // ── CHECK 2: createInitialMissionState accepts targetProfileRef/targetUrl/targetTitle ──
  {
    const src = readSrc(CFG.missionStatePath);
    if (!src) {
      checks.push({ checkId: "VMR-02", question: "createInitialMissionState accepts target fields?", status: "FAIL", detail: `File not found: ${CFG.missionStatePath}` });
    } else {
      const missing = CFG.missionStateCreateParams.filter(p => !src.includes(p));
      if (missing.length === 0) {
        checks.push({ checkId: "VMR-02", question: "createInitialMissionState accepts target fields?", status: "PASS", detail: "createInitialMissionState params include all target fields." });
      } else {
        checks.push({ checkId: "VMR-02", question: "createInitialMissionState accepts target fields?", status: "FAIL", detail: `Missing params in mission-state.ts: ${missing.join(", ")}` });
      }
    }
  }

  // ── CHECK 3: children.ts extracts targetProfileRef from initialPayload ────
  {
    const src = readSrc(CFG.childrenPath);
    if (!src) {
      checks.push({ checkId: "VMR-03", question: "children.ts extracts targetProfileRef from initialPayload?", status: "FAIL", detail: `File not found: ${CFG.childrenPath}` });
    } else {
      const hasPayload = src.includes(CFG.initialPayloadExtractToken);
      const hasTargetProfile = src.includes("targetProfileRef");
      if (hasPayload && hasTargetProfile) {
        checks.push({ checkId: "VMR-03", question: "children.ts extracts targetProfileRef from initialPayload?", status: "PASS", detail: "initialPayload extraction with targetProfileRef present." });
      } else if (!hasPayload) {
        checks.push({ checkId: "VMR-03", question: "children.ts extracts targetProfileRef from initialPayload?", status: "FAIL", detail: "initialPayload token not found in children.ts." });
      } else {
        checks.push({ checkId: "VMR-03", question: "children.ts extracts targetProfileRef from initialPayload?", status: "FAIL", detail: "initialPayload found but targetProfileRef not extracted." });
      }
    }
  }

  // ── CHECK 4: CaptureBrowserViewportResultSchema has aiReadableImagePath ────
  {
    const src = readSrc(CFG.screenshotSchemaPath);
    if (!src) {
      checks.push({ checkId: "VMR-04", question: "CaptureBrowserViewportResultSchema has aiReadableImagePath?", status: "FAIL", detail: `File not found: ${CFG.screenshotSchemaPath}` });
    } else {
      // Should appear at least twice (once for CaptureBrowserViewport, once for RenderCoordinateGrid)
      const count = (src.match(/aiReadableImagePath/g) ?? []).length;
      if (count >= 2) {
        checks.push({ checkId: "VMR-04", question: "Screenshot schemas have aiReadableImagePath?", status: "PASS", detail: `aiReadableImagePath appears ${count} times in screenshot schema.` });
      } else if (count === 1) {
        checks.push({ checkId: "VMR-04", question: "Screenshot schemas have aiReadableImagePath?", status: "WARN", detail: "aiReadableImagePath only in one schema — both CaptureBrowserViewport and RenderCoordinateGrid need it." });
      } else {
        checks.push({ checkId: "VMR-04", question: "Screenshot schemas have aiReadableImagePath?", status: "FAIL", detail: "aiReadableImagePath missing from screenshot schemas." });
      }
    }
  }

  // ── CHECK 5: capture-browser-viewport.ts returns aiReadableImagePath ──────
  {
    const src = readSrc(CFG.captureBrowserViewportPath);
    if (!src) {
      checks.push({ checkId: "VMR-05", question: "capture-browser-viewport returns aiReadableImagePath?", status: "FAIL", detail: `File not found: ${CFG.captureBrowserViewportPath}` });
    } else {
      const hasReturn = src.includes("aiReadableImagePath: artifactRef.storageRef");
      if (hasReturn) {
        checks.push({ checkId: "VMR-05", question: "capture-browser-viewport returns aiReadableImagePath?", status: "PASS", detail: "aiReadableImagePath: artifactRef.storageRef in success return." });
      } else {
        checks.push({ checkId: "VMR-05", question: "capture-browser-viewport returns aiReadableImagePath?", status: "FAIL", detail: "aiReadableImagePath not returned in capture-browser-viewport.ts." });
      }
    }
  }

  // ── CHECK 6: render-coordinate-grid.ts returns aiReadableImagePath ────────
  {
    const src = readSrc(CFG.renderCoordinateGridPath);
    if (!src) {
      checks.push({ checkId: "VMR-06", question: "render-coordinate-grid returns aiReadableImagePath?", status: "FAIL", detail: `File not found: ${CFG.renderCoordinateGridPath}` });
    } else {
      const hasReturn = src.includes("aiReadableImagePath: artifactRef.storageRef");
      if (hasReturn) {
        checks.push({ checkId: "VMR-06", question: "render-coordinate-grid returns aiReadableImagePath?", status: "PASS", detail: "aiReadableImagePath: artifactRef.storageRef in success return." });
      } else {
        checks.push({ checkId: "VMR-06", question: "render-coordinate-grid returns aiReadableImagePath?", status: "FAIL", detail: "aiReadableImagePath not returned in render-coordinate-grid.ts." });
      }
    }
  }

  // ── CHECK 7: mission-loop-runner has open gate before screenshot ──────────
  {
    const src = readSrc(CFG.missionLoopPath);
    if (!src) {
      checks.push({ checkId: "VMR-07", question: "mission-loop-runner has OPEN gate before round-0 screenshot?", status: "FAIL", detail: `File not found: ${CFG.missionLoopPath}` });
    } else {
      const missing = CFG.openGateTokens.filter(t => !src.includes(t));
      if (missing.length === 0) {
        // Verify open gate appears before screenshot capture
        const openIdx = src.indexOf("open-platform-entry-once");
        const captureIdx = src.indexOf("capture-browser-viewport");
        if (openIdx < captureIdx) {
          checks.push({ checkId: "VMR-07", question: "mission-loop-runner has OPEN gate before round-0 screenshot?", status: "PASS", detail: "open-platform-entry-once gate appears before capture-browser-viewport." });
        } else {
          checks.push({ checkId: "VMR-07", question: "mission-loop-runner has OPEN gate before round-0 screenshot?", status: "FAIL", detail: "open-platform-entry-once exists but appears AFTER capture — gate must come first." });
        }
      } else {
        checks.push({ checkId: "VMR-07", question: "mission-loop-runner has OPEN gate before round-0 screenshot?", status: "FAIL", detail: `Missing open gate tokens: ${missing.join(", ")}` });
      }
    }
  }

  // ── CHECK 8: mission-loop-runner uses aiReadableImagePath for AI filePaths ─
  {
    const src = readSrc(CFG.missionLoopPath);
    if (!src) {
      checks.push({ checkId: "VMR-08", question: "mission-loop-runner uses aiReadableImagePath for AI filePaths?", status: "FAIL", detail: `File not found: ${CFG.missionLoopPath}` });
    } else {
      const missing = CFG.aiFilePathTokens.filter(t => !src.includes(t));
      if (missing.length === 0) {
        checks.push({ checkId: "VMR-08", question: "mission-loop-runner uses aiReadableImagePath for AI filePaths?", status: "PASS", detail: "originalAiPath/gridAiPath variables derived from aiReadableImagePath present." });
      } else {
        checks.push({ checkId: "VMR-08", question: "mission-loop-runner uses aiReadableImagePath for AI filePaths?", status: "FAIL", detail: `Missing AI path tokens: ${missing.join(", ")}` });
      }
    }
  }

  // ── CHECK 9: mission-loop-runner platformContext uses state target fields ──
  {
    const src = readSrc(CFG.missionLoopPath);
    if (!src) {
      checks.push({ checkId: "VMR-09", question: "mission-loop-runner platformContext uses state.targetUrl etc?", status: "FAIL", detail: `File not found: ${CFG.missionLoopPath}` });
    } else {
      const hasStateTarget = src.includes(CFG.platformContextStateToken);
      if (hasStateTarget) {
        checks.push({ checkId: "VMR-09", question: "mission-loop-runner platformContext uses state.targetUrl etc?", status: "PASS", detail: "state.targetUrl found in platformContext block." });
      } else {
        checks.push({ checkId: "VMR-09", question: "mission-loop-runner platformContext uses state.targetUrl etc?", status: "FAIL", detail: "platformContext hardcodes null for targetUrl — should use state.targetUrl." });
      }
    }
  }

  // ── CHECK 10: AI prompt throws if SAVE not in catalog (no fallback) ────────
  {
    const src = readSrc(CFG.aiPromptPath);
    if (!src) {
      checks.push({ checkId: "VMR-10", question: "AI prompt fails closed if SAVE not in catalog?", status: "FAIL", detail: `File not found: ${CFG.aiPromptPath}` });
    } else {
      const hasFallback = src.includes(CFG.saveActionFallbackForbiddenToken);
      const hasThrow = src.includes(CFG.saveActionThrowToken);
      if (!hasFallback && hasThrow) {
        checks.push({ checkId: "VMR-10", question: "AI prompt fails closed if SAVE not in catalog?", status: "PASS", detail: "No '?? scrollAction' fallback; throws if SAVE missing from catalog." });
      } else if (hasFallback) {
        checks.push({ checkId: "VMR-10", question: "AI prompt fails closed if SAVE not in catalog?", status: "FAIL", detail: "saveAction still uses '?? scrollAction' fallback — must fail closed." });
      } else {
        checks.push({ checkId: "VMR-10", question: "AI prompt fails closed if SAVE not in catalog?", status: "WARN", detail: "No fallback found but no throw either — verify SAVE guard logic." });
      }
    }
  }

  // ── CHECK 11: dispatch-sequence context includes screenshotAbilityGroup ────
  {
    const src = readSrc(CFG.dispatchSequencePath);
    if (!src) {
      checks.push({ checkId: "VMR-11", question: "DispatchSequenceContext includes screenshotAbilityGroup?", status: "FAIL", detail: `File not found: ${CFG.dispatchSequencePath}` });
    } else {
      const hasContext = src.includes(CFG.screenshotAbilityGroupContextToken);
      if (hasContext) {
        checks.push({ checkId: "VMR-11", question: "DispatchSequenceContext includes screenshotAbilityGroup?", status: "PASS", detail: "screenshotAbilityGroup: ScreenshotAbilityGroup present in context type." });
      } else {
        checks.push({ checkId: "VMR-11", question: "DispatchSequenceContext includes screenshotAbilityGroup?", status: "FAIL", detail: "screenshotAbilityGroup missing from DispatchSequenceContext — post-comment screenshot impossible." });
      }
    }
  }

  // ── CHECK 12: dispatch-sequence tracks clicks, logs reason/gridCell ────────
  {
    const src = readSrc(CFG.dispatchSequencePath);
    if (!src) {
      checks.push({ checkId: "VMR-12", question: "dispatch-sequence tracks clicks and logs reason/gridCell?", status: "FAIL", detail: `File not found: ${CFG.dispatchSequencePath}` });
    } else {
      const hasClickTracking = src.includes(CFG.clickTrackingToken);
      const hasPostComment = src.includes(CFG.postCommentScreenshotToken);
      const hasReason = src.includes(CFG.abilityResultReasonToken);
      const hasGridCell = src.includes(CFG.abilityResultGridCellToken);
      const allPresent = hasClickTracking && hasPostComment && hasReason && hasGridCell;
      if (allPresent) {
        checks.push({ checkId: "VMR-12", question: "dispatch-sequence tracks clicks and logs reason/gridCell?", status: "PASS", detail: "priorClickCount, postCommentScreenshotRef, reason, gridCell all present." });
      } else {
        const missing: string[] = [];
        if (!hasClickTracking) missing.push("priorClickCount");
        if (!hasPostComment) missing.push("postCommentScreenshotRef");
        if (!hasReason) missing.push("reason");
        if (!hasGridCell) missing.push("gridCell");
        checks.push({ checkId: "VMR-12", question: "dispatch-sequence tracks clicks and logs reason/gridCell?", status: "FAIL", detail: `Missing: ${missing.join(", ")}` });
      }
    }
  }

  // ── Compute overall status ─────────────────────────────────────────────────
  const hasFail = checks.some(c => c.status === "FAIL");
  const hasWarn = checks.some(c => c.status === "WARN");
  const overallStatus = hasFail ? "FAIL" : hasWarn ? "WARN" : "PASS";

  return { checks, overallStatus };
}
