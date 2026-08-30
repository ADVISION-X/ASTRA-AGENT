import { resolveRuntimeAuthorities } from "./diagnosis-authority.js";
import type {
  DiagnosedFailure,
  RuntimeAuthorityResolver,
  RuntimeDiagnosis,
} from "./diagnosis-contract.js";
import { parseRuntimeLogSource, verifyRuntimeProducerChains } from "./diagnosis-source.js";
import type {
  RuntimeErrorEvent,
  RuntimeLogEventV2,
  RuntimeObservedEvent,
  RuntimeSpanStartedEvent,
  RuntimeSpanTerminalEvent,
} from "./runtime-event-contract.js";

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

const mutationOutcome = (event: RuntimeObservedEvent | undefined): string | null => {
  if (!event?.code.startsWith("BROWSER_MUTATION_")) return null;
  return event.code.slice("BROWSER_MUTATION_".length);
};

const mutationEventsFor = (
  started: RuntimeSpanStartedEvent,
  events: readonly RuntimeLogEventV2[],
): RuntimeObservedEvent[] => {
  const identity = started.typedIdentity;
  if (identity.kind !== "browser-command") throw new Error("RUNTIME_BROWSER_IDENTITY_INVALID");
  return events.filter((event): event is RuntimeObservedEvent => event.kind === "event"
    && event.operation === "browser.command"
    && event.typedIdentity.kind === "browser-command"
    && event.typedIdentity.commandId === identity.commandId
    && event.code.startsWith("BROWSER_MUTATION_"))
    .sort((left, right) => left.producerRunId.localeCompare(right.producerRunId) || left.producerSeq - right.producerSeq);
};

const atomicPostcondition = (
  observedOutcome: string,
  mutation: boolean,
): RuntimeDiagnosis["atomicSteps"][number]["postcondition"] => {
  if (observedOutcome === "CONFIRMED") return "passed";
  if (observedOutcome === "REJECTED") return "failed";
  if (observedOutcome === "DISPATCHED") return "pending_reconciliation";
  return mutation ? "not_reached" : "not_applicable";
};

const mutationStage = (
  mutations: readonly RuntimeObservedEvent[],
  isMutation: boolean,
  outcome: "PREPARED" | "DISPATCHED",
): "passed" | "failed" | "dispatched" | "not_dispatched" | "not_applicable" => {
  if (!isMutation) return "not_applicable";
  const observed = mutations.some((event) => mutationOutcome(event) === outcome);
  if (outcome === "PREPARED") return observed ? "passed" : "failed";
  return observed ? "dispatched" : "not_dispatched";
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
  const isMutation = mutations.length > 0 || (capabilityId !== null && MUTATION_CAPABILITIES.has(capabilityId));
  const observedOutcome = mutationOutcome(latest) ?? terminal?.outcome.toUpperCase() ?? "OPEN";
  return {
    pluginStepId: identity.pluginStepId,
    childCapabilityId: identity.childCapabilityId,
    actionOrdinal: identity.actionOrdinal,
    commandId: identity.commandId,
    capabilityId,
    precondition: mutationStage(mutations, isMutation, "PREPARED") as "passed" | "failed" | "not_applicable",
    dispatch: mutationStage(mutations, isMutation, "DISPATCHED") as "dispatched" | "not_dispatched" | "not_applicable",
    postcondition: atomicPostcondition(observedOutcome, isMutation),
    observedOutcome,
    failureCode: terminal?.failure?.code ?? null,
    authorityRef: latest?.authorityRef ?? terminal?.authorityRef ?? null,
    authorityHash: latest?.authorityHash ?? terminal?.authorityHash ?? null,
    startedEventId: started.eventId,
    terminalEventId: terminal?.eventId ?? null,
  };
};

const atomicBrowserSteps = (events: readonly RuntimeLogEventV2[]): RuntimeDiagnosis["atomicSteps"] => {
  const terminals = new Map(events.filter((event): event is RuntimeSpanTerminalEvent => event.kind === "span.terminal")
    .map((event) => [spanKey(event), event]));
  const starts = events.filter((event): event is RuntimeSpanStartedEvent => event.kind === "span.started"
    && event.operation === "browser.command" && event.typedIdentity.kind === "browser-command");
  return starts.map((started) => atomicBrowserStep(started, events, terminals))
    .sort((left, right) => left.pluginStepId.localeCompare(right.pluginStepId)
      || left.actionOrdinal - right.actionOrdinal || left.commandId.localeCompare(right.commandId));
};

const selectTraceEvents = (events: readonly RuntimeLogEventV2[], traceId: string): RuntimeLogEventV2[] => {
  const selectedSpanKeys = new Set(events.filter((event): event is RuntimeSpanStartedEvent => event.kind === "span.started")
    .filter((event) => event.traceId === traceId || ("jobId" in event.typedIdentity && event.typedIdentity.jobId === traceId))
    .map(spanKey));
  return events.filter((event) => event.traceId === traceId
    || ((event.kind === "span.started" || event.kind === "span.terminal") && selectedSpanKeys.has(spanKey(event))));
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

const failureEvent = (
  event: RuntimeLogEventV2 | undefined,
): event is RuntimeSpanTerminalEvent | RuntimeErrorEvent => Boolean(event)
  && ((event!.kind === "span.terminal" && event!.failure !== undefined) || event!.kind === "error");

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
  if (!failureEvent(cause)) input.findings.push(`CAUSE_EVENT_INVALID:${input.event.eventId}`);
  else if (cause.traceId !== input.event.traceId) input.findings.push(`CAUSE_TRACE_MISMATCH:${input.event.eventId}`);
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
  failures: readonly (RuntimeSpanTerminalEvent | RuntimeErrorEvent)[],
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
  const byId = new Map(failures.map((event) => [event.eventId, event]));
  for (const failure of failures) {
    const seen = new Set([failure.eventId]);
    let cause = failure.failure?.causedByEventId;
    while (cause) {
      if (seen.has(cause)) {
        findings.push(`FAILURE_CAUSE_CYCLE:${failure.eventId}`);
        break;
      }
      seen.add(cause);
      cause = byId.get(cause)?.failure?.causedByEventId;
    }
  }
};

