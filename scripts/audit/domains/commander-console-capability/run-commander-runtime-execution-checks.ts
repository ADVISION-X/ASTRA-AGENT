import type { SourceFile } from "ts-morph";

import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { hasCallExpression } from "../_shared/ast-helpers.js";

import { commanderConsoleInspectionConstants } from "./inspection-constants.js";
import { commanderConsoleInspectionUtils } from "./inspection-utils.js";

const { CHILD_EXECUTORS_PATH, READ_CHILD_EXECUTOR_PATH } = commanderConsoleInspectionConstants;
const { countOccurrences } = commanderConsoleInspectionUtils;

type ChildExecutorCheckResult = {
  findings: Finding[];
  childExecutorReceiptCount: number;
};

const createFatalFinding = (lawId: string, file: string, message: string): Finding => createFinding({ lawId, file, line: 1, severity: "fatal", message });

const hasNamedImport = (sourceFile: SourceFile, moduleSuffix: string, importName: string) => {
  return sourceFile.getImportDeclarations().some((declaration) => {
    const specifier = declaration.getModuleSpecifierValue() ?? "";
    return specifier.endsWith(moduleSuffix)
      && declaration.getNamedImports().some((namedImport) => namedImport.getName() === importName);
  });
};

const hasReadRuntimeWiring = (sourceFile: SourceFile) => {
  return hasNamedImport(sourceFile, "commander-timeout-gate.js", "runCommanderTimeoutGate")
    && hasNamedImport(sourceFile, "commander-idempotency-gate.js", "runCommanderIdempotencyGate")
    && hasNamedImport(sourceFile, "commander-read-proof-gate.js", "applyCommanderReadProofGate")
    && hasCallExpression(sourceFile, "runCommanderTimeoutGate")
    && hasCallExpression(sourceFile, "runCommanderIdempotencyGate")
    && hasCallExpression(sourceFile, "applyCommanderReadProofGate")
    && sourceFile.getFullText().includes("timed-out-review-required");
};

function collectReadRuntimeFindings(sourceFile: SourceFile): Finding[] {
  return hasReadRuntimeWiring(sourceFile)
    ? []
    : [createFatalFinding("GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-003-V2", READ_CHILD_EXECUTOR_PATH, "Read execution must invoke timeout, idempotency, and read-proof gates.")];
}

function collectChildExecutorFindings(childExecutorsSource: SourceFile): ChildExecutorCheckResult {
  const childExecutorReceiptCount = countOccurrences(childExecutorsSource.getFullText(), "output: receipt,");
  const findings = childExecutorReceiptCount < 3 || !childExecutorsSource.getFullText().includes("hard-stop-dispatch-failed")
    ? [createFatalFinding("GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-007-V2", CHILD_EXECUTORS_PATH, "Commander child executors must emit governed command receipts on failure and preserve hard-stop/not-found policy decisions.")]
    : [];
  return { findings, childExecutorReceiptCount };
}

export { collectChildExecutorFindings, collectReadRuntimeFindings };
export type { ChildExecutorCheckResult };