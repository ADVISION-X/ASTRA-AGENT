import {
  runtimeLogEventShapeValid,
} from "./schema.js";
import type {
  RuntimeLogEventV2,
  RuntimeSpanStartedEvent,
  RuntimeSpanTerminalEvent,
  RuntimeStateEvent,
  RuntimeStateKey,
} from "./runtime-event-contract.js";
import { parseRuntimeLogSource, verifyRuntimeProducerChains } from "./diagnosis-source.js";
import { deriveRuntimeCurrentStates } from "./diagnosis-state.js";
import { resolveRuntimeAuthorities } from "./diagnosis-authority.js";
import type {
  DiagnosedFailure,
  RuntimeAuthorityResolver,
  RuntimeDiagnosis,
} from "./diagnosis-contract.js";
export type { RuntimeAuthorityResolver, RuntimeDiagnosis } from "./diagnosis-contract.js";

const spanKey = (event: Pick<RuntimeLogEventV2, "producerRunId"> & { spanId: string }): string =>
  `${event.producerRunId}\u0000${event.spanId}`;

const MUTATION_CAPABILITIES = new Set([
  "browser.dom.click.v1",
  "browser.dom.hover.v1",
  "browser.dom.double-click.v1",
  "browser.dom.keypress.v1",
  "browser.dom.fill.v1",
  "browser.file-input.v1",
]);

const atomicPostcondition = (
  terminalState: string,
  mutation: boolean,
): RuntimeDiagnosis["atomicSteps"][number]["postcondition"] => {
  if (terminalState === "CONFIRMED") return "passed";
  if (terminalState === "REJECTED") return "failed";
  if (terminalState === "DISPATCHED") return "pending_reconciliation";
  return mutation ? "not_reached" : "not_applicable";
};

const mutationEventsFor = (
  started: RuntimeSpanStartedEvent,
  events: readonly RuntimeLogEventV2[],
): RuntimeStateEvent[] => {
  const identity = started.typedIdentity;
  if (identity.kind !== "browser-command") throw new Error("RUNTIME_BROWSER_IDENTITY_INVALID");
  const authorityRef = `browser-mutation:${identity.commandId}`;
  return events.filter((event): event is RuntimeStateEvent =>
    event.type === "STATE" && event.stateKey === "browser.mutation" && event.authorityRef === authorityRef)
    .sort((left, right) => left.producerRunId.localeCompare(right.producerRunId) || left.producerSeq - right.producerSeq);
};

const stepTerminalState = (
  latest: RuntimeStateEvent | undefined,
  terminal: RuntimeSpanTerminalEvent | undefined,
): string => latest?.current ?? terminal?.outcome.toUpperCase() ?? "OPEN";

const mutationStepStatus = (
  mutations: readonly RuntimeStateEvent[],
  capabilityId: string | null,
  terminalState: string,
): Pick<RuntimeDiagnosis["atomicSteps"][number], "precondition" | "dispatch" | "postcondition"> => {
  const mutation = mutations.length > 0 || (capabilityId !== null && MUTATION_CAPABILITIES.has(capabilityId));
  if (!mutation) return { precondition: "not_applicable", dispatch: "not_applicable", postcondition: "not_applicable" };
  return {
    precondition: mutations.some((event) => event.current === "PREPARED") ? "passed" : "failed",
    dispatch: mutations.some((event) => event.current === "DISPATCHED") ? "dispatched" : "not_dispatched",
    postcondition: atomicPostcondition(terminalState, true),
  };
};

const terminalAuthority = (
  terminal: RuntimeSpanTerminalEvent | undefined,
): Readonly<{ authorityRef: string | null; authorityHash: string | null }> => {
  if (!terminal || !("authorityRef" in terminal)) return { authorityRef: null, authorityHash: null };
  return { authorityRef: terminal.authorityRef ?? null, authorityHash: terminal.authorityHash ?? null };
};

