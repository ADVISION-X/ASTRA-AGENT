import { listFilesRecursive, readTextFile } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase, finalizeInspectorResult } from "../../core/result.js";
import type { InspectorContext } from "../../core/schema.js";
import { runDomainOwnerInspection } from "../_shared/run-domain-owner-inspection.js";

const LAW_ID = "GRASSEYE-STRUCTURED-LOGGING-001-V1";
const LAW_PATH = ".github/instructions/cursor-rules/modules/module-structured-logging.instructions.md";
const BLUEPRINT_PATH = "docs/法案辅助文件/GrassEye 结构化日志与运行证明施工图.md";
const TYPES_PATH = "src/types/structured-log.ts";

const includesAll = (text: string, markers: string[]): boolean => markers.every((marker) => text.includes(marker));

export default async function inspectStructuredLogging(context: InspectorContext) {
  const base = await runDomainOwnerInspection(context, {
    capabilityDomain: "structured-logging",
    inspectorId: "structured-logging-owner",
    inspectorEntry: "scripts/audit/domains/structured-logging/inspector.ts",
  });

  const [law, blueprint, typesFile, repoFiles] = await Promise.all([
    readTextFile(pathFromRepoRoot(LAW_PATH)),
    readTextFile(pathFromRepoRoot(BLUEPRINT_PATH)),
    readTextFile(pathFromRepoRoot(TYPES_PATH)),
    listFilesRecursive(pathFromRepoRoot("."), { ignoreDirs: ["node_modules", "dist", ".grasseye-data", ".grasseye-demo-data"] }),
  ]);

  const findings = [...base.findings];
  const governedPaths = ["src/features/agent/", "src/features/local-data/", "src/lib/local-runtime/", "src/types/structured-log.ts"];
  const governedSourceFiles = repoFiles.filter(
    (file) => governedPaths.some((governedPath) => file === governedPath || file.startsWith(governedPath)) && /\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(file),
  );
  const consoleTruthFile = governedSourceFiles.find((file) => {
    const absolutePath = pathFromRepoRoot(file);
    return false;
  });
  void consoleTruthFile;

  const forbiddenTests = repoFiles.filter((file) => /(^|\/)(tests|__tests__)\/|\.test\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(file));

  const lawPassed = includesAll(law, [
    "StructuredRuntimeEvent",
    "StructuredActionLog",
    "console.log as runtime truth.",
    "Fake structured logs.",
    "Claiming live PASS without structured log sequence proof.",
  ]);
  if (!lawPassed) {
    findings.push(createFinding({
      lawId: LAW_ID,
      file: LAW_PATH,
      line: 1,
      severity: "error",
      message: "Structured logging law is missing a required runtime-truth or fake-log boundary.",
    }));
  }

  const blueprintPassed = includesAll(blueprint, [
    "StructuredRuntimeEvent",
    "StructuredActionLog",
    "open_target_page_completed",
    "next_video_wait_started",
    "Runtime snapshot 不得替代 StructuredRuntimeEvent 或 StructuredActionLog。",
    "fake PASS",
  ]);
  if (!blueprintPassed) {
    findings.push(createFinding({
      lawId: LAW_ID,
      file: BLUEPRINT_PATH,
      line: 1,
      severity: "error",
      message: "Structured logging blueprint is missing schema, live-proof, or snapshot-boundary requirements.",
    }));
  }

  const typesPassed = includesAll(typesFile, [
    "StructuredRuntimeEventSchema",
    "StructuredActionLogSchema",
    "actionPurpose",
    "failureReason",
    "reviewRequiredReason",
    "LiveProofLogSequence",
    "StructuredRuntimeEventTypeSchema",
    "evidenceRefs",
    "open_target_page_completed",
    "scroll_next_video_completed",
  ]);
  if (!typesPassed) {
    findings.push(createFinding({
      lawId: LAW_ID,
      file: TYPES_PATH,
      line: 1,
      severity: "error",
      message: "Structured logging type contract is missing a required schema field or live-proof event type.",
    }));
  }

  if (typesFile.includes(" as any")) {
    findings.push(createFinding({
      lawId: LAW_ID,
      file: TYPES_PATH,
      line: 1,
      severity: "error",
      message: "Structured logging types must not use any escape hatches.",
    }));
  }

  for (const sourceFile of governedSourceFiles) {
    const sourceText = await readTextFile(pathFromRepoRoot(sourceFile));
    if (sourceText.includes("console.log")) {
      findings.push(createFinding({
        lawId: LAW_ID,
        file: sourceFile,
        line: 1,
        severity: "error",
        message: "Governed structured-logging surfaces must not use console.log as runtime truth.",
      }));
      break;
    }
  }

  if (law.includes("fake PASS claims") === false && blueprint.includes("fake PASS") === false) {
    findings.push(createFinding({
      lawId: LAW_ID,
      file: LAW_PATH,
      line: 1,
      severity: "error",
      message: "Structured logging governance must explicitly forbid fake PASS claims.",
    }));
  }

  if (forbiddenTests.length > 0) {
    findings.push(createFinding({
      lawId: LAW_ID,
      file: forbiddenTests[0] ?? "tests",
      line: 1,
      severity: "fatal",
      message: "Structured logging governance forbids repository test artifacts as quality truth.",
    }));
  }

  return finalizeInspectorResult({
    inspector: "GrassEye Structured Logging Owner Inspector",
    inspectorId: "structured-logging-owner",
    capabilityDomain: "structured-logging",
    findings,
    phases: [
      ...base.phases,
      createPhase("structured-logging-law", lawPassed ? "PASS" : "CODE VIOLATION", lawPassed, lawPassed ? "Structured logging law defines runtime-truth boundaries and fake-log prohibitions." : "Structured logging law is missing required boundaries."),
      createPhase("structured-logging-blueprint", blueprintPassed ? "PASS" : "CODE VIOLATION", blueprintPassed, blueprintPassed ? "Structured logging blueprint defines schemas, live proof, and snapshot boundaries." : "Structured logging blueprint is incomplete."),
      createPhase("structured-logging-types", typesPassed && !typesFile.includes(" as any") ? "PASS" : "CODE VIOLATION", typesPassed && !typesFile.includes(" as any"), typesPassed && !typesFile.includes(" as any") ? "Structured logging type contract defines runtime events, action logs, and live-proof sequence." : "Structured logging type contract is incomplete or uses escape hatches."),
      createPhase("structured-logging-console-truth", findings.some((finding) => finding.message.includes("console.log as runtime truth")) ? "CODE VIOLATION" : "PASS", !findings.some((finding) => finding.message.includes("console.log as runtime truth")), !findings.some((finding) => finding.message.includes("console.log as runtime truth")) ? "Governed runtime truth surfaces do not rely on console.log." : "Governed runtime truth surfaces still rely on console.log."),
      createPhase("structured-logging-test-boundary", forbiddenTests.length === 0 ? "PASS" : "FAKE ENFORCEMENT", forbiddenTests.length === 0, forbiddenTests.length === 0 ? "Repository contains no tests, __tests__, or *.test.* artifacts." : "Repository contains forbidden test artifacts."),
    ],
    summary: findings.length === 0 ? "structured logging law, blueprint, type contract, and audit owner are present and bounded" : "structured logging governance is missing a required log-truth boundary or contract",
  });
}