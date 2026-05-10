import { pathFromRepoRoot } from "../../core/paths.js";
import { createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { Node, SyntaxKind } from "ts-morph";

import { forensicsPersistenceInspectionConstants } from "./inspection-constants.js";

const {
  ROOT,
  ROOT_MOCK_DIR,
  ROOT_RUNTIME_DIR,
  SHARED_STORE_ROOT,
} = forensicsPersistenceInspectionConstants;

const FORBIDDEN_LEGACY_IMPORT_MARKERS = [
  "/types/evidence-packet",
  "/types/platform-action",
  "/types/stored-ai-result",
  "/types/local-ai",
  "/types/task-run",
  "/types/runtime",
] as const;

const FORBIDDEN_ROOT_SYMBOLS = [
  "saveAiResult",
  "saveActionLog",
  "saveEvidencePacket",
  "saveAgentRound",
  "saveCandidate",
  "resetLocalStore",
  "getOperatorSnapshot",
  "setCandidateDisposition",
  "deleteCandidate",
] as const;

const REQUIRED_ENVELOPE_FIELDS = [
  "missionId",
  "runId",
  "sessionId",
  "roundId",
  "stepId",
  "capabilityCallId",
  "inputRefs",
  "outputRefs",
  "sourceRecordRefs",
  "parentRefs",
  "artifactRefs",
  "promptContractId",
  "actionRef",
  "postActionVerificationRef",
  "decisionRef",
  "schemaVersion",
  "integrityHash",
  "idempotencyKey",
] as const;

const REQUIRED_PROOF_FIELDS = [
  "missionId",
  "runId",
  "sessionId",
  "roundId",
  "stepId",
  "capabilityCallId",
  "inputRefs",
  "outputRefs",
  "inputRecordRefs",
  "outputRecordRefs",
  "parentRefs",
  "artifactRefs",
  "promptContractId",
  "actionRef",
  "postActionVerificationRef",
  "decisionRef",
  "integrityHash",
  "idempotencyKey",
  "failureReason",
] as const;

const FORBIDDEN_ROOT_DIRS = [ROOT_RUNTIME_DIR, ROOT_MOCK_DIR, SHARED_STORE_ROOT] as const;

export const forensicsP0CheckConstants = {
  FORBIDDEN_LEGACY_IMPORT_MARKERS,
  FORBIDDEN_ROOT_SYMBOLS,
  REQUIRED_ENVELOPE_FIELDS,
  REQUIRED_PROOF_FIELDS,
  FORBIDDEN_ROOT_DIRS,
} as const;

export const getForensicsSources = (project: import("ts-morph").Project) => (
  project.getSourceFiles(pathFromRepoRoot(`${ROOT}/**/*.ts`))
);

export const getObjectLiteralPropertyNames = (sourceFile: import("ts-morph").SourceFile, variableName: string): Set<string> => {
  const initializer = sourceFile.getVariableDeclarationOrThrow(variableName).getInitializerIfKindOrThrow(SyntaxKind.ObjectLiteralExpression);

  return new Set(
    initializer.getProperties().flatMap((property) => {
      if (Node.isPropertyAssignment(property) || Node.isShorthandPropertyAssignment(property)) {
        return [property.getName()];
      }

      return [];
    }),
  );
};

export const countOccurrences = (sourceText: string, needle: string): number => {
  if (needle.length === 0) {
    return 0;
  }

  return sourceText.split(needle).length - 1;
};

export const createDomainPhase = (name: string, lawIds: readonly string[], findings: Finding[], summary: { pass: string; fail: string }): InspectorPhase => {
  const passed = findings.every((finding) => !lawIds.includes(finding.lawId));
  return createPhase(name, passed ? "PASS" : "CODE VIOLATION", passed, passed ? summary.pass : summary.fail);
};