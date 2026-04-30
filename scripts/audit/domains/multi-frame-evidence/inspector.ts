import { fileExists, listFilesRecursive } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { getFunctionLike, getZodEnumValues, getZodObjectPropertyNames } from "../_shared/ast-schema-queries.js";
import { createAuditProject, getSourceFileOrThrow, hasPropertyAccessPath } from "../_shared/ast-helpers.js";

const LAW_ID = "GRASSEYE-MULTI-FRAME-EVIDENCE-001-V1";
const MULTI_FRAME_TYPES_PATH = "src/types/multi-frame-evidence.ts";
const VISION_TYPES_PATH = "src/types/vision-product-presence.ts";
const RESULT_HELPER_PATH = "src/lib/local-ai/vision-task-result.ts";
const EVIDENCE_PACKET_TYPES_PATH = "src/types/evidence-packet.ts";
const AGENT_SERVICE_PATH = "src/lib/local-runtime/runtime-executor.ts";

export async function inspectMultiFrameScreenshotBoundary(repoRoot = pathFromRepoRoot(".")): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> {
  const repoFiles = await listFilesRecursive(repoRoot, { ignoreDirs: [".grasseye-data"] });
  const forbiddenTests = repoFiles.filter((file) => /(^|\/)(tests|__tests__)\/|\.test\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(file));
  const project = createAuditProject();
  const multiFrameTypes = getSourceFileOrThrow(project, MULTI_FRAME_TYPES_PATH);
  const illegalAgentRuntimeExists = await fileExists(pathFromRepoRoot(AGENT_SERVICE_PATH));
  const findings: Finding[] = [];

  const samplingStrategies = getZodEnumValues(multiFrameTypes, "MultiFrameSamplingStrategySchema");
  const inputModes = getZodEnumValues(multiFrameTypes, "ProductPresenceInputModeSchema");
  const evidenceSetFields = getZodObjectPropertyNames(multiFrameTypes, "MultiFrameVideoEvidenceSetSchema");
  const schemaPassed = [
    samplingStrategies.includes("fixed_3_6_10"),
    samplingStrategies.includes("adaptive_short_video"),
    samplingStrategies.includes("single_frame_fallback"),
    inputModes.includes("multi_frame_contact_sheet"),
    inputModes.includes("multi_image"),
    inputModes.includes("single_frame_fallback"),
    evidenceSetFields.has("multiFrameEvidenceSetId"),
    evidenceSetFields.has("roundId"),
    evidenceSetFields.has("videoVisitId"),
    evidenceSetFields.has("frames"),
    evidenceSetFields.has("validFrameCount"),
    evidenceSetFields.has("contactSheetEvidenceId"),
  ].every(Boolean);
  if (!schemaPassed) {
    findings.push(createFinding({ lawId: LAW_ID, file: MULTI_FRAME_TYPES_PATH, line: 1, severity: "error", message: "Multi-frame screenshot packaging must define governed sampling strategies, evidence-set ids, and frame refs." }));
  }

  const runtimeHonestyPassed = !illegalAgentRuntimeExists;
  if (!runtimeHonestyPassed) {
    findings.push(createFinding({ lawId: LAW_ID, file: AGENT_SERVICE_PATH, line: 1, severity: "error", message: "Illegal local-runtime executor must be physically removed before governed multi-frame runtime honesty can be trusted." }));
  }

  if (forbiddenTests.length > 0) {
    findings.push(createFinding({ lawId: LAW_ID, file: forbiddenTests[0] ?? "tests", line: 1, severity: "fatal", message: "Multi-frame screenshot governance forbids repository test artifacts as quality truth." }));
  }

  return {
    findings,
    phases: [
      createPhase("multi-frame-input-packaging", schemaPassed ? "PASS" : "CODE VIOLATION", schemaPassed, schemaPassed ? "Multi-frame screenshot packaging defines governed sampling strategies and evidence-set metadata." : "Multi-frame screenshot packaging is incomplete."),
      createPhase("multi-frame-runtime-honesty", runtimeHonestyPassed ? "PASS" : "CODE VIOLATION", runtimeHonestyPassed, runtimeHonestyPassed ? "Runtime still honestly declares single-frame fallback until multi-frame production sampling lands." : "Runtime is not honestly representing current single-frame fallback state."),
      createPhase("multi-frame-test-boundary", forbiddenTests.length === 0 ? "PASS" : "FAKE ENFORCEMENT", forbiddenTests.length === 0, forbiddenTests.length === 0 ? "Repository contains no tests, __tests__, or *.test.* artifacts." : "Repository contains forbidden test artifacts."),
    ],
  };
}