const atomicBrowserStep = (
  started: RuntimeSpanStartedEvent,
  events: readonly RuntimeLogEventV2[],
  terminals: ReadonlyMap<string, RuntimeSpanTerminalEvent>,
): RuntimeDiagnosis["atomicSteps"][number] => {
  const identity = started.typedIdentity;
  if (identity.kind !== "browser-command") throw new Error("RUNTIME_BROWSER_IDENTITY_INVALID");
  const mutations = mutationEventsFor(started, events);
  const latest = mutations.at(-1);
  const terminal = terminals.get(spanKey(started));
  const capabilityId = identity.capabilityCallId ?? null;
  const terminalState = stepTerminalState(latest, terminal);
  const status = mutationStepStatus(mutations, capabilityId, terminalState);
  const authority = terminalAuthority(terminal);
  return {
    pluginStepId: identity.pluginStepId, childCapabilityId: identity.childCapabilityId,
    actionOrdinal: identity.actionOrdinal, commandId: identity.commandId, capabilityId,
    ...status, terminalState,
    failureCode: terminal?.failure?.code ?? null,
    authorityRef: latest?.authorityRef ?? authority.authorityRef,
    authorityHash: latest?.authorityHash ?? authority.authorityHash,
    startedEventId: started.eventId, terminalEventId: terminal?.eventId ?? null,
  };
};

const atomicBrowserSteps = (events: readonly RuntimeLogEventV2[]): RuntimeDiagnosis["atomicSteps"] => {
  const terminals = new Map(events.filter((event): event is RuntimeSpanTerminalEvent =>
    event.type === "SPAN" && event.phase === "terminal").map((event) => [spanKey(event), event]));
  const starts = events.filter((event): event is RuntimeSpanStartedEvent =>
    event.type === "SPAN" && event.phase === "started"
      && event.operation === "browser.command" && event.typedIdentity.kind === "browser-command");
  return starts.map((started) => atomicBrowserStep(started, events, terminals))
    .sort((left, right) => left.pluginStepId.localeCompare(right.pluginStepId)
    || left.actionOrdinal - right.actionOrdinal || left.commandId.localeCompare(right.commandId));
};

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

const BOUNDARY_REQUIRED_OPERATIONS = new Set([
  "api.boundary", "cloud.claim", "cloud.session-open", "job.execute", "job.terminal",
  "website.first-terminal", "website.outbox", "website.result-consume", "website.task-create", "website.v6-request",
]);

const recordStartedSpan = (input: Readonly<{
  event: RuntimeSpanStartedEvent;
  starts: Map<string, RuntimeSpanStartedEvent>;
  boundaryByAction: Map<string, string>;
  findings: string[];
}>): void => {
  const key = spanKey(input.event);
  if (input.starts.has(key)) input.findings.push(`DUPLICATE_SPAN_START:${input.event.spanId}`);
  input.starts.set(key, input.event);
  if (BOUNDARY_REQUIRED_OPERATIONS.has(input.event.operation) && !input.event.boundaryId) {
    input.findings.push(`BOUNDARY_ID_MISSING:${input.event.spanId}`);
  }
  if (input.event.boundaryId && input.event.typedIdentity.kind === "request"
    && input.event.typedIdentity.requestId !== input.event.boundaryId) {
    input.findings.push(`BOUNDARY_IDENTITY_MISMATCH:${input.event.spanId}`);
  }
  const actionKey = `${input.event.operation}\u0000${JSON.stringify(input.event.typedIdentity)}`;
  const priorBoundary = input.boundaryByAction.get(actionKey);
  if (priorBoundary && input.event.boundaryId && priorBoundary !== input.event.boundaryId) {
    input.findings.push(`BOUNDARY_RETRY_MISMATCH:${input.event.spanId}`);
  } else if (input.event.boundaryId) input.boundaryByAction.set(actionKey, input.event.boundaryId);
};

