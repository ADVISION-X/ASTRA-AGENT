import assert from "node:assert/strict";
import { Node, Project, SyntaxKind } from "ts-morph";
import { inspectCiControlIntegrity } from "../audit/domains/audit-system/ci-control-integrity-inspector.js";
import { inspectRunnerSessionContract } from "../audit/domains/audit-system/physical-check-receipt-inspector.js";
import { loadGeneratedAuditPlan } from "../audit/core/load-audit-plan.js";
import { createInspectorCheckSession } from "../audit/shared/inspector-check-session.js";
import type { InspectorContext } from "../audit/shared/inspector-contracts.js";
import { resolveFromRepo } from "../audit/shared/paths.js";
const mutablePaths = [
  "scripts/audit/ci-acceptance-leaf-plan.ts",
  "scripts/audit/ci-audit-plan-runner.ts",
  "scripts/audit/ci-command-runner.ts",
  "scripts/audit/ci-full.ts",
  "scripts/audit/core/run-generated-plan-worker.ts",
  "scripts/audit/core/run-generated-plan.ts",
  "scripts/audit/shared/inspector-check-session.ts",
] as const;
const attackProject = new Project({ tsConfigFilePath: resolveFromRepo("tsconfig.json") });
const resetAttackProject = (): Project => {
  for (const filePath of mutablePaths) {
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

const inspectRound8Surface = (context: InspectorContext, lawId: string) => {
  const findings: import("../audit/shared/inspector-contracts.js").InspectorFinding[] = [];
  const inspectedFiles = new Set<string>();
  inspectCiControlIntegrity(context, findings, inspectedFiles, lawId);
  findings.push(...inspectRunnerSessionContract(context, lawId).findings);
  return { findings };
};

const runAcceptancePlanPreEntryAttack = (): void => {
  const project = resetAttackProject();
  const ciFull = project.getSourceFileOrThrow(resolveFromRepo("scripts/audit/ci-full.ts"));
  const main = ciFull.getVariableDeclarationOrThrow("main")
    .getInitializerIfKindOrThrow(SyntaxKind.ArrowFunction);
  const body = main.getBody().asKindOrThrow(SyntaxKind.Block);
  const phasePlan = body.getVariableDeclarationOrThrow("phasePlan").getVariableStatementOrThrow();
  const phasePlanText = phasePlan.getText();
  phasePlan.remove();
  body.insertStatements(5, phasePlanText);
  const result = inspectRound8Surface(buildContext(project), "APEX-AUDIT-005-V1");
  assert.equal(result.findings.some((finding) =>
    finding.checkId === "audit-system/ci-full-entry-gate"
    && finding.message.includes("complete physical skeleton")), true,
  "receipt governance must reject acceptance authority loaded before the entry gate and artifact regeneration.");
};

const runDeferredAcceptanceNameHeuristicAttack = (): void => {
  const project = resetAttackProject();
  const leafPlan = project.getSourceFileOrThrow(resolveFromRepo("scripts/audit/ci-acceptance-leaf-plan.ts"));
  const expander = leafPlan.getVariableDeclarationOrThrow("expandNpmScript")
    .getInitializerIfKindOrThrow(SyntaxKind.ArrowFunction);
  expander.getBody().asKindOrThrow(SyntaxKind.Block).insertStatements(0, `
    if (scriptName.includes("real-proof")) return;
  `);
  const result = inspectRound8Surface(buildContext(project), "APEX-AUDIT-005-V1");
  assert.equal(result.findings.some((finding) =>
    finding.checkId === "audit-system/ci-full-entry-gate"
    && finding.message.includes("complete physical skeleton")), true,
  "receipt governance must reject acceptance deferral inferred from a script or file name.");
};

const runFailureEvidenceLateAssignmentAttack = (): void => {
  const project = resetAttackProject();
  const ciFull = project.getSourceFileOrThrow(resolveFromRepo("scripts/audit/ci-full.ts"));
  const main = ciFull.getVariableDeclarationOrThrow("main")
    .getInitializerIfKindOrThrow(SyntaxKind.ArrowFunction);
  const body = main.getBody().asKindOrThrow(SyntaxKind.Block);
  const assignment = body.getDescendantsOfKind(SyntaxKind.BinaryExpression).find((expression) =>
    expression.getLeft().getText() === "lawCoverage"
    && expression.getRight().getText() === "lawCoverageStep.lawCoverage");
  const assignmentStatement = assignment?.getFirstAncestorByKind(SyntaxKind.ExpressionStatement);
  const failureGuard = body.getDescendantsOfKind(SyntaxKind.IfStatement).find((statement) =>
    statement.getExpression().getText() === "lawCoverageStep.failure");
  if (!assignmentStatement || !failureGuard) throw new Error("law coverage failure handoff fixture is missing.");
  const assignmentText = assignmentStatement.getText();
  assignmentStatement.remove();
  body.insertStatements(body.getStatements().indexOf(failureGuard) + 1, assignmentText);
  const result = inspectRound8Surface(buildContext(project), "APEX-AUDIT-005-V1");
  assert.equal(result.findings.some((finding) =>
    finding.checkId === "audit-system/ci-full-entry-gate"
    && finding.message.includes("complete physical skeleton")), true,
  "receipt governance must reject failure evidence assigned only after fail-fast writes the summary.");
};

const runCommandCleanupPostReturnAttack = (): void => {
  const project = resetAttackProject();
  const source = project.getSourceFileOrThrow(resolveFromRepo("scripts/audit/ci-command-runner.ts"));
  const execute = source.getVariableDeclarationOrThrow("executeBoundedCommand")
    .getInitializerIfKindOrThrow(SyntaxKind.ArrowFunction);
  const waitCall = execute.getDescendantsOfKind(SyntaxKind.CallExpression).find((call) =>
    Node.isIdentifier(call.getExpression())
    && call.getExpression().getText() === "waitForProcessGroupTermination");
  const statement = waitCall?.getFirstAncestorByKind(SyntaxKind.VariableStatement);
  if (!statement) throw new Error("command cleanup wait fixture is missing.");
  statement.replaceWithText(`
    return;
    const terminated = await waitForProcessGroupTermination(child.pid);
  `);
  const result = inspectRound8Surface(buildContext(project), "APEX-AUDIT-005-V1");
  assert.equal(result.findings.some((finding) =>
    finding.checkId === "audit-system/ci-full-entry-gate"
    && finding.message.includes("hard deadline")), true,
  "receipt governance must reject command cleanup placed after an unconditional return.");
};

const runWorkerCleanupPostReturnAttack = (): void => {
  const project = resetAttackProject();
  const source = project.getSourceFileOrThrow(resolveFromRepo("scripts/audit/ci-audit-plan-runner.ts"));
  const failure = source.getVariableDeclarationOrThrow("runGeneratedPlanWithDeadline")
    .getInitializerIfKindOrThrow(SyntaxKind.ArrowFunction)
    .getDescendantsOfKind(SyntaxKind.VariableDeclaration)
    .find((declaration) => declaration.getName() === "settleFailureAfterTermination")
    ?.getInitializerIfKindOrThrow(SyntaxKind.ArrowFunction);
  if (!failure) throw new Error("worker failure cleanup fixture is missing.");
  failure.getBody().asKindOrThrow(SyntaxKind.Block).insertStatements(0, "return;");
  const result = inspectRound8Surface(buildContext(project), "APEX-AUDIT-005-V1");
  assert.equal(result.findings.some((finding) =>
    finding.checkId === "audit-system/ci-full-entry-gate"
    && finding.message.includes("hard deadline")), true,
  "receipt governance must reject worker termination placed after an unconditional return.");
};

const runWorkerAdapterForgedSuccessAttack = (): void => {
  const project = resetAttackProject();
  const source = project.getSourceFileOrThrow(resolveFromRepo("scripts/audit/core/run-generated-plan-worker.ts"));
  const successPost = source.getDescendantsOfKind(SyntaxKind.CallExpression).find((call) => {
    const callee = call.getExpression();
    const message = call.getArguments()[0];
    const ok = Node.isObjectLiteralExpression(message) ? message.getProperty("ok") : undefined;
    return Node.isPropertyAccessExpression(callee)
      && callee.getName() === "postMessage"
      && Node.isPropertyAssignment(ok)
      && Node.isTrueLiteral(ok.getInitializer());
  });
  successPost?.getArguments()[0]?.replaceWithText("{ ok: true, result: { domainReports: [], hasFailures: false } }");
  const result = inspectRound8Surface(buildContext(project), "APEX-AUDIT-005-V1");
  assert.equal(result.findings.some((finding) =>
    finding.checkId === "audit-system/ci-full-entry-gate"
    && finding.message.includes("hard deadline")), true,
  "receipt governance must reject a worker adapter that discards the real owner result and posts a forged empty success.");
};

const runWorkerMessageEarlyResolveAttack = (): void => {
  const project = resetAttackProject();
  const source = project.getSourceFileOrThrow(resolveFromRepo("scripts/audit/ci-audit-plan-runner.ts"));
  const message = source.getVariableDeclarationOrThrow("runGeneratedPlanWithDeadline")
    .getInitializerIfKindOrThrow(SyntaxKind.ArrowFunction)
    .getDescendantsOfKind(SyntaxKind.CallExpression).find((call) => {
      const callee = call.getExpression();
      return Node.isPropertyAccessExpression(callee)
        && callee.getName() === "once"
        && call.getArguments()[0]?.getText() === '"message"';
    });
  const callback = message?.getArguments()[1];
  if (!Node.isArrowFunction(callback)) throw new Error("worker message callback fixture is missing.");
  callback.getBody().asKindOrThrow(SyntaxKind.Block)
    .addStatements("clearTimeout(deadline); resolvePromise(pendingResult!);");
  const result = inspectRound8Surface(buildContext(project), "APEX-AUDIT-005-V1");
  assert.equal(result.findings.some((finding) =>
    finding.checkId === "audit-system/ci-full-entry-gate"
    && finding.message.includes("hard deadline")), true,
  "receipt governance must reject a parent that accepts a worker message before terminal worker exit.");
};
const runRealChromeDecoyFilterAttack = (): void => {
  const project = resetAttackProject();
  for (const [filePath, variableName] of [
    ["scripts/audit/shared/inspector-check-session.ts", "executedChecks"],
    ["scripts/audit/core/run-generated-plan.ts", "expectedChecks"],
  ] as const) {
    const sourceFile = project.getSourceFileOrThrow(resolveFromRepo(filePath));
    const initializer = sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration)
      .find((declaration) => declaration.getName() === variableName)
      ?.getInitializerOrThrow();
    const realFilter = initializer?.getDescendantsOfKind(SyntaxKind.BinaryExpression)
      .find((expression) => expression.getRight().getText() === '"real-chrome"');
    if (!realFilter) throw new Error(`${variableName} real-Chrome filter fixture is missing.`);
    realFilter.replaceWithText('binding.evidenceMode === "real-chrome"');
    sourceFile.addStatements('const realChromeDecoy = [{ evidenceMode: "static" }].filter((binding) => binding.evidenceMode !== "real-chrome");');
  }
  const result = inspectRound8Surface(buildContext(project), "APEX-AUDIT-005-V1");
  assert.equal(
    result.findings.some((finding) =>
      finding.checkId === "audit-system/runner-law-truth"
      && finding.message.includes("real-chrome")),
    true,
    "receipt governance must reject decoy real-Chrome filters that do not govern executed mappings.",
  );
};

const runRealChromeDiscardedInnerFilterAttack = (): void => {
  const project = resetAttackProject();
  for (const [filePath, variableName] of [
    ["scripts/audit/shared/inspector-check-session.ts", "executedChecks"],
    ["scripts/audit/core/run-generated-plan.ts", "expectedChecks"],
  ] as const) {
    const sourceFile = project.getSourceFileOrThrow(resolveFromRepo(filePath));
    const initializer = sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration)
      .find((declaration) => declaration.getName() === variableName)
      ?.getInitializerOrThrow();
    const filter = initializer?.getDescendantsOfKind(SyntaxKind.CallExpression).find((call) => {
      const callee = call.getExpression();
      return Node.isPropertyAccessExpression(callee) && callee.getName() === "filter";
    });
    if (!initializer || !filter) throw new Error(`${variableName} filter fixture is missing.`);
    filter.replaceWithText("planEntry.bindings");
    const unfilteredValue = initializer.getText();
    initializer.replaceWithText(`(() => {
      const discardedFilter = () => planEntry.bindings.filter((binding) => binding.evidenceMode !== "real-chrome");
      void discardedFilter;
      return ${unfilteredValue};
    })()`);
  }
  const result = inspectRound8Surface(buildContext(project), "APEX-AUDIT-005-V1");
  assert.equal(result.findings.some((finding) =>
    finding.checkId === "audit-system/runner-law-truth"
    && finding.message.includes("real-chrome")), true,
  "receipt governance must reject a real-Chrome filter discarded inside the returned initializer.");
};

