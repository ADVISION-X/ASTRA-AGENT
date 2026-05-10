import { SyntaxKind, type Project, type SourceFile } from "ts-morph";

import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { hasStringLiteral } from "../_shared/ast-literal-queries.js";
import {
  RETIRED_ACTIVATION_REF_FIELD,
  RETIRED_PACKAGE_ID_FIELD,
  RETIRED_PACKAGE_VERSION_FIELD,
  RETIRED_SELECTION_ID_FIELD,
  RETIRED_SELECTION_VERSION_FIELD,
} from "../_shared/retired-map-chain-field-names.js";

import { aiInspectionConstants } from "./inspection-constants.js";
import { aiInspectionUtils } from "./inspection-utils.js";

const { AI_ROOT } = aiInspectionConstants;
const { getSourceOrThrow } = aiInspectionUtils;

const WORKBENCH_AI_DEBUG_RECORDER_PATH = "src/lib/local-runtime/workbench-ai-debug-recorder.ts";
const WORKBENCH_AI_DEBUG_SUPPORT_PATH = "src/lib/local-runtime/workbench-ai-debug-support.ts";
const LOCAL_AI_TASK_SUPPORT_PATH = "src/lib/local-ai/local-ai-runtime-task-support.ts";
const OLLAMA_RUNTIME_SUPPORT_PATH = "src/lib/local-ai/runtime-adapters/ollama-runtime-support.ts";
const OCR_RUNTIME_SUPPORT_PATH = "src/lib/local-ai/runtime-adapters/local-ocr-runtime-support.ts";
const VISION_RUNTIME_TASK_PATH = "src/lib/local-ai/local-ai-runtime-vision-task.ts";
const VISION_RUNTIME_TASK_HANDLER_PATH = "src/lib/local-ai/local-ai-runtime-vision-task-handlers.ts";

const createAiDebugFinding = (lawId: string, file: string, message: string): Finding => createFinding({
  lawId,
  file,
  line: 1,
  severity: "fatal",
  message,
});

const isPropertyNamed = (property: import("ts-morph").PropertyAssignment, propertyName: string): boolean =>
  property.getName() === propertyName;

const propertyInitializerText = (sourceFile: SourceFile, propertyName: string): string[] =>
  sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAssignment)
    .filter((property) => isPropertyNamed(property, propertyName))
    .map((property) => property.getInitializer()?.getText() ?? "");

const hasInputTraceIdRunIdAuthority = (sourceFile: SourceFile): boolean =>
  propertyInitializerText(sourceFile, "runId").some((initializer) => initializer.includes("input.traceId"));

const hasAiRuntimeCallIdCapabilityAuthority = (sourceFile: SourceFile): boolean =>
  propertyInitializerText(sourceFile, "capabilityCallId").some((initializer) => initializer.includes("runtimeCallId") || initializer.includes("input.spanId"));

const hasSplitTraceIdMapAuthority = (sourceFile: SourceFile): boolean =>
  propertyInitializerText(sourceFile, RETIRED_SELECTION_ID_FIELD).some((initializer) => initializer.includes("trace.mapId") || initializer.includes("splitTraceId"))
  || propertyInitializerText(sourceFile, "mapId").some((initializer) => initializer === "trace.mapId");

const hasCanonicalChainResolver = (sourceFile: SourceFile): boolean => {
  const resolver = sourceFile.getFunction("resolveCanonicalAiChain") ?? sourceFile.getVariableDeclaration("resolveCanonicalAiChain");
  if (!resolver) {
    return false;
  }
  const text = resolver.getText();
  return [
    ["input.", RETIRED_SELECTION_ID_FIELD].join(""),
    "input.runId",
    ["input.", RETIRED_PACKAGE_ID_FIELD].join(""),
    ["input.", RETIRED_PACKAGE_VERSION_FIELD].join(""),
    ["input.", RETIRED_SELECTION_VERSION_FIELD].join(""),
    ["input.", RETIRED_ACTIVATION_REF_FIELD].join(""),
    "input.capabilityCallId",
    "input.nerveBusEnvelopeId",
    "input.idempotencyKey",
  ].every((snippet) => text.includes(snippet));
};

const hasTerminalDebugPaths = (project: Project): boolean => {
  const localDebugSource = getSourceOrThrow(project, `${AI_ROOT}/runtime-adapters/local-ai-runtime-debug.ts`);
  const runtimeFailureSource = getSourceOrThrow(project, `${AI_ROOT}/runtime/ai-execution-failure-debug.ts`);
  const externalRuntimeSource = getSourceOrThrow(project, `${AI_ROOT}/runtime-adapters/external-provider-runtime-execution.ts`);
  return [localDebugSource, runtimeFailureSource, externalRuntimeSource].some((source) => hasStringLiteral(source, "AI_ERROR_DEBUG"))
    && [localDebugSource, externalRuntimeSource].some((source) => hasStringLiteral(source, "AI_RESPONSE_DEBUG"));
};

