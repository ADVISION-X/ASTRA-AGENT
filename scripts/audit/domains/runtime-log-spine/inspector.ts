import { existsSync, readFileSync } from "node:fs";
import { extname, resolve } from "node:path";
import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../shared/finding-utils.js";
import type {
  InspectorContext,
  InspectorFinding,
  SessionInspectorOutput,
  StaticCheckReceipt,
} from "../../shared/inspector-contracts.js";
import {
  producerModePassed,
  recordStaticCheck,
  staticClauses,
  staticEvidenceRefs,
  validateStaticInspection,
} from "../../shared/static-inspection-contract.js";

const LAW_OPERATIONAL = "LAW-RUNTIME-LOG-SPINE-001-V7";
const LAW_PRIVACY = "LAW-RUNTIME-LOG-SPINE-002-V4";
const LAW_STRUCTURE = "LAW-RUNTIME-LOG-SPINE-003-V6";
const SOURCE_EXTENSIONS = new Set([".js", ".mjs", ".mts", ".ts"]);
const TERMINAL_PROTOCOL_OUTPUTS = new Set([
  "scripts/startup/lib/dependency-check.mjs",
  "scripts/startup/production-runtime-cloud-enroll.ts",
  "scripts/runtime-logs/inspect.ts",
  "src/lib/browser/chrome-extension/build.mjs",
]);
const RETIRED_PATHS = [
  "scripts/startup/lib/startup-failure-bundle.mjs",
  "scripts/startup/lib/terminal-structured-log.mjs",
  "scripts/startup/lib/terminal-structured-runtime-relay.mjs",
  "src/lib/local-runtime/structured-log-bus.ts",
  "src/lib/local-runtime/structured-log-terminal.ts",
  "src/lib/runtime-logs/debug-bundle-contract.ts",
  "src/lib/runtime-logs/debug-bundle-index.ts",
  "src/lib/runtime-logs/debug-bundle.ts",
  "src/lib/runtime-logs/event-factory.ts",
  "src/lib/runtime-logs/event-types.ts",
  "src/lib/runtime-logs/evidence-contract.ts",
  "src/lib/runtime-logs/failure-classes.ts",
  "src/lib/runtime-logs/redaction-contract.ts",
  "src/lib/runtime-logs/stage-logger.ts",
  "src/lib/runtime-logs/structured-log-contract.ts",
  "src/lib/runtime-logs/trace-context.ts",
] as const;
const REQUIRED_CORE_PATHS = [
  "src/lib/runtime-logs/diagnosis-authority.ts",
  "src/lib/runtime-logs/diagnosis-contract.ts",
  "src/lib/runtime-logs/diagnosis-source.ts",
  "src/lib/runtime-logs/diagnosis.ts",
  "src/lib/runtime-logs/failure.ts",
  "src/lib/runtime-logs/index.ts",
  "src/lib/runtime-logs/integrity.ts",
  "src/lib/runtime-logs/logger.ts",
  "src/lib/runtime-logs/mode.ts",
  "src/lib/runtime-logs/redaction.ts",
  "src/lib/runtime-logs/runtime-event-contract.ts",
  "src/lib/runtime-logs/runtime-failure-contract.ts",
  "src/lib/runtime-logs/runtime-identity-contract.ts",
  "src/lib/runtime-logs/schema.ts",
  "src/lib/runtime-logs/sinks.ts",
] as const;

const ordered = (values: readonly string[]): string[] => [...new Set(values)].sort((left, right) =>
  Buffer.compare(Buffer.from(left), Buffer.from(right)));
const read = (context: InspectorContext, repoPath: string): string =>
  readFileSync(resolve(context.sealedRoot, repoPath), "utf8");
const targetSources = (context: InspectorContext): string[] => ordered(context.targetPaths
  .filter((repoPath) => SOURCE_EXTENSIONS.has(extname(repoPath).toLocaleLowerCase("en-US"))));