const runRealChromeDecoyReceiverFilterAttack = (): void => {
  const project = resetAttackProject();
  for (const [filePath, variableName] of [
    ["scripts/audit/shared/inspector-check-session.ts", "executedChecks"],
    ["scripts/audit/core/run-generated-plan.ts", "expectedChecks"],
  ] as const) {
    const sourceFile = project.getSourceFileOrThrow(resolveFromRepo(filePath));
    const initializer = sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration)
      .find((declaration) => declaration.getName() === variableName)
      ?.getInitializerOrThrow();
    const filter = initializer?.getDescendantsOfKind(SyntaxKind.CallExpression).find((call) => {
      const callee = call.getExpression();
      return Node.isPropertyAccessExpression(callee) && callee.getName() === "filter";
    });
    if (!filter) throw new Error(`${variableName} filter fixture is missing.`);
    const receiver = filter.getExpression().asKindOrThrow(SyntaxKind.PropertyAccessExpression).getExpression();
    receiver.replaceWithText("({ filter: (_predicate: unknown) => planEntry.bindings })");
  }
  const result = inspectRound8Surface(buildContext(project), "APEX-AUDIT-005-V1");
  assert.equal(result.findings.some((finding) =>
    finding.checkId === "audit-system/runner-law-truth"
    && finding.message.includes("real-chrome")), true,
  "receipt governance must reject an exact filter callback executed on a decoy receiver that returns unfiltered bindings.");
};

