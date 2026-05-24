import { Node, SyntaxKind, type CallExpression, type SourceFile } from "ts-morph";

import {
  type AliasIndex,
  type ResolvedCall,
  registerIdentifierAlias,
  registerObjectBindingAliases,
  resolveConsoleCall,
  resolveEventFactoryCall,
  resolveRecoveryCall,
  resolveRuntimeEmitCall,
  resolveStageLifecycleCall,
} from "./ast-call-resolver-support.js";
import { getStaticMemberName } from "./ast-node-utils.js";

const createResolvedCall = (input: {
  filePath: string;
  line: number;
  kind: ResolvedCall["kind"];
  calleeText: string;
  symbolName: string | null;
  objectLiteralArg: ReturnType<typeof firstObjectArg>;
}): ResolvedCall => input;

const firstObjectArg = (call: CallExpression) => call.getArguments()[0]?.asKind(SyntaxKind.ObjectLiteralExpression);

const includesAny = (text: string, fragments: readonly string[]): boolean =>
  fragments.some((fragment) => text.includes(fragment));

const browserActionNames = new Set(["open", "evaluateActiveTab", "textInput", "scroll", "click", "fill", "upload"]);

const buildAliasIndex = (sourceFile: SourceFile): AliasIndex => {
  const index: AliasIndex = {
    consoleObjects: new Set(["console"]),
    consoleMethods: new Set(),
    runtimeLoggerObjects: new Set(),
    runtimeEmitMethods: new Set(),
    stageLoggerObjects: new Set(),
    stageHandleObjects: new Set(),
    stageStartMethods: new Set(),
    stageTerminalMethods: new Set(),
    recoveryLoggerObjects: new Set(),
  };

  for (const declaration of sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
    const nameNode = declaration.getNameNode();
    const initializer = declaration.getInitializer();
    if (Node.isIdentifier(nameNode)) {
      registerIdentifierAlias(index, nameNode.getText(), initializer);
    }
    registerObjectBindingAliases(index, nameNode, initializer);
  }

  return index;
};

const resolveSemanticFallbackCall = (
  filePath: string,
  line: number,
  calleeText: string,
  memberName: string | null,
  objectLiteralArg: ReturnType<typeof firstObjectArg>,
): ResolvedCall | null => {
  if (includesAny(calleeText, ["recoveryLogger", "Recovery"])) {
    return createResolvedCall({
      filePath,
      line,
      kind: "recovery-log",
      calleeText,
      symbolName: memberName,
      objectLiteralArg,
    });
  }
  if (includesAny(calleeText, ["AI_", "ai", "upload", "parse"])) {
    return createResolvedCall({
      filePath,
      line,
      kind: "ai-log",
      calleeText,
      symbolName: memberName,
      objectLiteralArg,
    });
  }
  if ((memberName !== null && browserActionNames.has(memberName)) || browserActionNames.has(calleeText)) {
    return createResolvedCall({
      filePath,
      line,
      kind: "browser-action-log",
      calleeText,
      symbolName: memberName,
      objectLiteralArg,
    });
  }
  return null;
};

const resolveCall = (filePath: string, call: CallExpression, index: AliasIndex): ResolvedCall => {
  const expression = call.getExpression();
  const calleeText = expression.getText();
  const objectLiteralArg = firstObjectArg(call);
  const line = call.getStartLineNumber();

  const resolved = resolveConsoleCall({ filePath, line, expression, calleeText, index, objectLiteralArg })
    ?? resolveRuntimeEmitCall({ filePath, line, expression, calleeText, index, objectLiteralArg })
    ?? resolveEventFactoryCall({ filePath, line, expression, calleeText, objectLiteralArg })
    ?? resolveStageLifecycleCall({ filePath, line, expression, calleeText, index, objectLiteralArg })
    ?? resolveRecoveryCall({ filePath, line, expression, calleeText, index, objectLiteralArg })
    ?? resolveSemanticFallbackCall(filePath, line, calleeText, getStaticMemberName(expression), objectLiteralArg);

  return resolved ?? createResolvedCall({
    filePath,
    line,
    kind: "unknown",
    calleeText,
    symbolName: getStaticMemberName(expression),
    objectLiteralArg,
  });
};

export const resolveCallsInSourceFile = (sourceFile: SourceFile, filePath: string): ResolvedCall[] => {
  const index = buildAliasIndex(sourceFile);
  const calls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).map((call) => resolveCall(filePath, call, index));

  for (const call of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    for (const argument of call.getArguments()) {
      if (!Node.isIdentifier(argument) && !Node.isPropertyAccessExpression(argument) && !Node.isElementAccessExpression(argument)) {
        continue;
      }
      const resolvedArgument = resolveConsoleCall({
        filePath,
        line: call.getStartLineNumber(),
        expression: argument,
        calleeText: argument.getText(),
        index,
        objectLiteralArg: undefined,
      });
      if (resolvedArgument) {
        calls.push(resolvedArgument);
      }
    }
  }

  return calls;
};