const lineAt = (source: string, index: number): number => source.slice(0, index).split("\n").length;
const finding = (
  lawId: string,
  evidenceMode: "static.ast" | "static.contract",
  checkId: string,
  filePath: string,
  message: string,
  line?: number,
): InspectorFinding => createFinding({
  lawId,
  evidenceMode,
  clauseId: `${lawId.toLowerCase()}-requirement`,
  checkId: `runtime-log-spine/${checkId}`,
  filePath,
  message,
  ...(line === undefined ? {} : { line }),
});

export const directOutputViolations = (source: string, repoPath: string): readonly number[] => {
  if (repoPath === "src/lib/runtime-logs/sinks.ts") return [];
  const consoleObject = String.raw`(?:\bconsole|\bglobalThis\s*(?:\.\s*console|\[\s*["']console["']\s*\]))`;
  const processObject = String.raw`(?:\bprocess|\bglobalThis\s*(?:\.\s*process|\[\s*["']process["']\s*\]))`;
  const property = (names: string): string => String.raw`(?:\.\s*(?:${names})\b|\[\s*(?:["'](?:${names})["']|[A-Za-z_$][\w$]*)\s*\])`;
  const declaration = String.raw`\b(?:const|let|var)\s+(?:[A-Za-z_$][\w$]*|\{[^}]+\})\s*=\s*`;
  const directConsole = `${consoleObject}${property("log|error|warn|info|debug|trace")}`;
  const directProcessWrite = `${processObject}${property("stdout|stderr")}${property("write")}`;
  const outputAlias = `${declaration}(?:${consoleObject}|${processObject}${property("stdout|stderr")})(?=\s*(?:[;,\n]|$))`;
  const processAlias = `${declaration}${processObject}(?=\s*(?:[;,\n]|$))`;
  const matches = [...source.matchAll(new RegExp(
    `(?:${directConsole}|${directProcessWrite}|${outputAlias}|${processAlias})`, "gu",
  ))];
  if (!TERMINAL_PROTOCOL_OUTPUTS.has(repoPath)) return matches.map((match) => lineAt(source, match.index ?? 0));
  return matches.filter((match) => {
    const line = source.split("\n")[lineAt(source, match.index ?? 0) - 1] ?? "";
    return !line.includes("process.stdout.write(JSON.stringify(")
      && !line.includes("process.stdout.write(`${JSON.stringify(");
  }).map((match) => lineAt(source, match.index ?? 0));
};

const requireTokens = (
  context: InspectorContext,
  findings: InspectorFinding[],
  lawId: string,
  evidenceMode: "static.ast" | "static.contract",
  checkId: string,
  repoPath: string,
  tokens: readonly string[],
): void => {
  if (!existsSync(resolve(context.sealedRoot, repoPath))) {
    findings.push(finding(lawId, evidenceMode, checkId, repoPath, "Required Runtime Log Spine source is missing."));
    return;
  }
  const source = read(context, repoPath);
  for (const token of tokens) {
    if (!source.includes(token)) findings.push(finding(
      lawId, evidenceMode, checkId, repoPath, `Required terminal contract token is missing: ${token}.`,
    ));
  }
};

