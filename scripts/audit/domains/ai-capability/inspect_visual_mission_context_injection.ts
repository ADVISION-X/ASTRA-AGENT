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

const collectRuntimeContextSourceFindings = (input: {
  decoderSource: ReturnType<typeof getSourceFileOrThrow>;
  stepDispatcherSource: ReturnType<typeof getSourceFileOrThrow>;
  screenshotRefSource: ReturnType<typeof getSourceFileOrThrow>;
  actionContextSource: ReturnType<typeof getSourceFileOrThrow>;
}): Finding[] => {
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
  if (!input.actionContextSource.getFullText().includes("productPresenceAiResultRef") || !input.actionContextSource.getFullText().includes("resolveScreenshotStructuredDataRefPayload")) {
    findings.push(createContextInjectionFinding(toRelativeSourcePath(input.actionContextSource), "Visual mission action context enricher must inject governed AI result refs and screenshot-derived grid truth."));
  }

  return findings;
};

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
  return [
    ...collectRuntimeContextSourceFindings({ decoderSource, stepDispatcherSource, screenshotRefSource, actionContextSource }),
    ...collectActionContextBoundaryFindings(actionContextSource),
  ];
};