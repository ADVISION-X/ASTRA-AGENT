import assert from "node:assert/strict";

import { Node, Project, SyntaxKind, VariableDeclarationKind, type SourceFile } from "ts-morph";

import { inspectAcceptanceDeliveryIsolation } from "../audit/domains/audit-system/acceptance-delivery-isolation-inspector.js";
import { loadGeneratedAuditPlan } from "../audit/core/load-audit-plan.js";
import { createInspectorCheckSession } from "../audit/shared/inspector-check-session.js";
import type { InspectorContext } from "../audit/shared/inspector-contracts.js";
import { resolveFromRepo } from "../audit/shared/paths.js";

const fixturePath = "scripts/acceptance/media-processing-async-route.acceptance.ts";
const persistenceFixturePath = "scripts/acceptance/media-processing-task-persistence.acceptance.ts";
const attackProject = new Project({ tsConfigFilePath: resolveFromRepo("tsconfig.json") });
const resetAttackProject = (): Project => {
  for (const source of attackProject.getSourceFiles()) {
    if (source.getFilePath().includes("/scripts/acceptance/decoy/")
      || source.getFilePath().endsWith("/scripts/acceptance/fake-promise.d.ts")) source.forget();
  }
  for (const filePath of [fixturePath, persistenceFixturePath]) {
    attackProject.getSourceFileOrThrow(resolveFromRepo(filePath)).refreshFromFileSystemSync();
  }
  return attackProject;
};

const buildContext = (project: Project): InspectorContext => {
  const generatedPlan = loadGeneratedAuditPlan();
  const planEntry = generatedPlan.find((entry) => entry.capabilityDomain === "audit-system");
  if (!planEntry) throw new Error("audit-system plan entry is missing.");
  return { checks: createInspectorCheckSession(planEntry).checks, completedReports: {}, generatedPlan, planEntry, project };
};

const callNamed = (source: SourceFile, name: string) =>
  source.getDescendantsOfKind(SyntaxKind.CallExpression).find((call) => {
    const expression = call.getExpression();
    return Node.isIdentifier(expression) && expression.getText() === name;
  });

const callPropertyNamed = (source: SourceFile, name: string) =>
  source.getDescendantsOfKind(SyntaxKind.CallExpression).find((call) => {
    const expression = call.getExpression();
    return Node.isPropertyAccessExpression(expression) && expression.getName() === name;
  });

const hasDeliveryFinding = (project: Project, filePath = fixturePath): boolean => {
  const result = inspectAcceptanceDeliveryIsolation(buildContext(project), "APEX-AUDIT-005-V1");
  return result.findings.some((finding) => finding.filePath === filePath
    && (finding.message.includes("Acceptance delivery")
      || finding.message.includes("Media persistence acceptance")));
};

const assertAttackRejected = (mutate: (source: SourceFile, project: Project) => void, label: string): void => {
  const project = resetAttackProject();
  const source = project.getSourceFileOrThrow(resolveFromRepo(fixturePath));
  mutate(source, project);
  assert.equal(hasDeliveryFinding(project), true, `delivery isolation must reject ${label}.`);
};

const assertBaselineAccepted = (): void => {
  const baselineProject = resetAttackProject();
  assert.equal(hasDeliveryFinding(baselineProject), false, "current delivery isolation fixture must satisfy the mechanical contract.");
  assert.equal(hasDeliveryFinding(baselineProject, persistenceFixturePath), false,
    "current persistence fixture must satisfy the temporary-root contract.");
};

const assertPersistenceAttackRejected = (mutate: (source: SourceFile) => void, label: string): void => {
  const project = resetAttackProject();
  mutate(project.getSourceFileOrThrow(resolveFromRepo(persistenceFixturePath)));
  assert.equal(hasDeliveryFinding(project, persistenceFixturePath), true,
    `persistence isolation must reject ${label}.`);
};

const persistenceVariable = (source: SourceFile, scenarioName: string, variableName: string) =>
  source.getDescendantsOfKind(SyntaxKind.VariableDeclaration).find((declaration) => {
    if (declaration.getName() !== variableName) return false;
    const scope = declaration.getFirstAncestorByKind(SyntaxKind.ArrowFunction);
    return scope?.getParentIfKind(SyntaxKind.VariableDeclaration)?.getName() === scenarioName;
  });