const inspectOperationalAst = (context: InspectorContext): InspectorFinding[] => {
  const findings: InspectorFinding[] = [];
  for (const repoPath of targetSources(context)) {
    const source = read(context, repoPath);
    for (const line of directOutputViolations(source, repoPath)) findings.push(finding(
      LAW_OPERATIONAL, "static.ast", "direct-output-forbidden", repoPath,
      "Production source bypasses the unique Runtime Log Spine terminal/file sink.", line,
    ));
  }
  for (const repoPath of RETIRED_PATHS) {
    if (existsSync(resolve(context.sealedRoot, repoPath))) findings.push(finding(
      LAW_OPERATIONAL, "static.ast", "retired-chain-absent", repoPath,
      "A retired logger, bus, stage logger, debug bundle, or second diagnostic persistence path remains.",
    ));
  }
  requireTokens(context, findings, LAW_OPERATIONAL, "static.ast", "production-boundaries",
    "src/lib/local-runtime/production/runtime-claim.ts", [
      "operation: \"job.execute\"", "operation: \"job.durable-accept\"",
      "operation: \"material.download-verify\"", "operation: \"result.upload\"", "operation: \"job.terminal\"",
      "requireRuntimeLogWrite",
    ]);
  requireTokens(context, findings, LAW_OPERATIONAL, "static.ast", "production-boundaries",
    "src/lib/local-runtime/production/runtime-execution-heartbeat.ts",
    ["operation: \"job.lease-renew\"", "requireRuntimeLogWrite"]);
  requireTokens(context, findings, LAW_OPERATIONAL, "static.ast", "production-boundaries", "src/lib/local-runtime/production/runtime-logging.ts",
    ["operation: \"job.lease-release\"", "requireRuntimeLogWrite"]);
  requireTokens(context, findings, LAW_OPERATIONAL, "static.ast", "production-boundaries",
    "src/lib/local-runtime/production/runtime-loops.ts", [
      "operation: \"cloud.claim\"", "operation: \"website.v6-request\"",
      "component: \"production-admission-readback\"", "state.runtimeLogger.isWritable()", "requireRuntimeLogWrite",
      "responsibleOwner: \"website\"",
    ]);
  if (read(context, "src/lib/local-runtime/production/runtime-loops.ts")
    .includes('operation: "website.result-consume"')) findings.push(finding(
    LAW_OPERATIONAL, "static.ast", "production-boundaries", "src/lib/local-runtime/production/runtime-loops.ts",
    "AGENT admission readback must not claim Website business-result consumption ownership.",
  ));
  requireTokens(context, findings, LAW_OPERATIONAL, "static.ast", "production-boundaries",
    "src/lib/local-runtime/production/runtime-startup.ts", [
      "operation: \"cloud.session-open\"", "operation: \"runtime.start\"", "operation: \"runtime.shutdown\"",
      "requireRuntimeLogWrite",
    ]);
  requireTokens(context, findings, LAW_OPERATIONAL, "static.ast", "executor-boundaries",
    "src/lib/local-runtime/production/executor.ts", [
      "operation: \"plugin.execute\"", "parentSpanId", "causedByEventId", "requireRuntimeLogWrite",
    ]);
  requireTokens(context, findings, LAW_OPERATIONAL, "static.ast", "executor-boundaries",
    "src/capabilities/gpt/production-child-tools.ts", [
      "operation: \"gpt.child\"", "parentSpanId", "requireRuntimeLogWrite",
      "runtimeLogCauseEventId", "RuntimeFailureImpact.CONSEQUENTIAL", "causedByEventId",
    ]);
  requireTokens(context, findings, LAW_OPERATIONAL, "static.ast", "producer-boundaries",
    "src/lib/browser/exact-target/browser-command-runtime-logging.ts", [
      "operation: \"browser.command\"", "code: `BROWSER_MUTATION_${input.outcome}`",
      "authorityHash", "requireRuntimeLogWrite",
    ]);
  requireTokens(context, findings, LAW_OPERATIONAL, "static.ast", "startup-boundaries",
    "scripts/startup/lib/startup-log-helpers.mjs", [
      "operation: \"startup.step\"", "STARTUP_STEPS", "failOpenStartupSteps",
    ]);
  requireTokens(context, findings, LAW_OPERATIONAL, "static.ast", "durable-state-authorities",
    "src/lib/local-runtime/production/store-foundation.ts", [
      "production_tasks", "production_outbox", "attempt_failure_json", "production-outbox:",
    ]);
  requireTokens(context, findings, LAW_OPERATIONAL, "static.ast", "durable-state-authorities",
    "src/lib/local-runtime/production/store-authority-reader.ts", [
      "resolveStoredProductionAuthority",
    ]);
  requireTokens(context, findings, LAW_OPERATIONAL, "static.ast", "readonly-authority-resolution",
    "scripts/runtime-logs/inspect.ts", [
      "resolveStoredProductionAuthority", "resolveStoredBrowserMutationAuthority", "authorityResolver",
      "discoverRuntimeLogScope", "NO_ACTIVE_SCOPE",
    ]);
  return findings;
};