const runAcceptanceAuthorityDiscardedOwnerResolutionAttack = (): void => {
  const project = resetAttackProject();
  const source = project.getSourceFileOrThrow(resolveFromRepo("scripts/audit/ci-acceptance-leaf-plan.ts"));
  const authority = source.getVariableDeclarationOrThrow("acceptanceAuthority")
    .getInitializerIfKindOrThrow(SyntaxKind.ArrowFunction);
  const ownerMatches = authority.getBody().getDescendantsOfKind(SyntaxKind.VariableDeclaration)
    .find((declaration) => declaration.getName() === "ownerMatches");
  if (!ownerMatches) throw new Error("acceptance owner resolution fixture is missing.");
  const original = ownerMatches.getInitializerOrThrow().getText();
  ownerMatches.setInitializer('[{ candidate: { evidenceMode: "static" }, ownerId: "decoy-owner" }]');
  authority.getBody().asKindOrThrow(SyntaxKind.Block).insertStatements(2, `
    const discardedOwnerResolution = () => ${original};
    void discardedOwnerResolution;
  `);
  const result = inspectRound8Surface(buildContext(project), "APEX-AUDIT-005-V1");
  assert.equal(result.findings.some((finding) =>
    finding.checkId === "audit-system/ci-full-entry-gate"
    && finding.message.includes("complete physical skeleton")), true,
  "receipt governance must reject a decoy acceptance owner while the real generated-plan resolution is discarded.");
};