const runTemporaryRootAttacks = (): void => {
  assertAttackRejected((source) => {
    const osImport = source.getImportDeclaration((declaration) =>
      declaration.getModuleSpecifierValue() === "node:os");
    if (!osImport) throw new Error("node:os import fixture is missing.");
    osImport.addNamedImport("homedir");
    const rootCall = source.getVariableDeclarationOrThrow("dataDir")
      .getInitializerIfKindOrThrow(SyntaxKind.AwaitExpression)
      .getExpressionIfKindOrThrow(SyntaxKind.CallExpression);
    rootCall.getArguments()[0]?.replaceWithText('path.join(homedir(), "Downloads/grasseye-safe-")');
  }, "a user-home Downloads mkdtemp prefix");
  assertAttackRejected((source) => {
    const rootCall = source.getVariableDeclarationOrThrow("dataDir")
      .getInitializerIfKindOrThrow(SyntaxKind.AwaitExpression)
      .getExpressionIfKindOrThrow(SyntaxKind.CallExpression);
    rootCall.getArguments()[0]?.replaceWithText('path.join(tmpdir(), "grasseye-safe-", "nested")');
  }, "an extra unproved path segment");
  assertAttackRejected((source) => {
    const boundary = source.getVariableDeclarationOrThrow("dataDir")
      .getFirstAncestorByKindOrThrow(SyntaxKind.VariableStatement)
      .getNextSiblingIfKindOrThrow(SyntaxKind.TryStatement);
    boundary.getTryBlock().insertStatements(0,
      "{ const dataDir = await mkdtemp(path.join(tmpdir(), 'grasseye-shadow-')); void dataDir; }");
  }, "a second shadow declaration of the governed temporary root");
};

const runImportIdentityAttacks = (): void => {
  assertAttackRejected((source) => {
    const imported = source.getImportDeclarations()
      .flatMap((declaration) => declaration.getNamedImports())
      .find((specifier) => specifier.getName() === "handleMediaProcessingRequest");
    if (!imported) throw new Error("delivery handler import fixture is missing.");
    imported.setAlias("realHandleMediaProcessingRequest");
    source.insertStatements(source.getImportDeclarations().length,
      "const handleMediaProcessingRequest = (..._args: unknown[]) => Promise.resolve();");
  }, "a local shadow callee beside an aliased real import");
  assertAttackRejected((source, project) => {
    project.createSourceFile(
      resolveFromRepo("scripts/acceptance/decoy/workbench-media-processing-routes.ts"),
      "export const handleMediaProcessingRequest = (..._args: unknown[]) => Promise.resolve();",
    );
    const declaration = source.getImportDeclaration((candidate) =>
      candidate.getNamedImports().some((specifier) => specifier.getName() === "handleMediaProcessingRequest"));
    if (!declaration) throw new Error("delivery handler import declaration is missing.");
    declaration.setModuleSpecifier("./decoy/workbench-media-processing-routes.js");
  }, "a same-filename decoy module");
  assertAttackRejected((source, project) => {
    project.createSourceFile(
      resolveFromRepo("scripts/acceptance/decoy/typed-media-route.ts"),
      [
        'import { handleMediaProcessingRequest as realHandler } from "../../../src/app/workbench-media-processing-routes.js";',
        "export const handleMediaProcessingRequest: typeof realHandler = (...args) => realHandler(...args);",
      ].join("\n"),
    );
    const declaration = source.getImportDeclaration((candidate) =>
      candidate.getNamedImports().some((specifier) => specifier.getName() === "handleMediaProcessingRequest"));
    if (!declaration) throw new Error("delivery handler import declaration is missing.");
    declaration.setModuleSpecifier("./decoy/typed-media-route.js");
  }, "a typed runtime wrapper laundering the real handler declaration");
};

