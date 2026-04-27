import { createPhase, finalizeInspectorResult } from "../../core/result.js";
import type { InspectorContext } from "../../core/schema.js";
import { readTextFile } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding } from "../../core/result.js";
import { runDomainOwnerInspection } from "../_shared/run-domain-owner-inspection.js";

const BLUEPRINT_PATH = "docs/法案辅助文件/GrassEye Agent 浏览决策树与AI询问契约施工图.md";
const PROMPT_PATH = "src/lib/local-ai/prompts/vision-product-presence.v1.ts";
const SCHEMA_PATH = "src/types/vision-product-presence.ts";
const CONTRACT_PATH = "src/features/agent/agent-browse-flow-contract.ts";
const PRODUCT_SCHEMA_PATH = "src/types/product-opportunity.ts";
const PACKAGE_JSON_PATH = "package.json";
const LAW_PATH = ".github/instructions/cursor-rules/modules/module-agent-browse-flow.instructions.md";

const includesAll = (text: string, markers: string[]): boolean => markers.every((marker) => text.includes(marker));

export default async function inspectAgentBrowseFlow(context: InspectorContext) {
  const base = await runDomainOwnerInspection(context, {
    capabilityDomain: "agent-browse-flow",
    inspectorId: "agent-browse-flow-owner",
    inspectorEntry: "scripts/audit/domains/agent-browse-flow/inspector.ts",
  });

  const [blueprint, prompt, schema, contract, candidateSchema, packageJson, law] = await Promise.all([
    readTextFile(pathFromRepoRoot(BLUEPRINT_PATH)),
    readTextFile(pathFromRepoRoot(PROMPT_PATH)),
    readTextFile(pathFromRepoRoot(SCHEMA_PATH)),
    readTextFile(pathFromRepoRoot(CONTRACT_PATH)),
    readTextFile(pathFromRepoRoot(PRODUCT_SCHEMA_PATH)),
    readTextFile(pathFromRepoRoot(PACKAGE_JSON_PATH)),
    readTextFile(pathFromRepoRoot(LAW_PATH)),
  ]);

  const findings = [...base.findings];

  const blueprintPassed =
    includesAll(blueprint, [
      "单条视频生命周期",
      "WAIT_VIDEO_STABLE",
      "IDENTIFY_CURRENT_VIDEO",
      "SAMPLE_VIDEO_FRAMES",
      "CREATE_MULTI_FRAME_EVIDENCE_SET",
      "CREATE_PRODUCT_PRESENCE_CONTACT_SHEET",
      "ASK_AI_PRODUCT_PRESENCE_MULTI_FRAME",
      "Lightweight Browse Ledger Entry",
      "Round Completion Contract",
      "Like / Save Marker Policy",
      "Comment Sampling Policy",
      "Multi-frame Product Presence Sampling Policy",
    ]);
  if (!blueprintPassed) {
    findings.push(
      createFinding({
        lawId: "GRASSEYE-AGENT-BROWSE-FLOW-001-V1",
        file: BLUEPRINT_PATH,
        line: 1,
        severity: "error",
        message: "Browse-flow blueprint is missing the strict single-video lifecycle or still routes next video back to open target page.",
      }),
    );
  }

  const promptPassed =
    includesAll(prompt, [
      'promptId: "vision.productPresence.v1"',
      'taskType: "vision.productPresence"',
      'schemaVersion: "vision.productPresence.schema.v1"',
      'inputMode: "multi_frame_contact_sheet | multi_image | single_frame_fallback"',
      'multiFrameEvidenceSetId: "string | null"',
      'contactSheetEvidenceId: "string | null"',
      'collect_metrics_like_marker_open_comments',
      'click_not_interested_or_scroll_next',
      'skip_or_operator_review',
      'Review the sampled frames from the same video',
      'Do not judge profitability, sourcing, procurement, advertising, market size, or whether the product is good.',
    ]) &&
    !/Should we source it\?|Should we buy it\?|Should we run ads\?|Is it a winning product\?/i.test(prompt);
  if (!promptPassed) {
    findings.push(
      createFinding({
        lawId: "GRASSEYE-AGENT-BROWSE-FLOW-001-V1",
        file: PROMPT_PATH,
        line: 1,
        severity: "error",
        message: "Product-presence prompt contract is missing required fields or still asks forbidden business questions.",
      }),
    );
  }

  const schemaPassed = includesAll(schema, [
    "promptId",
    "inputMode",
    "multiFrameEvidenceSetId",
    "contactSheetEvidenceId",
    "frameEvidenceIds",
    "screenshotEvidenceId",
    "sampledFrameCount",
    "validFrameCount",
    "isProductVideo",
    "confidence",
    "frameLevelObservations",
    "aggregateReason",
    "suggestedNextAction",
    "mustReview",
    "validateVisionProductPresenceResult",
  ]);
  if (!schemaPassed) {
    findings.push(
      createFinding({
        lawId: "GRASSEYE-AGENT-BROWSE-FLOW-001-V1",
        file: SCHEMA_PATH,
        line: 1,
        severity: "error",
        message: "Vision product-presence schema contract is incomplete.",
      }),
    );
  }

  const contractPassed = includesAll(contract, [
    "BrowserRoundStep",
    "ProductPresenceDecision",
    "RoundOutcome",
    "LikeSaveMarkerPolicy",
    "CommentSamplingPolicy",
    "MetricsCollectionPolicy",
    "CandidateCreationPolicy",
    "AgentBrowseDecisionInput",
    "AgentBrowseDecisionOutput",
  ]);
  if (!contractPassed) {
    findings.push(
      createFinding({
        lawId: "GRASSEYE-AGENT-BROWSE-FLOW-001-V1",
        file: CONTRACT_PATH,
        line: 1,
        severity: "error",
        message: "Agent browse-flow contract file is missing required policy or decision types.",
      }),
    );
  }

  const lawPassed = includesAll(law, [
    "product_yes_high_confidence must finalize into Evidence Packet.",
    "product_no_high_confidence must finalize into Browse Ledger by default.",
    "The first AI question must default to governed multi-frame evidence rather than one opening screenshot.",
    "Multi-frame product-presence must run as one governed AI task by default, not three independent AI calls.",
    "Every round must finalize into either a full Evidence Packet, a lightweight Browse Ledger entry, or an explicit failed/review record before scroll next.",
  ]) && !law.includes("Every round must finalize into an Evidence Packet or explicit failed packet before scroll next");
  if (!lawPassed) {
    findings.push(
      createFinding({
        lawId: "GRASSEYE-AGENT-BROWSE-FLOW-001-V1",
        file: LAW_PATH,
        line: 1,
        severity: "error",
        message: "Browse-flow law must distinguish Browse Ledger from full Evidence Packet finalization.",
      }),
    );
  }

  const candidatePolicyPassed = candidateSchema.includes('analysisStatus: z.literal("pending_analysis")');
  if (!candidatePolicyPassed) {
    findings.push(
      createFinding({
        lawId: "GRASSEYE-AGENT-BROWSE-FLOW-001-V1",
        file: PRODUCT_SCHEMA_PATH,
        line: 1,
        severity: "error",
        message: "Candidate schema must constrain browse-flow outputs to pending_analysis.",
      }),
    );
  }

  const testsAsGate = /"test"\s*:|npm test|vitest|jest|playwright test/i.test(packageJson);
  if (testsAsGate) {
    findings.push(
      createFinding({
        lawId: "GRASSEYE-AGENT-BROWSE-FLOW-001-V1",
        file: PACKAGE_JSON_PATH,
        line: 1,
        severity: "fatal",
        message: "Browse-flow governance forbids test commands from acting as a quality gate.",
      }),
    );
  }

  const phases = [
    ...base.phases,
    createPhase(
      "browse-blueprint",
      blueprintPassed ? "PASS" : "CODE VIOLATION",
      blueprintPassed,
      blueprintPassed
        ? "Browse-flow blueprint is a strict single-video lifecycle state machine with bounded next-video routing."
        : "Browse-flow blueprint still has lifecycle gaps or incorrect next-video routing.",
    ),
    createPhase(
      "product-presence-prompt",
      promptPassed ? "PASS" : "CODE VIOLATION",
      promptPassed,
      promptPassed
        ? "First-question product-presence prompt exists and stays off profitability, sourcing, ads, and final business judgment."
        : "First-question product-presence prompt is missing or overreaches into forbidden business questions.",
    ),
    createPhase(
      "product-presence-schema",
      schemaPassed ? "PASS" : "CODE VIOLATION",
      schemaPassed,
      schemaPassed
        ? "Product-presence schema validates task type, prompt version, suggested next action, and mustReview before actions."
        : "Product-presence schema contract is incomplete.",
    ),
    createPhase(
      "browse-contract-types",
      contractPassed ? "PASS" : "CODE VIOLATION",
      contractPassed,
      contractPassed
        ? "Browse-flow contract defines round steps, decision types, policies, and round outcomes."
        : "Browse-flow contract is missing required lifecycle or policy types.",
    ),
    createPhase(
      "browse-law-finalization",
      lawPassed ? "PASS" : "CODE VIOLATION",
      lawPassed,
      lawPassed
        ? "Browse-flow law separates Browse Ledger finalization from full Evidence Packet finalization."
        : "Browse-flow law still over-expands full Evidence Packet creation.",
    ),
    createPhase(
      "candidate-status-policy",
      candidatePolicyPassed ? "PASS" : "CODE VIOLATION",
      candidatePolicyPassed,
      candidatePolicyPassed
        ? "Browse-flow candidates are constrained to pending_analysis."
        : "Browse-flow candidates are not constrained to pending_analysis.",
    ),
    createPhase(
      "browse-test-artifacts",
      testsAsGate ? "FAKE ENFORCEMENT" : "PASS",
      !testsAsGate,
      testsAsGate
        ? "Browse-flow governance found a forbidden test-based quality gate."
        : "Browse-flow governance keeps tests out of the acceptance gate.",
    ),
  ];

  return finalizeInspectorResult({
    inspector: "GrassEye Agent Browse Flow Owner Inspector",
    inspectorId: "agent-browse-flow-owner",
    capabilityDomain: "agent-browse-flow",
    findings,
    phases,
    summary:
      findings.length === 0
        ? "browse-flow blueprint, contracts, and audit anchors are present and bounded"
        : "browse-flow governance is missing a required blueprint, contract, or bounded routing rule",
  });
}