const inspectOperationalContract = (context: InspectorContext): InspectorFinding[] => {
  const findings: InspectorFinding[] = [];
  requireTokens(context, findings, LAW_OPERATIONAL, "static.contract", "diagnosis-output",
    "src/lib/runtime-logs/diagnosis-contract.ts", [
      "DIAGNOSIS_COMPLETE", "DIAGNOSIS_INCOMPLETE", "blockingRoots", "lastSuccessfulActions",
      "observedEvents", "openSpans", "interruptedSpans", "atomicSteps", "authorityRefs", "eventRefs",
      "firstSeenAt", "lastSeenAt", "count",
    ]);
  requireTokens(context, findings, LAW_OPERATIONAL, "static.contract", "diagnosis-output",
    "src/lib/runtime-logs/diagnosis-authority.ts", ["AUTHORITY_REF_UNVERIFIED", "AUTHORITY_HASH_MISMATCH"]);
  requireTokens(context, findings, LAW_OPERATIONAL, "static.contract", "diagnosis-output",
    "src/lib/runtime-logs/diagnosis.ts", ["BOUNDARY_SOURCE_INCOMPLETE", "BOUNDARY_TRACE_MISMATCH", "PRODUCER_STALE"]);
  requireTokens(context, findings, LAW_OPERATIONAL, "static.contract", "failure-truth",
    "src/lib/runtime-logs/failure.ts", [
      "knownNativeCause", "record.cause", "record.httpStatus", "RuntimeFailureKind.TRANSPORT",
    ]);
  requireTokens(context, findings, LAW_OPERATIONAL, "static.contract", "typed-root-and-liveness",
    "src/lib/local-runtime/production/runtime-logging.ts", [
      "typedExecutionFailure(error)?.code ?? fallbackCode", "causedByEventId",
    ]);
  requireTokens(context, findings, LAW_OPERATIONAL, "static.contract", "typed-root-and-liveness",
    "src/lib/local-runtime/production/runtime-loops.ts", [
      "const sessionHeartbeatLoop", "state.runtimeLogger.isWritable()",
    ]);
  requireTokens(context, findings, LAW_OPERATIONAL, "static.contract", "diagnosis-api",
    "src/app/workbench-production-runtime-routes.ts", [
      "/api/production-runtime/operations-snapshot", "readProductionOperationsSnapshot",
    ]);
  requireTokens(context, findings, LAW_OPERATIONAL, "static.contract", "operations-current-facts",
    "src/lib/local-runtime/production/operations-snapshot.ts", [
      "runtime_log_sink", "logSinkState", "discoverRuntimeLogScope", "SOURCE_UNAVAILABLE",
      "DIAGNOSIS_INCOMPLETE",
    ]);
  requireTokens(context, findings, LAW_OPERATIONAL, "static.contract", "terminal-projection",
    "src/lib/runtime-logs/sinks.ts", [
      "shouldProjectRuntimeEvent", "terminalProjectionState", "activeMode === \"TRACE\"",
      "blockingFailure", "event.failure?.impact === \"BLOCKING\"",
    ]);
  return findings;
};

const inspectPrivacyAst = (context: InspectorContext): InspectorFinding[] => {
  const findings: InspectorFinding[] = [];
  requireTokens(context, findings, LAW_PRIVACY, "static.ast", "write-before-redaction",
    "src/lib/runtime-logs/logger.ts", [
      "redactedUnsigned(unsignedInput)", "runtimeEventHash(unsigned)", "fileSink.write(event",
  ]);
  const loggerPath = resolve(context.sealedRoot, "src/lib/runtime-logs/logger.ts");
  const loggerSource = context.project.getSourceFile(loggerPath);
  if (!redactHashWriteOrderIsExact(loggerSource)) findings.push(finding(
    LAW_PRIVACY, "static.ast", "write-before-redaction", "src/lib/runtime-logs/logger.ts",
    "Redaction, hash, and sink ordering is not redact -> hash -> write.",
  ));
  return findings;
};

