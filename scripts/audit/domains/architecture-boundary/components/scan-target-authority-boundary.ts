import { Node, SyntaxKind, type Project, type SourceFile } from "ts-morph";

import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath, listActiveSourceFiles } from "../../../shared/source-files.js";

const handoffPath = "src/lib/local-runtime/production/runtime-source-handoff.ts";
const handoffValidator = "assertV44SealedHandoff";
const retiredTargetTokens = [
  "expectedTargetRef", "BROWSER_OLD_TARGET_INSTANCE_UNAVAILABLE", "browser_target_claims",
  "readUnreleasedTargetClaims", "allDispatchedTargetsSettled", "assertHistoricalTargetClaimCoverage",
] as const;
const v44RejectedFields = [
  "old_target_ref_hash", "old_document_ref_hash", "old_path",
  "browser_target_settled", "target_settlement_hash",
] as const;

type Input = Readonly<{
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
  project: Project;
}>;

const push = (input: Input, checkId: string, filePath: string, evidence: string, message: string): void => {
  input.findings.push(createFinding({
    evidenceMode: "static.ast", checkId, lawId: input.lawId, filePath, evidence, message,
  }));
};

const occurrences = (text: string, token: string): number => text.split(token).length - 1;

/** The only legal home of a retired V44 field is a reject-only `Object.hasOwn` literal in the sealed-handoff validator. */
const rejectLiterals = (sourceFile: SourceFile): readonly string[] =>
  sourceFile.getVariableDeclaration(handoffValidator)
    ?.getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((call) => call.getExpression().getText() === "Object.hasOwn")
    .flatMap((call) => call.getArguments().slice(1))
    .filter(Node.isStringLiteral)
    .map((literal) => literal.getLiteralValue()) ?? [];

/** Retired Target recovery authority stays at zero in active src; only the V44 reject-only validator may name old fields. */
export const inspectTargetAuthorityBoundary = (input: Input): void => {
  let handoffRejected: readonly string[] = [];
  for (const sourceFile of listActiveSourceFiles(input.project)) {
    const filePath = getRepoSourcePath(sourceFile);
    if (!filePath.startsWith("src/")) continue;
    input.inspectedFiles.add(filePath);
    const text = sourceFile.getFullText();
    const rejected = filePath === handoffPath ? rejectLiterals(sourceFile) : [];
    if (filePath === handoffPath) handoffRejected = rejected;
    for (const token of [...retiredTargetTokens, ...v44RejectedFields]) {
      const allowed = rejected.filter((literal) => literal === token).length;
      if (occurrences(text, token) === allowed) continue;
      push(input, "architecture/target-retired-authority-resurrected", filePath, token,
        `${filePath} resurrects retired Target recovery authority token ${token}.`);
    }
  }
  for (const field of v44RejectedFields.filter((candidate) => !handoffRejected.includes(candidate))) {
    push(input, "architecture/target-v44-reject-missing", handoffPath, field,
      `${handoffPath} must keep ${handoffValidator} rejecting retired V44 source field ${field}.`);
  }
};