const recordTerminalSpan = (input: Readonly<{
  event: RuntimeSpanTerminalEvent;
  terminals: Map<string, RuntimeSpanTerminalEvent>;
  eventById: ReadonlyMap<string, RuntimeLogEventV2>;
  findings: string[];
}>): void => {
  const key = spanKey(input.event);
  if (input.terminals.has(key)) input.findings.push(`DUPLICATE_SPAN_TERMINAL:${input.event.spanId}`);
  input.terminals.set(key, input.event);
  const causeId = input.event.failure?.causedByEventId;
  if (!causeId) return;
  const cause = input.eventById.get(causeId);
  if (!cause || cause.type !== "SPAN" || cause.phase !== "terminal" || !cause.failure) {
    input.findings.push(`CAUSE_EVENT_INVALID:${input.event.eventId}`);
  } else if (cause.traceId !== input.event.traceId) input.findings.push(`CAUSE_TRACE_MISMATCH:${input.event.eventId}`);
};

const verifySpanRelations = (
  starts: ReadonlyMap<string, RuntimeSpanStartedEvent>,
  terminals: ReadonlyMap<string, RuntimeSpanTerminalEvent>,
  findings: string[],
): void => {
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
};

const verifySpanCycles = (
  starts: ReadonlyMap<string, RuntimeSpanStartedEvent>,
  terminals: ReadonlyMap<string, RuntimeSpanTerminalEvent>,
  findings: string[],
): void => {
  const visit = (start: RuntimeSpanStartedEvent, seen: Set<string>): void => {
    if (!start.parentSpanId) return;
    const key = `${start.producerRunId}\u0000${start.parentSpanId}`;
    if (seen.has(key)) {
      findings.push(`PARENT_SPAN_CYCLE:${start.spanId}`);
      return;
    }
    const parent = starts.get(key);
    if (parent) visit(parent, new Set([...seen, key]));
  };
  for (const start of starts.values()) visit(start, new Set([spanKey(start)]));
  const failures = new Map([...terminals.values()].filter((event) => event.failure)
    .map((event) => [event.eventId, event]));
  for (const failure of failures.values()) {
    const seen = new Set([failure.eventId]);
    let cause = failure.failure?.causedByEventId;
    while (cause) {
      if (seen.has(cause)) {
        findings.push(`FAILURE_CAUSE_CYCLE:${failure.eventId}`);
        break;
      }
      seen.add(cause);
      cause = failures.get(cause)?.failure?.causedByEventId;
    }
  }
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
  for (const event of events) {
    if (event.type !== "SPAN") continue;
    if (event.phase === "started") recordStartedSpan({ event, starts, boundaryByAction, findings });
    else recordTerminalSpan({ event, terminals, eventById, findings });
  }
  verifySpanRelations(starts, terminals, findings);
  verifySpanCycles(starts, terminals, findings);
  const open = [...starts].filter(([key]) => !terminals.has(key)).map(([, event]) => event.spanId).sort();
  const interrupted = [...starts].filter(([key, event]) => !terminals.has(key) && freshRuns.get(event.producerRunId) !== true)
    .map(([, event]) => event.spanId).sort();
  for (const id of open) findings.push(`OPEN_SPAN:${id}`);
  for (const id of interrupted) findings.push(`INTERRUPTED:${id}`);
  return { open, interrupted };
};

const verifyCrossRepositoryBoundaries = (
  events: readonly RuntimeLogEventV2[],
  allEvents: readonly RuntimeLogEventV2[],
  findings: string[],
): void => {
  const websiteRequests = allEvents.filter((event): event is RuntimeSpanStartedEvent =>
    event.type === "SPAN" && event.phase === "started" && event.operation === "website.v6-request");
  for (const event of events) {
    if (event.type !== "SPAN" || event.phase !== "started" || event.operation !== "cloud.session-open"
      || !event.boundaryId) continue;
    const opposite = websiteRequests.filter((candidate) => candidate.producerRunId !== event.producerRunId
      && candidate.boundaryId === event.boundaryId);
    if (opposite.length === 0) findings.push(`BOUNDARY_SOURCE_INCOMPLETE:${event.boundaryId}`);
    else if (!opposite.some((candidate) => candidate.traceId === event.traceId)) {
      findings.push(`BOUNDARY_TRACE_MISMATCH:${event.boundaryId}`);
    }
  }
};

