import { Node, SyntaxKind, type ObjectLiteralExpression, type SourceFile } from "ts-morph";

import { astIdentifierName } from "../../shared/ast-node-identity.js";
import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";

export const createLocalFinding = (input: Parameters<typeof createFinding>[0]): InspectorFinding =>
  createFinding({ ...input, clauseId: input.clauseId ?? `${input.lawId.toLowerCase()}-requirement` });

export const lawPath = ".github/instructions/agent-rules/功能法案.md";
export const blueprintPath = "docs/blueprints/local-browser-session/LOCAL-BROWSER-SESSION-V5-OWNER-JOURNAL-BLUEPRINT.md";
export const targetAuthorityPath = "src/lib/browser/chrome-extension/extension-target-authority.ts";
export const brokerPath = "src/lib/browser/infrastructure/browser-authority-broker.ts";

export const sourcePaths = [
  "src/lib/browser/transport/browser-authority-websocket.ts",
  "src/lib/browser/chrome-extension/websocket-actor.ts",
  "src/lib/browser/chrome-extension/pairing-popup.ts",
  "src/lib/browser/infrastructure/browser-infrastructure-supervisor.ts",
  "src/lib/browser/exact-target/browser-session-workspace.ts",
  "src/lib/browser/exact-target/browser-target-lease-manager.ts",
  "src/lib/browser/exact-target/browser-command-actor.ts",
  "src/lib/browser/exact-target/browser-proof-journal.ts",
  "src/lib/browser/chrome-extension/command-registry.ts",
  "src/lib/local-runtime/workbench-browser-authority-support.ts",
  "src/lib/local-runtime/workbench-handle.ts",
  "src/app/workbench-api-boundary.ts",
  "src/app/create-workbench-server.ts",
  "src/app/app-shell/command-bar.ts",
  "src/app/workbench-home-client.ts",
  "scripts/acceptance/local-browser-terminal-contract.acceptance.ts",
  "scripts/acceptance/local-runtime-browser-authority.acceptance.ts",
  "scripts/acceptance/browser-extension-build.acceptance.ts",
  brokerPath,
  "src/lib/browser/chrome-extension/dom-intent-runtime.ts",
  "src/lib/browser/chrome-extension/websocket-actor-crypto.ts",
  "src/app/workbench-browser-websocket-upgrade.ts",
  "src/lib/browser/chrome-extension/extension-heartbeat.ts",
  "src/lib/browser/chrome-extension/pairing-completion-gate.ts",
  "scripts/acceptance/local-browser.real-chrome.ts",
] as const;

export const retiredPaths = [
  "src/lib/browser/chrome-extension/external-port-actor.ts",
  "src/lib/browser/transport/workbench-extension-channel.ts",
  "src/lib/browser/release/cws-extension-release-identity.ts",
  "src/lib/browser/release/cws-extension-release-policy.ts",
  "src/lib/browser/release/cws-extension-release-proof.ts",
  "src/lib/browser/release/browser-release-security-policy.schema.json",
] as const;

export const identifiers = (source: SourceFile): Set<string> =>
  new Set(source.getDescendantsOfKind(SyntaxKind.Identifier)
    .map(astIdentifierName)
    .filter((name): name is string => name !== undefined));

export const stringLiterals = (source: SourceFile): string[] => [
  ...source.getDescendantsOfKind(SyntaxKind.StringLiteral).map((node) => node.getLiteralValue()),
  ...source.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral).map((node) => node.getLiteralValue()),
];

export const requireSource = (
  context: InspectorContext,
  findings: InspectorFinding[],
  lawId: string,
  path: string,
): SourceFile | null => {
  const source = context.project.getSourceFile(resolveFromRepo(path));
  if (!source) findings.push(createLocalFinding({
    checkId: "browser-authority/terminal-authority",
    lawId,
    filePath: path,
    message: `${path} must exist in the ts-morph project.`,
  }));
  return source ?? null;
};

export const propertyValue = (object: ObjectLiteralExpression, name: string): string | boolean | null => {
  const property = object.getProperty(name);
  if (!property || !Node.isPropertyAssignment(property)) return null;
  const initializer = property.getInitializer();
  if (Node.isStringLiteral(initializer)) return initializer.getLiteralValue();
  if (initializer?.getKind() === SyntaxKind.TrueKeyword) return true;
  if (initializer?.getKind() === SyntaxKind.FalseKeyword) return false;
  return null;
};

export const requireIdentifiers = (
  source: SourceFile,
  required: readonly string[],
  findings: InspectorFinding[],
  lawId: string,
  message: string,
): void => {
  const present = identifiers(source);
  const missing = required.filter((name) => !present.has(name));
  if (missing.length === 0) return;
  findings.push(createLocalFinding({
    checkId: "browser-authority/terminal-authority",
    lawId,
    filePath: source.getFilePath().slice(resolveFromRepo("").length + 1),
    message: `${message} Missing AST symbols: ${missing.join(", ")}.`,
  }));
};