export async function inspectMultiFrameAiBoundary(): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> {
  const project = createAuditProject();
  const visionTypes = getSourceFileOrThrow(project, VISION_TYPES_PATH);
  const resultHelper = getSourceFileOrThrow(project, RESULT_HELPER_PATH);
  const findings: Finding[] = [];

  const requestFields = getZodObjectPropertyNames(visionTypes, "VisionProductPresenceRequestInputSchema");
  const payloadFields = getZodObjectPropertyNames(visionTypes, "VisionProductPresencePayloadSchema");
  const aiContractPassed = [
    requestFields.has("inputMode"),
    requestFields.has("multiFrameEvidenceSetId"),
    requestFields.has("contactSheetEvidenceId"),
    requestFields.has("sampledFrameCount"),
    requestFields.has("validFrameCount"),
    payloadFields.has("frameLevelObservations"),
    payloadFields.has("aggregateReason"),
  ].every(Boolean);
  if (!aiContractPassed) {
    findings.push(createFinding({ lawId: LAW_ID, file: VISION_TYPES_PATH, line: 1, severity: "error", message: "AI multi-frame request and payload schemas must preserve governed frame-level and aggregate fields." }));
  }

  const resultBuilder = getFunctionLike(resultHelper, "createVisionResultPayload");
  const resultHelperPassed = Boolean(
    resultBuilder
    && hasPropertyAccessPath(resultBuilder, ["request", "input", "inputMode"])
    && hasPropertyAccessPath(resultBuilder, ["request", "input", "multiFrameEvidenceSetId"])
    && hasPropertyAccessPath(resultBuilder, ["request", "input", "contactSheetEvidenceId"])
    && hasPropertyAccessPath(resultBuilder, ["request", "input", "sampledFrameCount"])
    && hasPropertyAccessPath(resultBuilder, ["request", "input", "validFrameCount"])
    && hasPropertyAccessPath(resultBuilder, ["input", "aggregateReason"])
    && hasPropertyAccessPath(resultBuilder, ["input", "frameLevelObservations"])
  );
  if (!resultHelperPassed) {
    findings.push(createFinding({ lawId: LAW_ID, file: RESULT_HELPER_PATH, line: 1, severity: "error", message: "Vision result builder must emit the governed multi-frame request and aggregate result fields." }));
  }

  return {
    findings,
    phases: [
      createPhase("multi-frame-ai-contract", aiContractPassed ? "PASS" : "CODE VIOLATION", aiContractPassed, aiContractPassed ? "AI contracts preserve governed multi-frame request and aggregate output fields." : "AI contracts are missing governed multi-frame fields."),
      createPhase("multi-frame-result-builder", resultHelperPassed ? "PASS" : "CODE VIOLATION", resultHelperPassed, resultHelperPassed ? "Vision result builder preserves governed multi-frame request and result fields." : "Vision result builder is missing governed multi-frame fields."),
    ],
  };
}

export async function inspectMultiFrameForensicsBoundary(): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> {
  const project = createAuditProject();
  const packetTypes = getSourceFileOrThrow(project, EVIDENCE_PACKET_TYPES_PATH);
  const findings: Finding[] = [];

  const packetVideoFields = getZodObjectPropertyNames(packetTypes, "EvidencePacketVideoEvidenceSchema");
  const packetAiFields = getZodObjectPropertyNames(packetTypes, "EvidencePacketProductPresenceAISchema");
  const packetPassed = [
    packetVideoFields.has("multiFrameEvidenceSetId"),
    packetVideoFields.has("contactSheetEvidenceId"),
    packetAiFields.has("inputMode"),
    packetAiFields.has("sampledFrameCount"),
    packetAiFields.has("validFrameCount"),
    packetAiFields.has("frameLevelObservations"),
    packetAiFields.has("aggregateReason"),
  ].every(Boolean);
  if (!packetPassed) {
    findings.push(createFinding({ lawId: LAW_ID, file: EVIDENCE_PACKET_TYPES_PATH, line: 1, severity: "error", message: "Evidence packet schemas must preserve governed multi-frame video and AI metadata." }));
  }

  return {
    findings,
    phases: [
      createPhase("multi-frame-forensics-packet", packetPassed ? "PASS" : "CODE VIOLATION", packetPassed, packetPassed ? "Forensics packet schemas preserve governed multi-frame video and AI metadata." : "Forensics packet schemas are missing governed multi-frame metadata."),
    ],
  };
}
