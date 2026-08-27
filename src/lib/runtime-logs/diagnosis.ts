import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { runtimeEventIntegrityValid } from "./integrity.js";
import {
  runtimeLogEventShapeValid,
  type RuntimeLogEventV2,
  type RuntimeLogOwner,
  type RuntimeSpanStartedEvent,
  type RuntimeSpanTerminalEvent,
  type RuntimeStateEvent,
  type RuntimeStateKey,
} from "./schema.js";

export type RuntimeAuthorityResolver = (
  authorityRef: string,
  authorityHash: `sha256:${string}`,
) => "verified" | "missing" | "mismatch";

type DiagnosedFailure = Readonly<{
  eventId: string;
  operation: string;
  owner: string;
  responsibleOwner: string;
  kind: string;
  code: string;
  nativeCause: string | null;
  impact: string;
  recovery: string;
  causedByEventId: string | null;
}>;

export type RuntimeDiagnosis = Readonly<{
  status: "DIAGNOSIS_COMPLETE" | "DIAGNOSIS_INCOMPLETE";
  traceId: string;
  sources: readonly Readonly<{ source: string; available: boolean; files: number; events: number }>[];
  currentStates: Readonly<Record<string, Readonly<{
    value: string;
    owner: string;
    producerRunId: string;
    fresh: boolean;
    authorityRef: string | null;
    authorityHash: string | null;
  }>>>;
  lastSuccessfulActions: readonly Readonly<{
    producerRunId: string;
    operation: string;
    owner: string;
    eventId: string;
  }>[];
  openSpans: readonly string[];
  interruptedSpans: readonly string[];
  blockingRoots: readonly DiagnosedFailure[];
  consequentialFailures: readonly DiagnosedFailure[];
  cleanupFailures: readonly DiagnosedFailure[];
  sideEffects: readonly Readonly<{
    authorityRef: string;
    authorityHash: string | null;
    state: string;
    owner: string;
  }>[];
  mutationState: string | null;
  recoveries: readonly string[];
  authorityRefs: readonly string[];
  warnings: readonly string[];
  findings: readonly string[];
}>;

const walkJsonl = (root: string): string[] => {
  if (!existsSync(root)) return [];
  const rootStat = statSync(root);
  if (rootStat.isFile()) return [root];
  if (!rootStat.isDirectory()) return [];
  const found: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile() && entry.name.endsWith(".jsonl")) found.push(path);
    }
  };
  visit(root);
  return found.sort();
};

const parseSource = (source: string, findings: string[]): Readonly<{
  events: RuntimeLogEventV2[];
  status: { source: string; available: boolean; files: number; events: number };
}> => {
  let files: string[];
  try { files = walkJsonl(source); }
  catch { files = []; }
  if (files.length === 0) findings.push(`SOURCE_UNAVAILABLE:${source}`);
  const events: RuntimeLogEventV2[] = [];
  for (const path of files) {
    const lines = readFileSync(path, "utf8").split("\n");
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index]!;
      if (!line) continue;
      let parsed: unknown;
      try { parsed = JSON.parse(line) as unknown; }
      catch {
        findings.push(index === lines.length - 1
          ? `TRUNCATED_FINAL_LINE:${path}`
          : `INVALID_JSONL_LINE:${path}:${index + 1}`);
        continue;
      }
      if (!runtimeLogEventShapeValid(parsed)) findings.push(`EVENT_SCHEMA_INVALID:${path}:${index + 1}`);
      else events.push(parsed);
    }
  }
  return { events, status: { source, available: files.length > 0, files: files.length, events: events.length } };
};

const orderedByProducer = (events: readonly RuntimeLogEventV2[]): RuntimeLogEventV2[] =>
  [...events].sort((left, right) => left.producerRunId.localeCompare(right.producerRunId)
    || left.producerSeq - right.producerSeq);

