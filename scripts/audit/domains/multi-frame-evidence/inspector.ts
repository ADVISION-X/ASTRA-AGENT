import { listFilesRecursive, readTextFile } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase, finalizeInspectorResult } from "../../core/result.js";
import type { InspectorContext } from "../../core/schema.js";
import { runDomainOwnerInspection } from "../_shared/run-domain-owner-inspection.js";

const LAW_PATH = ".github/instructions/cursor-rules/modules/module-multi-frame-evidence.instructions.md";
const BROWSE_BLUEPRINT_PATH = "docs/法案辅助文件/GrassEye Agent 浏览决策树与AI询问契约施工图.md";
const PACKET_BLUEPRINT_PATH = "docs/法案辅助文件/GrassEye Agent 取证表单与高级AI投喂契约施工图.md";
const PROMPT_PATH = "src/lib/local-ai/prompts/vision-product-presence.v1.ts";
const VISION_SCHEMA_PATH = "src/types/vision-product-presence.ts";
const EVIDENCE_PACKET_TYPES_PATH = "src/types/evidence-packet.ts";
const GOVERNED_EXECUTION_PATH = "src/lib/local-ai/governed-task-execution.ts";
const AGENT_SERVICE_PATH = "src/features/agent/agent-service.ts";

const includesAll = (text: string, markers: string[]): boolean => markers.every((marker) => text.includes(marker));