const runIndirectCallAttacks = (): void => {
  assertAttackRejected((source) => {
    source.addStatements([
      "const escapedHandler = handleMediaProcessingRequest;",
      "void escapedHandler({} as never, {} as never, {} as never, path.join(dataDir, 'escaped-delivery'));",
    ]);
  }, "an indirect real business call outside the cleanup boundary");
  assertAttackRejected((source) => {
    source.addImportDeclaration({
      moduleSpecifier: "../../src/app/workbench-media-processing-routes.js",
      namespaceImport: "mediaRoutes",
    });
    source.addStatements(
      "void mediaRoutes.handleMediaProcessingRequest({} as never, {} as never, {} as never, path.join(dataDir, 'namespace-escape'));",
    );
  }, "a namespace real business call outside the cleanup boundary");
};

const runHigherOrderCallAttacks = (): void => {
  assertAttackRejected((source) => {
    const rootStatement = source.getVariableDeclarationOrThrow("dataDir")
      .getFirstAncestorByKindOrThrow(SyntaxKind.VariableStatement);
    source.insertStatements(source.getStatements().indexOf(rootStatement),
      "let escapedWrapper: (() => Promise<unknown>) | null = null;");
    rootStatement.getNextSiblingIfKindOrThrow(SyntaxKind.TryStatement).getTryBlock().addStatements(
      "escapedWrapper = () => handleMediaProcessingRequest({} as never, {} as never, {} as never, deliveryDirectory);",
    );
    source.insertStatements(source.getStatements().length - 1, "await escapedWrapper?.();");
  }, "a captured production wrapper invoked after cleanup");
  assertAttackRejected((source) => {
    const call = callNamed(source, "handleMediaProcessingRequest");
    call?.getExpression().replaceWithText("handleMediaProcessingRequest.call");
    call?.insertArgument(0, "undefined");
  }, "Function.call indirection");
  assertAttackRejected((source) => {
    const call = callNamed(source, "handleMediaProcessingRequest");
    const originalArguments = call?.getArguments().map((argument) => argument.getText()).join(", ");
    call?.replaceWithText(`handleMediaProcessingRequest.apply(undefined, [${originalArguments}])`);
  }, "Function.apply indirection");
  assertAttackRejected((source) => {
    const boundary = source.getVariableDeclarationOrThrow("dataDir")
      .getFirstAncestorByKindOrThrow(SyntaxKind.VariableStatement)
      .getNextSiblingIfKindOrThrow(SyntaxKind.TryStatement);
    boundary.getTryBlock().addStatements([
      "const boundHandler = handleMediaProcessingRequest.bind(undefined);",
      "void boundHandler({} as never, {} as never, {} as never, deliveryDirectory);",
    ]);
  }, "Function.bind indirection");
  assertAttackRejected((source) => {
    const boundary = source.getVariableDeclarationOrThrow("dataDir")
      .getFirstAncestorByKindOrThrow(SyntaxKind.VariableStatement)
      .getNextSiblingIfKindOrThrow(SyntaxKind.TryStatement);
    boundary.getTryBlock().addStatements("void Promise.resolve(handleMediaProcessingRequest);");
  }, "higher-order function transport");
  assertAttackRejected((source) => {
    const boundary = source.getVariableDeclarationOrThrow("dataDir")
      .getFirstAncestorByKindOrThrow(SyntaxKind.VariableStatement)
      .getNextSiblingIfKindOrThrow(SyntaxKind.TryStatement);
    boundary.getTryBlock().addStatements(
      "createServer((request, response) => { void handleMediaProcessingRequest(request, response, workbench, deliveryDirectory); });",
    );
  }, "a production handler hidden in a second unmanaged createServer callback");
};

const runUnreachableDeliveryAttack = (): void => {
  assertAttackRejected((source) => {
    const call = callNamed(source, "handleMediaProcessingRequest");
    const statement = call?.getFirstAncestorByKind(SyntaxKind.ExpressionStatement);
    if (!statement) throw new Error("delivery handler statement fixture is missing.");
    statement.replaceWithText(`if (false) { ${statement.getText()} }`);
  }, "a production delivery call that exists only in an unreachable branch");
  assertAttackRejected((source) => {
    const call = callNamed(source, "handleMediaProcessingRequest");
    const statement = call?.getFirstAncestorByKind(SyntaxKind.ExpressionStatement);
    if (!statement) throw new Error("delivery handler statement fixture is missing.");
    statement.replaceWithText(`throw new Error("stop before delivery"); ${statement.getText()}`);
  }, "a production delivery call placed after an unconditional throw");
};

