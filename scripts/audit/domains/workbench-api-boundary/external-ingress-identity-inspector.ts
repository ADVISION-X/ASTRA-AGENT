import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { astIdentifierName } from "../../shared/ast-node-identity.js";
import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorFinding } from "../../shared/inspector-contracts.js";

type IngressIdentitySummary = {
  ingressIdentityViolations: number;
};

const hasCallWithStringArgument = (file: SourceFile, callName: string, value: string): boolean =>
  file.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
    const expression = call.getExpression();
    const calledName = Node.isIdentifier(expression)
      ? astIdentifierName(expression)
      : Node.isPropertyAccessExpression(expression)
        ? expression.getName()
        : undefined;
    return calledName === callName
      && call.getArguments().some((argument) =>
        (Node.isStringLiteral(argument) || Node.isNoSubstitutionTemplateLiteral(argument))
        && argument.getLiteralText() === value,
      );
  });

export const inspectExternalIngressIdentity = (input: {
  boundaryPath: string;
  file: SourceFile;
  findings: InspectorFinding[];
  lawId: string;
  summary: IngressIdentitySummary;
}): void => {
  const requiredTokens = [
    "x-grasseye-source-system",
    "missing_source_system",
    "x-grasseye-request-id",
    "missing_request_id",
  ] as const;
  for (const token of requiredTokens) {
    if (hasCallWithStringArgument(input.file, "readHeader", token) || hasCallWithStringArgument(input.file, "block", token)) {
      continue;
    }
    input.summary.ingressIdentityViolations += 1;
    input.findings.push(createFinding({
      checkId: "workbench-api-boundary/external-ingress-identity-required",
      lawId: input.lawId,
      filePath: input.boundaryPath,
      message: `External API Boundary must enforce ${token} before accepting external tasks.`,
    }));
  }
};
