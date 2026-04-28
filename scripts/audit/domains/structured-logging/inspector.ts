import { listFilesRecursive } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { createAuditProject, getSourceFileOrThrow, getZodObjectPropertyNames, hasAnyKeyword, hasCallExpression, hasConsoleLog, hasPropertyAccessPath } from "../_shared/ast-helpers.js";

const LAW_ID = "GRASSEYE-STRUCTURED-LOGGING-001-V1";
const TYPES_PATH = "src/types/structured-log.ts";
const RUNTIME_PROOF_SUPPORT_PATH = "src/lib/local-runtime/runtime-proof-support.ts";
const EVIDENCE_STORE_PATH = "src/lib/storage/evidence-store/evidence-store-service.ts";

export async function inspectStructuredLoggingBoundary(repoRoot = pathFromRepoRoot(".")): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> {
  const repoFiles = await listFilesRecursive(repoRoot, { ignoreDirs: ["node_modules", "dist", ".grasseye-data", ".grasseye-demo-data"] });
  const project = createAuditProject();
  const typesFile = getSourceFileOrThrow(project, TYPES_PATH);
  const runtimeProofSupport = getSourceFileOrThrow(project, RUNTIME_PROOF_SUPPORT_PATH);
  const evidenceStore = getSourceFileOrThrow(project, EVIDENCE_STORE_PATH);

  const findings: Finding[] = [];
  const governedPaths = ["src/features/local-data/", "src/lib/local-runtime/", "src/types/structured-log.ts"];
  const governedSourceFiles = repoFiles.filter(
    (file) => governedPaths.some((governedPath) => file === governedPath || file.startsWith(governedPath)) && /\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(file),
  );
  const forbiddenTests = repoFiles.filter((file) => /(^|\/)(tests|__tests__)\/|\.test\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(file));
  const runtimeEventFields = getZodObjectPropertyNames(typesFile, "StructuredRuntimeEventSchema");
  const actionLogFields = getZodObjectPropertyNames(typesFile, "StructuredActionLogSchema");
  const typesPassed = [
    runtimeEventFields.has("eventType"),
    runtimeEventFields.has("step"),
    runtimeEventFields.has("failureReason"),
    runtimeEventFields.has("reviewRequiredReason"),
    runtimeEventFields.has("evidenceRefs"),
    actionLogFields.has("actionPurpose"),
    actionLogFields.has("triggerSource"),
    actionLogFields.has("verificationResult"),
    actionLogFields.has("failureReason"),
    actionLogFields.has("reviewRequiredReason"),
    hasPropertyAccessPath(typesFile, ["z", "array"]),
  ].every(Boolean);
  if (!typesPassed) {
    findings.push(createFinding({
      lawId: LAW_ID,
      file: TYPES_PATH,
      line: 1,
      severity: "error",
      message: "Structured logging type contract is missing a required schema field or live-proof event type.",
    }));
  }

  if (hasAnyKeyword(typesFile)) {
    findings.push(createFinding({
      lawId: LAW_ID,
      file: TYPES_PATH,
      line: 1,
      severity: "error",
      message: "Structured logging types must not use any escape hatches.",
    }));
  }

  const saveStructuredRuntimeEventMethod = evidenceStore.getClass("EvidenceStoreService")?.getMethod("saveStructuredRuntimeEvent") ?? null;
  const saveStructuredActionLogMethod = evidenceStore.getClass("EvidenceStoreService")?.getMethod("saveStructuredActionLog") ?? null;
  const evidenceStorePassed = Boolean(
    saveStructuredRuntimeEventMethod
    && saveStructuredActionLogMethod
    && hasCallExpression(saveStructuredRuntimeEventMethod, "parse")
    && hasCallExpression(saveStructuredActionLogMethod, "parse")
    && hasPropertyAccessPath(saveStructuredRuntimeEventMethod, ["this", "stateStore", "write"])
    && hasPropertyAccessPath(saveStructuredActionLogMethod, ["this", "stateStore", "write"]),
  );
  if (!evidenceStorePassed) {
    findings.push(createFinding({
      lawId: LAW_ID,
      file: EVIDENCE_STORE_PATH,
      line: 1,
      severity: "error",
      message: "Evidence store must persist structured runtime events and structured action logs through governed save methods.",
    }));
  }

  const recordRoundLifecycleStepFunction = runtimeProofSupport.getFunction("recordRoundLifecycleStep") ?? null;
  const emitSupplementalRuntimeEventFunction = runtimeProofSupport.getFunction("emitSupplementalRuntimeEvent") ?? null;
  const runtimeProofSource = runtimeProofSupport.getFullText();
  const runtimeProofPassed = Boolean(
    recordRoundLifecycleStepFunction
    && emitSupplementalRuntimeEventFunction
    && hasPropertyAccessPath(recordRoundLifecycleStepFunction, ["input", "forensicsPersistenceAbilityGroup", "writeStructuredRuntimeEvent"])
    && hasPropertyAccessPath(recordRoundLifecycleStepFunction, ["input", "forensicsPersistenceAbilityGroup", "writeStructuredActionLog"])
    && hasPropertyAccessPath(emitSupplementalRuntimeEventFunction, ["input", "forensicsPersistenceAbilityGroup", "writeStructuredRuntimeEvent"])
    && runtimeProofSource.includes("sourceAbilityGroupId: \"agent-runtime\"")
    && runtimeProofSource.includes("actionPurpose: deriveRoundStepActionPurpose(input.step)"),
  );
  if (!runtimeProofPassed) {
    findings.push(createFinding({
      lawId: LAW_ID,
      file: RUNTIME_PROOF_SUPPORT_PATH,
      line: 1,
      severity: "error",
      message: "Runtime proof support must route browse-step proof through Forensics Persistence structured runtime and action log writes.",
    }));
  }

  for (const sourceFile of governedSourceFiles) {
    const source = project.getSourceFile(pathFromRepoRoot(sourceFile));
    if (source && hasConsoleLog(source)) {
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

  if (forbiddenTests.length > 0) {
    findings.push(createFinding({
      lawId: LAW_ID,
      file: forbiddenTests[0] ?? "tests",
      line: 1,
      severity: "fatal",
      message: "Structured logging governance forbids repository test artifacts as quality truth.",
    }));
  }

  return {
    findings,
    phases: [
      createPhase("structured-logging-types", typesPassed && !hasAnyKeyword(typesFile) ? "PASS" : "CODE VIOLATION", typesPassed && !hasAnyKeyword(typesFile), typesPassed && !hasAnyKeyword(typesFile) ? "Structured logging type contract defines runtime event and action-log schemas without escape hatches." : "Structured logging type contract is incomplete or uses escape hatches."),
      createPhase("structured-logging-persistence", evidenceStorePassed ? "PASS" : "CODE VIOLATION", evidenceStorePassed, evidenceStorePassed ? "Evidence store persists structured runtime events and structured action logs." : "Evidence store is missing governed structured-log persistence."),
      createPhase("structured-logging-runtime-calls", runtimeProofPassed ? "PASS" : "CODE VIOLATION", runtimeProofPassed, runtimeProofPassed ? "Runtime proof support emits structured runtime events and structured action logs through governed methods." : "Runtime proof support is missing governed structured-log calls."),
      createPhase("structured-logging-console-truth", findings.some((finding) => finding.message.includes("console.log as runtime truth")) ? "CODE VIOLATION" : "PASS", !findings.some((finding) => finding.message.includes("console.log as runtime truth")), !findings.some((finding) => finding.message.includes("console.log as runtime truth")) ? "Governed runtime truth surfaces do not rely on console.log." : "Governed runtime truth surfaces still rely on console.log."),
      createPhase("structured-logging-test-boundary", forbiddenTests.length === 0 ? "PASS" : "FAKE ENFORCEMENT", forbiddenTests.length === 0, forbiddenTests.length === 0 ? "Repository contains no tests, __tests__, or *.test.* artifacts." : "Repository contains forbidden test artifacts."),
    ],
  };
}