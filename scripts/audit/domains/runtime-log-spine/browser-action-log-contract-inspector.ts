import {
  Node,
  SyntaxKind,
  type CallExpression,
  type MethodDeclaration,
  type Node as MorphNode,
  type ObjectLiteralExpression,
  type SourceFile,
  type Symbol as MorphSymbol,
} from "ts-morph";

import type { InspectorContext } from "../../shared/inspector-contracts.js";
import { astIdentifierName } from "../../shared/ast-node-identity.js";
import { toRepoPath } from "../../shared/paths.js";
import { RuntimeLogSpineLaw, type RuntimeLogSpineFinding } from "./constants.js";

const actorPath = "src/lib/browser/exact-target/browser-command-actor.ts";
const helperPath = "src/lib/browser/exact-target/browser-command-runtime-logging.ts";
const supervisorPath = "src/lib/browser/infrastructure/browser-infrastructure-supervisor.ts";
const browserSupportPath = "src/lib/local-runtime/workbench-browser-authority-support.ts";
const assemblyPath = "src/lib/local-runtime/workbench-assembly.ts";

const declarationName = (symbol: MorphSymbol | undefined): string | null => {
  const target = symbol?.getAliasedSymbol() ?? symbol;
  return target?.getName() ?? null;
};

const source = (context: InspectorContext, path: string): SourceFile | undefined =>
  context.project.getSourceFiles().find((file) => toRepoPath(file.getFilePath()) === path);

const propertyValue = (
  object: ObjectLiteralExpression,
  name: string,
): MorphNode | undefined => {
  const property = object.getProperties().find((item) =>
    (Node.isPropertyAssignment(item) || Node.isShorthandPropertyAssignment(item))
    && item.getName() === name);
  if (Node.isPropertyAssignment(property)) return property.getInitializer();
  return Node.isShorthandPropertyAssignment(property) ? property.getNameNode() : undefined;
};

const sameBinding = (left: MorphNode | undefined, right: MorphNode): boolean => {
  if (!left) return false;
  if (Node.isIdentifier(left) && Node.isIdentifier(right)) {
    const leftTarget = left.getSymbol()?.getAliasedSymbol() ?? left.getSymbol();
    const rightTarget = right.getSymbol()?.getAliasedSymbol() ?? right.getSymbol();
    const rightDeclarations = new Set(rightTarget?.getDeclarations() ?? []);
    return (leftTarget?.getDeclarations() ?? []).some((declaration) =>
      rightDeclarations.has(declaration));
  }
  return left.getSourceFile() === right.getSourceFile() && left.getStart() === right.getStart();
};

const helperCall = (
  method: MethodDeclaration,
  name: string,
): CallExpression | undefined => method.getDescendantsOfKind(SyntaxKind.CallExpression)
  .find((call) => declarationName(call.getExpression().getSymbol()) === name);

const callBindsPermit = (
  call: CallExpression | undefined,
  permit: MorphNode,
): boolean => {
  const input = call?.getArguments()[0];
  return Node.isObjectLiteralExpression(input)
    && sameBinding(propertyValue(input, "permit"), permit);
};

const helperEventNames = (file: SourceFile): Set<string> => new Set(
  file.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
    .filter((access) => Node.isIdentifier(access.getExpression())
      && astIdentifierName(access.getExpression()) === "RuntimeLogEventType")
    .map((access) => access.getName()),
);

const helperPayloadFields = (file: SourceFile): Set<string> => new Set(
  file.getDescendantsOfKind(SyntaxKind.PropertyAssignment).map((property) => property.getName()),
);