const runEntryGateReorderAttack = (): void => {
  const project = resetAttackProject();
  const ciFull = project.getSourceFileOrThrow(resolveFromRepo("scripts/audit/ci-full.ts"));
  const main = ciFull.getVariableDeclarationOrThrow("main")
    .getInitializerIfKindOrThrow(SyntaxKind.ArrowFunction);
  const body = main.getBody();
  if (!Node.isBlock(body)) throw new Error("ci-full main block fixture is missing.");
  const firstExecutable = body.getStatements().find((statement) =>
    statement.getKind() === SyntaxKind.ExpressionStatement);
  if (!firstExecutable) throw new Error("ci-full first executable fixture is missing.");
  firstExecutable.replaceWithText(`
    await runCommandStepOrFail("typecheck", 4, typecheckStep, completedSteps, failFast);
    await runCommandStepOrFail("codex-entry-gate", 0, codexEntryGateStep, completedSteps, failFast);
  `);
  const result = inspectRound8Surface(buildContext(project), "APEX-AUDIT-005-V1");
  assert.equal(result.findings.some((finding) =>
    finding.checkId === "audit-system/ci-full-entry-gate"
    && finding.message.includes("complete physical skeleton")), true,
  "receipt governance must reject a codex entry gate moved behind another physical phase.");
};

