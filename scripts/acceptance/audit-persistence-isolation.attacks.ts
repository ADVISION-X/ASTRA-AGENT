import assert from "node:assert/strict";

import { Node, Project, SyntaxKind, type SourceFile } from "ts-morph";

import { loadGeneratedAuditPlan } from "../audit/core/load-audit-plan.js";
import { inspectAcceptanceDeliveryIsolation } from "../audit/domains/audit-system/acceptance-delivery-isolation-inspector.js";
import { createInspectorCheckSession } from "../audit/shared/inspector-check-session.js";
import type { InspectorContext } from "../audit/shared/inspector-contracts.js";
import { resolveFromRepo } from "../audit/shared/paths.js";

const fixturePath = "scripts/acceptance/media-processing-task-persistence.acceptance.ts";
const attackProject = new Project({ tsConfigFilePath: resolveFromRepo("tsconfig.json") });

const resetAttackProject = (): Project => {
  attackProject.getSourceFileOrThrow(resolveFromRepo(fixturePath)).refreshFromFileSystemSync();
  return attackProject;
};

const buildContext = (project: Project): InspectorContext => {
  const generatedPlan = loadGeneratedAuditPlan();
  const planEntry = generatedPlan.find((entry) => entry.capabilityDomain === "audit-system");
  if (!planEntry) throw new Error("audit-system plan entry is missing.");
  return {
    checks: createInspectorCheckSession(planEntry, "acceptance-run:audit-persistence-isolation").checks,
    completedReports: {}, generatedPlan, planEntry, project,
  };
};

const hasPersistenceFinding = (project: Project): boolean => {
  const result = inspectAcceptanceDeliveryIsolation(buildContext(project), "APEX-AUDIT-005-V1");
  return result.findings.some((finding) => finding.filePath === fixturePath
    && finding.message.includes("Media persistence acceptance"));
};

const assertAttackRejected = (mutate: (source: SourceFile) => void, label: string): void => {
  const project = resetAttackProject();
  mutate(project.getSourceFileOrThrow(resolveFromRepo(fixturePath)));
  assert.equal(hasPersistenceFinding(project), true, `persistence isolation must reject ${label}.`);
};

const callNamed = (source: SourceFile, name: string) =>
  source.getDescendantsOfKind(SyntaxKind.CallExpression).find((call) => {
    const expression = call.getExpression();
    return Node.isIdentifier(expression) && expression.getText() === name;
  });

const persistenceVariable = (source: SourceFile, scenarioName: string, variableName: string) =>
  source.getDescendantsOfKind(SyntaxKind.VariableDeclaration).find((declaration) => {
    if (declaration.getName() !== variableName) return false;
    const scope = declaration.getFirstAncestorByKind(SyntaxKind.ArrowFunction);
    return scope?.getParentIfKind(SyntaxKind.VariableDeclaration)?.getName() === scenarioName;
  });