export const redactHashWriteOrderIsExact = (loggerSource: SourceFile | undefined): boolean => {
  const persist = loggerSource?.getClass("RuntimeLoggerOwner")?.getMethod("persist");
  if (!persist) return false;
  const calls = persist?.getDescendantsOfKind(SyntaxKind.CallExpression) ?? [];
  const redactAt = calls.find((call) => call.getExpression().getText() === "redactedUnsigned"
    && call.getArguments()[0]?.getText() === "unsignedInput")?.getStart() ?? -1;
  const hashAt = calls.find((call) => call.getExpression().getText() === "runtimeEventHash"
    && call.getArguments()[0]?.getText() === "unsigned")?.getStart() ?? -1;
  const writeAt = calls.find((call) => call.getExpression().getText() === "this.fileSink.write"
    && call.getArguments()[0]?.getText().startsWith("event") === true)?.getStart() ?? -1;
  return redactAt >= 0 && redactAt < hashAt && hashAt < writeAt;
};

const inspectPrivacyContract = (context: InspectorContext): InspectorFinding[] => {
  const findings: InspectorFinding[] = [];
  requireTokens(context, findings, LAW_PRIVACY, "static.contract", "closed-redaction",
    "src/lib/runtime-logs/redaction.ts", [
      "[REDACTED]", "[REDACTED_UNSAFE]", "SECRET_KEYS", "INLINE_SECRET", "BASE64",
      "ABSOLUTE_PATH", "REDACTED_PATH", "depth > 5", "Array.isArray(value)",
    ]);
  return findings;
};

const walTransitionBeforeEmission = (
  owner: Node | undefined,
  authorityName: string,
  emissionName: string,
  emissionText: string,
): boolean => {
  const calls = owner?.getDescendantsOfKind(SyntaxKind.CallExpression) ?? [];
  const authorities = calls.filter((call) => call.getExpression().getText() === authorityName);
  const emissions = calls.filter((call) => call.getExpression().getText() === emissionName
    && call.getText().includes(emissionText));
  return authorities.length === 1 && authorities.every((authority) =>
    emissions.some((emission) => emission.getStart() > authority.getStart()));
};

const inspectStructureAst = (context: InspectorContext): InspectorFinding[] => {
  const findings: InspectorFinding[] = [];
  const actorRepoPath = "src/lib/browser/exact-target/browser-command-actor.ts";
  const failureRepoPath = "src/lib/browser/exact-target/browser-command-failure.ts";
  requireTokens(context, findings, LAW_STRUCTURE, "static.ast", "wal-before-log", actorRepoPath, [
      "this.mutations.prepare", "outcome: \"PREPARED\"", "this.mutations.markDispatched",
      "outcome: \"DISPATCHED\"", "this.mutations.markRejected", "this.mutations.markConfirmed",
      "this.mutations.resolve", "outcome: state",
    ]);
  requireTokens(context, findings, LAW_STRUCTURE, "static.ast", "wal-before-log", failureRepoPath, [
    "input.mutations.markReceiptMissing", "input.mutations.markFailedBeforeDispatch", "outcome: \"FAILED\"",
  ]);
  const actorSource = context.project.getSourceFile(resolve(context.sealedRoot, actorRepoPath));
  const failureSource = context.project.getSourceFile(resolve(context.sealedRoot, failureRepoPath));
  const actorClass = actorSource?.getClass("BrowserCommandActor");
  for (const [owner, filePath, authorityCalls, emissionName, emission] of [
    [actorClass?.getMethod("prepareMutation"), actorRepoPath, ["this.mutations.prepare"],
      "emitBrowserMutationEvent", "outcome: \"PREPARED\""],
    [actorClass?.getMethod("execute"), actorRepoPath, ["this.mutations.markDispatched"],
      "emitBrowserMutationEvent", "outcome: \"DISPATCHED\""],
    [actorClass?.getMethod("completeMutation"), actorRepoPath,
      ["this.mutations.markRejected", "this.mutations.markConfirmed"], "emitBrowserMutationEvent",
      "outcome: result.terminal === \"rejected\" ? \"REJECTED\" : \"CONFIRMED\""],
    [actorClass?.getMethod("resolveDispatchedMutation"), actorRepoPath, ["this.mutations.resolve"],
      "emitBrowserMutationEvent", "outcome: state"],
    [failureSource?.getVariableDeclaration("rejectAuthenticatedTerminalReply")?.getInitializer(), failureRepoPath,
      ["input.mutations.markRejected"], "emitRejected", ""],
    [failureSource?.getVariableDeclaration("rejectAuthenticatedResult")?.getInitializer(), failureRepoPath,
      ["input.mutations.markRejected"], "emitRejected", ""],
    [failureSource?.getVariableDeclaration("recordUnsettledMutation")?.getInitializer(), failureRepoPath,
      ["input.mutations.markFailedBeforeDispatch"], "emitBrowserMutationEvent", "outcome: \"FAILED\""],
  ] as const) {
    for (const authorityName of authorityCalls) {
      if (!walTransitionBeforeEmission(owner, authorityName, emissionName, emission)) findings.push(finding(
        LAW_STRUCTURE, "static.ast", "wal-before-log", filePath,
        `Browser mutation log precedes its WAL authority transition: ${authorityName}.`,
      ));
    }
  }
  return findings;
};

