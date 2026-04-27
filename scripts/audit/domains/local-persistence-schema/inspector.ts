import { listFilesRecursive, readTextFile } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase, finalizeInspectorResult } from "../../core/result.js";
import type { InspectorContext } from "../../core/schema.js";
import { runDomainOwnerInspection } from "../_shared/run-domain-owner-inspection.js";

const LAW_ID = "GRASSEYE-LOCAL-PERSISTENCE-SCHEMA-001-V1";
const LAW_PATH = ".github/instructions/cursor-rules/modules/module-local-persistence-schema.instructions.md";
const BLUEPRINT_PATH = "docs/法案辅助文件/GrassEye 本地取证存储结构施工图.md";
const TYPES_PATH = "src/types/local-persistence.ts";
const GITIGNORE_PATH = ".gitignore";

const includesAll = (text: string, markers: string[]): boolean => markers.every((marker) => text.includes(marker));

export default async function inspectLocalPersistenceSchema(context: InspectorContext) {
  const base = await runDomainOwnerInspection(context, {
    capabilityDomain: "local-persistence-schema",
    inspectorId: "local-persistence-schema-owner",
    inspectorEntry: "scripts/audit/domains/local-persistence-schema/inspector.ts",
  });

  const [law, blueprint, typesFile, gitignore, repoFiles] = await Promise.all([
    readTextFile(pathFromRepoRoot(LAW_PATH)),
    readTextFile(pathFromRepoRoot(BLUEPRINT_PATH)),
    readTextFile(pathFromRepoRoot(TYPES_PATH)),
    readTextFile(pathFromRepoRoot(GITIGNORE_PATH)),
    listFilesRecursive(pathFromRepoRoot("."), { ignoreDirs: ["node_modules", "dist", ".git", ".grasseye-data", ".grasseye-demo-data", ".grasseye-local"] }),
  ]);

  const findings = [...base.findings];
  const forbiddenTests = repoFiles.filter((file) => /(^|\/)(tests|__tests__)\/|\.test\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(file));

  const lawPassed = includesAll(law, [
    "Structured records must use local SQLite or equivalent governed local structured store.",
    "Large evidence artifacts must use governed evidence file store with storageRef in database.",
    ".grasseye-local must be gitignored.",
    "Scattered JSON files as canonical persistence truth.",
    "Cookies / session / token / passwords in any persistence table.",
  ]);
  if (!lawPassed) {
    findings.push(createFinding({
      lawId: LAW_ID,
      file: LAW_PATH,
      line: 1,
      severity: "error",
      message: "Local persistence schema law is missing a required storage or privacy boundary.",
    }));
  }

  const blueprintPassed = includesAll(blueprint, [
    ".grasseye-local/data/grasseye.sqlite",
    ".grasseye-local/evidence/video-frames",
    ".grasseye-local/evidence/contact-sheets",
    ".grasseye-local/evidence/comment-screenshots",
    ".grasseye-local/evidence/ocr-text",
    ".grasseye-local/exports/advanced-ai",
    ".grasseye-local/browser-profiles",
    "SQLite Structured Store",
    "Evidence File Store",
    "Browser Profile Store",
    "product_no 默认创建 evidence_packet",
  ]);
  if (!blueprintPassed) {
    findings.push(createFinding({
      lawId: LAW_ID,
      file: BLUEPRINT_PATH,
      line: 1,
      severity: "error",
      message: "Local persistence blueprint is missing a required store layout, directory, or product_no boundary.",
    }));
  }

  const typesPassed = includesAll(typesFile, [
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
  ]);
  if (!typesPassed) {
    findings.push(createFinding({
      lawId: LAW_ID,
      file: TYPES_PATH,
      line: 1,
      severity: "error",
      message: "Local persistence types are missing required table or relationship contracts.",
    }));
  }

  if (typesFile.includes(" as any")) {
    findings.push(createFinding({
      lawId: LAW_ID,
      file: TYPES_PATH,
      line: 1,
      severity: "error",
      message: "Local persistence types must not use any escape hatches.",
    }));
  }

  for (const forbiddenSensitiveField of ["accessToken", "refreshToken", "sessionToken", "cookieValue", "cookies", "password", "storageState"]) {
    if (typesFile.includes(forbiddenSensitiveField)) {
      findings.push(createFinding({
        lawId: LAW_ID,
        file: TYPES_PATH,
        line: 1,
        severity: "error",
        message: `Local persistence types must not persist ${forbiddenSensitiveField}.`,
      }));
      break;
    }
  }

  if (!gitignore.includes(".grasseye-local/")) {
    findings.push(createFinding({
      lawId: LAW_ID,
      file: GITIGNORE_PATH,
      line: 1,
      severity: "error",
      message: ".gitignore must exclude the .grasseye-local root.",
    }));
  }

  if (forbiddenTests.length > 0) {
    findings.push(createFinding({
      lawId: LAW_ID,
      file: forbiddenTests[0] ?? "tests",
      line: 1,
      severity: "fatal",
      message: "Local persistence schema governance forbids repository test artifacts as quality truth.",
    }));
  }

  return finalizeInspectorResult({
    inspector: "GrassEye Local Persistence Schema Owner Inspector",
    inspectorId: "local-persistence-schema-owner",
    capabilityDomain: "local-persistence-schema",
    findings,
    phases: [
      ...base.phases,
      createPhase("local-persistence-law", lawPassed ? "PASS" : "CODE VIOLATION", lawPassed, lawPassed ? "Local persistence law defines structured-store, evidence-store, and privacy boundaries." : "Local persistence law is missing required storage boundaries."),
      createPhase("local-persistence-blueprint", blueprintPassed ? "PASS" : "CODE VIOLATION", blueprintPassed, blueprintPassed ? "Blueprint defines .grasseye-local layout, evidence directories, and packet-vs-ledger boundaries." : "Blueprint is missing required layout or relationship anchors."),
      createPhase("local-persistence-types", typesPassed && !typesFile.includes(" as any") ? "PASS" : "CODE VIOLATION", typesPassed && !typesFile.includes(" as any"), typesPassed && !typesFile.includes(" as any") ? "Type contract defines tables, path layout, and relationship map without escape hatches." : "Type contract is incomplete or uses escape hatches."),
      createPhase("local-persistence-root-ignore", gitignore.includes(".grasseye-local/") ? "PASS" : "CODE VIOLATION", gitignore.includes(".grasseye-local/"), gitignore.includes(".grasseye-local/") ? ".grasseye-local root is gitignored." : ".grasseye-local root is not gitignored."),
      createPhase("local-persistence-test-boundary", forbiddenTests.length === 0 ? "PASS" : "FAKE ENFORCEMENT", forbiddenTests.length === 0, forbiddenTests.length === 0 ? "Repository contains no tests, __tests__, or *.test.* artifacts." : "Repository contains forbidden test artifacts."),
    ],
    summary: findings.length === 0 ? "local persistence schema law, blueprint, type contract, and audit owner are present and bounded" : "local persistence schema governance is missing a required storage boundary or contract",
  });
}