const verifyProducerChains = (events: readonly RuntimeLogEventV2[], findings: string[]): void => {
  const runs = new Map<string, RuntimeLogEventV2[]>();
  for (const event of events) runs.set(event.producerRunId, [...(runs.get(event.producerRunId) ?? []), event]);
  for (const [runId, runEvents] of runs) {
    const ordered = [...runEvents].sort((left, right) => left.producerSeq - right.producerSeq);
    let previous: RuntimeLogEventV2 | null = null;
    for (const event of ordered) {
      if (!runtimeEventIntegrityValid(event)) findings.push(`EVENT_HASH_INVALID:${event.eventId}`);
      if (!previous) {
        if (event.producerSeq !== 1 || event.previousEventHash !== null) findings.push(`PRODUCER_CHAIN_START_INVALID:${runId}`);
      } else if (event.producerSeq !== previous.producerSeq + 1 || event.previousEventHash !== previous.eventHash) {
        findings.push(`PRODUCER_CHAIN_BROKEN:${runId}:${event.producerSeq}`);
      }
      previous = event;
    }
    const stopped = [...ordered].reverse().find((event): event is RuntimeStateEvent =>
      event.type === "STATE" && event.stateKey === "producer.lifecycle" && event.current === "stopped");
    if (stopped && stopped.eventId !== ordered.at(-1)?.eventId) findings.push(`PRODUCER_NORMAL_STOP_NOT_SEALED:${runId}`);
  }
};

const spanKey = (event: Pick<RuntimeLogEventV2, "producerRunId"> & { spanId: string }): string =>
  `${event.producerRunId}\u0000${event.spanId}`;

const GLOBAL_STATE_KEYS = new Set<RuntimeStateKey>([
  "producer.lifecycle", "producer.alive", "log.sink", "website.core", "website.worker", "agent.shell",
  "cloud.contract", "cloud.session", "claim.admission", "browser.authority", "browser.target",
]);

const selectTraceEvents = (events: readonly RuntimeLogEventV2[], traceId: string): RuntimeLogEventV2[] => {
  const selectedSpanKeys = new Set(events.filter((event): event is RuntimeSpanStartedEvent =>
    event.type === "SPAN" && event.phase === "started")
    .filter((event) => event.traceId === traceId || ("jobId" in event.typedIdentity && event.typedIdentity.jobId === traceId))
    .map(spanKey));
  const participatingRuns = new Set(events.filter((event) => event.traceId === traceId
    || (event.type === "SPAN" && selectedSpanKeys.has(spanKey(event))))
    .map((event) => event.producerRunId));
  return events.filter((event) => event.traceId === traceId
    || (event.type === "SPAN" && selectedSpanKeys.has(spanKey(event)))
    || (event.type === "STATE" && GLOBAL_STATE_KEYS.has(event.stateKey) && participatingRuns.has(event.producerRunId)));
};

const producerFreshness = (allEvents: readonly RuntimeLogEventV2[], now: number): ReadonlyMap<string, boolean> => {
  const latest = new Map<string, RuntimeStateEvent>();
  const stoppedRuns = new Set<string>();
  for (const event of allEvents) {
    if (event.type === "STATE" && event.stateKey === "producer.lifecycle" && event.current === "stopped") {
      stoppedRuns.add(event.producerRunId);
    }
    if (event.type !== "STATE" || event.stateKey !== "producer.alive") continue;
    const prior = latest.get(event.producerRunId);
    if (!prior || event.producerSeq > prior.producerSeq) latest.set(event.producerRunId, event);
  }
  return new Map([...latest].map(([runId, event]) => [
    runId,
    !stoppedRuns.has(runId) && event.freshForMs !== undefined && now - Date.parse(event.occurredAt) <= event.freshForMs,
  ]));
};

