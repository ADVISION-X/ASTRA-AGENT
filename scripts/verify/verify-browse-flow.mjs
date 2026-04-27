import { readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function requireFile(relativePath) {
  const content = await readFile(path.join(repoRoot, relativePath), "utf8");
  return content;
}

async function main() {
  const [blueprint, prompt, schema, contract, law, localAiSchema, governedExecution, agentService, finalizer, candidateSchema, packageJson] = await Promise.all([
    requireFile("docs/法案辅助文件/GrassEye Agent 浏览决策树与AI询问契约施工图.md"),
    requireFile("src/lib/local-ai/prompts/vision-product-presence.v1.ts"),
    requireFile("src/types/vision-product-presence.ts"),
    requireFile("src/features/agent/agent-browse-flow-contract.ts"),
    requireFile(".github/instructions/cursor-rules/modules/module-agent-browse-flow.instructions.md"),
    requireFile("src/types/local-ai.ts"),
    requireFile("src/lib/local-ai/governed-task-execution.ts"),
    requireFile("src/features/agent/agent-service.ts"),
    requireFile("src/features/agent/agent-round-finalizer.ts"),
    requireFile("src/types/product-opportunity.ts"),
    requireFile("package.json"),
  ]);

  assert(blueprint.includes("单条视频生命周期"), "browse-flow blueprint must define a single-video lifecycle");
  assert(blueprint.includes("原子动作表"), "browse-flow blueprint must define an atomic action table");
  assert(blueprint.includes("WAIT_VIDEO_STABLE"), "browse-flow blueprint must include WAIT_VIDEO_STABLE");
  assert(blueprint.includes("IDENTIFY_CURRENT_VIDEO"), "browse-flow blueprint must include IDENTIFY_CURRENT_VIDEO");
  assert(blueprint.includes("SAMPLE_VIDEO_FRAMES"), "browse-flow blueprint must include multi-frame sampling");
  assert(blueprint.includes("CREATE_MULTI_FRAME_EVIDENCE_SET"), "browse-flow blueprint must include the multi-frame evidence set step");
  assert(blueprint.includes("CREATE_PRODUCT_PRESENCE_CONTACT_SHEET"), "browse-flow blueprint must include the contact sheet step");
  assert(blueprint.includes("ASK_AI_PRODUCT_PRESENCE_MULTI_FRAME"), "browse-flow blueprint must include the multi-frame AI step");
  assert(blueprint.includes("Like / Save Marker Policy"), "browse-flow blueprint must include like/save marker policy");
  assert(blueprint.includes("Comment Sampling Policy"), "browse-flow blueprint must include comment sampling policy");
  assert(blueprint.includes("Multi-frame Product Presence Sampling Policy"), "browse-flow blueprint must define the multi-frame sampling policy");
  assert(blueprint.includes("Lightweight Browse Ledger Entry"), "browse-flow blueprint must distinguish lightweight browse ledger output");
  assert(blueprint.includes("3s"), "browse-flow blueprint must define the 3s sample point");
  assert(blueprint.includes("6s"), "browse-flow blueprint must define the 6s sample point");
  assert(blueprint.includes("10s"), "browse-flow blueprint must define the 10s sample point");

  assert(prompt.includes('promptId: "vision.productPresence.v1"'), "product-presence promptId must exist");
  assert(prompt.includes('schemaVersion: "vision.productPresence.schema.v1"'), "product-presence schema version must exist");
  assert(prompt.includes("collect_metrics_like_marker_open_comments"), "product-presence prompt must include the governed product_yes action");
  assert(prompt.includes("inputMode"), "product-presence prompt must declare inputMode");
  assert(prompt.includes("multiFrameEvidenceSetId"), "product-presence prompt must declare the multi-frame evidence set id");
  assert(prompt.includes("contactSheetEvidenceId"), "product-presence prompt must declare the contact sheet evidence id");
  assert(prompt.includes("Review the sampled frames from the same video"), "product-presence prompt must ask about the sampled frames as a whole");
  assert(prompt.includes("Do not judge profitability, sourcing, procurement, advertising, market size, or whether the product is good."), "product-presence prompt must explicitly forbid business-judgment tasks");
  assert(!/Should we source it\?|Should we buy it\?|Should we run ads\?|Is it a winning product\?/i.test(prompt), "product-presence prompt must not ask forbidden business questions");

  assert(schema.includes("promptId"), "vision product-presence schema must contain promptId");
  assert(schema.includes("inputMode"), "vision product-presence schema must contain inputMode");
  assert(schema.includes("multiFrameEvidenceSetId"), "vision product-presence schema must contain multiFrameEvidenceSetId");
  assert(schema.includes("contactSheetEvidenceId"), "vision product-presence schema must contain contactSheetEvidenceId");
  assert(schema.includes("frameEvidenceIds"), "vision product-presence schema must contain frameEvidenceIds");
  assert(schema.includes("screenshotEvidenceId"), "vision product-presence schema must contain screenshotEvidenceId");
  assert(schema.includes("sampledFrameCount"), "vision product-presence schema must contain sampledFrameCount");
  assert(schema.includes("validFrameCount"), "vision product-presence schema must contain validFrameCount");
  assert(schema.includes("isProductVideo"), "vision product-presence schema must contain isProductVideo");
  assert(schema.includes("frameLevelObservations"), "vision product-presence schema must contain frameLevelObservations");
  assert(schema.includes("aggregateReason"), "vision product-presence schema must contain aggregateReason");
  assert(schema.includes("suggestedNextAction"), "vision product-presence schema must contain suggestedNextAction");
  assert(schema.includes("mustReview"), "vision product-presence schema must contain mustReview");
  assert(schema.includes("validateVisionProductPresenceResult"), "vision product-presence schema must export a validator");
  assert(localAiSchema.includes("vision.productPresence"), "local AI schema must adopt the product-presence task type");
  assert(!localAiSchema.includes("vision.product_classification"), "local AI schema must not keep the deprecated product-classification task type");
  assert(governedExecution.includes("collect_metrics_like_marker_open_comments"), "governed execution must emit the governed product_yes next action");
  assert(governedExecution.includes("single_frame_fallback"), "governed execution must preserve explicit single-frame fallback semantics");
  assert(governedExecution.includes("aggregateReason"), "governed execution must emit aggregateReason");
  assert(agentService.includes("resolveProductPresenceDecision"), "agent service must route through the browse decision resolver");
  assert(agentService.includes("finalizeRoundArtifacts"), "agent service must finalize each round through the structured finalizer");
  assert(agentService.includes("comments_unavailable_candidate_created"), "agent service must preserve the video-only candidate branch when comments fail");
  assert(agentService.includes('inputMode: "single_frame_fallback"'), "agent service must honestly declare single-frame fallback until runtime sampling lands");
  assert(finalizer.includes("browse_ledger"), "round finalizer must support lightweight browse ledger output");
  assert(finalizer.includes('artifactKind === "failed_packet"'), "round finalizer must support explicit failed packet output");
  assert(finalizer.includes("multiFrameEvidenceSetId"), "round finalizer must persist multi-frame evidence references");

  assert(contract.includes("RoundOutcome"), "browse-flow contract must define round outcomes");
  assert(contract.includes("LikeSaveMarkerPolicy"), "browse-flow contract must define like/save marker policy");
  assert(contract.includes("CommentSamplingPolicy"), "browse-flow contract must define comment sampling policy");
  assert(contract.includes("MetricsCollectionPolicy"), "browse-flow contract must define metrics collection policy");
  assert(contract.includes("CandidateCreationPolicy"), "browse-flow contract must define candidate creation policy");

  assert(law.includes("recommendation tuning marker"), "browse-flow law must define like/save as a recommendation tuning marker");
  assert(law.includes("The first AI question must default to governed multi-frame evidence rather than one opening screenshot."), "browse-flow law must require governed multi-frame evidence by default");
  assert(law.includes("Multi-frame product-presence must run as one governed AI task by default, not three independent AI calls."), "browse-flow law must forbid three independent AI calls as the default strategy");
  assert(law.includes("product_no_high_confidence must finalize into Browse Ledger by default."), "browse-flow law must route product_no to Browse Ledger by default");
  assert(law.includes("product_yes_high_confidence must finalize into Evidence Packet."), "browse-flow law must route product_yes to Evidence Packet by default");
  assert(!law.includes("Every round must finalize into an Evidence Packet or explicit failed packet before scroll next"), "browse-flow law must not require full Evidence Packets for every round");
  assert(law.includes("pending_analysis"), "browse-flow law must constrain candidate status to pending_analysis");
  assert(candidateSchema.includes('analysisStatus: z.literal("pending_analysis")'), "candidate schema must constrain analysisStatus to pending_analysis");

  assert(!/"test"\s*:|npm test|vitest|jest|playwright test/i.test(packageJson), "tests must not be part of the browse-flow acceptance gate");

  process.stdout.write("verify-browse-flow: PASS\n");
}

await main();