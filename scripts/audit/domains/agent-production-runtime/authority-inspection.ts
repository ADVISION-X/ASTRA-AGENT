import { Node, SyntaxKind } from "ts-morph";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";
import { inspectWorkerLoopLiveness } from "./worker-loop-inspection.js";
import { LAWS, RUNTIME_ROOT, bodyFor, booleanTerms, callNames, calls, compare, literal, reject, rejectingComparison, runtimePath, sourceFor } from "./contract-inspection.js";

const sqlStatements = (node: Node | undefined): string[] => calls(node).flatMap((call) => {
  const callee = call.getExpression();
  if (!Node.isPropertyAccessExpression(callee) || !["prepare", "exec", "pragma"].includes(callee.getName())) return [];
  const argument = call.getArguments()[0];
  const value = literal(argument);
  if (value !== undefined) return [value.toLowerCase().replace(/\s+/gu, " ").trim()];
  return Node.isTemplateExpression(argument) ? [argument.getText().toLowerCase().replace(/\s+/gu, " ")] : [];
});
const errors = (node: Node | undefined): string[] => calls(node, "executionFailure").flatMap((call) => {
  const argument = call.getArguments()[1];
  if (!argument) return [];
  return [argument, ...argument.getDescendantsOfKind(SyntaxKind.StringLiteral)].flatMap((entry) => {
    const value = literal(entry); return value === undefined ? [] : [value];
  });
});
const method = (context: InspectorContext, file: string, className: string, name: string) =>
  sourceFor(context, runtimePath(file)).getClass(className)?.getMethod(name);
const hasCall = (node: Node | undefined, name: string): boolean => callNames(node).has(name);
const productionSources = (context: InspectorContext) => context.targetPaths.filter((path) =>
  path.startsWith(`${RUNTIME_ROOT}/`) && path.endsWith(".ts")).map((path) => sourceFor(context, path));

const inspectResultStaging = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const path = runtimePath("store-outbox");
  const stage = method(context, "store-outbox", "ProductionStoreOutbox", "stageResultAndEnqueueTerminal");
  const transaction = calls(stage, "this.database.transaction")[0]?.getArguments()[0];
  const stagedCalls = calls(transaction, "this.stageResultInTerminalTransaction");
  const intentCalls = calls(transaction, "this.persistOutboxWrite");
  reject(findings, LAWS.core, "static.ast", path, "atomic-result-terminal-intent",
    stage !== undefined && calls(stage, "this.database.transaction").length === 1
    && stagedCalls.length === 1 && intentCalls.length === 1
    && stagedCalls[0]!.getStart() < intentCalls[0]!.getStart(),
    "Result stage and terminal intent must be persisted by the same original SQLite transaction before cleanup.");
  const staged = method(context, "store-task-state", "ProductionStoreTaskState", "stageResultInTerminalTransaction");
  const stageSql = sqlStatements(staged);
  reject(findings, LAWS.core, "static.ast", runtimePath("store-task-state"), "source-seal-stage-fence",
    staged?.hasModifier(SyntaxKind.ProtectedKeyword) === true
    && hasCall(staged, "this.sourceAttemptClosed")
    && compare(staged, "accepted!.current_attempt_id", SyntaxKind.ExclamationEqualsEqualsToken, "attemptId")
    && stageSql.some((sql) => /where job_id=\? and status='failed' and current_attempt_id=\?/u.test(sql)
      && /staged_result_json is null/u.test(sql))
    && errors(staged).includes("PRODUCTION_RESULT_ATTEMPT_FENCED"),
    "Only the exact current unsealed attempt may stage a result; diagnostics cannot substitute for its CAS.");
};
const inspectAdmissionCompletion = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const source = sourceFor(context, runtimePath("runtime-business-admission"));
  const admission = bodyFor(source, "reconcileBusinessAdmission");
  const completion = calls(admission, "state.store.completeTask")[0];
  const receiptGuard = admission?.getDescendantsOfKind(SyntaxKind.IfStatement).find((statement) =>
    statement.getExpression().getText() === "!admission");
  const identityGuard = admission?.getDescendantsOfKind(SyntaxKind.IfStatement).find((statement) =>
    compare(statement.getExpression(), "admission.result_payload_hash", SyntaxKind.ExclamationEqualsEqualsToken,
      "staged.result_payload_hash"));
  reject(findings, LAWS.admission, "static.ast", runtimePath("runtime-business-admission"), "admission-before-completion",
    completion !== undefined && receiptGuard !== undefined && identityGuard !== undefined
    && rejectingComparison(identityGuard.getExpression(), "admission.result_payload_hash", "staged.result_payload_hash")
    && rejectingComparison(identityGuard.getExpression(), "remote.terminal_payload_hash", "hashCanonical(staged)")
    && receiptGuard.getEnd() < completion.getStart() && identityGuard.getEnd() < completion.getStart()
    && errors(identityGuard).includes("BUSINESS_ADMISSION_RESULT_HASH_MISMATCH")
    && receiptGuard.getThenStatement().getDescendantsOfKind(SyntaxKind.ReturnStatement)
      .some((statement) => literal(statement.getExpression()) === "pending"),
    "Local completion requires actual Website admission and the same result hash; absence must return pending.");
};