const hasVisionNormalizedDebugStage = (sourceFile: SourceFile): boolean => {
  const text = sourceFile.getFullText();
  return hasStringLiteral(sourceFile, "local_ai_output_normalized")
    && text.includes("adjusted=${String(visionOutput.adjusted)}")
    && text.includes("rawResponseText: responseText");
};

export const findAiDebugTransparencyViolations = (project: Project): Finding[] => {
  const localTaskSupport = getSourceOrThrow(project, LOCAL_AI_TASK_SUPPORT_PATH);
  const ollamaSupport = getSourceOrThrow(project, OLLAMA_RUNTIME_SUPPORT_PATH);
  const ocrSupport = getSourceOrThrow(project, OCR_RUNTIME_SUPPORT_PATH);
  const visionTask = getSourceOrThrow(project, VISION_RUNTIME_TASK_PATH);
  const visionTaskHandlers = getSourceOrThrow(project, VISION_RUNTIME_TASK_HANDLER_PATH);
  const findings: Finding[] = [];

  for (const [file, source] of [[LOCAL_AI_TASK_SUPPORT_PATH, localTaskSupport], [OLLAMA_RUNTIME_SUPPORT_PATH, ollamaSupport], [OCR_RUNTIME_SUPPORT_PATH, ocrSupport]] as const) {
    if (source.getFullText().includes("GRASSEYE_DEBUG_AI_IO")) {
      findings.push(createAiDebugFinding("GRASSEYE-AI-CAPABILITY-007A-V1", file, "AI IO transparency must not be gated by GRASSEYE_DEBUG_AI_IO; governed logs must carry full raw AI IO by default."));
    }
  }
  if (!ollamaSupport.getFullText().includes("rawResponseText: parsed.response") || !ocrSupport.getFullText().includes("rawResponseText: ocrText")) {
    findings.push(createAiDebugFinding("GRASSEYE-AI-CAPABILITY-007A-V1", OLLAMA_RUNTIME_SUPPORT_PATH, "Local AI adapters must emit full rawResponseText by default, not only rawResponsePreview."));
  }
  if (![visionTask, visionTaskHandlers].some((sourceFile) => hasVisionNormalizedDebugStage(sourceFile))) {
    findings.push(createAiDebugFinding("GRASSEYE-AI-CAPABILITY-007A-V1", VISION_RUNTIME_TASK_HANDLER_PATH, "Vision parser must emit a separate normalized/assembled debug step with the original raw response still attached."));
  }

  return findings;
};

export const collectWorkbenchAiDebugChainFindings = (project: Project): Finding[] => {
  const recorderSource = getSourceOrThrow(project, WORKBENCH_AI_DEBUG_RECORDER_PATH);
  const supportSource = getSourceOrThrow(project, WORKBENCH_AI_DEBUG_SUPPORT_PATH);
  const findings: Finding[] = [];

  if (hasInputTraceIdRunIdAuthority(recorderSource)) {
    findings.push(createAiDebugFinding("GRASSEYE-AI-CAPABILITY-007A-V1", WORKBENCH_AI_DEBUG_RECORDER_PATH, "Workbench AI debug recorder must not use input.traceId as governed runId truth."));
  }
  if (hasSplitTraceIdMapAuthority(recorderSource) || hasSplitTraceIdMapAuthority(supportSource)) {
    findings.push(createAiDebugFinding(
      "GRASSEYE-AI-CAPABILITY-007A-V1",
      WORKBENCH_AI_DEBUG_RECORDER_PATH,
      "Workbench AI debug recorder must not derive retired selection or map identifiers from splitTraceId(traceId); use explicit governed chain fields.",
    ));
  }
  if (!hasCanonicalChainResolver(recorderSource)) {
    findings.push(createAiDebugFinding("GRASSEYE-AI-CAPABILITY-007A-V1", WORKBENCH_AI_DEBUG_RECORDER_PATH, "Workbench AI debug recorder must resolve mission/run/map/package/activation/capability/idempotency fields from canonical AI debug event fields."));
  }
  if (hasAiRuntimeCallIdCapabilityAuthority(recorderSource) || hasAiRuntimeCallIdCapabilityAuthority(supportSource)) {
    findings.push(createAiDebugFinding("GRASSEYE-AI-CAPABILITY-007A-V1", WORKBENCH_AI_DEBUG_RECORDER_PATH, "AI debug capabilityCallId must remain the Orchestration step invocation id; runtimeCallId/spanId belong to AI runtime observability fields."));
  }
  if (!hasTerminalDebugPaths(project)) {
    findings.push(createAiDebugFinding("GRASSEYE-AI-CAPABILITY-007A-V1", `${AI_ROOT}/runtime-adapters/local-ai-runtime-debug.ts`, "AI_REQUEST_DEBUG must have governed terminal AI_RESPONSE_DEBUG or AI_ERROR_DEBUG paths."));
  }

  return findings;
};