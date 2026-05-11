import type { Project } from "ts-morph";

import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { getSourceFileOrThrow, toRelativeSourcePath } from "../../core/ts-morph.js";

const createRuntimePathFinding = (file: string, message: string): Finding => createFinding({
  lawId: "GRASSEYE-AI-CAPABILITY-002-V1",
  file,
  line: 1,
  severity: "fatal",
  message,
});

type RuntimePathSourceInput = {
  decisionSource: ReturnType<typeof getSourceFileOrThrow>;
  typesSource: ReturnType<typeof getSourceFileOrThrow>;
  planWrapperSource: ReturnType<typeof getSourceFileOrThrow>;
  decoderSource: ReturnType<typeof getSourceFileOrThrow>;
  stepDispatcherSource: ReturnType<typeof getSourceFileOrThrow>;
  dispatchContextSource: ReturnType<typeof getSourceFileOrThrow>;
};

const collectPublicSurfaceRuntimePathFindings = (input: RuntimePathSourceInput): Finding[] => {
  const findings: Finding[] = [];

  if (!input.decisionSource.getFullText().includes("normalizeVisualMissionActionPlanOutput")) {
    findings.push(createRuntimePathFinding(toRelativeSourcePath(input.decisionSource), "Visual mission AI decision path must route through the canonical normalizeVisualMissionActionPlanOutput step."));
  }
  if (!input.typesSource.getFullText().includes("ai-output.schema.js")) {
    findings.push(createRuntimePathFinding(toRelativeSourcePath(input.typesSource), "Visual mission public type surface must remain a thin wrapper over the canonical AI output schema module."));
  }
  if (!input.planWrapperSource.getFullText().includes("executable-plan.schema.js")) {
    findings.push(createRuntimePathFinding(toRelativeSourcePath(input.planWrapperSource), "Visual mission executable plan public surface must remain a thin wrapper over the canonical executable plan schema module."));
  }

  return findings;
};

const collectExecutionRuntimePathFindings = (input: RuntimePathSourceInput): Finding[] => {
  const findings: Finding[] = [];

  if (!input.decoderSource.getFullText().includes("./action-plan.schema.js") || input.decoderSource.getFullText().includes("ai-output.schema.js")) {
    findings.push(createRuntimePathFinding(toRelativeSourcePath(input.decoderSource), "Visual mission decoder must accept the executable-plan wrapper only and must not consume raw AI output schema directly."));
  }
  if (!input.stepDispatcherSource.getFullText().includes("runtimeContext:")) {
    findings.push(createRuntimePathFinding(toRelativeSourcePath(input.stepDispatcherSource), "Visual mission step dispatch must pass runtimeContext into decodeVisualMissionActionPlan."));
  }
  if (!input.dispatchContextSource.getFullText().includes("roundMissionPacketJson")
    || !input.dispatchContextSource.getFullText().includes("roundMissionPacketRef")
    || !input.dispatchContextSource.getFullText().includes("recordRoundMissionPacket(")
    || !input.dispatchContextSource.getFullText().includes("buildRoundMissionPacket(")) {
    findings.push(createRuntimePathFinding(toRelativeSourcePath(input.dispatchContextSource), "Visual mission runtime path must materialize Round Mission Packet json/ref injection before the AI request leaves Orchestration."));
  }

  return findings;
};

const collectVisualMissionRuntimePathFindings = (input: RuntimePathSourceInput): Finding[] => [
  ...collectPublicSurfaceRuntimePathFindings(input),
  ...collectExecutionRuntimePathFindings(input),
];

export const inspectVisualMissionRuntimePath = (project: Project): Finding[] => {
  const decisionSource = getSourceFileOrThrow(project, "src/lib/local-runtime/workbench-nerve-bus-ai-decision-visual-mission.ts");
  const typesSource = getSourceFileOrThrow(project, "src/types/visual-mission-action-plan.ts");
  const planWrapperSource = getSourceFileOrThrow(project, "src/muscle-memory/decoder/action-plan.schema.ts");
  const decoderSource = getSourceFileOrThrow(project, "src/muscle-memory/decoder/action-plan-decoder.ts");
  const stepDispatcherSource = getSourceFileOrThrow(project, "src/capabilities/orchestration/runtime/step-dispatcher.ts");
  const dispatchContextSource = getSourceFileOrThrow(project, "src/capabilities/orchestration/runtime/visual-mission-ai-dispatch-context.ts");
  return collectVisualMissionRuntimePathFindings({
    decisionSource,
    typesSource,
    planWrapperSource,
    decoderSource,
    stepDispatcherSource,
    dispatchContextSource,
  });
};