const inspectWebsiteLifecycle = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const taskState = sourceFor(context, runtimePath("store-task-state"));
  const taskClass = taskState.getClass("ProductionStoreTaskState");
  const supersede = taskClass?.getMethod("supersedeUnsentWritesForWebsiteAttempt");
  const supersedeOwners = calls(taskClass, "this.supersedeUnsentWritesForWebsiteAttempt")
    .map((call) => call.getFirstAncestorByKind(SyntaxKind.MethodDeclaration)?.getName()).sort();
  const outbox = method(context, "store-outbox", "ProductionStoreOutbox", "deliverOutbox");
  const remoteFailure = bodyFor(sourceFor(context, runtimePath("runtime-claim")), "applyRemoteFailureDisposition");
  const startup = bodyFor(sourceFor(context, runtimePath("runtime-startup")), "reconcileStartupTasks");
  const admission = bodyFor(sourceFor(context, runtimePath("runtime-business-admission")), "reconcileBusinessAdmission");
  const forbiddenCalls = new Set(["state.store.endUnsentAttemptWrites", "state.store.discardStagedResult",
    "restoreBrowserHostVisibility", "this.releaseAttemptForWebsiteDecision"]);
  const noLocalEnded = productionSources(context).every((source) => !calls(source).some((call) =>
    forbiddenCalls.has(call.getExpression().getText()))
    && !source.getDescendantsOfKind(SyntaxKind.StringLiteral).some((node) =>
      /ATTEMPT_ENDED|attempt-replaced|PROCESS_RESTART_ATTEMPT_ENDED/u.test(node.getLiteralValue())));
  const valid = noLocalEnded && taskClass?.getMethod("discardStagedResult") === undefined
    && taskClass?.getMethod("releaseAttemptForWebsiteDecision") === undefined
    && supersede?.hasModifier(SyntaxKind.PrivateKeyword) === true
    && JSON.stringify(supersedeOwners) === JSON.stringify(["acceptTaskAfterSourceHandoff", "closeAttemptRefusedByWebsite"])
    && calls(outbox, "executionFailure").some((call) => call.getArguments()[1]?.getText() === "authority.lastError")
    && !hasCall(startup, "state.store.setCurrentReason")
    && compare(remoteFailure, "remote.next_action_code", SyntaxKind.EqualsEqualsEqualsToken, '"WAIT_NEW_ATTEMPT"')
    && compare(admission, "remote.next_action_code", SyntaxKind.EqualsEqualsEqualsToken, '"WAIT_NEW_ATTEMPT"');
  reject(findings, LAWS.core, "static.ast", runtimePath("runtime-claim"), "no-local-business-lifecycle-adjudication", valid,
    "Restart, failure and undelivered results must remain Website-owned decisions; local Outbox errors cannot end attempts.");
  const accept = taskClass?.getMethod("acceptTaskAfterSourceHandoff");
  reject(findings, LAWS.core, "static.ast", runtimePath("store-task-state"), "sealed-source-acceptance",
    accept !== undefined && compare(accept, "current.current_attempt_id", SyntaxKind.ExclamationEqualsEqualsToken,
      "archived.source_attempt_id") && compare(accept, "archived.sealed_at", SyntaxKind.EqualsEqualsEqualsToken, "null")
    && hasCall(accept, "this.supersedeUnsentWritesForWebsiteAttempt")
    && !accept.getDescendantsOfKind(SyntaxKind.IfStatement).some((statement) =>
      statement.getExpression().getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
        .some((node) => node.getName() === "current_reason")),
    "A different attempt may only accept from its exact typed source seal; current_reason is not an authority.");
};

