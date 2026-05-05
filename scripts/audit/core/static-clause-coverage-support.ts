import path from "node:path";

import { Node, SyntaxKind, type Node as MorphNode, type ObjectLiteralExpression, type SourceFile } from "ts-morph";

import { fileExists, readJsonFile } from "./filesystem.js";
import { pathFromRepoRoot, toRepoRelativePath } from "./paths.js";

export type CommandStatus = {
  name: string;
  command: string;
  passed: boolean;
  exitCode: number | null;
  evidencePath: string;
};

export type GlobalChainStatus = {
  observed: boolean;
  passed: boolean;
  commands: CommandStatus[];
  blockers: string[];
};

export type SourceEvidence = {
  checkPhase: string;
  checkFunction: string;
  sourceFile: string;
  targetSymbol: string;
  checkKind: "required-shape" | "forbidden-shape" | "boundary-attack" | "anti-escape" | "runtime-proof";
};

type AuditSummaryEntry = {
  name: string;
  command?: string;
  exitCode: number;
  durationMs?: number;
};

const GLOBAL_CHAIN_COMMANDS = [
  { name: "typecheck", command: "npm run typecheck", evidencePath: "tmp/audit/ability-law-census/audit-runs/typecheck.txt" },
  { name: "lint", command: "npm run lint", evidencePath: "tmp/audit/ability-law-census/audit-runs/lint.txt" },
  { name: "audit:capability-group-governance", command: "npm run audit:capability-group-governance", evidencePath: "tmp/audit/ability-law-census/audit-runs/audit-capability-group-governance.txt" },
  { name: "audit", command: "npm run audit", evidencePath: "tmp/audit/ability-law-census/audit-runs/audit.txt" },
  { name: "ci:full", command: "npm run ci:full", evidencePath: "tmp/audit/ability-law-census/audit-runs/ci-full.txt" },
] as const;

const AUDIT_SUMMARY_PATH = pathFromRepoRoot("tmp/audit/ability-law-census/audit-runs/summary.json");

const createEmptyCommandStatus = (input: { name: string; command: string; evidencePath: string }): CommandStatus => ({
  name: input.name,
  command: input.command,
  passed: false,
  exitCode: null,
  evidencePath: input.evidencePath,
});

const normalizeAuditEntryName = (name: string): string => name.trim();

export const loadAuditSummary = async (): Promise<Map<string, AuditSummaryEntry>> => {
  if (!(await fileExists(AUDIT_SUMMARY_PATH))) {
    return new Map();
  }

  const entries = await readJsonFile<AuditSummaryEntry[]>(AUDIT_SUMMARY_PATH);
  return new Map(entries.map((entry) => [normalizeAuditEntryName(entry.name), entry]));
};

export const resolveCommandStatuses = async (): Promise<GlobalChainStatus> => {
  const summary = await loadAuditSummary();
  const commands = GLOBAL_CHAIN_COMMANDS.map((command) => {
    const entry = summary.get(command.name);
    return entry
      ? {
          name: command.name,
          command: entry.command ?? command.command,
          passed: entry.exitCode === 0,
          exitCode: entry.exitCode,
          evidencePath: command.evidencePath,
        }
      : createEmptyCommandStatus(command);
  });
  const blockers = commands.filter((command) => !command.passed).map((command) => `${command.name} failed or is missing fresh evidence.`);

  return {
    observed: commands.some((command) => command.exitCode !== null),
    passed: blockers.length === 0,
    commands,
    blockers,
  };
};

const inferCheckKind = (filePath: string): SourceEvidence["checkKind"] => {
  if (filePath.includes("required-shape")) {
    return "required-shape";
  }
  if (filePath.includes("forbidden-shape") || filePath.includes("runtime")) {
    return "forbidden-shape";
  }
  if (filePath.includes("boundary")) {
    return "boundary-attack";
  }
  if (filePath.includes("anti-escape") || filePath.includes("negative-proof")) {
    return "anti-escape";
  }

  return "runtime-proof";
};

const unwrapExpression = (node: MorphNode | undefined): MorphNode | undefined => {
  let current = node;
  while (current) {
    if (Node.isAsExpression(current) || Node.isParenthesizedExpression(current) || Node.isNonNullExpression(current)) {
      current = current.getExpression();
      continue;
    }

    const typeAssertion = current.asKind(SyntaxKind.TypeAssertionExpression);
    if (typeAssertion) {
      current = typeAssertion.getExpression();
      continue;
    }

    const satisfiesExpression = current.asKind(SyntaxKind.SatisfiesExpression);
    if (satisfiesExpression) {
      current = satisfiesExpression.getExpression();
      continue;
    }

    return current;
  }

  return undefined;
};

const getNodeKey = (node: MorphNode): string => `${node.getSourceFile().getFilePath()}:${node.getPos()}:${node.getKind()}`;

const resolveIdentifierInitializer = (node: MorphNode | undefined): MorphNode | undefined => {
  if (!node || !Node.isIdentifier(node)) {
    return undefined;
  }

  const symbol = node.getSymbol()?.getAliasedSymbol() ?? node.getSymbol();
  const declaration = symbol?.getDeclarations()[0];
  return Node.isVariableDeclaration(declaration) ? declaration.getInitializer() : undefined;
};