const verifySpans = (
  events: readonly RuntimeLogEventV2[],
  findings: string[],
): Readonly<{ open: string[]; interrupted: string[] }> => {
  const starts = new Map<string, RuntimeSpanStartedEvent>();
  const terminals = new Map<string, RuntimeSpanTerminalEvent>();
  const eventById = new Map(events.map((event) => [event.eventId, event]));
  const boundaryByAction = new Map<string, string>();
  for (const event of events) {
    if (event.kind === "span.started") recordStartedSpan({ event, starts, boundaryByAction, findings });
    if (event.kind === "span.terminal") recordTerminalSpan({ event, terminals, eventById, findings });
  }
  verifySpanRelations(starts, terminals, findings);
  const failures = events.filter(failureEvent);
  verifySpanCycles(starts, failures, findings);
  const openEvents = [...starts].filter(([key]) => !terminals.has(key)).map(([, event]) => event);
  const sealedRuns = new Set(events.filter((event) => event.kind === "event" && event.code === "PRODUCER_STOPPED")
    .map((event) => event.producerRunId));
  const open = openEvents.map((event) => event.spanId).sort();
  const interrupted = openEvents.filter((event) => sealedRuns.has(event.producerRunId)).map((event) => event.spanId).sort();
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
    event.kind === "span.started" && event.operation === "website.v6-request");
  for (const event of events) {
    if (event.kind !== "span.started" || event.operation !== "cloud.session-open" || !event.boundaryId) continue;
    const opposite = websiteRequests.filter((candidate) => candidate.producerRunId !== event.producerRunId
      && candidate.boundaryId === event.boundaryId);
    if (opposite.length === 0) findings.push(`BOUNDARY_SOURCE_INCOMPLETE:${event.boundaryId}`);
    else if (!opposite.some((candidate) => candidate.traceId === event.traceId)) {
      findings.push(`BOUNDARY_TRACE_MISMATCH:${event.boundaryId}`);
    }
  }
};

const diagnosedFailure = (event: RuntimeSpanTerminalEvent | RuntimeErrorEvent): DiagnosedFailure => ({
  eventId: event.eventId,
  operation: event.operation,
  owner: event.owner,
  responsibleOwner: event.failure!.responsibleOwner,
  kind: event.failure!.kind,
  code: event.failure!.code,
  nativeCause: event.failure!.nativeCause ?? null,
  httpStatus: event.failure!.httpStatus ?? null,
  impact: event.failure!.impact,
  causedByEventId: event.failure!.causedByEventId ?? null,
});

const blockingRoots = (
  failures: readonly (RuntimeSpanTerminalEvent | RuntimeErrorEvent)[],
): (RuntimeSpanTerminalEvent | RuntimeErrorEvent)[] => {
  const blockers = failures.filter((event) => event.failure?.impact === "BLOCKING");
  const blockerIds = new Set(blockers.map((event) => event.eventId));
  const byId = new Map(failures.map((event) => [event.eventId, event]));
  const hasBlockingAncestor = (event: RuntimeSpanTerminalEvent | RuntimeErrorEvent): boolean => {
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
  for (const event of terminals.filter((item) => item.outcome === "succeeded")) {
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

const observedEvents = (events: readonly RuntimeLogEventV2[]): RuntimeDiagnosis["observedEvents"] =>
  events.filter((event): event is RuntimeObservedEvent => event.kind === "event").map((event) => ({
    code: event.code,
    operation: event.operation,
    owner: event.owner,
    eventId: event.eventId,
    authorityRef: event.authorityRef ?? null,
    authorityHash: event.authorityHash ?? null,
  }));

export const diagnoseRuntimeLog = (input: Readonly<{
  sources: readonly string[];
  traceId: string;
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
  verifyCrossRepositoryBoundaries(events, allEvents, findings);
  const spans = verifySpans(events, findings);
  const terminals = events.filter((event): event is RuntimeSpanTerminalEvent => event.kind === "span.terminal");
  const failures = events.filter(failureEvent);
  const roots = blockingRoots(failures);
  const authorityEvents = resolveRuntimeAuthorities({
    events,
    resolver: input.authorityResolver,
    findings,
  });
  return {
    status: findings.length === 0 ? "DIAGNOSIS_COMPLETE" : "DIAGNOSIS_INCOMPLETE",
    traceId: input.traceId,
    sources: parsed.map((item) => item.status),
    lastSuccessfulActions: lastSuccessfulActions(terminals),
    observedEvents: observedEvents(events),
    openSpans: spans.open,
    interruptedSpans: spans.interrupted,
    blockingRoots: roots.map(diagnosedFailure),
    consequentialFailures: failures.filter((event) => event.failure?.impact === "CONSEQUENTIAL").map(diagnosedFailure),
    cleanupFailures: failures.filter((event) => event.failure?.impact === "CLEANUP").map(diagnosedFailure),
    atomicSteps: atomicBrowserSteps(events),
    authorityRefs: [...authorityEvents.keys()].sort(),
    warnings,
    findings: [...new Set(findings)],
  };
};