const inspectCapacityAndSession = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const path = runtimePath("runtime-loops"), source = sourceFor(context, path);
  const inFlight = bodyFor(source, "businessInFlightJobIds");
  const count = bodyFor(source, "businessInFlightCount");
  const authority = bodyFor(source, "runtimeState");
  const set = inFlight?.getDescendantsOfKind(SyntaxKind.NewExpression).find((node) => node.getExpression().getText() === "Set");
  const active = calls(inFlight, "state.active.keys").length === 1;
  const pending = calls(inFlight, "state.store.taskAuthorities").length === 1;
  reject(findings, LAWS.core, "static.ast", path, "website-capacity-and-deduplication",
    set !== undefined && active && pending && hasCall(count, "businessInFlightJobIds")
    && calls(authority, "businessInFlightCount").length === 1
    && source.getDescendantsOfKind(SyntaxKind.BinaryExpression).some((node) =>
      node.getOperatorToken().getKind() === SyntaxKind.MinusToken
      && node.getLeft().getText() === "PRODUCTION_BUSINESS_CAPACITY_MAX"
      && node.getRight().getText() === "businessInFlightCount(state)"),
    "Claim capacity must deduplicate active and admission-pending jobs and remain bounded by Website authority.");
  const sessionPath = runtimePath("worker-session");
  const session = sourceFor(context, sessionPath).getClass("ProductionWorkerSession");
  reject(findings, LAWS.core, "static.ast", sessionPath, "atomic-session-claim",
    calls(session?.getMethod("requestClaim"), "this.runSessionAuthorityTurn").length === 1
    && calls(session?.getMethod("heartbeat"), "this.runSessionAuthorityTurn").length === 1,
    "Heartbeat and claim must serialize the same session generation through the original authority turn.");
  const cloud = sourceFor(context, runtimePath("cloud-client"));
  reject(findings, LAWS.core, "static.ast", runtimePath("cloud-client"), "one-session-claim-entry",
    calls(bodyFor(cloud, "claimProductionTasks"), "session.requestClaim").length === 1
    && calls(bodyFor(cloud, "claimProductionTasks"), "session.request").length === 0,
    "Claim must consume the current session attestation rather than send a second unbound transport request.");
};