const diagnosedFailure = (event: RuntimeSpanTerminalEvent): DiagnosedFailure => ({
  eventId: event.eventId,
  operation: event.operation,
  owner: event.owner,
  responsibleOwner: event.failure!.responsibleOwner,
  kind: event.failure!.kind,
  code: event.failure!.code,
  nativeCause: event.failure!.nativeCause ?? null,
  httpStatus: event.failure!.httpStatus ?? null,
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

const lastSuccessfulActions = (
  terminals: readonly RuntimeSpanTerminalEvent[],
): RuntimeDiagnosis["lastSuccessfulActions"] => {
  const byRun = new Map<string, RuntimeSpanTerminalEvent>();
  for (const event of terminals.filter((item) => item.outcome === "success")) {
    const prior = byRun.get(event.producerRunId);
    if (!prior || event.producerSeq > prior.producerSeq) byRun.set(event.producerRunId, event);
  }
  return [...byRun.values()].map((event) => ({
    producerRunId: event.producerRunId,
    operation: event.operation,
    owner: event.owner,
    eventId: event.eventId,
  }));
};

const diagnosedSideEffects = (
  states: RuntimeDiagnosis["currentStates"],
): RuntimeDiagnosis["sideEffects"] => Object.entries(states)
  .filter(([key]) => key.startsWith("browser.mutation:"))
  .map(([key, state]) => ({
    authorityRef: state.authorityRef ?? key.slice("browser.mutation:".length),
    authorityHash: state.authorityHash,
    state: state.value,
    owner: state.owner,
  }));

export const diagnoseRuntimeLog = (input: Readonly<{
  sources: readonly string[];
  traceId: string;
  now?: Date;
  authorityResolver?: RuntimeAuthorityResolver;
}>): RuntimeDiagnosis => {
  const findings: string[] = [];
  const warnings: string[] = [];
  if (input.sources.length === 0) findings.push("SOURCE_LIST_EMPTY");
  const parsed = input.sources.map((source) => parseRuntimeLogSource(source, findings));
  const allEvents = parsed.flatMap((item) => item.events);
  verifyRuntimeProducerChains(allEvents, findings);
  const events = selectTraceEvents(allEvents, input.traceId);
  if (events.length === 0) findings.push(`TRACE_NOT_FOUND:${input.traceId}`);
  const freshRuns = producerFreshness(allEvents, (input.now ?? new Date()).getTime());
  verifyCrossRepositoryBoundaries(events, allEvents, findings);
  const spans = verifySpans(events, freshRuns, findings);
  const states = deriveRuntimeCurrentStates({ events, allEvents, freshRuns, findings });
  verifyApplicableStateAxes(events, states, findings);
  const terminals = events.filter((event): event is RuntimeSpanTerminalEvent =>
    event.type === "SPAN" && event.phase === "terminal");
  const failures = terminals.filter((event) => event.failure !== undefined);
  const roots = blockingRoots(failures);
  const authorityEvents = resolveRuntimeAuthorities({
    events, freshRuns, resolver: input.authorityResolver, findings,
  });
  const sideEffects = diagnosedSideEffects(states);
  const atomicSteps = atomicBrowserSteps(events);
  return {
    status: findings.length === 0 ? "DIAGNOSIS_COMPLETE" : "DIAGNOSIS_INCOMPLETE",
    traceId: input.traceId,
    sources: parsed.map((item) => item.status),
    currentStates: states,
    lastSuccessfulActions: lastSuccessfulActions(terminals),
    openSpans: spans.open,
    interruptedSpans: spans.interrupted,
    blockingRoots: roots.map(diagnosedFailure),
    consequentialFailures: failures.filter((event) => event.failure?.impact === "CONSEQUENTIAL").map(diagnosedFailure),
    cleanupFailures: failures.filter((event) => event.failure?.impact === "CLEANUP").map(diagnosedFailure),
    sideEffects,
    atomicSteps,
    mutationState: sideEffects.length === 1 ? sideEffects[0]!.state : null,
    recoveries: [...new Set(roots.map((event) => event.failure!.recovery))].sort(),
    authorityRefs: [...authorityEvents.keys()].sort(),
    warnings,
    findings: [...new Set(findings)],
  };
};