const runResourceLifetimeAttacks = (): void => {
  assertAttackRejected((source) => {
    const closeCall = callPropertyNamed(source, "close");
    closeCall?.getFirstAncestorByKindOrThrow(SyntaxKind.ExpressionStatement)
      .replaceWithText("await Promise.resolve();");
  }, "a server resource without close");
  assertAttackRejected((source) => {
    const server = source.getDescendantsOfKind(SyntaxKind.VariableDeclaration)
      .find((declaration) => declaration.getName() === "server");
    server?.getVariableStatementOrThrow().setDeclarationKind(VariableDeclarationKind.Let);
  }, "a reassignable server declaration");
  assertAttackRejected((source) => {
    const closeCall = callPropertyNamed(source, "close");
    closeCall?.getExpression().replaceWithText("({ close: server.close.bind(server) } as never).close");
  }, "closing a decoy receiver instead of the governed server");
  assertAttackRejected((source) => {
    const closeCall = callPropertyNamed(source, "close");
    const awaited = closeCall?.getFirstAncestorByKind(SyntaxKind.AwaitExpression);
    awaited?.replaceWithText(awaited.getExpression().getText());
  }, "server close without an awaited completion promise");
  assertAttackRejected((source) => {
    const closeCall = callPropertyNamed(source, "close");
    while (closeCall && closeCall.getArguments().length > 0) closeCall.removeArgument(0);
  }, "an awaited Promise whose server close never resolves or rejects it");
  assertAttackRejected((source) => {
    const server = source.getDescendantsOfKind(SyntaxKind.VariableDeclaration)
      .find((declaration) => declaration.getName() === "server");
    if (!server) throw new Error("server declaration fixture is missing.");
    const statement = server.getVariableStatementOrThrow();
    statement.setDeclarationKind(VariableDeclarationKind.Let);
    const block = statement.getParentIfKindOrThrow(SyntaxKind.Block);
    block.insertStatements(block.getStatements().indexOf(statement) + 1,
      "server = createServer(() => undefined);");
  }, "server reassignment before cleanup");
  assertAttackRejected((source) => {
    const rootStatement = source.getVariableDeclarationOrThrow("dataDir")
      .getFirstAncestorByKindOrThrow(SyntaxKind.VariableStatement);
    source.insertStatements(source.getStatements().indexOf(rootStatement),
      "const Promise = globalThis.Promise;");
  }, "a local Promise shadow masquerading as the global close-completion primitive");
  assertAttackRejected((source) => {
    source.getVariableDeclarationOrThrow("dataDir")
      .getVariableStatementOrThrow().setDeclarationKind(VariableDeclarationKind.Let);
  }, "a reassignable temporary root");
  assertAttackRejected((source) => {
    const delivery = source.getDescendantsOfKind(SyntaxKind.VariableDeclaration)
      .find((declaration) => declaration.getName() === "deliveryDirectory");
    delivery?.getVariableStatementOrThrow().setDeclarationKind(VariableDeclarationKind.Let);
  }, "a reassignable delivery directory");
};

const runCleanupControlFlowAttacks = (): void => {
  assertAttackRejected((source) => {
    callNamed(source, "rm")?.getFirstAncestorByKindOrThrow(SyntaxKind.ExpressionStatement).remove();
    source.addStatements("await rm(dataDir, { force: true, recursive: true });");
  }, "a decoy cleanup outside the delivery call's finally");
  assertAttackRejected((source) => {
    const cleanup = callNamed(source, "rm")?.getFirstAncestorByKindOrThrow(SyntaxKind.ExpressionStatement);
    cleanup?.remove();
    source.addStatements("try { process.stdout.write('decoy'); } finally { await rm(dataDir, { force: true, recursive: true }); }");
  }, "an unrelated later finally cleanup");

  assertAttackRejected((source) => {
    const cleanup = callNamed(source, "rm")?.getFirstAncestorByKindOrThrow(SyntaxKind.ExpressionStatement);
    cleanup?.replaceWithText("if (false) { await rm(dataDir, { force: true, recursive: true }); }");
  }, "a conditional cleanup decoy inside the correct finally");
};