const runRootAttacks = (): void => {
  assertAttackRejected((source) => {
    const handler = callNamed(source, "handleMediaProcessingRequest");
    if (!handler) throw new Error("persistence handler fixture is missing.");
    handler.removeArgument(3);
  }, "a production handler without an injected delivery directory");
  assertAttackRejected((source) => {
    const cleanup = source.getDescendantsOfKind(SyntaxKind.CallExpression).find((call) =>
      Node.isIdentifier(call.getExpression()) && call.getExpression().getText() === "rm"
      && Node.isIdentifier(call.getArguments()[0]) && call.getArguments()[0]?.getText() === "acceptanceRoot");
    cleanup?.getFirstAncestorByKindOrThrow(SyntaxKind.ExpressionStatement).remove();
  }, "a persistence suite without root-level terminal cleanup");
  assertAttackRejected((source) => {
    persistenceVariable(source, "runInitialSnapshotFailureAcceptance", "dataDir")
      ?.getInitializerOrThrow().replaceWithText('path.join(tmpdir(), "escaped-persistence-data")');
  }, "a persistence dataDir escaping the governed root");
  assertAttackRejected((source) => {
    persistenceVariable(source, "runDownloadsCopyFailureAcceptance", "outsideArtifactPath")
      ?.getInitializerOrThrow().replaceWithText('path.join(tmpdir(), "escaped-artifact.webp")');
  }, "an outside artifact escaping the governed root");
  assertAttackRejected((source) => {
    const boundary = source.getVariableDeclarationOrThrow("acceptanceRoot")
      .getVariableStatementOrThrow().getNextSiblingIfKindOrThrow(SyntaxKind.TryStatement);
    boundary.getTryBlock().insertStatements(0,
      'const secondRoot = await mkdtemp(path.join(tmpdir(), "grasseye-second-persistence-")); void secondRoot;');
  }, "a second persistence mkdtemp root");
  assertAttackRejected((source) => {
    const invocation = callNamed(source, "runInitialSnapshotFailureAcceptance");
    const statement = invocation?.getFirstAncestorByKind(SyntaxKind.ExpressionStatement);
    if (!statement) throw new Error("persistence scenario invocation fixture is missing.");
    statement.replaceWithText(`if (false) { ${statement.getText()} }`);
  }, "a persistence scenario invoked only in an unreachable branch");
  assertAttackRejected((source) => {
    const invocation = callNamed(source, "runInitialSnapshotFailureAcceptance");
    const statement = invocation?.getFirstAncestorByKind(SyntaxKind.ExpressionStatement);
    if (!statement) throw new Error("persistence scenario invocation fixture is missing.");
    statement.replaceWithText(`throw new Error("stop before scenario"); ${statement.getText()}`);
  }, "a persistence scenario placed after an unconditional throw");
};

const runExecutionAttacks = (): void => {
  assertAttackRejected((source) => {
    const withServer = source.getVariableDeclarationOrThrow("withServer")
      .getInitializerIfKindOrThrow(SyntaxKind.ArrowFunction);
    const runCall = withServer.getDescendantsOfKind(SyntaxKind.CallExpression).find((call) =>
      Node.isIdentifier(call.getExpression()) && call.getExpression().getText() === "run");
    const statement = runCall?.getFirstAncestorByKind(SyntaxKind.ReturnStatement);
    if (!statement) throw new Error("persistence server run fixture is missing.");
    statement.replaceWithText(`if (false) { ${statement.getText()} } return undefined as T;`);
  }, "a persistence server callback executed only in an unreachable branch");
  assertAttackRejected((source) => {
    const withServer = source.getVariableDeclarationOrThrow("withServer")
      .getInitializerIfKindOrThrow(SyntaxKind.ArrowFunction);
    const runCall = withServer.getDescendantsOfKind(SyntaxKind.CallExpression).find((call) =>
      Node.isIdentifier(call.getExpression()) && call.getExpression().getText() === "run");
    const statement = runCall?.getFirstAncestorByKind(SyntaxKind.ReturnStatement);
    if (!statement) throw new Error("persistence server run fixture is missing.");
    statement.replaceWithText(`throw new Error("stop before callback"); ${statement.getText()}`);
  }, "a persistence server callback placed after an unconditional throw");
};

