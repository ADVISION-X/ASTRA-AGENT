import type { Project } from "ts-morph";

import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { getSourceFileOrThrow, toRelativeSourcePath } from "../../core/ts-morph.js";

const SYSTEM_MANUAL_PATH = "src/muscle-memory/system-manual.ts";
const VISUAL_MISSION_TYPES_PATH = "src/types/visual-mission-action-plan.ts";
const EXECUTABLE_PLAN_WRAPPER_PATH = "src/muscle-memory/decoder/action-plan.schema.ts";
const AI_OUTPUT_SCHEMA_PATH = "src/visual-mission/action-plan/ai-output.schema.ts";

export const inspectVisualMissionCatalogSsot = (project: Project): Finding[] => {
  const systemManualSource = getSourceFileOrThrow(project, SYSTEM_MANUAL_PATH);
  const visualMissionTypesSource = getSourceFileOrThrow(project, VISUAL_MISSION_TYPES_PATH);
  const executablePlanWrapperSource = getSourceFileOrThrow(project, EXECUTABLE_PLAN_WRAPPER_PATH);
  const aiOutputSchemaSource = getSourceFileOrThrow(project, AI_OUTPUT_SCHEMA_PATH);
  const findings: Finding[] = [];

  if (!systemManualSource.getFullText().includes("listAiActionPlanEntries(")) {
    findings.push(createFinding({
      lawId: "GRASSEYE-AI-CAPABILITY-002-V1",
      file: toRelativeSourcePath(systemManualSource),
      line: 1,
      severity: "fatal",
      message: "Visual mission system manual must source governed action blocks from the generated muscle-memory catalog SSOT.",
    }));
  }
  if (!visualMissionTypesSource.getFullText().includes("../visual-mission/action-plan/ai-output.schema.js")) {
    findings.push(createFinding({
      lawId: "GRASSEYE-AI-CAPABILITY-002-V1",
      file: toRelativeSourcePath(visualMissionTypesSource),
      line: 1,
      severity: "fatal",
      message: "Visual mission public request/output types must re-export the canonical AI output schema module.",
    }));
  }
  if (!executablePlanWrapperSource.getFullText().includes("../../visual-mission/action-plan/executable-plan.schema.js")) {
    findings.push(createFinding({
      lawId: "GRASSEYE-AI-CAPABILITY-002-V1",
      file: toRelativeSourcePath(executablePlanWrapperSource),
      line: 1,
      severity: "fatal",
      message: "Visual mission executable plan wrapper must re-export the canonical executable plan schema module.",
    }));
  }
  if (!aiOutputSchemaSource.getFullText().includes("isAiActionPlanAllowedActionCode")) {
    findings.push(createFinding({
      lawId: "GRASSEYE-AI-CAPABILITY-002-V1",
      file: toRelativeSourcePath(aiOutputSchemaSource),
      line: 1,
      severity: "fatal",
      message: "Visual mission AI output schema must gate actionCode through the generated catalog allow-list.",
    }));
  }

  return findings;
};