const verifySpans = (
  events: readonly RuntimeLogEventV2[],
  freshRuns: ReadonlyMap<string, boolean>,
  findings: string[],
): Readonly<{ open: string[]; interrupted: string[] }> => {
  const starts = new Map<string, RuntimeSpanStartedEvent>();
  const terminals = new Map<string, RuntimeSpanTerminalEvent>();
  const eventById = new Map(events.map((event) => [event.eventId, event]));
  const boundaryByAction = new Map<string, string>();
  const boundaryRequired = new Set([
    "api.boundary", "cloud.claim", "cloud.session-open", "job.execute", "job.terminal",
    "website.first-terminal", "website.outbox", "website.result-consume", "website.task-create", "website.v6-request",
  ]);
  for (const event of events) {
    if (event.type !== "SPAN") continue;
    const key = spanKey(event);
    if (event.phase === "started") {
      if (starts.has(key)) findings.push(`DUPLICATE_SPAN_START:${event.spanId}`);
      starts.set(key, event);
      if (boundaryRequired.has(event.operation) && !event.boundaryId) findings.push(`BOUNDARY_ID_MISSING:${event.spanId}`);
      if (event.boundaryId && event.typedIdentity.kind === "request"
        && event.typedIdentity.requestId !== event.boundaryId) findings.push(`BOUNDARY_IDENTITY_MISMATCH:${event.spanId}`);
      const actionKey = `${event.operation}\u0000${JSON.stringify(event.typedIdentity)}`;
      const priorBoundary = boundaryByAction.get(actionKey);
      if (priorBoundary && event.boundaryId && priorBoundary !== event.boundaryId) findings.push(`BOUNDARY_RETRY_MISMATCH:${event.spanId}`);
      else if (event.boundaryId) boundaryByAction.set(actionKey, event.boundaryId);
    } else {
      if (terminals.has(key)) findings.push(`DUPLICATE_SPAN_TERMINAL:${event.spanId}`);
      terminals.set(key, event);
      const cause = event.failure?.causedByEventId ? eventById.get(event.failure.causedByEventId) : undefined;
      if (event.failure?.causedByEventId && (!cause || cause.type !== "SPAN" || cause.phase !== "terminal" || !cause.failure)) {
        findings.push(`CAUSE_EVENT_INVALID:${event.eventId}`);
      } else if (cause && cause.traceId !== event.traceId) findings.push(`CAUSE_TRACE_MISMATCH:${event.eventId}`);
    }
  }
  for (const start of starts.values()) {
    if (!start.parentSpanId) continue;
    const parent = starts.get(`${start.producerRunId}\u0000${start.parentSpanId}`);
    if (!parent) findings.push(`PARENT_SPAN_MISSING:${start.spanId}`);
    else if (parent.traceId !== start.traceId) findings.push(`PARENT_TRACE_MISMATCH:${start.spanId}`);
  }
  for (const terminal of terminals.values()) {
    const start = starts.get(spanKey(terminal));
    if (!start) findings.push(`SPAN_START_MISSING:${terminal.spanId}`);
    else if (start.operation !== terminal.operation || start.traceId !== terminal.traceId || start.owner !== terminal.owner) {
      findings.push(`SPAN_TERMINAL_MISMATCH:${terminal.spanId}`);
    }
  }
  const visit = (start: RuntimeSpanStartedEvent, seen: Set<string>): void => {
    if (!start.parentSpanId) return;
    const key = `${start.producerRunId}\u0000${start.parentSpanId}`;
    if (seen.has(key)) { findings.push(`PARENT_SPAN_CYCLE:${start.spanId}`); return; }
    const parent = starts.get(key);
    if (parent) visit(parent, new Set([...seen, key]));
  };
  for (const start of starts.values()) visit(start, new Set([spanKey(start)]));
  const failureById = new Map([...terminals.values()].filter((event) => event.failure).map((event) => [event.eventId, event]));
  for (const failure of failureById.values()) {
    const seen = new Set([failure.eventId]);
    let cause = failure.failure?.causedByEventId;
    while (cause) {
      if (seen.has(cause)) { findings.push(`FAILURE_CAUSE_CYCLE:${failure.eventId}`); break; }
      seen.add(cause);
      cause = failureById.get(cause)?.failure?.causedByEventId;
    }
  }
  const open = [...starts].filter(([key]) => !terminals.has(key)).map(([, event]) => event.spanId).sort();
  const interrupted = [...starts].filter(([key, event]) => !terminals.has(key) && freshRuns.get(event.producerRunId) !== true)
    .map(([, event]) => event.spanId).sort();
  for (const id of open) findings.push(`OPEN_SPAN:${id}`);
  for (const id of interrupted) findings.push(`INTERRUPTED:${id}`);
  return { open, interrupted };
};