export default async function inspectMultiFrameEvidence(context: InspectorContext) {
  const base = await runDomainOwnerInspection(context, {
    capabilityDomain: "multi-frame-evidence",
    inspectorId: "multi-frame-evidence-owner",
    inspectorEntry: "scripts/audit/domains/multi-frame-evidence/inspector.ts",
  });

  const [law, browseBlueprint, packetBlueprint, prompt, visionSchema, evidencePacketTypes, governedExecution, agentService, repoFiles] = await Promise.all([
    readTextFile(pathFromRepoRoot(LAW_PATH)),
    readTextFile(pathFromRepoRoot(BROWSE_BLUEPRINT_PATH)),
    readTextFile(pathFromRepoRoot(PACKET_BLUEPRINT_PATH)),
    readTextFile(pathFromRepoRoot(PROMPT_PATH)),
    readTextFile(pathFromRepoRoot(VISION_SCHEMA_PATH)),
    readTextFile(pathFromRepoRoot(EVIDENCE_PACKET_TYPES_PATH)),
    readTextFile(pathFromRepoRoot(GOVERNED_EXECUTION_PATH)),
    readTextFile(pathFromRepoRoot(AGENT_SERVICE_PATH)),
    listFilesRecursive(pathFromRepoRoot("."), { ignoreDirs: [".grasseye-data"] }),
  ]);

  const findings = [...base.findings];
  const forbiddenTests = repoFiles.filter((file) => /(^|\/)(tests|__tests__)\/|\.test\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(file));
  const firstForbiddenTest = forbiddenTests[0] ?? null;

  const lawPassed = includesAll(law, [
    "Default sample times are 3s, 6s, and 10s after video stability.",
    "Contact sheet input is preferred when local AI multi-image support is uncertain.",
    "Multi-frame input should be one AI task by default, not three independent AI calls.",
    "One-frame fallback must reduce confidence or route to review/skip.",
  ]);
  if (!lawPassed) {
    findings.push(createFinding({
      lawId: "GRASSEYE-MULTI-FRAME-EVIDENCE-001-V1",
      file: LAW_PATH,
      line: 1,
      severity: "error",
      message: "Multi-frame evidence law is missing a required default sampling, contact sheet, or fallback rule.",
    }));
  }

  const browseBlueprintPassed = includesAll(browseBlueprint, [
    "SAMPLE_VIDEO_FRAMES",
    "CAPTURE_FRAME_3S",
    "CAPTURE_FRAME_6S",
    "CAPTURE_FRAME_10S",
    "CREATE_MULTI_FRAME_EVIDENCE_SET",
    "CREATE_PRODUCT_PRESENCE_CONTACT_SHEET",
    "ASK_AI_PRODUCT_PRESENCE_MULTI_FRAME",
    "Multi-frame Product Presence Sampling Policy",
    "single_frame_fallback",
  ]);
  if (!browseBlueprintPassed) {
    findings.push(createFinding({
      lawId: "GRASSEYE-MULTI-FRAME-EVIDENCE-001-V1",
      file: BROWSE_BLUEPRINT_PATH,
      line: 1,
      severity: "error",
      message: "Browse blueprint is missing the governed multi-frame product-presence chain.",
    }));
  }

  const packetBlueprintPassed = includesAll(packetBlueprint, [
    "multiFrameEvidenceSetId",
    "contactSheetEvidenceId",
    "samplingStrategy",
    "validFrameCount",
    "frameLevelObservations",
    "aggregateReason",
  ]);
  if (!packetBlueprintPassed) {
    findings.push(createFinding({
      lawId: "GRASSEYE-MULTI-FRAME-EVIDENCE-001-V1",
      file: PACKET_BLUEPRINT_PATH,
      line: 1,
      severity: "error",
      message: "Evidence packet blueprint is missing the required multi-frame evidence fields.",
    }));
  }

  const promptAndSchemaPassed = includesAll(prompt, [
    "inputMode",
    "multiFrameEvidenceSetId",
    "contactSheetEvidenceId",
    "frameEvidenceIds",
    "sampledFrameCount",
    "validFrameCount",
    "Review the sampled frames from the same video",
  ]) && includesAll(visionSchema, [
    "inputMode",
    "multiFrameEvidenceSetId",
    "contactSheetEvidenceId",
    "frameEvidenceIds",
    "sampledFrameCount",
    "validFrameCount",
    "frameLevelObservations",
    "aggregateReason",
  ]);
  if (!promptAndSchemaPassed) {
    findings.push(createFinding({
      lawId: "GRASSEYE-MULTI-FRAME-EVIDENCE-001-V1",
      file: PROMPT_PATH,
      line: 1,
      severity: "error",
      message: "Product-presence prompt or schema is missing the multi-frame input/output contract.",
    }));
  }

  const runtimeHonestyPassed = includesAll(governedExecution, ["single_frame_fallback", "reduced_frame_coverage", "aggregateReason"]) && agentService.includes('inputMode: "single_frame_fallback"');
  if (!runtimeHonestyPassed) {
    findings.push(createFinding({
      lawId: "GRASSEYE-MULTI-FRAME-EVIDENCE-001-V1",
      file: AGENT_SERVICE_PATH,
      line: 1,
      severity: "error",
      message: "Runtime must honestly mark single-frame fallback until real multi-frame sampling lands.",
    }));
  }

  const packetTypesPassed = includesAll(evidencePacketTypes, [
    "multiFrameEvidenceSetId",
    "contactSheetEvidenceId",
    "samplingStrategy",
    "validFrameCount",
    "inputMode",
    "sampledFrameCount",
    "frameLevelObservations",
    "aggregateReason",
  ]);
  if (!packetTypesPassed) {
    findings.push(createFinding({
      lawId: "GRASSEYE-MULTI-FRAME-EVIDENCE-001-V1",
      file: EVIDENCE_PACKET_TYPES_PATH,
      line: 1,
      severity: "error",
      message: "Evidence packet types are missing the multi-frame evidence fields.",
    }));
  }

  if (firstForbiddenTest !== null) {
    findings.push(createFinding({
      lawId: "GRASSEYE-MULTI-FRAME-EVIDENCE-001-V1",
      file: firstForbiddenTest,
      line: 1,
      severity: "fatal",
      message: "Multi-frame evidence governance forbids repository test artifacts as quality truth.",
    }));
  }

  return finalizeInspectorResult({
    inspector: "GrassEye Multi Frame Evidence Owner Inspector",
    inspectorId: "multi-frame-evidence-owner",
    capabilityDomain: "multi-frame-evidence",
    findings,
    phases: [
      ...base.phases,
      createPhase("multi-frame-law", lawPassed ? "PASS" : "CODE VIOLATION", lawPassed, lawPassed ? "Multi-frame law defines sampling, contact sheet, and fallback rules." : "Multi-frame law is missing a required sampling or fallback rule."),
      createPhase("multi-frame-browse-blueprint", browseBlueprintPassed ? "PASS" : "CODE VIOLATION", browseBlueprintPassed, browseBlueprintPassed ? "Browse blueprint defines the governed multi-frame product-presence chain." : "Browse blueprint is missing the governed multi-frame product-presence chain."),
      createPhase("multi-frame-packet-blueprint", packetBlueprintPassed ? "PASS" : "CODE VIOLATION", packetBlueprintPassed, packetBlueprintPassed ? "Evidence packet blueprint records the multi-frame evidence fields." : "Evidence packet blueprint is missing required multi-frame evidence fields."),
      createPhase("multi-frame-prompt-schema", promptAndSchemaPassed ? "PASS" : "CODE VIOLATION", promptAndSchemaPassed, promptAndSchemaPassed ? "Prompt and schema expose the governed multi-frame input/output contract." : "Prompt or schema is missing the multi-frame contract."),
      createPhase("multi-frame-runtime-honesty", runtimeHonestyPassed ? "PASS" : "CODE VIOLATION", runtimeHonestyPassed, runtimeHonestyPassed ? "Runtime still declares explicit single-frame fallback until sampling lands." : "Runtime does not honestly declare single-frame fallback."),
      createPhase("multi-frame-packet-types", packetTypesPassed ? "PASS" : "CODE VIOLATION", packetTypesPassed, packetTypesPassed ? "Evidence packet types record the multi-frame evidence fields." : "Evidence packet types are missing the multi-frame evidence fields."),
      createPhase("multi-frame-test-boundary", forbiddenTests.length === 0 ? "PASS" : "FAKE ENFORCEMENT", forbiddenTests.length === 0, forbiddenTests.length === 0 ? "Repository contains no tests, __tests__, or *.test.* artifacts." : "Repository contains forbidden test artifacts."),
    ],
    summary: findings.length === 0 ? "multi-frame evidence law, blueprints, and runtime contract are present and bounded" : "multi-frame evidence governance is missing a required law, blueprint, or runtime honesty rule",
  });
}