const runEntryGateInitializerAttack = (): void => {
  const project = resetAttackProject();
  const ciFull = project.getSourceFileOrThrow(resolveFromRepo("scripts/audit/ci-full.ts"));
  const main = ciFull.getVariableDeclarationOrThrow("main")
    .getInitializerIfKindOrThrow(SyntaxKind.ArrowFunction);
  const body = main.getBody();
  if (!Node.isBlock(body)) throw new Error("ci-full main block fixture is missing.");
  const entryGate = body.getDescendantsOfKind(SyntaxKind.CallExpression).find((call) =>
    Node.isIdentifier(call.getExpression())
    && call.getExpression().getText() === "runCommandStepOrFail");
  const statement = entryGate?.getFirstAncestorByKind(SyntaxKind.ExpressionStatement);
  if (!statement) throw new Error("ci-full entry-gate fixture is missing.");
  body.insertStatements(body.getStatements().indexOf(statement), `
    const prematurePhase = await runCommandStepOrFail("typecheck", 4, typecheckStep, completedSteps, failFast);
    void prematurePhase;
  `);
  const result = inspectRound8Surface(buildContext(project), "APEX-AUDIT-005-V1");
  assert.equal(result.findings.some((finding) =>
    finding.checkId === "audit-system/ci-full-entry-gate"
    && finding.message.includes("complete physical skeleton")), true,
  "receipt governance must reject a physical phase hidden in a variable initializer before the entry gate.");
};

const runEntryGateUnknownInitializerAttack = (): void => {
  const project = resetAttackProject();
  const ciFull = project.getSourceFileOrThrow(resolveFromRepo("scripts/audit/ci-full.ts"));
  const main = ciFull.getVariableDeclarationOrThrow("main")
    .getInitializerIfKindOrThrow(SyntaxKind.ArrowFunction);
  const body = main.getBody();
  if (!Node.isBlock(body)) throw new Error("ci-full main block fixture is missing.");
  const firstStatement = body.getStatements()[0];
  if (!firstStatement) throw new Error("ci-full setup fixture is missing.");
  body.insertStatements(body.getStatements().indexOf(firstStatement), `
    const prematureUnknownWork = await Promise.resolve("audit work before gate");
    void prematureUnknownWork;
  `);
  const result = inspectRound8Surface(buildContext(project), "APEX-AUDIT-005-V1");
  assert.equal(result.findings.some((finding) =>
    finding.checkId === "audit-system/ci-full-entry-gate"
    && finding.message.includes("complete physical skeleton")), true,
  "receipt governance must reject unknown awaited work hidden in an initializer before the entry gate.");
};