const inspectCooldown = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const path = runtimePath("provider-rate-limit-control"), source = sourceFor(context, path);
  const owner = source.getClass("ProviderRateLimitControl");
  const begin = owner?.getMethod("beginIncident");
  const gate = owner?.getMethod("canRequestClaimAuthority");
  const observe = owner?.getMethod("observeWebsiteAuthority");
  const enqueue = calls(begin, "this.store.enqueue")[0];
  const returnHandle = begin?.getDescendantsOfKind(SyntaxKind.ReturnStatement)[0];
  const loops = sourceFor(context, runtimePath("runtime-loops"));
  const valid = enqueue !== undefined && returnHandle !== undefined && enqueue.getStart() < returnHandle.getStart()
    && hasCall(gate, "this.store.hasUndeliveredProviderCooldown")
    && hasCall(owner?.getMethod("assertProviderSubmitAllowed"), "this.store.hasUndeliveredProviderCooldown")
    && hasCall(observe, "this.store.latestProviderCooldownClearance")
    && compare(observe, "Date.parse(input.serverNow)", SyntaxKind.LessThanToken, "Date.parse(latestIncidentServerNow)")
    && calls(source, "Date.now").length === 0
    && hasCall(loops, "state.providerRateLimitControl.canRequestClaimAuthority")
    && hasCall(loops, "state.providerRateLimitControl.observeWebsiteAuthority")
    && hasCall(owner?.getMethod("reconcilePendingIntents"), "this.store.deliverOutbox");
  reject(findings, LAWS.core, "static.ast", path, "provider-cooldown-durable-authority", valid,
    "A durable intent must close claim/submit before acknowledgement, and only Website clearance may reopen it.");
  const receipt = bodyFor(sourceFor(context, runtimePath("provider-cooldown-receipt")), "parseProviderCooldownReceipt");
  reject(findings, LAWS.database, "static.ast", runtimePath("provider-cooldown-receipt"), "cooldown-receipt-full-hash",
    compare(receipt, "receiptHash", SyntaxKind.ExclamationEqualsEqualsToken, "hashCanonical(core)"),
    "Live and hydrated cooldown authority must close its canonical receipt hash.");
};

const inspectCredential = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const path = runtimePath("credential"), source = sourceFor(context, path);
  const codes = [...calls(source, "credentialFailure"), ...calls(source, "credentialMetadata")].flatMap((call) => call.getArguments().flatMap((argument) =>
    [argument, ...argument.getDescendantsOfKind(SyntaxKind.StringLiteral)].map(literal).filter((value) => value !== undefined)));
  reject(findings, LAWS.credential, "static.ast", path, "credential-distinct-failures",
    ["PARENT_MISSING", "MISSING", "PARENT_PERMISSIONS_INVALID", "FILE_PERMISSIONS_INVALID", "SYMLINK_INVALID",
      "JSON_INVALID", "SCHEMA_INVALID", "ORIGIN_INVALID"].every((suffix) => codes.includes(`PRODUCTION_CREDENTIAL_${suffix}`))
    && hasCall(bodyFor(source, "readProductionCredential"), "parseProductionCredential")
    && hasCall(bodyFor(source, "readProductionCredential"), "assertCredentialOrigins"),
    "The unique credential reader must reject all distinct typed failure categories before execution.");
};

