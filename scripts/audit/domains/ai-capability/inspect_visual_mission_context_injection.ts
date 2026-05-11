import { type Project } from "ts-morph";

import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { getSourceFileOrThrow, toRelativeSourcePath } from "../../core/ts-morph.js";

const createContextInjectionFinding = (file: string, message: string): Finding => createFinding({
  lawId: "GRASSEYE-AI-CAPABILITY-002-V1",
  file,
  line: 1,
  severity: "fatal",
  message,
});

const createAiNoMemoryFinding = (file: string, message: string): Finding => createFinding({
  lawId: "GRASSEYE-AI-NO-MEMORY-V1",
  file,
  line: 1,
  severity: "fatal",
  message,
});

type RuntimeContextSourceInput = {
  decoderSource: ReturnType<typeof getSourceFileOrThrow>;
  stepDispatcherSource: ReturnType<typeof getSourceFileOrThrow>;
  screenshotRefSource: ReturnType<typeof getSourceFileOrThrow>;
  actionContextSource: ReturnType<typeof getSourceFileOrThrow>;
  aiDispatchContextSource: ReturnType<typeof getSourceFileOrThrow>;
  promptBuilderSource: ReturnType<typeof getSourceFileOrThrow>;
  roundMissionPacketSchemaSource: ReturnType<typeof getSourceFileOrThrow>;
};

const collectDecoderContextFindings = (input: RuntimeContextSourceInput): Finding[] => {
  const findings: Finding[] = [];

  if (!input.decoderSource.getFullText().includes("buildVisualMissionActionRuntimeContext")) {
    findings.push(createContextInjectionFinding(toRelativeSourcePath(input.decoderSource), "Visual mission decoder must build a governed runtime context before expanding executable actions."));
  }
  if (!input.stepDispatcherSource.getFullText().includes("...input.dispatchResult.payloadRefs")) {
    findings.push(createContextInjectionFinding(toRelativeSourcePath(input.stepDispatcherSource), "AI dispatch step must merge fresh payloadRefs into visual mission runtime context before decode and execute."));
  }
  if (!input.screenshotRefSource.getFullText().includes("resolveScreenshotStructuredDataRefPayload")) {
    findings.push(createContextInjectionFinding(toRelativeSourcePath(input.screenshotRefSource), "Screenshot structured refs must expose a governed payload resolver for visual mission runtime context injection."));
  }

  return findings;
};

const collectActionRuntimeContextFindings = (input: RuntimeContextSourceInput): Finding[] => {
  const findings: Finding[] = [];

  if (!input.actionContextSource.getFullText().includes("productPresenceAiResultRef") || !input.actionContextSource.getFullText().includes("resolveScreenshotStructuredDataRefPayload")) {
    findings.push(createContextInjectionFinding(toRelativeSourcePath(input.actionContextSource), "Visual mission action context enricher must inject governed AI result refs and screenshot-derived grid truth."));
  }
  if (!input.aiDispatchContextSource.getFullText().includes("buildRoundMissionPacket(")
    || !input.aiDispatchContextSource.getFullText().includes("recordRoundMissionPacket(")
    || !input.aiDispatchContextSource.getFullText().includes("roundMissionPacketJson:")
    || !input.aiDispatchContextSource.getFullText().includes("roundMissionPacketRef")) {
    findings.push(createContextInjectionFinding(toRelativeSourcePath(input.aiDispatchContextSource), "Visual mission AI dispatch augmentation must build, record, and inject Round Mission Packet truth before the AI request."));
  }

  return findings;
};

const collectPromptBuilderContinuityFindings = (input: RuntimeContextSourceInput): Finding[] => {
  const findings: Finding[] = [];

  if (!input.promptBuilderSource.getFullText().includes("buildRoundMissionPacketSection")
    || !input.promptBuilderSource.getFullText().includes("buildCurrentVisualEvidenceSection")
    || !input.promptBuilderSource.getFullText().includes("You are stateless across rounds.")
    || !input.promptBuilderSource.getFullText().includes("Do not assume memory from previous AI calls.")) {
    findings.push(createAiNoMemoryFinding(toRelativeSourcePath(input.promptBuilderSource), "Visual mission prompt builder must explicitly inject Round Mission Packet continuity and stateless-across-rounds wording."));
  }

  return findings;
};

