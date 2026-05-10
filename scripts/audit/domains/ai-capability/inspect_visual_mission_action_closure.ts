import type { Project } from "ts-morph";

import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { getSourceFileOrThrow, toRelativeSourcePath } from "../../core/ts-morph.js";

const ACTION_CLOSURE_CHECKS = [
  {
    path: "src/visual-mission/action-plan/normalize-ai-output.ts",
    marker: "normalizeVisualMissionActionPlanOutput",
    message: "Visual mission runtime must normalize AI output into the governed executable plan before execution.",
  },
  {
    path: "src/muscle-memory/decoder/action-plan-decoder.ts",
    marker: "enrichVisualMissionActionInput",
    message: "Visual mission decoder must enrich action input before asserting required fields.",
  },
  {
    path: "src/muscle-memory/executor/muscle-memory-execution-dispatch.ts",
    marker: "successOutputRefs",
    message: "Muscle-memory executor must fan out success output refs from the governed catalog instead of business-specific hardcoding.",
  },
  {
    path: "src/lib/local-runtime/workbench-forensics-dispatch-input.ts",
    marker: "resolveAiVisualMissionActionPlanOutputSummary",
    message: "Forensics product lead recording must accept visual mission AI output summaries for SAVE_LEAD closure.",
  },
] as const;

export const inspectVisualMissionActionClosure = (project: Project): Finding[] => {
  return ACTION_CLOSURE_CHECKS.flatMap((check) => {
    const source = getSourceFileOrThrow(project, check.path);
    return source.getFullText().includes(check.marker)
      ? []
      : [createFinding({
        lawId: "GRASSEYE-AI-CAPABILITY-002-V1",
        file: toRelativeSourcePath(source),
        line: 1,
        severity: "fatal",
        message: check.message,
      })];
  });
};