const runCleanupOptionAttacks = (): void => {
  assertAttackRejected((source) => {
    const options = callNamed(source, "rm")?.getArguments()[1];
    if (!Node.isObjectLiteralExpression(options)) throw new Error("rm options fixture is missing.");
    const recursive = options.getProperty("recursive");
    if (!Node.isPropertyAssignment(recursive)) throw new Error("recursive cleanup fixture is missing.");
    recursive.getInitializerOrThrow().replaceWithText("false");
  }, "non-recursive cleanup");

  assertAttackRejected((source) => {
    const options = callNamed(source, "rm")?.getArguments()[1];
    if (!Node.isObjectLiteralExpression(options)) throw new Error("rm options fixture is missing.");
    const force = options.getProperty("force");
    if (!Node.isPropertyAssignment(force)) throw new Error("force cleanup fixture is missing.");
    force.getInitializerOrThrow().replaceWithText("false");
  }, "non-forced cleanup");

  assertAttackRejected((source) => {
    const options = callNamed(source, "rm")?.getArguments()[1];
    if (!Node.isObjectLiteralExpression(options)) throw new Error("rm options fixture is missing.");
    options.replaceWithText("{ force: true, recursive: true, ...{ force: false } }");
  }, "cleanup options overridden by an object spread");
};

const runPersistenceRootAttacks = (): void => {
  assertPersistenceAttackRejected((source) => {
    const handler = callNamed(source, "handleMediaProcessingRequest");
    if (!handler) throw new Error("persistence handler fixture is missing.");
    handler.removeArgument(3);
  }, "a production handler without an injected delivery directory");
  assertPersistenceAttackRejected((source) => {
    const cleanup = source.getDescendantsOfKind(SyntaxKind.CallExpression).find((call) =>
      Node.isIdentifier(call.getExpression())
      && call.getExpression().getText() === "rm"
      && Node.isIdentifier(call.getArguments()[0])
      && call.getArguments()[0]?.getText() === "acceptanceRoot");
    cleanup?.getFirstAncestorByKindOrThrow(SyntaxKind.ExpressionStatement).remove();
  }, "a persistence suite without root-level terminal cleanup");
  assertPersistenceAttackRejected((source) => {
    persistenceVariable(source, "runInitialSnapshotFailureAcceptance", "dataDir")
      ?.getInitializerOrThrow().replaceWithText('path.join(tmpdir(), "escaped-persistence-data")');
  }, "a persistence dataDir escaping the governed root");
  assertPersistenceAttackRejected((source) => {
    persistenceVariable(source, "runDownloadsCopyFailureAcceptance", "outsideArtifactPath")
      ?.getInitializerOrThrow().replaceWithText('path.join(tmpdir(), "escaped-artifact.webp")');
  }, "an outside artifact escaping the governed root");
  assertPersistenceAttackRejected((source) => {
    const boundary = source.getVariableDeclarationOrThrow("acceptanceRoot")
      .getVariableStatementOrThrow().getNextSiblingIfKindOrThrow(SyntaxKind.TryStatement);
    boundary.getTryBlock().insertStatements(0,
      'const secondRoot = await mkdtemp(path.join(tmpdir(), "grasseye-second-persistence-")); void secondRoot;');
  }, "a second persistence mkdtemp root");
  assertPersistenceAttackRejected((source) => {
    const invocation = callNamed(source, "runInitialSnapshotFailureAcceptance");
    const statement = invocation?.getFirstAncestorByKind(SyntaxKind.ExpressionStatement);
    if (!statement) throw new Error("persistence scenario invocation fixture is missing.");
    statement.replaceWithText(`if (false) { ${statement.getText()} }`);
  }, "a persistence scenario invoked only in an unreachable branch");
  assertPersistenceAttackRejected((source) => {
    const invocation = callNamed(source, "runInitialSnapshotFailureAcceptance");
    const statement = invocation?.getFirstAncestorByKind(SyntaxKind.ExpressionStatement);
    if (!statement) throw new Error("persistence scenario invocation fixture is missing.");
    statement.replaceWithText(`throw new Error("stop before scenario"); ${statement.getText()}`);
  }, "a persistence scenario placed after an unconditional throw");
};