const STATE_OWNERS: Readonly<Record<RuntimeStateKey, RuntimeLogOwner | null>> = {
  "producer.lifecycle": null,
  "producer.alive": null,
  "log.sink": "runtime-logs",
  "website.core": "website",
  "website.worker": "website",
  "website.consume": "website",
  "agent.shell": "app-shell",
  "cloud.contract": "production-runtime",
  "cloud.session": "production-runtime",
  "claim.admission": "production-runtime",
  "browser.authority": "browser-session",
  "browser.target": "browser-session",
  "job.lifecycle": "production-runtime",
  "job.lease": "production-runtime",
  "job.checkpoint": "production-runtime",
  "gpt.execution": "gpt",
  "browser.execution": "browser-session",
  "browser.mutation": "browser-session",
  "outbox.delivery": "outbox",
};
const expectedOwner = (event: RuntimeStateEvent): RuntimeLogOwner | null => {
  if (event.stateKey === "producer.lifecycle" || event.stateKey === "producer.alive") {
    if (event.producer === "agent") return "app-shell";
    if (event.producer === "startup-entrypoint") return "startup-entrypoint";
    if (event.producer === "website") return "website";
  }
  return STATE_OWNERS[event.stateKey];
};

const currentStates = (
  events: readonly RuntimeLogEventV2[],
  allEvents: readonly RuntimeLogEventV2[],
  freshRuns: ReadonlyMap<string, boolean>,
  findings: string[],
): RuntimeDiagnosis["currentStates"] => {
  const requiresLiveReconciliation = (candidates: readonly RuntimeStateEvent[]): boolean => {
    const latest = [...candidates].sort((left, right) => left.producerSeq - right.producerSeq).at(-1)!;
    if (latest.authorityRef === undefined) return false;
    if (latest.stateKey === "job.lifecycle") {
      return ["accepted", "running", "recovery_pending"].includes(latest.current);
    }
    if (latest.stateKey === "job.lease") return latest.current !== "absent";
    if (latest.stateKey === "outbox.delivery") return latest.current !== "delivered";
    if (latest.stateKey === "browser.mutation") return ["PREPARED", "SENT", "UNKNOWN"].includes(latest.current);
    if (latest.stateKey === "job.checkpoint") {
      const lifecycle = events.filter((event): event is RuntimeStateEvent =>
        event.type === "STATE" && event.traceId === latest.traceId && event.stateKey === "job.lifecycle")
        .sort((left, right) => left.producerSeq - right.producerSeq).at(-1);
      return !lifecycle || ["accepted", "running", "recovery_pending"].includes(lifecycle.current);
    }
    return false;
  };
  const liveRunsByProducer = new Map<string, Set<string>>();
  for (const event of allEvents) {
    if (freshRuns.get(event.producerRunId) !== true) continue;
    const runs = liveRunsByProducer.get(event.producer) ?? new Set<string>();
    runs.add(event.producerRunId);
    liveRunsByProducer.set(event.producer, runs);
  }
  const byOutput = new Map<string, RuntimeStateEvent[]>();
  const previousByAxis = new Map<string, string>();
  for (const event of orderedByProducer(events)) {
    if (event.type !== "STATE") continue;
    const requiredOwner = expectedOwner(event);
    if (requiredOwner && requiredOwner !== event.owner) findings.push(`STATE_OWNER_INVALID:${event.stateKey}:${event.owner}`);
    const subject = event.stateKey === "browser.mutation" || event.stateKey === "outbox.delivery"
      ? event.authorityRef ?? event.traceId
      : event.traceId;
    const axis = `${event.producerRunId}\u0000${event.stateKey}\u0000${subject}`;
    const expected = previousByAxis.get(axis) ?? null;
    if (event.previous !== expected) findings.push(`STATE_TRANSITION_BROKEN:${event.eventId}`);
    if (event.stateKey !== "producer.alive" && event.previous === event.current) {
      findings.push(`STATE_NOOP_FORBIDDEN:${event.eventId}`);
    }
    previousByAxis.set(axis, event.current);
    const outputKey = event.stateKey === "browser.mutation" || event.stateKey === "outbox.delivery"
      ? `${event.stateKey}:${event.authorityRef ?? event.traceId}`
      : event.stateKey === "producer.lifecycle" || event.stateKey === "producer.alive" || event.stateKey === "log.sink"
        ? `${event.stateKey}:${event.producer}`
        : event.stateKey;
    byOutput.set(outputKey, [...(byOutput.get(outputKey) ?? []), event]);
  }
  const result: Record<string, {
    value: string; owner: string; producerRunId: string; fresh: boolean; authorityRef: string | null; authorityHash: string | null;
  }> = {};
  for (const [key, candidates] of byOutput) {
    const byRun = new Map<string, RuntimeStateEvent[]>();
    for (const event of candidates) byRun.set(event.producerRunId, [...(byRun.get(event.producerRunId) ?? []), event]);
    let selected: RuntimeStateEvent | null = null;
    let reconciliationPending = false;
    if (byRun.size === 1) selected = [...candidates].sort((left, right) => left.producerSeq - right.producerSeq).at(-1) ?? null;
    else {
      const liveRuns = new Set(candidates.filter((event) => freshRuns.get(event.producerRunId) === true)
        .map((event) => event.producerRunId));
      const reconciled = candidates.filter((event) => event.reconciledFromAuthority === true);
      const reconciledRuns = new Set(reconciled.map((event) => event.producerRunId));
      const selectedRun = liveRuns.size === 1
        ? [...liveRuns][0]!
        : reconciledRuns.size === 1 ? [...reconciledRuns][0]! : null;
      if (selectedRun) {
        selected = candidates.filter((event) => event.producerRunId === selectedRun)
          .sort((left, right) => left.producerSeq - right.producerSeq).at(-1) ?? null;
      }
      else findings.push(`STATE_CROSS_RUN_ORDER_UNRESOLVED:${key}`);
    }
    const relevantLiveRuns = new Set(candidates.flatMap((event) =>
      [...(liveRunsByProducer.get(event.producer) ?? [])]));
    if (relevantLiveRuns.size === 1) {
      const liveRunId = [...relevantLiveRuns][0]!;
      const liveCandidates = candidates.filter((event) => event.producerRunId === liveRunId);
      if (liveCandidates.length > 0) {
        selected = [...liveCandidates].sort((left, right) => left.producerSeq - right.producerSeq).at(-1) ?? null;
      } else if (requiresLiveReconciliation(candidates)) {
        const authorityRef = [...candidates].reverse().find((event) => event.authorityRef)?.authorityRef ?? key;
        findings.push(`AUTHORITY_RECONCILIATION_PENDING:${authorityRef}`);
        reconciliationPending = true;
      }
    } else if (relevantLiveRuns.size > 1 && requiresLiveReconciliation(candidates)) {
      findings.push(`AUTHORITY_RECONCILIATION_PENDING:${key}`);
      reconciliationPending = true;
    }
    if (!selected) {
      const exemplar = candidates[0]!;
      result[key] = { value: "UNKNOWN_ORDER", owner: exemplar.owner, producerRunId: "multiple", fresh: false, authorityRef: null, authorityHash: null };
      continue;
    }
    const fresh = !reconciliationPending && (selected.authorityRef !== undefined
      || (selected.stateKey === "producer.lifecycle" && selected.current === "stopped")
      || freshRuns.get(selected.producerRunId) === true);
    if (!fresh) findings.push(`PRODUCER_STALE:${selected.producerRunId}`);
    result[key] = {
      value: fresh ? selected.current : "UNKNOWN_STALE",
      owner: selected.owner,
      producerRunId: selected.producerRunId,
      fresh,
      authorityRef: selected.authorityRef ?? null,
      authorityHash: selected.authorityHash ?? null,
    };
  }
  return result;
};

