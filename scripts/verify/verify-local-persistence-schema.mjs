import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function requireFile(relativePath) {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

async function listRepoFiles(rootDir, relativeDir = "") {
  const entries = await readdir(path.join(rootDir, relativeDir), { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const nextRelativePath = path.posix.join(relativeDir, entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", "dist", ".git", ".grasseye-data", ".grasseye-demo-data", ".grasseye-local"].includes(entry.name)) {
        continue;
      }

      files.push(...await listRepoFiles(rootDir, nextRelativePath));
      continue;
    }

    files.push(nextRelativePath);
  }

  return files;
}

async function main() {
  const [law, blueprint, typesFile, localDataLaw, evidencePacketLaw, structuredLoggingLaw, topologyLaw, auditLaw, gitignore, packageJson, phaseTodo, phaseReport, repoFiles] = await Promise.all([
    requireFile(".github/instructions/cursor-rules/modules/module-local-persistence-schema.instructions.md"),
    requireFile("docs/法案辅助文件/GrassEye 本地取证存储结构施工图.md"),
    requireFile("src/types/local-persistence.ts"),
    requireFile(".github/instructions/cursor-rules/modules/module-local-data.instructions.md"),
    requireFile(".github/instructions/cursor-rules/modules/module-evidence-packet.instructions.md"),
    requireFile(".github/instructions/cursor-rules/modules/module-structured-logging.instructions.md"),
    requireFile(".github/instructions/cursor-rules/modules/module-code-topology.instructions.md"),
    requireFile(".github/instructions/cursor-rules/modules/module-audit-system.instructions.md"),
    requireFile(".gitignore"),
    requireFile("package.json"),
    requireFile("docs/TODO/phase-03-TODO.md"),
    requireFile("docs/验收报告/phase-03-acceptance-report.md"),
    listRepoFiles(repoRoot),
  ]);

  assert(law.includes("Law GRASSEYE-LOCAL-PERSISTENCE-SCHEMA-001-V1"), "local-persistence-schema law must exist");
  assert(law.includes("Structured records must use local SQLite or equivalent governed local structured store."), "local-persistence law must require governed structured store");
  assert(law.includes("Large evidence artifacts must use governed evidence file store with storageRef in database."), "local-persistence law must require evidence file store refs");
  assert(law.includes(".grasseye-local must be gitignored."), "local-persistence law must require gitignored local root");
  assert(law.includes("Scattered JSON files as canonical persistence truth."), "local-persistence law must forbid scattered JSON truth");

  for (const requiredBlueprintMarker of [
    "GrassEye 本地取证存储结构施工图",
    ".grasseye-local/data/grasseye.sqlite",
    ".grasseye-local/evidence/video-frames",
    ".grasseye-local/evidence/contact-sheets",
    ".grasseye-local/evidence/comment-screenshots",
    ".grasseye-local/evidence/ocr-text",
    ".grasseye-local/exports/advanced-ai",
    ".grasseye-local/browser-profiles",
    "SQLite Structured Store",
    "Evidence File Store",
    "Export Store",
    "Browser Profile Store",
    "product_no 默认创建 evidence_packet",
  ]) {
    assert(blueprint.includes(requiredBlueprintMarker), `local-persistence blueprint is missing ${requiredBlueprintMarker}`);
  }

  for (const requiredTypeMarker of [
    "LocalPersistenceRootSchema",
    "LocalPersistencePathLayoutSchema",
    "LocalDatabaseTableNameSchema",
    "BrowseSessionRecordSchema",
    "VideoRoundRecordSchema",
    "StructuredRuntimeEventRecordSchema",
    "StructuredActionLogRecordSchema",
    "EvidenceRecordSchema",
    "MultiFrameEvidenceSetRecordSchema",
    "AIResultRecordSchema",
    "BrowseLedgerEntryRecordSchema",
    "EvidencePacketRecordSchema",
    "ProductCandidateRecordSchema",
    "ExportSetRecordSchema",
    "LocalPersistenceRelationshipMapSchema",
    "browse_sessions",
    "video_rounds",
    "structured_runtime_events",
    "structured_action_logs",
    "evidence_records",
    "multi_frame_evidence_sets",
    "ai_results",
    "browse_ledger_entries",
    "evidence_packets",
    "product_candidates",
    "export_sets",
    ".grasseye-local/data/grasseye.sqlite",
  ]) {
    assert(typesFile.includes(requiredTypeMarker), `local-persistence types are missing ${requiredTypeMarker}`);
  }

  assert(localDataLaw.includes("Local Data must follow the Local Persistence Schema."), "module-local-data must reference Local Persistence Schema");
  assert(evidencePacketLaw.includes("Evidence Packet must persist in the governed local persistence schema."), "module-evidence-packet must bind to local persistence schema");
  assert(structuredLoggingLaw.includes("Structured logs persist in structured_runtime_events and structured_action_logs"), "module-structured-logging must define persistence tables");
  assert(topologyLaw.includes("Local persistence schema types belong under src/types/local-persistence.ts."), "module-code-topology must place local-persistence types");
  assert(auditLaw.includes("Future local-persistence-schema enforcement must verify schema tables"), "module-audit-system must route future local-persistence enforcement");

  assert(gitignore.includes(".grasseye-local/"), ".gitignore must exclude the .grasseye-local root");
  assert(packageJson.includes('"verify:local-persistence-schema"'), "package.json must expose verify:local-persistence-schema");
  assert(packageJson.includes("verify:local-persistence-schema &&"), "phase or ci chain must invoke verify:local-persistence-schema");
  assert(phaseTodo.includes("Local Persistence Schema"), "phase-03 TODO must mention Local Persistence Schema");
  assert(phaseReport.includes("Local Persistence Schema law added"), "phase-03 acceptance report must mention Local Persistence Schema");
  assert(phaseReport.includes("SQLite structured store clarified"), "phase-03 acceptance report must mention SQLite structured store");
  assert(phaseReport.includes("evidence-store-service.ts 还需要真实实现 SQLite + evidence file store 写入"), "phase-03 acceptance report must keep the persistence implementation gap explicit");

  const forbiddenTests = repoFiles.filter((file) => /(^|\/)(tests|__tests__)\/|\.test\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(file));
  assert(forbiddenTests.length === 0, `local-persistence verification forbids repository test artifacts: ${forbiddenTests.join(", ")}`);

  for (const forbiddenSensitiveField of ["accessToken", "refreshToken", "sessionToken", "cookieValue", "cookies", "password", "storageState"]) {
    assert(!typesFile.includes(forbiddenSensitiveField), `local-persistence types must not persist ${forbiddenSensitiveField}`);
  }

  process.stdout.write("verify-local-persistence-schema: PASS\n");
}

await main();