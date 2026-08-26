import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { astIdentifierName } from "../../shared/ast-node-identity.js";
import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorFinding } from "../../shared/inspector-contracts.js";

type IngressIdentitySummary = {
  ingressIdentityViolations: number;
  perSiteHmacViolations: number;
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

const hasCallNamed = (file: SourceFile, callName: string): boolean =>
  file.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
    const expression = call.getExpression();
    return (Node.isIdentifier(expression) ? astIdentifierName(expression)
      : Node.isPropertyAccessExpression(expression) ? expression.getName() : undefined) === callName;
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
    input.findings.push(createFinding({ evidenceMode: "static.ast",
      checkId: "workbench-api-boundary/external-ingress-identity-required",
      lawId: input.lawId,
      filePath: input.boundaryPath,
      message: `External API Boundary must enforce ${token} before accepting external tasks.`,
    }));
  }
};

export const inspectPerSiteHmac = (input: {
  boundaryPath: string;
  file: SourceFile;
  findings: InspectorFinding[];
  lawId: string;
  summary: IngressIdentitySummary;
}): void => {
  const source = input.file.getFullText();
  const requiredTokens = [
    "GRASSEYE_EXTERNAL_SITE_HMAC_SECRETS",
    "x-grasseye-signature",
    "requiresSiteHmac",
  ] as const;
  const canonicalRequest = input.file.getDescendantsOfKind(SyntaxKind.VariableDeclaration)
    .find((declaration) => declaration.getName() === "canonicalRequest")?.getInitializer()?.getText() ?? "";
  const violations = [
    ...requiredTokens.filter((token) => !source.includes(token)).map((token) => `missing ${token}`),
    ...(["sourceSystem", "requestId", "routeRule.method", "routeRule.path"] as const)
      .filter((token) => !canonicalRequest.includes(token)).map((token) => `canonical request omits ${token}`),
    ...(!hasCallNamed(input.file, "createHmac") ? ["missing createHmac execution"] : []),
    ...(!hasCallNamed(input.file, "timingSafeEqual") ? ["missing timingSafeEqual execution"] : []),
    ...(source.includes("GRASSEYE_EXTERNAL_API_KEY") || source.includes("x-grasseye-agent-key")
      ? ["legacy global-key authentication remains"] : []),
  ];
  for (const message of violations) {
    input.summary.perSiteHmacViolations += 1;
    input.findings.push(createFinding({ evidenceMode: "static.ast",
      checkId: "workbench-api-boundary/per-site-hmac-required",
      lawId: input.lawId,
      filePath: input.boundaryPath,
      message: `External API Boundary per-site HMAC violation: ${message}.`,
    }));
  }
};
