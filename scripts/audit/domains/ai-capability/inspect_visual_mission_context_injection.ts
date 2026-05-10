import type { Project } from "ts-morph";

import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { getSourceFileOrThrow, toRelativeSourcePath } from "../../core/ts-morph.js";

export const inspectVisualMissionContextInjection = (project: Project): Finding[] => {
  const decoderSource = getSourceFileOrThrow(project, "src/muscle-memory/decoder/action-plan-decoder.ts");
  const stepDispatcherSource = getSourceFileOrThrow(project, "src/capabilities/orchestration/runtime/step-dispatcher.ts");
  const screenshotRefSource = getSourceFileOrThrow(project, "src/capabilities/screenshot/runtime/screenshot-structured-data-ref.ts");
  const actionContextSource = getSourceFileOrThrow(project, "src/visual-mission/action-plan/action-context-enricher.ts");
  const findings: Finding[] = [];

  if (!decoderSource.getFullText().includes("buildVisualMissionActionRuntimeContext")) {
    findings.push(createFinding({
      lawId: "GRASSEYE-AI-CAPABILITY-002-V1",
      file: toRelativeSourcePath(decoderSource),
      line: 1,
      severity: "fatal",
      message: "Visual mission decoder must build a governed runtime context before expanding executable actions.",
    }));
  }
  if (!stepDispatcherSource.getFullText().includes("...input.dispatchResult.payloadRefs")) {
    findings.push(createFinding({
      lawId: "GRASSEYE-AI-CAPABILITY-002-V1",
      file: toRelativeSourcePath(stepDispatcherSource),
      line: 1,
      severity: "fatal",
      message: "AI dispatch step must merge fresh payloadRefs into visual mission runtime context before decode and execute.",
    }));
  }
  if (!screenshotRefSource.getFullText().includes("resolveScreenshotStructuredDataRefPayload")) {
    findings.push(createFinding({
      lawId: "GRASSEYE-AI-CAPABILITY-002-V1",
      file: toRelativeSourcePath(screenshotRefSource),
      line: 1,
      severity: "fatal",
      message: "Screenshot structured refs must expose a governed payload resolver for visual mission runtime context injection.",
    }));
  }
  if (!actionContextSource.getFullText().includes("productPresenceAiResultRef") || !actionContextSource.getFullText().includes("resolveScreenshotStructuredDataRefPayload")) {
    findings.push(createFinding({
      lawId: "GRASSEYE-AI-CAPABILITY-002-V1",
      file: toRelativeSourcePath(actionContextSource),
      line: 1,
      severity: "fatal",
      message: "Visual mission action context enricher must inject governed AI result refs and screenshot-derived grid truth.",
    }));
  }

  return findings;
};