const runPersistenceExecutionAttacks = (): void => {
  assertPersistenceAttackRejected((source) => {
    const withServer = source.getVariableDeclarationOrThrow("withServer")
      .getInitializerIfKindOrThrow(SyntaxKind.ArrowFunction);
    const runCall = withServer.getDescendantsOfKind(SyntaxKind.CallExpression).find((call) =>
      Node.isIdentifier(call.getExpression()) && call.getExpression().getText() === "run");
    const statement = runCall?.getFirstAncestorByKind(SyntaxKind.ReturnStatement);
    if (!statement) throw new Error("persistence server run fixture is missing.");
    statement.replaceWithText(`
      if (false) { ${statement.getText()} }
      return undefined as T;
    `);
  }, "a persistence server callback executed only in an unreachable branch");
  assertPersistenceAttackRejected((source) => {
    const withServer = source.getVariableDeclarationOrThrow("withServer")
      .getInitializerIfKindOrThrow(SyntaxKind.ArrowFunction);
    const runCall = withServer.getDescendantsOfKind(SyntaxKind.CallExpression).find((call) =>
      Node.isIdentifier(call.getExpression()) && call.getExpression().getText() === "run");
    const statement = runCall?.getFirstAncestorByKind(SyntaxKind.ReturnStatement);
    if (!statement) throw new Error("persistence server run fixture is missing.");
    statement.replaceWithText(`throw new Error("stop before callback"); ${statement.getText()}`);
  }, "a persistence server callback placed after an unconditional throw");
};

const runPersistenceSettlementAttacks = (): void => {
  assertPersistenceAttackRejected((source) => {
    const withServer = source.getVariableDeclarationOrThrow("withServer")
      .getInitializerIfKindOrThrow(SyntaxKind.ArrowFunction);
    const close = withServer.getDescendantsOfKind(SyntaxKind.CallExpression).find((call) => {
      const expression = call.getExpression();
      return Node.isPropertyAccessExpression(expression) && expression.getName() === "close";
    });
    close?.getArguments()[0]?.replaceWithText("() => resolve()");
  }, "a persistence server close wrapper that cannot reject");
  assertPersistenceAttackRejected((source) => {
    const withServer = source.getVariableDeclarationOrThrow("withServer")
      .getInitializerIfKindOrThrow(SyntaxKind.ArrowFunction);
    const close = withServer.getDescendantsOfKind(SyntaxKind.CallExpression).find((call) => {
      const expression = call.getExpression();
      return Node.isPropertyAccessExpression(expression) && expression.getName() === "close";
    });
    const promise = close?.getFirstAncestorByKind(SyntaxKind.NewExpression);
    const executor = promise?.getArguments()[0];
    if (!Node.isArrowFunction(executor) || !Node.isBlock(executor.getBody())) {
      throw new Error("persistence close Promise executor fixture is missing.");
    }
    const [resolveParameter, rejectParameter] = executor.getParameters();
    resolveParameter?.getNameNode().replaceWithText("realResolve");
    rejectParameter?.getNameNode().replaceWithText("realReject");
    executor.getBody().asKindOrThrow(SyntaxKind.Block).insertStatements(0, [
      "const resolve = () => undefined;",
      "const reject = (_error: unknown) => undefined;",
    ]);
  }, "a persistence server close wrapper settled only through same-name decoy functions");
  assertPersistenceAttackRejected((source) => {
    const withServer = source.getVariableDeclarationOrThrow("withServer")
      .getInitializerIfKindOrThrow(SyntaxKind.ArrowFunction);
    const close = withServer.getDescendantsOfKind(SyntaxKind.CallExpression).find((call) => {
      const expression = call.getExpression();
      return Node.isPropertyAccessExpression(expression) && expression.getName() === "close";
    });
    const promise = close?.getFirstAncestorByKind(SyntaxKind.NewExpression);
    const executor = promise?.getArguments()[0];
    if (!Node.isArrowFunction(executor) || !Node.isBlock(executor.getBody())) {
      throw new Error("persistence close Promise executor fixture is missing.");
    }
    executor.setBodyText(`
      const discardedClose = () => server.close((error) => error ? reject(error) : resolve());
      void discardedClose;
    `);
  }, "a persistence Promise whose only valid settlement path is trapped in an uncalled closure");
};