const getObjectLiteralPropertyInitializer = (
  objectLiteral: ObjectLiteralExpression,
  propertyName: string,
): MorphNode | undefined => {
  const property = objectLiteral.getProperty(propertyName);
  if (Node.isPropertyAssignment(property)) {
    return property.getInitializer();
  }
  if (Node.isShorthandPropertyAssignment(property)) {
    return property.getNameNode();
  }

  return undefined;
};

const resolveObjectLiteral = (
  node: MorphNode | undefined,
  seen: Set<string>,
): ObjectLiteralExpression | null => {
  const unwrapped = unwrapExpression(node);
  if (!unwrapped) {
    return null;
  }

  const nodeKey = getNodeKey(unwrapped);
  if (seen.has(nodeKey)) {
    return null;
  }

  if (Node.isObjectLiteralExpression(unwrapped)) {
    return unwrapped;
  }

  seen.add(nodeKey);
  return resolveObjectLiteral(resolveIdentifierInitializer(unwrapped), seen);
};

const resolveStringLiteral = (
  node: MorphNode | undefined,
  seen: Set<string> = new Set(),
): string | null => {
  const unwrapped = unwrapExpression(node);
  if (!unwrapped) {
    return null;
  }

  const nodeKey = getNodeKey(unwrapped);
  if (seen.has(nodeKey)) {
    return null;
  }
  seen.add(nodeKey);

  if (Node.isStringLiteral(unwrapped) || Node.isNoSubstitutionTemplateLiteral(unwrapped)) {
    return unwrapped.getLiteralText();
  }
  if (Node.isIdentifier(unwrapped)) {
    return resolveStringLiteral(resolveIdentifierInitializer(unwrapped), seen);
  }
  if (Node.isPropertyAccessExpression(unwrapped)) {
    const objectLiteral = resolveObjectLiteral(unwrapped.getExpression(), seen);
    if (!objectLiteral) {
      return null;
    }

    return resolveStringLiteral(getObjectLiteralPropertyInitializer(objectLiteral, unwrapped.getName()), seen);
  }
  if (Node.isElementAccessExpression(unwrapped)) {
    const propertyName = resolveStringLiteral(unwrapped.getArgumentExpression(), seen);
    if (!propertyName) {
      return null;
    }

    const objectLiteral = resolveObjectLiteral(unwrapped.getExpression(), seen);
    if (!objectLiteral) {
      return null;
    }

    return resolveStringLiteral(getObjectLiteralPropertyInitializer(objectLiteral, propertyName), seen);
  }

  return null;
};

const getEnclosingFunctionName = (node: MorphNode): string => {
  const functionNode = node.getFirstAncestor((ancestor) => {
    return Node.isFunctionDeclaration(ancestor)
      || Node.isMethodDeclaration(ancestor)
      || Node.isArrowFunction(ancestor)
      || Node.isFunctionExpression(ancestor);
  });
  if (!functionNode) {
    return "module-scope";
  }
  if (Node.isFunctionDeclaration(functionNode) || Node.isMethodDeclaration(functionNode)) {
    return functionNode.getName() ?? "anonymous";
  }
  const variableDeclaration = functionNode.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
  return variableDeclaration?.getName() ?? "anonymous";
};

const collectLawEvidence = (sourceFile: SourceFile): Map<string, SourceEvidence[]> => {
  const evidenceByLaw = new Map<string, SourceEvidence[]>();
  const sourcePath = toRepoRelativePath(sourceFile.getFilePath());

  for (const callExpression of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const expression = callExpression.getExpression();
    if (!Node.isIdentifier(expression) || expression.getText() !== "createFinding") {
      continue;
    }

    const [argument] = callExpression.getArguments();
    if (!argument || !Node.isObjectLiteralExpression(argument)) {
      continue;
    }

    const lawIdProperty = argument.getProperty("lawId");
    if (!lawIdProperty || !Node.isPropertyAssignment(lawIdProperty)) {
      continue;
    }

    const lawId = resolveStringLiteral(lawIdProperty.getInitializer());
    if (!lawId) {
      continue;
    }

    const evidence: SourceEvidence = {
      checkPhase: path.basename(sourcePath, ".ts"),
      checkFunction: getEnclosingFunctionName(callExpression),
      sourceFile: sourcePath,
      targetSymbol: getEnclosingFunctionName(callExpression),
      checkKind: inferCheckKind(sourcePath),
    };

    const existing = evidenceByLaw.get(lawId) ?? [];
    existing.push(evidence);
    evidenceByLaw.set(lawId, existing);
  }

  return evidenceByLaw;
};

export const mergeEvidenceMaps = (files: SourceFile[]): Map<string, SourceEvidence[]> => {
  const evidenceByLaw = new Map<string, SourceEvidence[]>();

  for (const sourceFile of files) {
    const fileEvidence = collectLawEvidence(sourceFile);
    for (const [lawId, evidence] of fileEvidence.entries()) {
      const existing = evidenceByLaw.get(lawId) ?? [];
      evidenceByLaw.set(lawId, [...existing, ...evidence]);
    }
  }

  return evidenceByLaw;
};