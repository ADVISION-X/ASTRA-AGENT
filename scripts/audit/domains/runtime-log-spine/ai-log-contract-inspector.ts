import { SyntaxKind, type SourceFile } from "ts-morph";

import { astIdentifierName } from "../../shared/ast-node-identity.js";
import type { InspectorContext } from "../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../shared/source-files.js";
import { RuntimeLogSpineLaw, type RuntimeLogSpineFinding } from "./constants.js";
import { hasRuntimeLogSignal } from "./runtime-log-scope.js";

const requiredAiTokens = [
  "providerKind",
  "modelName",
  "promptHash",
  "inputRefs",
  "expectedOutputSchemaRef",
  "timeoutMs",
  "rawOutputRef",
  "rawOutputHash",
  "parseStatus",
  "schemaValidationStatus",
] as const;

const aiSignals = ["ai", "provider", "feed", "prompt", "rawoutput", "parse"] as const;

const identifierNames = (sourceFile: SourceFile): string[] => sourceFile
  .getDescendantsOfKind(SyntaxKind.Identifier)
  .flatMap((identifier) => {
    const name = astIdentifierName(identifier);
    return name ? [name] : [];
  });

const isAiSourcePath = (repoPath: string): boolean => repoPath.startsWith("src/capabilities/ai-input-gateway/")
  || (repoPath.startsWith("src/plugins/") && repoPath.toLowerCase().includes("ai"));

const hasAiSignal = (names: readonly string[]): boolean => names.some((name) => {
  const normalized = name.toLowerCase();
  return aiSignals.some((signal) => normalized.includes(signal));
});

export const collectAiLogContractFindings = (context: InspectorContext): {
  findings: RuntimeLogSpineFinding[];
  inspectedFiles: string[];
} => {
  const findings: RuntimeLogSpineFinding[] = [];
  const inspectedFiles: string[] = [];
  for (const sourceFile of context.project.getSourceFiles()) {
    const repoPath = getRepoSourcePath(sourceFile);
    if (!isAiSourcePath(repoPath)) continue;
    const names = identifierNames(sourceFile);
    if (!hasAiSignal(names) || !hasRuntimeLogSignal(sourceFile, repoPath)) continue;
    inspectedFiles.push(repoPath);
    const nameSet = new Set(names);
    const missing = requiredAiTokens.filter((token) => !nameSet.has(token));
    if (missing.length === 0) continue;
    const firstSignal = sourceFile.getDescendantsOfKind(SyntaxKind.Identifier)
      .find((identifier) => hasAiSignal([astIdentifierName(identifier) ?? ""]));
    findings.push({
      checkId: "runtime-log-spine/ai-log-contract",
      lawId: RuntimeLogSpineLaw.AI_CONTRACT,
      file: repoPath,
      line: firstSignal?.getStartLineNumber() ?? 1,
      severity: "fatal",
      message: "AI request/response/parse path lacks required observability contract",
      hint: `Add AI_REQUEST/AI_UPLOAD/AI_RESPONSE/AI_PARSE logs with refs, hashes, parse status and provider proof. Missing: ${missing.join(", ")}.`,
    });
  }
  return { findings, inspectedFiles: inspectedFiles.sort() };
};