const runCommandCleanupUncalledDecoyAttack = (): void => {
  const project = resetAttackProject();
  const source = project.getSourceFileOrThrow(resolveFromRepo("scripts/audit/ci-command-runner.ts"));
  const execute = source.getVariableDeclarationOrThrow("executeBoundedCommand")
    .getInitializerIfKindOrThrow(SyntaxKind.ArrowFunction);
  const waitCall = execute.getDescendantsOfKind(SyntaxKind.CallExpression).find((call) =>
    Node.isIdentifier(call.getExpression())
    && call.getExpression().getText() === "waitForProcessGroupTermination");
  const statement = waitCall?.getFirstAncestorByKind(SyntaxKind.VariableStatement);
  if (!statement) throw new Error("command cleanup wait fixture is missing.");
  statement.replaceWithText(`
    const terminated = true;
    const discardedCleanupProof = () => waitForProcessGroupTermination(child.pid);
    void discardedCleanupProof;
  `);
  const result = inspectRound8Surface(buildContext(project), "APEX-AUDIT-005-V1");
  assert.equal(result.findings.some((finding) =>
    finding.checkId === "audit-system/ci-full-entry-gate"
    && finding.message.includes("hard deadline")), true,
  "receipt governance must reject process cleanup evidence that exists only in an uncalled closure.");
};

const runCommandCleanupUnreachableDecoyAttack = (): void => {
  const project = resetAttackProject();
  const source = project.getSourceFileOrThrow(resolveFromRepo("scripts/audit/ci-command-runner.ts"));
  const execute = source.getVariableDeclarationOrThrow("executeBoundedCommand")
    .getInitializerIfKindOrThrow(SyntaxKind.ArrowFunction);
  const waitCall = execute.getDescendantsOfKind(SyntaxKind.CallExpression).find((call) =>
    Node.isIdentifier(call.getExpression())
    && call.getExpression().getText() === "waitForProcessGroupTermination");
  const statement = waitCall?.getFirstAncestorByKind(SyntaxKind.VariableStatement);
  if (!statement) throw new Error("command cleanup wait fixture is missing.");
  statement.replaceWithText(`
    const terminated = true;
    if (false) {
      await waitForProcessGroupTermination(child.pid);
    }
  `);
  const result = inspectRound8Surface(buildContext(project), "APEX-AUDIT-005-V1");
  assert.equal(result.findings.some((finding) =>
    finding.checkId === "audit-system/ci-full-entry-gate"
    && finding.message.includes("hard deadline")), true,
  "receipt governance must reject process cleanup evidence that exists only in an unreachable branch.");
};

const runCommandCleanupHollowWaitHelperAttack = (): void => {
  const project = resetAttackProject();
  const source = project.getSourceFileOrThrow(resolveFromRepo("scripts/audit/ci-command-runner.ts"));
  const waitHelper = source.getVariableDeclarationOrThrow("waitForProcessGroupTermination")
    .getInitializerIfKindOrThrow(SyntaxKind.ArrowFunction);
  waitHelper.setBodyText(`
    const discardedPoll = async () => {
      const deadlineMs = Date.now() + 5_000;
      while (processGroupIsAlive(pid) && Date.now() < deadlineMs) await delay(50);
      return !processGroupIsAlive(pid);
    };
    void discardedPoll;
    return true;
  `);
  const result = inspectRound8Surface(buildContext(project), "APEX-AUDIT-005-V1");
  assert.equal(result.findings.some((finding) =>
    finding.checkId === "audit-system/ci-full-entry-gate"
    && finding.message.includes("hard deadline")), true,
  "receipt governance must reject a hollow process-group wait helper with a decoy polling closure.");
};

const runCommandCleanupHollowTerminateHelperAttack = (): void => {
  const project = resetAttackProject();
  const source = project.getSourceFileOrThrow(resolveFromRepo("scripts/audit/ci-command-runner.ts"));
  const terminateHelper = source.getVariableDeclarationOrThrow("terminateProcessGroup")
    .getInitializerIfKindOrThrow(SyntaxKind.ArrowFunction);
  terminateHelper.setBodyText(`
    if (pid === undefined) return;
    process.kill(999_999, "SIGTERM");
    const discardedBoundKill = () => process.kill(pid, signal);
    void discardedBoundKill;
  `);
  const result = inspectRound8Surface(buildContext(project), "APEX-AUDIT-005-V1");
  assert.equal(result.findings.some((finding) =>
    finding.checkId === "audit-system/ci-full-entry-gate"
    && finding.message.includes("hard deadline")), true,
  "receipt governance must reject a termination helper that kills an unrelated pid and hides the bound kill in a decoy closure.");
};