const inspectStorage = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const path = runtimePath("runtime-storage-inventory"), inventory = sourceFor(context, path);
  const mutationNames = new Set(["mkdir", "rename", "rm", "unlink", "writeFile", "copyFile"]);
  const writes = inventory.getImportDeclarations().filter((declaration) => declaration.getModuleSpecifierValue().startsWith("node:fs"))
    .flatMap((declaration) => declaration.getNamedImports().map((entry) => entry.getName()))
    .filter((name) => mutationNames.has(name));
  const startup = sourceFor(context, runtimePath("runtime-startup"));
  reject(findings, LAWS.storage, "static.ast", path, "readonly-inventory-startup-gate",
    writes.length === 0 && calls(startup, "readProductionRuntimeStorageInventory").length > 0
    && calls(startup, "store.storageResponsibilities").length > 0
    && errors(startup).includes("PRODUCTION_ORPHAN_STORAGE_RECONCILIATION_REQUIRED"),
    "Storage inventory must remain read-only and block new execution on orphan or ambiguous ownership.");
  const source = sourceFor(context, runtimePath("runtime-business-admission"));
  const absent = bodyFor(source, "websiteJobAbsent");
  const purge = bodyFor(source, "purgeDeletedJob");
  const allowed = absent?.getDescendantsOfKind(SyntaxKind.BinaryExpression).filter((binary) =>
    binary.getLeft().getText() === "code" && binary.getOperatorToken().getKind() === SyntaxKind.EqualsEqualsEqualsToken)
    .map((binary) => literal(binary.getRight())).sort();
  reject(findings, LAWS.storage, "static.ast", runtimePath("runtime-business-admission"), "exact-deleted-job-owner-cleanup",
    JSON.stringify(allowed) === JSON.stringify(["AI_PRODUCTION_JOB_NOT_FOUND", "AI_V6_JOB_NOT_FOUND"])
    && ["state.browserAuthority.releaseJobBoundTarget", "state.browserAuthority.purgeBrowserJob",
      "state.evidenceStore.deleteArtifactsForMission", "purgeProductionRuntimeTask", "state.store.purgeJob"]
      .every((name) => calls(purge, name).some((call) => call.getArguments().some((argument) => argument.getText() === "jobId")))
    && errors(bodyFor(source, "purgeProductionRuntimeTask")).includes("PRODUCTION_STORAGE_PURGE_INCOMPLETE"),
    "Only exact Website job absence may clear every original local Owner, with task-path absence readback.");
};

