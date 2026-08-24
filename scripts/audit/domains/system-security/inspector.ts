import { Node, SyntaxKind } from "ts-morph";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorOutput, SessionInspectorOutput } from "../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../shared/source-files.js";

const sensitiveNames = new Set(["authorization", "cookie", "credential", "password", "secret", "token"]);

const evaluate = (context: InspectorContext): Omit<InspectorOutput, "executedChecks"> => {
  const lawId = context.planEntry.lawIds[0]!;
  const findings: InspectorOutput["findings"] = [];
  const inspectedFiles: string[] = [];
  for (const source of context.project.getSourceFiles().filter((file) => !file.isDeclarationFile())) {
    const filePath = getRepoSourcePath(source);
    if (!filePath.startsWith("src/") && !filePath.startsWith("scripts/")) continue;
    inspectedFiles.push(filePath);
    for (const call of source.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const expression = call.getExpression();
      if (!Node.isPropertyAccessExpression(expression)) continue;
      const receiver = expression.getExpression();
      if (!Node.isIdentifier(receiver)) continue;
      const consoleSymbol = receiver.getSymbol();
      if (consoleSymbol?.getName() !== "console" || !consoleSymbol.getDeclarations().every((declaration) => declaration.getSourceFile().isDeclarationFile())) continue;
      const leaked = call.getArguments().flatMap((argument) => argument.getDescendantsOfKind(SyntaxKind.Identifier))
        .map((identifier) => identifier.getSymbol()?.getName().toLowerCase() ?? "")
        .find((name) => sensitiveNames.has(name));
      if (leaked) findings.push(createFinding({
        checkId: "system-security/sensitive-console-flow",
        lawId,
        filePath,
        line: call.getStartLineNumber(),
        message: `${filePath} sends sensitive identifier ${leaked} to console output.`,
      }));
    }
  }
  return { capabilityDomain: "system-security", reportedLawIds: context.planEntry.lawIds, findings, inspectedFiles };
};

export const inspectDomain = async (context: InspectorContext): Promise<SessionInspectorOutput> => {
  let evaluation: Omit<InspectorOutput, "executedChecks"> | undefined;
  await context.checks.runAll(async () => {
    evaluation = evaluate(context);
    return { findings: evaluation.findings, evidenceRefs: [context.planEntry.ownerInspectorPath, ...evaluation.inspectedFiles] };
  });
  return context.checks.output();
};