const runWorkerCleanupUncalledDecoyAttack = (): void => {
  const project = resetAttackProject();
  const source = project.getSourceFileOrThrow(resolveFromRepo("scripts/audit/ci-audit-plan-runner.ts"));
  const deadline = source.getVariableDeclarationOrThrow("runGeneratedPlanWithDeadline")
    .getInitializerIfKindOrThrow(SyntaxKind.ArrowFunction)
    .getDescendantsOfKind(SyntaxKind.CallExpression).find((call) => {
      const callee = call.getExpression();
      return Node.isPropertyAccessExpression(callee) && callee.getName() === "terminate";
    });
  const statement = deadline?.getFirstAncestorByKind(SyntaxKind.ExpressionStatement);
  if (!statement) throw new Error("worker termination fixture is missing.");
  statement.replaceWithText(`
    rejectPromise(new Error("worker timed out without termination"));
    const discardedTerminationProof = () => worker.terminate().then(
      (exitCode) => rejectPromise(new Error(String(exitCode))),
      rejectPromise,
    );
    void discardedTerminationProof;
  `);
  const result = inspectRound8Surface(buildContext(project), "APEX-AUDIT-005-V1");
  assert.equal(result.findings.some((finding) =>
    finding.checkId === "audit-system/ci-full-entry-gate"
    && finding.message.includes("hard deadline")), true,
  "receipt governance must reject worker termination evidence that exists only in an uncalled closure.");
};

const runWorkerCleanupUnreachableDecoyAttack = (): void => {
  const project = resetAttackProject();
  const source = project.getSourceFileOrThrow(resolveFromRepo("scripts/audit/ci-audit-plan-runner.ts"));
  const deadline = source.getVariableDeclarationOrThrow("runGeneratedPlanWithDeadline")
    .getInitializerIfKindOrThrow(SyntaxKind.ArrowFunction)
    .getDescendantsOfKind(SyntaxKind.CallExpression).find((call) => {
      const callee = call.getExpression();
      return Node.isPropertyAccessExpression(callee) && callee.getName() === "terminate";
    });
  const statement = deadline?.getFirstAncestorByKind(SyntaxKind.ExpressionStatement);
  if (!statement) throw new Error("worker termination fixture is missing.");
  statement.replaceWithText(`
    rejectPromise(new Error("worker timed out without termination"));
    if (false) {
      void worker.terminate().then(
        (exitCode) => rejectPromise(new Error(String(exitCode))),
        rejectPromise,
      );
    }
  `);
  const result = inspectRound8Surface(buildContext(project), "APEX-AUDIT-005-V1");
  assert.equal(result.findings.some((finding) =>
    finding.checkId === "audit-system/ci-full-entry-gate"
    && finding.message.includes("hard deadline")), true,
  "receipt governance must reject worker termination evidence that exists only in an unreachable branch.");
};


export const runRound8PhysicalReceiptAttacks = (): void => {
  runCommandCleanupUncalledDecoyAttack();
  runCommandCleanupUnreachableDecoyAttack();
  runCommandCleanupHollowWaitHelperAttack();
  runCommandCleanupHollowTerminateHelperAttack();
  runWorkerCleanupUncalledDecoyAttack();
  runWorkerCleanupUnreachableDecoyAttack();
  runAcceptanceAuthorityDiscardedOwnerResolutionAttack();
  runEntryGateReorderAttack();
  runEntryGateInitializerAttack();
  runEntryGateUnknownInitializerAttack();
  runRealChromeDecoyFilterAttack();
  runRealChromeDiscardedInnerFilterAttack();
  runRealChromeDecoyReceiverFilterAttack();
  runAcceptancePlanPreEntryAttack();
  runDeferredAcceptanceNameHeuristicAttack();
  runFailureEvidenceLateAssignmentAttack();
  runCommandCleanupPostReturnAttack();
  runWorkerCleanupPostReturnAttack();
  runWorkerAdapterForgedSuccessAttack();
  runWorkerMessageEarlyResolveAttack();
};