const actorContractMissing = (
  actor: SourceFile | undefined,
  helper: SourceFile | undefined,
): string[] => {
  const missing: string[] = [];
  const actorClass = actor?.getClass("BrowserCommandActor");
  const execute = actorClass?.getMethod("execute");
  const permit = execute?.getParameters()[0];
  if (!actorClass || !execute || !permit) return ["BrowserCommandActor.execute"];
  if (!actorClass.getConstructors()[0]?.getParameters().some((parameter) =>
    parameter.getName() === "runtimeLogger")) missing.push("runtimeLogger injection");
  for (const name of [
    "emitBrowserCommandStarted",
    "emitBrowserCommandCompleted",
    "emitBrowserCommandFailed",
  ]) {
    if (!callBindsPermit(helperCall(execute, name), permit.getNameNode())) {
      missing.push(`${name}:same permit binding`);
    }
  }
  if (!helper) return [...missing, "browser command runtime logging helper"];
  const eventNames = helperEventNames(helper);
  for (const name of [
    "BROWSER_ACTION_STARTED",
    "BROWSER_ACTION_COMPLETED",
    "BROWSER_ACTION_FAILED",
  ]) if (!eventNames.has(name)) missing.push(`event:${name}`);
  const payloadFields = helperPayloadFields(helper);
  for (const name of [
    "capabilityCallId",
    "beforeHash",
    "afterHash",
    "durationMs",
    "actionResult",
    "failureClass",
    "fallbackUsed",
  ]) if (!payloadFields.has(name)) missing.push(`field:${name}`);
  return missing;
};

const callHasIdentifierArgument = (
  file: SourceFile | undefined,
  calleeName: string,
  argumentName: string,
): boolean => file?.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) =>
  declarationName(call.getExpression().getSymbol()) === calleeName
  && call.getArguments().some((argument) =>
    Node.isIdentifier(argument) && astIdentifierName(argument) === argumentName)) ?? false;

const wiringMissing = (
  supervisor: SourceFile | undefined,
  support: SourceFile | undefined,
  assembly: SourceFile | undefined,
): string[] => {
  const missing: string[] = [];
  const actorConstruction = supervisor?.getDescendantsOfKind(SyntaxKind.NewExpression)
    .find((entry) => Node.isIdentifier(entry.getExpression())
      && astIdentifierName(entry.getExpression()) === "BrowserCommandActor");
  if (!actorConstruction?.getArguments().some((argument) =>
    Node.isPropertyAccessExpression(argument)
    && argument.getName() === "runtimeLogger")) missing.push("supervisor -> actor runtimeLogger");
  const supervisorConstruction = support?.getDescendantsOfKind(SyntaxKind.NewExpression)
    .find((entry) => Node.isIdentifier(entry.getExpression())
      && astIdentifierName(entry.getExpression()) === "BrowserInfrastructureSupervisor");
  const supervisorInput = supervisorConstruction?.getArguments()[0];
  if (!Node.isObjectLiteralExpression(supervisorInput)
    || !propertyValue(supervisorInput, "runtimeLogger")) {
    missing.push("browser support -> supervisor runtimeLogger");
  }
  if (!callHasIdentifierArgument(assembly, "createWorkbenchBrowserAuthority", "runtimeLogger")) {
    missing.push("assembly -> browser support runtimeLogger");
  }
  return missing;
};

export const collectBrowserActionLogContractFindings = (context: InspectorContext): {
  findings: RuntimeLogSpineFinding[];
  inspectedFiles: string[];
} => {
  const missing = [
    ...actorContractMissing(source(context, actorPath), source(context, helperPath)),
    ...wiringMissing(
      source(context, supervisorPath),
      source(context, browserSupportPath),
      source(context, assemblyPath),
    ),
  ];
  return {
    inspectedFiles: [actorPath, helperPath, supervisorPath, browserSupportPath, assemblyPath],
    findings: missing.length === 0 ? [] : [{
      checkId: "runtime-log-spine/browser-action-log-contract",
      lawId: RuntimeLogSpineLaw.BROWSER_ACTION_CONTRACT,
      file: actorPath,
      line: 1,
      severity: "fatal",
      message: "BrowserCommandActor lacks the single correlated started/terminal Runtime Log Spine contract",
      hint: `The current command permit must bind the injected logger and all terminal fields. Missing: ${missing.join(", ")}.`,
    }],
  };
};