const renewalRetryPolicyIsTransportOnly = (retryable: Node | undefined): boolean => {
  const retryBody = Node.isArrowFunction(retryable) ? retryable.getBody() : undefined;
  const retryStatements = Node.isBlock(retryBody) ? retryBody.getStatements() : [];
  const transportBranch = retryStatements[1];
  const finalRetry = retryStatements[2];
  const branchReturn = Node.isIfStatement(transportBranch) ? transportBranch.getThenStatement() : undefined;
  const transportTerms = Node.isReturnStatement(branchReturn)
    ? booleanTerms(branchReturn.getExpression(), SyntaxKind.AmpersandAmpersandToken) : [];
  return compare(retryable, "transport.httpStatus", SyntaxKind.GreaterThanEqualsToken, "500")
    && retryStatements.length === 3 && Node.isVariableStatement(retryStatements[0])
    && Node.isIfStatement(transportBranch) && transportBranch.getExpression().getText() === "transport"
    && transportTerms.length === 2 && Node.isReturnStatement(finalRetry)
    && finalRetry.getExpression()?.getText() === 'typedExecutionFailure(error)?.code === "CLOUD_TRANSPORT_UNAVAILABLE"'
    && compare(retryable, "transport.httpStatus", SyntaxKind.LessThanToken, "600")
    && compare(retryable, "typedExecutionFailure(error)?.code", SyntaxKind.EqualsEqualsEqualsToken, '"CLOUD_TRANSPORT_UNAVAILABLE"');
};
const inspectLeaseRenewal = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const path = runtimePath("runtime-execution-heartbeat"), source = sourceFor(context, path);
  const retryable = bodyFor(source, "renewFailureRetryable"), renew = bodyFor(source, "renewWithinBudget");
  const call = calls(renew, "renewProductionLease")[0];
  const waitCall = calls(renew, "wait")[0];
  const budget = renew?.getDescendantsOfKind(SyntaxKind.BinaryExpression).some((binary) =>
    binary.getOperatorToken().getKind() === SyntaxKind.MinusToken
    && binary.getLeft().getText() === "input.budget.expires_at_monotonic"
    && binary.getRight().getText() === "performance.now()");
  reject(findings, LAWS.core, "static.ast", path, "same-lease-monotonic-renewal",
    renewalRetryPolicyIsTransportOnly(retryable)
    && call?.getArguments().map((argument) => argument.getText()).join(",") === "input.session,input.job,undefined,input.signal"
    && budget === true && compare(renew, "waitMs", SyntaxKind.LessThanEqualsToken, "0")
    && waitCall?.getArguments().map((argument) => argument.getText()).join(",") === "waitMs,input.signal"
    && calls(renew, "renewFailureRetryable").length === 1,
    "Only retryable transport/5xx may renew the same lease within its monotonic budget; 4xx or invalid schema must stop immediately.");
};
const inspectFirstFailure = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const claim = sourceFor(context, runtimePath("runtime-claim"));
  const persist = bodyFor(claim, "persistAttemptFailure");
  const orderedCalls = ["serializeTerminalFailureTransport", "buildProductionLeaseRelease", "firstFact",
    "state.store.recordAttemptFailure", "postFailureAndReadback"].map((name) => calls(persist, name));
  const positions = orderedCalls.map((list) => list[0]?.getStart() ?? -1);
  const readback = bodyFor(sourceFor(context, runtimePath("runtime-attempt-failure-readback")), "postFailureAndReadback");
  const post = calls(readback, "releaseLeaseWithLog")[0], get = calls(readback, "readProductionDeviceJobStatus")[0];
  const current = calls(readback, "assertAttemptFailureReadback")[0];
  const record = method(context, "store-task-state", "ProductionStoreTaskState", "recordAttemptFailure");
  const immutable = record?.getDescendantsOfKind(SyntaxKind.IfStatement).find((statement) =>
    errors(statement.getThenStatement()).includes("PRODUCTION_ATTEMPT_FAILURE_IMMUTABLE"));
  const immutableTerms = booleanTerms(immutable?.getExpression(), SyntaxKind.AmpersandAmpersandToken);
  const recordSql = sqlStatements(record);
  reject(findings, LAWS.core, "static.ast", runtimePath("runtime-claim"), "first-fact-before-release",
    orderedCalls.every((list) => list.length === 1) && positions.every((position, index) =>
      position >= 0 && (index === 0 || position > positions[index - 1]!))
    && post !== undefined && get !== undefined && current !== undefined
    && post.getStart() < get.getStart() && get.getStart() < current.getStart(),
    "Serialize→canonical builder→first fact→durable CAS must precede release, and ambiguous release must use exact Website readback.");
  reject(findings, LAWS.core, "static.ast", runtimePath("store-task-state"), "immutable-first-fact-cas",
    calls(record, "this.database.transaction").length === 1 && immutableTerms.length === 2
    && immutableTerms.some((term) => term.getText() === "existing.attempt_failure_json")
    && immutableTerms.some((term) => rejectingComparison(term, "existing.attempt_failure_json", "serialized"))
    && recordSql.some((sql) => /set attempt_failure_json=coalesce\(attempt_failure_json,\?\)/u.test(sql)
      && /where job_id=\? and status='failed' and current_attempt_id=\?/u.test(sql)),
    "The original transaction must reject a different first fact and preserve its original bytes in exact-attempt SQL.");
};
const inspectContinuation = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const executor = sourceFor(context, runtimePath("executor")).getClass("ProductionExecutor");
  const parent = executor?.getMethod("readContinuationParent");
  const dispatch = executor?.getMethod("dispatchPlugin");
  const parentGuard = parent?.getDescendantsOfKind(SyntaxKind.IfStatement).find((statement) =>
    errors(statement.getThenStatement()).includes("PRODUCTION_PARENT_RESULT_BINDING_INVALID"));
  const parentTerms = booleanTerms(parentGuard?.getExpression(), SyntaxKind.AmpersandAmpersandToken);
  reject(findings, LAWS.core, "static.ast", runtimePath("executor"), "completed-parent-exact-locator",
    parentTerms.length === 2 && parentTerms[0]?.getText() === "parent"
    && rejectingComparison(parentTerms[1], "parent.status", '"completed"')
    && rejectingComparison(parentTerms[1], "parent.result.result_payload_ref", "task.parent_result_ref")
    && rejectingComparison(parentTerms[1], "parent.result.result_payload_hash", "task.parent_result_hash")
    && hasCall(dispatch, "this.readContinuationParent")
    && dispatch?.getDescendantsOfKind(SyntaxKind.PropertyAssignment).some((property) =>
      property.getName() === "acceptedAttemptId" && property.getInitializer()?.getText() === "parent.current_attempt_id") === true,
    "Continuation may consume only the exact completed direct-parent result and its original accepted attempt locator.");
};