const collectRoundMissionPacketSchemaContinuityFindings = (input: RuntimeContextSourceInput): Finding[] => {
  const findings: Finding[] = [];

  if (!input.roundMissionPacketSchemaSource.getFullText().includes("schemaVersion: z.literal(\"roundMissionPacket.v1\")")
    || !input.roundMissionPacketSchemaSource.getFullText().includes("noHumanInLoop: z.literal(true)")
    || !input.roundMissionPacketSchemaSource.getFullText().includes("requireCoordinateGridForVisualActions: z.literal(true)")
    || !input.roundMissionPacketSchemaSource.getFullText().includes("noRawCoordinates: z.literal(true)")
    || !input.roundMissionPacketSchemaSource.getFullText().includes("systemManualRef: z.string().min(1)")
    || !input.roundMissionPacketSchemaSource.getFullText().includes("catalogVersion: z.string().min(1)")) {
    findings.push(createContextInjectionFinding(toRelativeSourcePath(input.roundMissionPacketSchemaSource), "Round Mission Packet schema must preserve no-human-in-loop, coordinate-grid, and governed catalog continuity fields."));
  }

  return findings;
};

const collectRuntimeContextSourceFindings = (input: RuntimeContextSourceInput): Finding[] => [
  ...collectDecoderContextFindings(input),
  ...collectActionRuntimeContextFindings(input),
  ...collectPromptBuilderContinuityFindings(input),
  ...collectRoundMissionPacketSchemaContinuityFindings(input),
];

const collectActionContextBoundaryFindings = (actionContextSource: ReturnType<typeof getSourceFileOrThrow>): Finding[] => {
  const findings: Finding[] = [];
  const actionContextImports = actionContextSource.getImportDeclarations().map((declaration) => declaration.getModuleSpecifierValue());
  const forbiddenActionContextImports = [
    "../capabilities/nerve-bus/",
    "../../capabilities/nerve-bus/",
    "../../capabilities/forensics-persistence/",
    "../../capabilities/mouse-click/",
    "../../capabilities/mouse-scroll/",
    "../../capabilities/text-input/",
    "../../capabilities/geometry-guard/",
  ];
  const forbiddenActionContextMarkers = [
    "sendCommandToAbility(",
    "executeMuscleMemoryPlan(",
    "decodeVisualMissionActionPlan(",
    "writeForensics",
    "appendForensics",
    "actionCode",
  ];

  if (forbiddenActionContextImports.some((specifier) => actionContextImports.some((candidate) => candidate.includes(specifier)))) {
    findings.push(createContextInjectionFinding(toRelativeSourcePath(actionContextSource), "Visual mission action context enricher must stay a system-field bridge and must not import action execution, nerve-bus, or forensics owners."));
  }
  if (forbiddenActionContextMarkers.some((marker) => actionContextSource.getFullText().includes(marker))) {
    findings.push(createContextInjectionFinding(toRelativeSourcePath(actionContextSource), "Visual mission action context enricher must not decide actionCode, dispatch execution, or write forensics; it may only enrich system-injected fields."));
  }

  return findings;
};

export const inspectVisualMissionContextInjection = (project: Project): Finding[] => {
  const decoderSource = getSourceFileOrThrow(project, "src/muscle-memory/decoder/action-plan-decoder.ts");
  const stepDispatcherSource = getSourceFileOrThrow(project, "src/capabilities/orchestration/runtime/step-dispatcher.ts");
  const screenshotRefSource = getSourceFileOrThrow(project, "src/capabilities/screenshot/runtime/screenshot-structured-data-ref.ts");
  const actionContextSource = getSourceFileOrThrow(project, "src/visual-mission/action-plan/action-context-enricher.ts");
  const aiDispatchContextSource = getSourceFileOrThrow(project, "src/capabilities/orchestration/runtime/visual-mission-ai-dispatch-context.ts");
  const promptBuilderSource = getSourceFileOrThrow(project, "src/capabilities/ai/prompt-contracts/visual-mission-action-plan/prompt-builder.ts");
  const roundMissionPacketSchemaSource = getSourceFileOrThrow(project, "src/visual-mission/round-mission-packet.schema.ts");
  return [
    ...collectRuntimeContextSourceFindings({
      decoderSource,
      stepDispatcherSource,
      screenshotRefSource,
      actionContextSource,
      aiDispatchContextSource,
      promptBuilderSource,
      roundMissionPacketSchemaSource,
    }),
    ...collectActionContextBoundaryFindings(actionContextSource),
  ];
};