import { listFilesRecursive, readTextFile } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase, finalizeInspectorResult } from "../../core/result.js";
import type { InspectorContext } from "../../core/schema.js";
import { runDomainOwnerInspection } from "../_shared/run-domain-owner-inspection.js";

const BLUEPRINT_PATH = "docs/法案辅助文件/GrassEye Agent 取证表单与高级AI投喂契约施工图.md";
const LAW_PATH = ".github/instructions/cursor-rules/modules/module-evidence-packet.instructions.md";
const TYPES_PATH = "src/types/evidence-packet.ts";
const TASK_RUN_PATH = "src/types/task-run.ts";
const ACTION_LOG_PATH = "src/types/platform-action.ts";
const CANDIDATE_PATH = "src/types/product-opportunity.ts";

const includesAll = (text: string, markers: string[]): boolean => markers.every((marker) => text.includes(marker));

export default async function inspectEvidencePacket(context: InspectorContext) {
  const base = await runDomainOwnerInspection(context, {
    capabilityDomain: "evidence-packet",
    inspectorId: "evidence-packet-owner",
    inspectorEntry: "scripts/audit/domains/evidence-packet/inspector.ts",
  });

  const [blueprint, law, typesFile, taskRunFile, actionLogFile, candidateFile, repoFiles] = await Promise.all([
    readTextFile(pathFromRepoRoot(BLUEPRINT_PATH)),
    readTextFile(pathFromRepoRoot(LAW_PATH)),
    readTextFile(pathFromRepoRoot(TYPES_PATH)),
    readTextFile(pathFromRepoRoot(TASK_RUN_PATH)),
    readTextFile(pathFromRepoRoot(ACTION_LOG_PATH)),
    readTextFile(pathFromRepoRoot(CANDIDATE_PATH)),
    listFilesRecursive(pathFromRepoRoot("."), { ignoreDirs: [".grasseye-data"] }),
  ]);

  const findings = [...base.findings];
  const forbiddenTests = repoFiles.filter((file) => /(^|\/)(tests|__tests__)\/|\.test\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(file));
  const firstForbiddenTest = forbiddenTests[0] ?? null;

  const blueprintPassed = includesAll(blueprint, [
    "ProductDiscoveryEvidencePacket",
    "Browse Ledger",
    "Advanced AI export set = Evidence Packets only by default.",
    "dataQualityFlags",
    "actionPurpose",
    "高级 AI 投喂边界",
    "Candidate 与 Evidence Packet 的关系",
    "multiFrameEvidenceSetId",
    "contactSheetEvidenceId",
    "samplingStrategy",
    "validFrameCount",
    "frameLevelObservations",
    "aggregateReason",
  ]);
  if (!blueprintPassed) {
    findings.push(createFinding({
      lawId: "GRASSEYE-EVIDENCE-PACKET-001-V1",
      file: BLUEPRINT_PATH,
      line: 1,
      severity: "error",
      message: "Evidence packet blueprint is missing a required schema, handoff boundary, or data-quality section.",
    }));
  }

  const lawPassed = includesAll(law, [
    "Evidence Packet",
    "Browse Ledger is the default lightweight record for non-product and ordinary skipped rounds.",
    "Advanced AI export set must include Evidence Packets by default, not all browse rounds.",
    "dataQualityFlags",
    "Action log records must include actionPurpose",
    "like or save marker must remain recommendation_tuning_marker",
    "views or likes must not be interpreted as sales",
    "Evidence Packet videoEvidence must support multiFrameEvidenceSetId, sampled frames, contactSheetEvidenceId, samplingStrategy, and validFrameCount.",
    "productPresenceAI must record inputMode, sampledFrameCount, validFrameCount, frameLevelObservations, and aggregateReason.",
  ]);
  if (!lawPassed) {
    findings.push(createFinding({
      lawId: "GRASSEYE-EVIDENCE-PACKET-001-V1",
      file: LAW_PATH,
      line: 1,
      severity: "error",
      message: "Evidence packet law is missing one or more handoff boundary clauses.",
    }));
  }

  const typesPassed = includesAll(typesFile, [
    "ProductDiscoveryEvidencePacketSchema",
    "BrowseLedgerEntrySchema",
    "BrowseSessionSummary",
    "BrowseSummarySchema",
    "AdvancedAIExportSetSchema",
    "EvidencePacketDataQualityFlagSchema",
    "EvidencePacketActionPurposeSchema",
    "multiFrameEvidenceSetId",
    "contactSheetEvidenceId",
    "samplingStrategy",
    "validFrameCount",
    "inputMode",
    "sampledFrameCount",
    "frameLevelObservations",
    "aggregateReason",
    "blocked_login",
    "local_ai_unavailable",
    "geometry_mismatch",
    "invalid_ai_output",
  ]);
  if (!typesPassed) {
    findings.push(createFinding({
      lawId: "GRASSEYE-EVIDENCE-PACKET-001-V1",
      file: TYPES_PATH,
      line: 1,
      severity: "error",
      message: "Evidence packet type contract is incomplete.",
    }));
  }

  const roundPassed = includesAll(taskRunFile, ["videoVisitId", "packetId", "roundOutcome", "decisionReason", "nextStep"]);
  if (!roundPassed) {
    findings.push(createFinding({
      lawId: "GRASSEYE-EVIDENCE-PACKET-001-V1",
      file: TASK_RUN_PATH,
      line: 1,
      severity: "error",
      message: "Agent round schema is missing evidence-packet finalization fields.",
    }));
  }

  const actionPassed = includesAll(actionLogFile, ["actionPurpose", "triggerSource", "beforeEvidenceId", "afterEvidenceId"]);
  if (!actionPassed) {
    findings.push(createFinding({
      lawId: "GRASSEYE-EVIDENCE-PACKET-001-V1",
      file: ACTION_LOG_PATH,
      line: 1,
      severity: "error",
      message: "Action log schema is missing actionPurpose or traceability fields.",
    }));
  }

  const candidatePassed = candidateFile.includes('analysisStatus: z.literal("pending_analysis")');
  if (!candidatePassed) {
    findings.push(createFinding({
      lawId: "GRASSEYE-EVIDENCE-PACKET-001-V1",
      file: CANDIDATE_PATH,
      line: 1,
      severity: "error",
      message: "Candidate schema must remain pending_analysis for evidence packet handoff.",
    }));
  }

  if (firstForbiddenTest !== null) {
    findings.push(createFinding({
      lawId: "GRASSEYE-EVIDENCE-PACKET-001-V1",
      file: firstForbiddenTest.replace(`${pathFromRepoRoot(".")}/`, ""),
      line: 1,
      severity: "fatal",
      message: "Evidence packet governance forbids repository test artifacts as quality truth.",
    }));
  }

  return finalizeInspectorResult({
    inspector: "GrassEye Evidence Packet Owner Inspector",
    inspectorId: "evidence-packet-owner",
    capabilityDomain: "evidence-packet",
    findings,
    phases: [
      ...base.phases,
      createPhase("evidence-packet-blueprint", blueprintPassed ? "PASS" : "CODE VIOLATION", blueprintPassed, blueprintPassed ? "Evidence packet blueprint defines schema, data quality, and advanced-AI handoff." : "Evidence packet blueprint is incomplete."),
      createPhase("evidence-packet-law", lawPassed ? "PASS" : "CODE VIOLATION", lawPassed, lawPassed ? "Evidence packet law defines packet, action purpose, and interpretation boundaries." : "Evidence packet law is missing required boundaries."),
      createPhase("evidence-packet-types", typesPassed ? "PASS" : "CODE VIOLATION", typesPassed, typesPassed ? "Evidence packet type contract defines packet schema, outcomes, flags, and action purpose." : "Evidence packet type contract is incomplete."),
      createPhase("evidence-packet-round-fields", roundPassed ? "PASS" : "CODE VIOLATION", roundPassed, roundPassed ? "Agent round schema carries packet finalization fields." : "Agent round schema is missing packet finalization fields."),
      createPhase("evidence-packet-action-purpose", actionPassed ? "PASS" : "CODE VIOLATION", actionPassed, actionPassed ? "Action log schema includes actionPurpose and traceability fields." : "Action log schema is missing actionPurpose or traceability fields."),
      createPhase("evidence-packet-candidate-status", candidatePassed ? "PASS" : "CODE VIOLATION", candidatePassed, candidatePassed ? "Candidate schema remains pending_analysis for packet handoff." : "Candidate schema is missing pending_analysis guard."),
      createPhase("evidence-packet-test-boundary", forbiddenTests.length === 0 ? "PASS" : "FAKE ENFORCEMENT", forbiddenTests.length === 0, forbiddenTests.length === 0 ? "Repository contains no tests, __tests__, or *.test.* artifacts." : "Repository contains forbidden test artifacts."),
    ],
    summary: findings.length === 0 ? "evidence packet blueprint, types, and handoff guardrails are present and bounded" : "evidence packet governance is missing a required packet contract or handoff boundary",
  });
}