const runSettlementAttacks = (): void => {
  assertAttackRejected((source) => {
    const withServer = source.getVariableDeclarationOrThrow("withServer")
      .getInitializerIfKindOrThrow(SyntaxKind.ArrowFunction);
    const close = withServer.getDescendantsOfKind(SyntaxKind.CallExpression).find((call) => {
      const expression = call.getExpression();
      return Node.isPropertyAccessExpression(expression) && expression.getName() === "close";
    });
    close?.getArguments()[0]?.replaceWithText("() => resolve()");
  }, "a persistence server close wrapper that cannot reject");
  assertAttackRejected((source) => {
    const withServer = source.getVariableDeclarationOrThrow("withServer")
      .getInitializerIfKindOrThrow(SyntaxKind.ArrowFunction);
    const close = withServer.getDescendantsOfKind(SyntaxKind.CallExpression).find((call) => {
      const expression = call.getExpression();
      return Node.isPropertyAccessExpression(expression) && expression.getName() === "close";
    });
    const executor = close?.getFirstAncestorByKind(SyntaxKind.NewExpression)?.getArguments()[0];
    if (!Node.isArrowFunction(executor) || !Node.isBlock(executor.getBody())) {
      throw new Error("persistence close Promise executor fixture is missing.");
    }
    const [resolveParameter, rejectParameter] = executor.getParameters();
    resolveParameter?.getNameNode().replaceWithText("realResolve");
    rejectParameter?.getNameNode().replaceWithText("realReject");
    executor.getBody().asKindOrThrow(SyntaxKind.Block).insertStatements(0, [
      "const resolve = () => undefined;", "const reject = (_error: unknown) => undefined;",
    ]);
  }, "a persistence server close wrapper settled only through same-name decoy functions");
  assertAttackRejected((source) => {
    const withServer = source.getVariableDeclarationOrThrow("withServer")
      .getInitializerIfKindOrThrow(SyntaxKind.ArrowFunction);
    const close = withServer.getDescendantsOfKind(SyntaxKind.CallExpression).find((call) => {
      const expression = call.getExpression();
      return Node.isPropertyAccessExpression(expression) && expression.getName() === "close";
    });
    const executor = close?.getFirstAncestorByKind(SyntaxKind.NewExpression)?.getArguments()[0];
    if (!Node.isArrowFunction(executor) || !Node.isBlock(executor.getBody())) {
      throw new Error("persistence close Promise executor fixture is missing.");
    }
    executor.setBodyText("const discardedClose = () => server.close((error) => error ? reject(error) : resolve()); void discardedClose;");
  }, "a persistence Promise whose only valid settlement path is trapped in an uncalled closure");
};

const runLifecycleAttacks = (): void => {
  assertAttackRejected((source) => {
    const withServer = source.getVariableDeclarationOrThrow("withServer")
      .getInitializerIfKindOrThrow(SyntaxKind.ArrowFunction);
    const server = withServer.getDescendantsOfKind(SyntaxKind.VariableDeclaration)
      .find((declaration) => declaration.getName() === "server");
    const boundary = server?.getVariableStatementOrThrow().getNextSiblingIfKindOrThrow(SyntaxKind.TryStatement);
    boundary?.getTryBlock().insertStatements(0,
      "const decoyServer = createServer(() => undefined); void decoyServer;");
  }, "a second persistence createServer held by a different variable");
  assertAttackRejected((source) => {
    const withServer = source.getVariableDeclarationOrThrow("withServer")
      .getInitializerIfKindOrThrow(SyntaxKind.ArrowFunction);
    const close = withServer.getDescendantsOfKind(SyntaxKind.CallExpression).find((call) => {
      const expression = call.getExpression();
      return Node.isPropertyAccessExpression(expression) && expression.getName() === "close";
    });
    close?.getFirstAncestorByKindOrThrow(SyntaxKind.ExpressionStatement).replaceWithText("await Promise.resolve();");
  }, "a persistence server lifecycle without close completion");
  assertAttackRejected((source) => {
    const withServer = source.getVariableDeclarationOrThrow("withServer")
      .getInitializerIfKindOrThrow(SyntaxKind.ArrowFunction);
    const guard = withServer.getDescendantsOfKind(SyntaxKind.IfStatement)
      .find((statement) => statement.getExpression().getText() === "server.listening");
    const thenStatement = guard?.getThenStatement();
    const block = Node.isBlock(thenStatement) ? thenStatement : undefined;
    guard?.replaceWithText(block?.getStatements().map((statement) => statement.getText()).join("\n") ?? "");
  }, "a persistence close path without the server.listening guard");
  assertAttackRejected((source) => {
    const rootBoundary = source.getVariableDeclarationOrThrow("acceptanceRoot")
      .getVariableStatementOrThrow().getNextSiblingIfKindOrThrow(SyntaxKind.TryStatement);
    rootBoundary.getTryBlock().addStatements("await rm(acceptanceRoot, { recursive: true, force: true });");
  }, "a second removal of the governed persistence root");
  assertAttackRejected((source) => source.getStatements().at(-1)?.replaceWithText("void 0;"),
    "a non-PASS terminal expression after persistence cleanup");
};

export const runPersistenceIsolationAttacks = (): void => {
  assert.equal(hasPersistenceFinding(resetAttackProject()), false,
    "current persistence fixture must satisfy the temporary-root contract.");
  runRootAttacks();
  runExecutionAttacks();
  runSettlementAttacks();
  runLifecycleAttacks();
};