const inspectAuthorityReader = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const path = runtimePath("store-authority-reader"), source = sourceFor(context, path);
  const codes = errors(source);
  const readers = source.getDescendantsOfKind(SyntaxKind.NewExpression).filter((node) => node.getExpression().getText() === "Database");
  const options = readers[0]?.getArguments()[1];
  const readOnly = Node.isObjectLiteralExpression(options) && ["readonly", "fileMustExist"].every((name) => {
    const property = options.getProperty(name);
    return Node.isPropertyAssignment(property) && property.getInitializer()?.getKind() === SyntaxKind.TrueKeyword;
  });
  const resolver = bodyFor(sourceFor(context, runtimePath("store-foundation")), "resolveProductionAuthority");
  const outcomes = resolver?.getDescendantsOfKind(SyntaxKind.StringLiteral).map((node) => node.getLiteralValue()) ?? [];
  reject(findings, LAWS.database, "static.ast", path, "authority-distinct-readonly-reader",
    readers.length === 1 && readOnly && ["MISSING", "UNREADABLE", "CORRUPT"].every((suffix) =>
      codes.includes(`PRODUCTION_AUTHORITY_STORE_${suffix}`))
    && hasCall(resolver, "reader.readTask") && hasCall(resolver, "reader.readOutboxAuthority")
    && compare(resolver, "hashCanonical(value)", SyntaxKind.EqualsEqualsEqualsToken, "authorityHash")
    && ["verified", "missing", "mismatch"].every((value) => outcomes.includes(value))
    && !source.getDescendantsOfKind(SyntaxKind.CatchClause).some((clause) =>
      clause.getDescendantsOfKind(SyntaxKind.ReturnStatement).some((statement) => literal(statement.getExpression()) === "missing")),
    "Store missing/unreadable/corrupt, record missing and hash mismatch must remain five distinct read-only outcomes.");
};

const inspectOutboxJobBoundaries = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const path = runtimePath("store-outbox"), source = sourceFor(context, path);
  const sql = sqlStatements(source);
  const marker = bodyFor(source, "jobPathMarker");
  const receipts = bodyFor(sourceFor(context, runtimePath("store-outbox-receipt")), "assertReceiptIdentity");
  reject(findings, LAWS.database, "static.ast", path, "outbox-job-boundary",
    sql.some((statement) => /instr\(path,\?\)>0/u.test(statement))
    && !sql.some((statement) => /path\s+like/u.test(statement))
    && calls(marker, "encodeURIComponent").some((call) => call.getArguments()[0]?.getText() === "jobId")
    && compare(receipts, "decodeURIComponent(pathJobId)", SyntaxKind.ExclamationEqualsEqualsToken, "jobId"),
    "Outbox SQL and receipt identity must select one literal encoded job segment, without wildcard deletion or readback.");
  const proofPath = "scripts/acceptance/agent-production-runtime.real-proof-support.ts";
  const proof = sourceFor(context, proofPath);
  const proofSql = sqlStatements(proof);
  reject(findings, LAWS.dynamicProof, "static.ast", proofPath, "proof-outbox-job-boundary",
    proofSql.some((statement) => /instr\(path,\?\)>0/u.test(statement))
    && !proofSql.some((statement) => /path\s+like/u.test(statement))
    && calls(bodyFor(proof, "sentProductionCheckpointPrefix"), "encodeURIComponent")
      .some((call) => call.getArguments()[0]?.getText() === "jobId"),
    "The retained proof reader must stay exact-job and read-only, separate from production business execution.");
};

