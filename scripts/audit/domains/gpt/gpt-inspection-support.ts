import { Node, SyntaxKind, type SourceFile } from "ts-morph";
import { resolve } from "node:path";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";

export type FindingFactory = (
  checkId: string,
  filePath: string,
  message: string,
  line?: number,
) => InspectorFinding;

export const sourceFor = (context: InspectorContext, path: string): SourceFile | undefined =>
  context.project.getSourceFile(resolve(context.sealedRoot, path));

const readOnlyDomIntents = new Set([
  "document", "observe", "readExactAssistantTurn", "find", "inspect", "readAttribute", "readText",
]);

const isPageMutationCall = (call: import("ts-morph").CallExpression): boolean => {
  const expression = call.getExpression().getText();
  if (expression.endsWith(".attachFile")) return true;
  if (!expression.endsWith(".executeDomIntent")) return false;
  const argument = call.getArguments()[0];
  if (!Node.isObjectLiteralExpression(argument)) return true;
  const kind = argument.getProperty("kind");
  if (!Node.isPropertyAssignment(kind)) return true;
  const value = kind.getInitializer();
  return !(Node.isStringLiteral(value) || Node.isNoSubstitutionTemplateLiteral(value))
    || !readOnlyDomIntents.has(value.getLiteralValue());
};

export const containsPageMutation = (node: Node): boolean =>
  node.getDescendantsOfKind(SyntaxKind.CallExpression).some(isPageMutationCall);

const privateInfrastructurePath = /(?:^|[-_.])(?:database|sqlite|queue|worker|scheduler|ledger|housekeeping)(?:[-_.]|$)/iu;
const privateInfrastructureImports = new Set([
  "better-sqlite3", "bull", "bullmq", "node:fs", "node:fs/promises", "node:sqlite", "node:worker_threads", "sqlite3",
]);
const privateInfrastructureName = /(?:Database|Queue|Worker|Scheduler|Ledger|Housekeeping|EvidenceStore|MutationStore)$/u;

export const gptPrivateInfrastructureViolations = (source: SourceFile): string[] => {
  const path = source.getFilePath().split("\\").join("/");
  const leaf = path.split("/").at(-1) ?? path;
  const violations: string[] = [];
  if (privateInfrastructurePath.test(leaf)) violations.push(`path:${leaf}`);
  for (const declaration of source.getImportDeclarations()) {
    const target = declaration.getModuleSpecifierValue();
    if (privateInfrastructureImports.has(target)) {
      violations.push(`import:${target}`);
    }
  }
  const names = [
    ...source.getClasses().flatMap((entry) => entry.getName() ?? []),
    ...source.getFunctions().flatMap((entry) => entry.getName() ?? []),
    ...source.getInterfaces().map((entry) => entry.getName()),
    ...source.getTypeAliases().map((entry) => entry.getName()),
    ...source.getVariableDeclarations().map((entry) => entry.getName()),
  ];
  for (const name of names) if (privateInfrastructureName.test(name)) violations.push(`declaration:${name}`);
  return [...new Set(violations)].sort();
};
