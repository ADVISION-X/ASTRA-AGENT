import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const ignoredDirs = new Set([".git", "dist", "node_modules", ".grasseye-data"]);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function requireFile(relativePath) {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

async function scanForForbiddenTestFiles(rootDir, relativeDir = "") {
  const entries = await readdir(path.join(rootDir, relativeDir), { withFileTypes: true });
  const violations = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (ignoredDirs.has(entry.name)) {
        continue;
      }

      const relativePath = path.posix.join(relativeDir, entry.name);
      if (entry.name === "tests" || entry.name === "__tests__") {
        violations.push(relativePath);
        continue;
      }

      violations.push(...await scanForForbiddenTestFiles(rootDir, relativePath));
      continue;
    }

    if (/\.test\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(entry.name)) {
      violations.push(path.posix.join(relativeDir, entry.name));
    }
  }

  return violations;
}

async function main() {
  const [blueprint, law, typesFile, taskRunFile, actionLogFile, candidateFile, storeFile, finalizerFile, agentServiceFile, packageJson] = await Promise.all([
    requireFile("docs/法案辅助文件/GrassEye Agent 取证表单与高级AI投喂契约施工图.md"),
    requireFile(".github/instructions/cursor-rules/modules/module-evidence-packet.instructions.md"),
    requireFile("src/types/evidence-packet.ts"),
    requireFile("src/types/task-run.ts"),
    requireFile("src/types/platform-action.ts"),
    requireFile("src/types/product-opportunity.ts"),
    requireFile("src/features/local-data/evidence-store-service.ts"),
    requireFile("src/features/agent/agent-round-finalizer.ts"),
    requireFile("src/features/agent/agent-service.ts"),
    requireFile("package.json"),
  ]);

  assert(blueprint.includes("ProductDiscoveryEvidencePacket"), "evidence packet blueprint must define ProductDiscoveryEvidencePacket");
  assert(blueprint.includes("Browse Ledger"), "evidence packet blueprint must define Browse Ledger");
  assert(blueprint.includes("Advanced AI export set = Evidence Packets only by default."), "evidence packet blueprint must restrict the export set to Evidence Packets by default");
  assert(blueprint.includes("dataQualityFlags"), "evidence packet blueprint must define dataQualityFlags");
  assert(blueprint.includes("actionPurpose"), "evidence packet blueprint must define actionPurpose");
  assert(blueprint.includes("高级 AI 投喂边界"), "evidence packet blueprint must define the advanced AI handoff boundary");
  assert(blueprint.includes("multiFrameEvidenceSetId"), "evidence packet blueprint must define multiFrameEvidenceSetId");
  assert(blueprint.includes("contactSheetEvidenceId"), "evidence packet blueprint must define contactSheetEvidenceId");
  assert(blueprint.includes("samplingStrategy"), "evidence packet blueprint must define samplingStrategy");
  assert(blueprint.includes("validFrameCount"), "evidence packet blueprint must define validFrameCount");
  assert(blueprint.includes("frameLevelObservations"), "evidence packet blueprint must define frameLevelObservations");
  assert(blueprint.includes("aggregateReason"), "evidence packet blueprint must define aggregateReason");

  assert(law.includes("GRASSEYE-EVIDENCE-PACKET-001-V1"), "module-evidence-packet law must exist");
  assert(law.includes("Evidence Packet is the only standard handoff material for advanced AI analysis."), "evidence packet law must define the handoff authority");
  assert(law.includes("Browse Ledger is the default lightweight record for non-product and ordinary skipped rounds."), "evidence packet law must define Browse Ledger as the default non-product record");
  assert(law.includes("Product_no_high_confidence, duplicate, unstable, and ordinary skipped rounds must finalize into a lightweight Browse Ledger entry by default"), "evidence packet law must prevent full packets for ordinary non-product rounds");
  assert(law.includes("like or save marker must remain recommendation_tuning_marker"), "evidence packet law must preserve the marker interpretation boundary");
  assert(law.includes("views or likes must not be interpreted as sales"), "evidence packet law must forbid sales inference from views or likes");
  assert(law.includes("Evidence Packet videoEvidence must support multiFrameEvidenceSetId, sampled frames, contactSheetEvidenceId, samplingStrategy, and validFrameCount."), "evidence packet law must require multi-frame video evidence fields");
  assert(law.includes("productPresenceAI must record inputMode, sampledFrameCount, validFrameCount, frameLevelObservations, and aggregateReason."), "evidence packet law must require multi-frame AI fields");

  for (const marker of [
    "ProductDiscoveryEvidencePacketSchema",
    "BrowseLedgerEntrySchema",
    "RoundStructuralLogSchema",
    "BrowseSessionSummary",
    "BrowseSummarySchema",
    "AdvancedAIExportSetSchema",
    "EvidencePacketActionPurposeSchema",
    "EvidencePacketDataQualityFlagSchema",
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
  ]) {
    assert(typesFile.includes(marker), `evidence packet types must include ${marker}`);
  }

  for (const marker of ["videoVisitId", "packetId", "roundOutcome", "decisionReason", "nextStep"]) {
    assert(taskRunFile.includes(marker), `task-run round schema must include ${marker}`);
  }

  for (const marker of ["actionPurpose", "triggerSource", "beforeEvidenceId", "afterEvidenceId"]) {
    assert(actionLogFile.includes(marker), `action log schema must include ${marker}`);
  }

  assert(candidateFile.includes('analysisStatus: z.literal("pending_analysis")'), "candidate status must stay pending_analysis");
  for (const marker of ["browseLedgerEntries", "roundStructuralLogs", "advancedAiExports", "saveBrowseLedgerEntry", "saveRoundStructuralLog", "rebuildAdvancedAiExportSet"]) {
    assert(storeFile.includes(marker), `evidence store must persist ${marker}`);
  }
  for (const marker of ["finalizeRoundArtifacts", "finalArtifactKind", "advanced_product_research", "treat_like_as_purchase_intent"]) {
    assert(finalizerFile.includes(marker), `round finalizer must include ${marker}`);
  }
  for (const marker of ["multiFrameEvidenceSetId", "contactSheetEvidenceId", "samplingStrategy", "frameLevelObservations", "aggregateReason"]) {
    assert(finalizerFile.includes(marker), `round finalizer must persist ${marker}`);
  }
  for (const marker of ["finalizeRoundArtifacts", "comments_unavailable_candidate_created", "round.packetId", "round.roundOutcome", "round.decisionReason", "round.nextStep"]) {
    assert(agentServiceFile.includes(marker), `agent service must write ${marker}`);
  }
  assert(!/"test"\s*:/i.test(packageJson), "package.json must not define a test script");

  const forbiddenTests = await scanForForbiddenTestFiles(repoRoot);
  assert(forbiddenTests.length === 0, `forbidden test files detected: ${forbiddenTests.join(", ")}`);

  process.stdout.write("verify-evidence-packet: PASS\n");
}

await main();