const inspectStructureContract = (context: InspectorContext): InspectorFinding[] => {
  const findings: InspectorFinding[] = [];
  for (const repoPath of REQUIRED_CORE_PATHS) {
    if (!existsSync(resolve(context.sealedRoot, repoPath))) findings.push(finding(
      LAW_STRUCTURE, "static.contract", "core-files", repoPath, "Required Runtime Log Spine V2 core file is missing.",
    ));
  }
  requireTokens(context, findings, LAW_STRUCTURE, "static.contract", "closed-event-union",
    "src/lib/runtime-logs/runtime-event-contract.ts", [
      "kind: \"event\"", "kind: \"span.started\"", "kind: \"span.terminal\"", "kind: \"error\"",
      "RuntimeLogEventV2", "typedIdentity", "producerSeq", "previousEventHash", "eventHash",
      "authorityRef", "authorityHash", "RuntimeLogWriteResult",
    ]);
  requireTokens(context, findings, LAW_STRUCTURE, "static.contract", "closed-event-union",
    "src/lib/runtime-logs/runtime-failure-contract.ts", ["causedByEventId"]);
  const schema = read(context, "src/lib/runtime-logs/schema.ts");
  for (const forbidden of ["payload:", "metrics:", "retryable:", "level:", "message:", "truthRef"]) {
    if (schema.includes(forbidden)) findings.push(finding(
      LAW_STRUCTURE, "static.contract", "open-bag-forbidden", "src/lib/runtime-logs/schema.ts",
      `Runtime event schema contains forbidden open or duplicate semantic field: ${forbidden}.`,
    ));
  }
  requireTokens(context, findings, LAW_STRUCTURE, "static.contract", "integrity-and-retention",
    "src/lib/runtime-logs/sinks.ts", [
      "flush: true", "maxTotalBytes", "SEGMENTS_PER_CAPACITY", "ensureCapacity",
      "writerLockPath", "flag: \"wx\"", "RUNTIME_LOG_CAPACITY_BLOCKED",
    ]);
  requireTokens(context, findings, LAW_STRUCTURE, "static.contract", "unique-diagnosis-cli",
    "scripts/runtime-logs/inspect.ts", ["--job", "--source", "sources", "DIAGNOSIS_COMPLETE", "scope.status !== \"SELECTED\""]);
  requireTokens(context, findings, LAW_STRUCTURE, "static.contract", "browser-authority-reconciliation",
    "src/lib/browser/exact-target/browser-mutation-store.ts", [
      "dispatchedForBinding", "where job_id=? and attempt_id=? and state='DISPATCHED'",
      "and (effect_scope='provider_effect' or (lease_version=? and execution_fence_hash=?))",
      "order by updated_at,command_id",
    ]);
  requireTokens(context, findings, LAW_STRUCTURE, "static.contract", "strict-reader",
    "src/lib/runtime-logs/schema.ts", ["exactKeys", "runtimeLogEventShapeValid", "failureValid"]);
  requireTokens(context, findings, LAW_STRUCTURE, "static.contract", "active-source-layout",
    "src/lib/runtime-logs/diagnosis-source.ts", [
      "activeJsonlFiles", "^.+-[0-9]{4}\\.jsonl$", "ACTIVE_SEGMENT_NAME_INVALID", "ACTIVE_SOURCE_LAYOUT_INVALID",
    ]);
  return findings;
};