const runPersistenceLifecycleAttacks = (): void => {
  assertPersistenceAttackRejected((source) => {
    const withServer = source.getVariableDeclarationOrThrow("withServer")
      .getInitializerIfKindOrThrow(SyntaxKind.ArrowFunction);
    const close = withServer.getDescendantsOfKind(SyntaxKind.CallExpression).find((call) => {
      const expression = call.getExpression();
      return Node.isPropertyAccessExpression(expression) && expression.getName() === "close";
    });
    close?.getFirstAncestorByKindOrThrow(SyntaxKind.ExpressionStatement).replaceWithText("await Promise.resolve();");
  }, "a persistence server lifecycle without close completion");
  assertPersistenceAttackRejected((source) => {
    const withServer = source.getVariableDeclarationOrThrow("withServer")
      .getInitializerIfKindOrThrow(SyntaxKind.ArrowFunction);
    const guard = withServer.getDescendantsOfKind(SyntaxKind.IfStatement)
      .find((statement) => statement.getExpression().getText() === "server.listening");
    const thenStatement = guard?.getThenStatement();
    const block = Node.isBlock(thenStatement) ? thenStatement : undefined;
    guard?.replaceWithText(block?.getStatements().map((statement) => statement.getText()).join("\n") ?? "");
  }, "a persistence close path without the server.listening guard");
  assertPersistenceAttackRejected((source) => {
    const rootBoundary = source.getVariableDeclarationOrThrow("acceptanceRoot")
      .getVariableStatementOrThrow().getNextSiblingIfKindOrThrow(SyntaxKind.TryStatement);
    rootBoundary.getTryBlock().addStatements("await rm(acceptanceRoot, { recursive: true, force: true });");
  }, "a second removal of the governed persistence root");
  assertPersistenceAttackRejected((source) => {
    const terminal = source.getStatements().at(-1);
    terminal?.replaceWithText("void 0;");
  }, "a non-PASS terminal expression after persistence cleanup");
};

const runPromiseIdentityAttack = (): void => {
  assertAttackRejected((source, project) => {
    project.createSourceFile(
      resolveFromRepo("scripts/acceptance/fake-promise.d.ts"),
      "declare class FakePromise<T> { constructor(executor: (resolve: (value: T) => void, reject: (error: unknown) => void) => void); }",
      { overwrite: true },
    );
    const close = source.getDescendantsOfKind(SyntaxKind.CallExpression).find((call) => {
      const callee = call.getExpression();
      return Node.isPropertyAccessExpression(callee) && callee.getName() === "close";
    });
    const promise = close?.getFirstAncestorByKind(SyntaxKind.NewExpression);
    if (!promise) throw new Error("governed server-close Promise fixture is missing.");
    promise?.getExpression().replaceWithText("FakePromise");
  }, "a declaration-file class masquerading as the standard Promise identity");
};

export const runDeliveryIsolationAttacks = (): void => {
  assertBaselineAccepted();
  runTemporaryRootAttacks();
  runImportIdentityAttacks();
  runIndirectCallAttacks();
  runHigherOrderCallAttacks();
  runUnreachableDeliveryAttack();
  runResourceLifetimeAttacks();
  runCleanupControlFlowAttacks();
  runCleanupOptionAttacks();
  runPersistenceRootAttacks();
  runPersistenceExecutionAttacks();
  runPersistenceSettlementAttacks();
  runPersistenceLifecycleAttacks();
  runPromiseIdentityAttack();
};
