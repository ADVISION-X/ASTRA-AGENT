import type { Project } from "ts-morph";

import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { getSourceFileOrThrow, toRelativeSourcePath } from "../../core/ts-morph.js";

export const inspectVisualMissionRuntimePath = (project: Project): Finding[] => {
  const decisionSource = getSourceFileOrThrow(project, "src/lib/local-runtime/workbench-nerve-bus-ai-decision-visual-mission.ts");
  const typesSource = getSourceFileOrThrow(project, "src/types/visual-mission-action-plan.ts");
  const planWrapperSource = getSourceFileOrThrow(project, "src/muscle-memory/decoder/action-plan.schema.ts");
  const stepDispatcherSource = getSourceFileOrThrow(project, "src/capabilities/orchestration/runtime/step-dispatcher.ts");
  const findings: Finding[] = [];

  if (!decisionSource.getFullText().includes("normalizeVisualMissionActionPlanOutput")) {
    findings.push(createFinding({
      lawId: "GRASSEYE-AI-CAPABILITY-002-V1",
      file: toRelativeSourcePath(decisionSource),
      line: 1,
      severity: "fatal",
      message: "Visual mission AI decision path must route through the canonical normalizeVisualMissionActionPlanOutput step.",
    }));
  }
  if (!typesSource.getFullText().includes("ai-output.schema.js")) {
    findings.push(createFinding({
      lawId: "GRASSEYE-AI-CAPABILITY-002-V1",
      file: toRelativeSourcePath(typesSource),
      line: 1,
      severity: "fatal",
      message: "Visual mission public type surface must remain a thin wrapper over the canonical AI output schema module.",
    }));
  }
  if (!planWrapperSource.getFullText().includes("executable-plan.schema.js")) {
    findings.push(createFinding({
      lawId: "GRASSEYE-AI-CAPABILITY-002-V1",
      file: toRelativeSourcePath(planWrapperSource),
      line: 1,
      severity: "fatal",
      message: "Visual mission executable plan public surface must remain a thin wrapper over the canonical executable plan schema module.",
    }));
  }
  if (!stepDispatcherSource.getFullText().includes("runtimeContext:")) {
    findings.push(createFinding({
      lawId: "GRASSEYE-AI-CAPABILITY-002-V1",
      file: toRelativeSourcePath(stepDispatcherSource),
      line: 1,
      severity: "fatal",
      message: "Visual mission step dispatch must pass runtimeContext into decodeVisualMissionActionPlan.",
    }));
  }

  return findings;
};