const diagnosedFailure = (event: RuntimeSpanTerminalEvent): DiagnosedFailure => ({
  eventId: event.eventId,
  operation: event.operation,
  owner: event.owner,
  responsibleOwner: event.failure!.responsibleOwner,
  kind: event.failure!.kind,
  code: event.failure!.code,
  nativeCause: event.failure!.nativeCause ?? null,
  impact: event.failure!.impact,
  recovery: event.failure!.recovery,
  causedByEventId: event.failure!.causedByEventId ?? null,
});

const verifyApplicableStateAxes = (
  events: readonly RuntimeLogEventV2[],
  states: RuntimeDiagnosis["currentStates"],
  findings: string[],
): void => {
  const required = new Set<RuntimeStateKey>();
  const durableAcceptSuccess = events.some((event) =>
    event.type === "SPAN" && event.phase === "terminal"
    && event.operation === "job.durable-accept" && event.outcome === "success");
  for (const event of events) {
    if (event.type !== "SPAN" || event.phase !== "started") continue;
    if (durableAcceptSuccess || event.operation === "job.terminal") required.add("job.lifecycle");
    if (event.typedIdentity.kind === "lease"
      || event.operation === "job.lease-renew"
      || event.operation === "job.lease-release") {
      required.add("job.lease");
    }
    if (event.operation === "job.checkpoint") required.add("job.checkpoint");
  }
  for (const stateKey of required) {
    if (!(stateKey in states)) findings.push(`STATE_AXIS_MISSING:${stateKey}`);
  }
};