const CHECKS = {
  [LAW_OPERATIONAL]: { "static.ast": "inspectOperationalAst", "static.contract": "inspectOperationalContract" },
  [LAW_PRIVACY]: { "static.ast": "inspectPrivacyAst", "static.contract": "inspectPrivacyContract" },
  [LAW_STRUCTURE]: { "static.ast": "inspectStructureAst", "static.contract": "inspectStructureContract" },
} as const;
const CLAUSES = {
  [LAW_OPERATIONAL]: staticClauses(0, 1, 2, 3, 4, 5, 6, 7, 8, 9),
  [LAW_PRIVACY]: staticClauses(0, 1, 2, 3),
  [LAW_STRUCTURE]: staticClauses(0, 1, 2, 3, 4, 5, 6, 7),
} as const;

export const inspectDomain = async (context: InspectorContext): Promise<SessionInspectorOutput> => {
  const findings: InspectorFinding[] = [];
  const receipts: StaticCheckReceipt[] = [];
  recordStaticCheck({ check: "inspectOperationalAst", findings, implementation: inspectOperationalAst,
    lawIds: [LAW_OPERATIONAL], receipts,
    run: () => { findings.push(...inspectOperationalAst(context)); } });
  recordStaticCheck({ check: "inspectOperationalContract", findings, implementation: inspectOperationalContract,
    lawIds: [LAW_OPERATIONAL], receipts,
    run: () => { findings.push(...inspectOperationalContract(context)); } });
  recordStaticCheck({ check: "inspectPrivacyAst", findings, implementation: inspectPrivacyAst,
    lawIds: [LAW_PRIVACY], receipts,
    run: () => { findings.push(...inspectPrivacyAst(context)); } });
  recordStaticCheck({ check: "inspectPrivacyContract", findings, implementation: inspectPrivacyContract,
    lawIds: [LAW_PRIVACY], receipts,
    run: () => { findings.push(...inspectPrivacyContract(context)); } });
  recordStaticCheck({ check: "inspectStructureAst", findings, implementation: inspectStructureAst,
    lawIds: [LAW_STRUCTURE], receipts,
    run: () => { findings.push(...inspectStructureAst(context)); } });
  recordStaticCheck({ check: "inspectStructureContract", findings, implementation: inspectStructureContract,
    lawIds: [LAW_STRUCTURE], receipts,
    run: () => { findings.push(...inspectStructureContract(context)); } });
  const lawResults = context.lawRequirements.map((requirement) => ({
    lawId: requirement.lawId,
    assertions: requirement.requiredStaticModes.map((evidenceMode) => {
      const mode = evidenceMode as "static.ast" | "static.contract";
      const checks = [CHECKS[requirement.lawId as keyof typeof CHECKS][mode]];
      const clauses = CLAUSES[requirement.lawId as keyof typeof CLAUSES];
      const passed = producerModePassed(receipts, requirement.lawId, checks);
      return {
        clauses,
        evidenceMode: mode,
        passed,
        refs: staticEvidenceRefs(context, requirement.lawId, mode, clauses, receipts, checks),
      };
    }),
    findings: findings.filter((item) => item.lawId === requirement.lawId),
  }));
  return validateStaticInspection(context, {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.lawRequirements.map((requirement) => requirement.lawId),
    lawResults,
    inspectedFiles: ordered(context.lawRequirements.flatMap((requirement) => requirement.targetPaths)),
  });
};
