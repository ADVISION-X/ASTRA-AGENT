import { readFile } from "node:fs/promises";

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
const WORKBENCH_AI_REQUEST_BUILDER_PATH = "src/lib/local-runtime/workbench-nerve-bus-ai-request-builder.ts";
const TIKTOK_SEEDING_MAP_PATH = "src/map-plugins/builtins/tiktok-seeding-video-discovery.meta.map-package.json";
const FACEBOOK_SEEDING_MAP_PATH = "src/map-plugins/builtins/facebook-seeding-video-discovery.meta.map-package.json";

function hasMultiFramePackagingSchema(multiFrameTypes: ReturnType<typeof getSourceFileOrThrow>): boolean {
  const samplingStrategies = getZodEnumValues(multiFrameTypes, "MultiFrameSamplingStrategySchema");
  const inputModes = getZodEnumValues(multiFrameTypes, "ProductPresenceInputModeSchema");
  const evidenceSetFields = getZodObjectPropertyNames(multiFrameTypes, "MultiFrameVideoEvidenceSetSchema");
  return [
    samplingStrategies.includes("fixed_3_6"),
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
}

function hasProductPresenceRoutePlanOwnedSamplingBuilder(requestBuilder: ReturnType<typeof getSourceFileOrThrow>): boolean {
  const text = requestBuilder.getFullText();
  return [
    "route_plan_or_ability_owned_sampling",
    "aiInputRefs.length > 1 ? \"multi_image\" : \"single_frame_fallback\"",
    "frameEvidenceIds: inputMode === \"multi_image\" ? aiInputRefs : []",
  ].every((snippet) => text.includes(snippet));
}

function forbiddenFrameMapTokens(): string[] {
  const framePoints = [
    { step: "3s", ref: "Frame3s" },
    { step: "6s", ref: "Frame6s" },
    { step: "10s", ref: "Frame10s" },
  ] as const;
  return framePoints.flatMap((framePoint) => [
    `"stepId": "prepare-ai-input-frame-${framePoint.step}"`,
    `"stepId": "capture-video-frame-${framePoint.step}"`,
    `screenshotEvidenceRef${framePoint.ref}`,
    `promptInputRef${framePoint.ref}`,
  ]);
}

async function collectSeedingMapFindings(seedingMap: { file: string; label: string; openStepId: string }, forbiddenTokens: string[]): Promise<Finding[]> {
  const mapText = await readFile(pathFromRepoRoot(seedingMap.file), "utf8");
  const leakedTokens = forbiddenTokens.filter((token) => mapText.includes(token));
  return !mapText.includes(seedingMap.openStepId)
    || !mapText.includes('"stepId": "capture-video-viewport"')
    || !mapText.includes('"stepId": "prepare-ai-input"')
    || !mapText.includes('"stepId": "startup-preparation"')
    || !mapText.includes('"stepId": "judge-seeding-video"')
    || !mapText.includes('"routePlanId": "product-discovery-route-plan.v1"')
    || leakedTokens.length > 0
      ? [createFinding({ lawId: LAW_ID, file: seedingMap.file, line: 1, severity: "fatal", message: `${seedingMap.label} must remain a weak entry-spine map. Product video sampling is Route Plan / ability-owned, and frame-specific capture or prompt refs must not appear in the production map.`, detail: leakedTokens.join(", ") })]
      : [];
}

async function collectProductPresenceRoutePlanOwnedSamplingFindings(): Promise<Finding[]> {
  const findings: Finding[] = [];
  const project = createAuditProject();
  const requestBuilder = getSourceFileOrThrow(project, WORKBENCH_AI_REQUEST_BUILDER_PATH);
  if (!hasProductPresenceRoutePlanOwnedSamplingBuilder(requestBuilder)) {
    findings.push(createFinding({ lawId: LAW_ID, file: WORKBENCH_AI_REQUEST_BUILDER_PATH, line: 1, severity: "fatal", message: "Product-presence AI request builder must consume Route Plan / ability-owned image inputs when available and preserve honest single-frame fallback metadata without hard-coding frame-specific map refs." }));
  }

  const seedingMaps = [
    {
      file: TIKTOK_SEEDING_MAP_PATH,
      label: "TikTok seeding-video discovery",
      openStepId: '"stepId": "open-tiktok-feed"',
    },
    {
      file: FACEBOOK_SEEDING_MAP_PATH,
      label: "Facebook seeding-video discovery",
      openStepId: '"stepId": "open-facebook-reels"',
    },
  ] as const;

  const forbiddenTokens = forbiddenFrameMapTokens();
  for (const seedingMap of seedingMaps) {
    findings.push(...await collectSeedingMapFindings(seedingMap, forbiddenTokens));
  }

  return findings;
}

function collectScreenshotBoundaryFindings(multiFrameTypes: ReturnType<typeof getSourceFileOrThrow>, illegalAgentRuntimeExists: boolean, forbiddenTests: string[]): Finding[] {
  const findings: Finding[] = [];
  if (!hasMultiFramePackagingSchema(multiFrameTypes)) {
    findings.push(createFinding({ lawId: LAW_ID, file: MULTI_FRAME_TYPES_PATH, line: 1, severity: "error", message: "Multi-frame screenshot packaging must define governed sampling strategies, evidence-set ids, and frame refs." }));
  }
  if (illegalAgentRuntimeExists) {
    findings.push(createFinding({ lawId: LAW_ID, file: AGENT_SERVICE_PATH, line: 1, severity: "error", message: "Illegal local-runtime executor must be physically removed before governed multi-frame runtime honesty can be trusted." }));
  }
  if (forbiddenTests.length > 0) {
    findings.push(createFinding({ lawId: LAW_ID, file: forbiddenTests[0] ?? "tests", line: 1, severity: "fatal", message: "Multi-frame screenshot governance forbids repository test artifacts as quality truth." }));
  }
  return findings;
}

function hasAiContractFields(visionTypes: ReturnType<typeof getSourceFileOrThrow>): boolean {
  const requestFields = getZodObjectPropertyNames(visionTypes, "VisionProductPresenceRequestInputSchema");
  const payloadFields = getZodObjectPropertyNames(visionTypes, "VisionProductPresencePayloadSchema");
  return [
    requestFields.has("inputMode"),
    requestFields.has("multiFrameEvidenceSetId"),
    requestFields.has("contactSheetEvidenceId"),
    requestFields.has("sampledFrameCount"),
    requestFields.has("validFrameCount"),
    payloadFields.has("frameLevelObservations"),
    payloadFields.has("aggregateReason"),
  ].every(Boolean);
}

function hasGovernedResultBuilder(resultHelper: ReturnType<typeof getSourceFileOrThrow>): boolean {
  const resultBuilder = getFunctionLike(resultHelper, "createVisionResultPayload");
  return Boolean(
    resultBuilder
    && hasPropertyAccessPath(resultBuilder, ["request", "input", "inputMode"])
    && hasPropertyAccessPath(resultBuilder, ["request", "input", "multiFrameEvidenceSetId"])
    && hasPropertyAccessPath(resultBuilder, ["request", "input", "contactSheetEvidenceId"])
    && hasPropertyAccessPath(resultBuilder, ["request", "input", "sampledFrameCount"])
    && hasPropertyAccessPath(resultBuilder, ["request", "input", "validFrameCount"])
    && hasPropertyAccessPath(resultBuilder, ["input", "aggregateReason"])
    && hasPropertyAccessPath(resultBuilder, ["input", "frameLevelObservations"]),
  );
}

function collectAiBoundaryFindings(visionTypes: ReturnType<typeof getSourceFileOrThrow>, resultHelper: ReturnType<typeof getSourceFileOrThrow>): Finding[] {
  const findings: Finding[] = [];
  if (!hasAiContractFields(visionTypes)) {
    findings.push(createFinding({ lawId: LAW_ID, file: VISION_TYPES_PATH, line: 1, severity: "error", message: "AI multi-frame request and payload schemas must preserve governed frame-level and aggregate fields." }));
  }
  if (!hasGovernedResultBuilder(resultHelper)) {
    findings.push(createFinding({ lawId: LAW_ID, file: RESULT_HELPER_PATH, line: 1, severity: "error", message: "Vision result builder must emit the governed multi-frame request and aggregate result fields." }));
  }
  return findings;
}

export async function inspectMultiFrameScreenshotBoundary(repoRoot = pathFromRepoRoot(".")): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> {
  const repoFiles = await listFilesRecursive(repoRoot, { ignoreDirs: [".grasseye-data"] });
  const forbiddenTests = repoFiles.filter((file) => /(^|\/)(tests|__tests__)\/|\.test\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(file));
  const project = createAuditProject();
  const multiFrameTypes = getSourceFileOrThrow(project, MULTI_FRAME_TYPES_PATH);
  const illegalAgentRuntimeExists = await fileExists(pathFromRepoRoot(AGENT_SERVICE_PATH));
  const schemaPassed = hasMultiFramePackagingSchema(multiFrameTypes);
  const runtimeHonestyPassed = !illegalAgentRuntimeExists;
  const findings = collectScreenshotBoundaryFindings(multiFrameTypes, illegalAgentRuntimeExists, forbiddenTests);
  findings.push(...await collectProductPresenceRoutePlanOwnedSamplingFindings());

  return {
    findings,
    phases: [
      createPhase("multi-frame-input-packaging", schemaPassed ? "PASS" : "CODE VIOLATION", schemaPassed, schemaPassed ? "Multi-frame screenshot packaging defines governed sampling strategies and evidence-set metadata." : "Multi-frame screenshot packaging is incomplete."),
      createPhase("multi-frame-runtime-honesty", runtimeHonestyPassed ? "PASS" : "CODE VIOLATION", runtimeHonestyPassed, runtimeHonestyPassed ? "Runtime keeps multi-frame evidence metadata while production maps stay weak; product sampling must be supplied by Route Plan / ability owners, with fallback honesty preserved." : "Runtime is not honestly representing current multi-frame and fallback state."),
      createPhase("multi-frame-test-boundary", forbiddenTests.length === 0 ? "PASS" : "FAKE ENFORCEMENT", forbiddenTests.length === 0, forbiddenTests.length === 0 ? "Repository contains no tests, __tests__, or *.test.* artifacts." : "Repository contains forbidden test artifacts."),
    ],
  };
}

export async function inspectMultiFrameAiBoundary(): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> {
  const project = createAuditProject();
  const visionTypes = getSourceFileOrThrow(project, VISION_TYPES_PATH);
  const resultHelper = getSourceFileOrThrow(project, RESULT_HELPER_PATH);
  const aiContractPassed = hasAiContractFields(visionTypes);
  const resultHelperPassed = hasGovernedResultBuilder(resultHelper);
  const findings = collectAiBoundaryFindings(visionTypes, resultHelper);

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