const blockingRoots = (failures: readonly RuntimeSpanTerminalEvent[]): RuntimeSpanTerminalEvent[] => {
  const blockers = failures.filter((event) => event.failure?.impact === "BLOCKING");
  const blockerIds = new Set(blockers.map((event) => event.eventId));
  const byId = new Map(failures.map((event) => [event.eventId, event]));
  const hasBlockingAncestor = (event: RuntimeSpanTerminalEvent): boolean => {
    const seen = new Set<string>();
    let causeId = event.failure?.causedByEventId;
    while (causeId && !seen.has(causeId)) {
      if (blockerIds.has(causeId)) return true;
      seen.add(causeId);
      causeId = byId.get(causeId)?.failure?.causedByEventId;
    }
    return false;
  };
  return blockers.filter((event) => !hasBlockingAncestor(event));
};

export const diagnoseRuntimeLog = (input: Readonly<{
  sources: readonly string[];
  traceId: string;
  now?: Date;
  authorityResolver?: RuntimeAuthorityResolver;
}>): RuntimeDiagnosis => {
  const findings: string[] = [];
  const warnings: string[] = [];
  if (input.sources.length === 0) findings.push("SOURCE_LIST_EMPTY");
  const parsed = input.sources.map((source) => parseSource(source, findings));
  const allEvents = parsed.flatMap((item) => item.events);
  verifyProducerChains(allEvents, findings);
  const events = selectTraceEvents(allEvents, input.traceId);
  if (events.length === 0) findings.push(`TRACE_NOT_FOUND:${input.traceId}`);
  const freshRuns = producerFreshness(allEvents, (input.now ?? new Date()).getTime());
  const spans = verifySpans(events, freshRuns, findings);
  const states = currentStates(events, allEvents, freshRuns, findings);
  verifyApplicableStateAxes(events, states, findings);
  const terminals = events.filter((event): event is RuntimeSpanTerminalEvent =>
    event.type === "SPAN" && event.phase === "terminal");
  const failures = terminals.filter((event) => event.failure !== undefined);
  const roots = blockingRoots(failures);
  const authorityGroups = new Map<string, RuntimeLogEventV2[]>();
  for (const event of events) {
    if (!("authorityRef" in event) || !event.authorityRef || !("authorityHash" in event) || !event.authorityHash) continue;
    authorityGroups.set(event.authorityRef, [...(authorityGroups.get(event.authorityRef) ?? []), event]);
  }
  const authorityEvents = new Map<string, RuntimeLogEventV2>();
  for (const [authorityRef, candidates] of authorityGroups) {
    const runs = new Set(candidates.map((event) => event.producerRunId));
    const liveRuns = new Set(candidates.filter((event) => freshRuns.get(event.producerRunId) === true)
      .map((event) => event.producerRunId));
    const reconciled = candidates.filter((event) => event.type === "STATE" && event.reconciledFromAuthority === true);
    const reconciledRuns = new Set(reconciled.map((event) => event.producerRunId));
    const selectedRun = liveRuns.size === 1
      ? [...liveRuns][0]!
      : reconciledRuns.size === 1 ? [...reconciledRuns][0]! : null;
    if (runs.size > 1 && !selectedRun) findings.push(`AUTHORITY_RECONCILIATION_PENDING:${authorityRef}`);
    const selected = selectedRun
      ? candidates.filter((event) => event.producerRunId === selectedRun)
        .sort((left, right) => left.producerSeq - right.producerSeq).at(-1)!
      : [...candidates].sort((left, right) => left.producerRunId.localeCompare(right.producerRunId) || left.producerSeq - right.producerSeq).at(-1)!;
    authorityEvents.set(authorityRef, selected);
  }
  for (const [authorityRef, event] of authorityEvents) {
    const authorityHash = "authorityHash" in event ? event.authorityHash : undefined;
    if (!authorityHash) continue;
    const verdict = input.authorityResolver?.(authorityRef, authorityHash);
    if (!verdict || verdict === "missing") findings.push(`AUTHORITY_REF_UNVERIFIED:${authorityRef}`);
    else if (verdict === "mismatch") findings.push(`AUTHORITY_STATE_MISMATCH:${authorityRef}`);
  }
  const successesByRun = new Map<string, RuntimeSpanTerminalEvent>();
  for (const event of terminals.filter((item) => item.outcome === "success")) {
    const prior = successesByRun.get(event.producerRunId);
    if (!prior || event.producerSeq > prior.producerSeq) successesByRun.set(event.producerRunId, event);
  }
  const sideEffects = Object.entries(states)
    .filter(([key]) => key.startsWith("browser.mutation:"))
    .map(([key, state]) => ({
      authorityRef: state.authorityRef ?? key.slice("browser.mutation:".length),
      authorityHash: state.authorityHash,
      state: state.value,
      owner: state.owner,
    }));
  return {
    status: findings.length === 0 ? "DIAGNOSIS_COMPLETE" : "DIAGNOSIS_INCOMPLETE",
    traceId: input.traceId,
    sources: parsed.map((item) => item.status),
    currentStates: states,
    lastSuccessfulActions: [...successesByRun.values()].map((event) => ({
      producerRunId: event.producerRunId,
      operation: event.operation,
      owner: event.owner,
      eventId: event.eventId,
    })),
    openSpans: spans.open,
    interruptedSpans: spans.interrupted,
    blockingRoots: roots.map(diagnosedFailure),
    consequentialFailures: failures.filter((event) => event.failure?.impact === "CONSEQUENTIAL").map(diagnosedFailure),
    cleanupFailures: failures.filter((event) => event.failure?.impact === "CLEANUP").map(diagnosedFailure),
    sideEffects,
    mutationState: sideEffects.length === 1 ? sideEffects[0]!.state : null,
    recoveries: [...new Set(roots.map((event) => event.failure!.recovery))].sort(),
    authorityRefs: [...authorityEvents.keys()].sort(),
    warnings,
    findings: [...new Set(findings)],
  };
};