export const inspectAgentAuthorityAst = (context: InspectorContext, findings: InspectorFinding[]): void => {
  inspectResultStaging(context, findings);
  inspectAdmissionCompletion(context, findings);
  inspectWebsiteLifecycle(context, findings);
  inspectCapacityAndSession(context, findings);
  inspectCooldown(context, findings);
  inspectCredential(context, findings);
  inspectStorage(context, findings);
  inspectLeaseRenewal(context, findings);
  inspectFirstFailure(context, findings);
  inspectContinuation(context, findings);
  inspectAuthorityReader(context, findings);
  inspectOutboxJobBoundaries(context, findings);
  inspectWorkerLoopLiveness(context, findings);
};

const existingSchemaIsVerified = (initializer: Node | undefined, current: Node | undefined): boolean =>
  sqlStatements(initializer).some((sql) => sql === "journal_mode")
  && compare(initializer, 'String(database.pragma("journal_mode", { simple: true })).toLowerCase()',
    SyntaxKind.ExclamationEqualsEqualsToken, '"wal"')
  && sqlStatements(current).some((sql) => sql === "integrity_check")
  && sqlStatements(current).some((sql) => sql === "foreign_key_check")
  && hasCall(initializer, "invalidJsonCount") && hasCall(initializer, "stateInvariantFailureCount")
  && errors(initializer).includes("PRODUCTION_SCHEMA_MIGRATION_REQUIRED")
  && errors(initializer).includes("PRODUCTION_DATA_CORRUPT")
  && !sqlStatements(initializer).some((sql) => /\b(?:alter|drop|update|delete)\b/u.test(sql));

export function inspectAgentSql(context: InspectorContext, findings: InspectorFinding[]): void {
  const path = runtimePath("store-foundation"), source = sourceFor(context, path);
  const schema = literal(source.getVariableDeclaration("productionSchemaSql")?.getInitializer()) ?? "";
  const tables = [...schema.matchAll(/create table (production_[a-z_]+)\(/gu)].map((match) => match[1]).sort();
  const expected = ["production_attempt_handoffs", "production_outbox", "production_tasks"];
  const initializer = bodyFor(source, "initializeOrAssertCurrentSchema");
  const firstInstall = initializer?.getDescendantsOfKind(SyntaxKind.IfStatement).find((statement) =>
    compare(statement.getExpression(), "productionTables.length", SyntaxKind.EqualsEqualsEqualsToken, "0"));
  const create = calls(initializer, "createProductionTables");
  const shape = bodyFor(source, "exactTableShape");
  const current = bodyFor(source, "currentSchemaPresent");
  const queries = sqlStatements(shape);
  const readback = ["sqlite_master", "pragma table_info", "pragma index_list", "pragma index_info", "pragma foreign_key_list"]
    .every((token) => queries.some((sql) => sql.includes(token)));
  const valid = JSON.stringify(tables) === JSON.stringify(expected) && firstInstall !== undefined
    && create.length === 1 && create[0]!.getStart() > firstInstall.getStart() && create[0]!.getEnd() < firstInstall.getEnd()
    && readback && hasCall(current, "exactTableShape")
    && existingSchemaIsVerified(initializer, current);
  reject(findings, LAWS.database, "static.sql", path, "exact-three-table-readonly-startup", valid,
    "Only first empty installation may create the exact three tables; existing startup must verify schema/WAL/integrity/data without migration.");
  const invariant = sqlStatements(bodyFor(source, "stateInvariantFailureCount"));
  reject(findings, LAWS.database, "static.sql", path, "persisted-business-data-invariants",
    invariant.some((sql) => /current_attempt_id=''/u.test(sql)
      && /response_hash is not null and sent_at is null/u.test(sql))
    && hasCall(method(context, "store-ledger", "ProductionRuntimeStore", "assertStartupDataIntegrity"), "stateInvariantFailureCount"),
    "Stored business identity and Outbox receipt state must be checked both at construction and startup.");
}
