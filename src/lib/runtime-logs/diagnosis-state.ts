import type {
  RuntimeLogEventV2,
  RuntimeStateEvent,
  RuntimeStateKey,
} from "./runtime-event-contract.js";
import type { RuntimeLogOwner } from "./runtime-failure-contract.js";
import { orderedRuntimeEventsByProducer } from "./diagnosis-source.js";
import type { RuntimeDiagnosis } from "./diagnosis-contract.js";

type CurrentState = RuntimeDiagnosis["currentStates"][string];

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
  if (event.stateKey !== "producer.lifecycle" && event.stateKey !== "producer.alive") {
    return STATE_OWNERS[event.stateKey];
  }
  const producerOwners: Readonly<Record<string, RuntimeLogOwner>> = {
    agent: "app-shell",
    "startup-entrypoint": "startup-entrypoint",
    website: "website",
  };
  return producerOwners[event.producer] ?? null;
};

const stateSubject = (event: RuntimeStateEvent): string =>
  event.stateKey === "browser.mutation" || event.stateKey === "outbox.delivery"
    ? event.authorityRef ?? event.traceId
    : event.traceId;

const stateOutputKey = (event: RuntimeStateEvent): string => {
  if (event.stateKey === "browser.mutation" || event.stateKey === "outbox.delivery") {
    return `${event.stateKey}:${event.authorityRef ?? event.traceId}`;
  }
  if (["producer.lifecycle", "producer.alive", "log.sink"].includes(event.stateKey)) {
    return `${event.stateKey}:${event.producer}`;
  }
  return event.stateKey;
};

const collectStateCandidates = (
  events: readonly RuntimeLogEventV2[],
  findings: string[],
): ReadonlyMap<string, RuntimeStateEvent[]> => {
  const byOutput = new Map<string, RuntimeStateEvent[]>();
  const previousByAxis = new Map<string, string>();
  for (const event of orderedRuntimeEventsByProducer(events)) {
    if (event.type !== "STATE") continue;
    const requiredOwner = expectedOwner(event);
    if (requiredOwner && requiredOwner !== event.owner) findings.push(`STATE_OWNER_INVALID:${event.stateKey}:${event.owner}`);
    const axis = `${event.producerRunId}\u0000${event.stateKey}\u0000${stateSubject(event)}`;
    const expected = previousByAxis.get(axis) ?? null;
    if (event.previous !== expected) findings.push(`STATE_TRANSITION_BROKEN:${event.eventId}`);
    if (event.stateKey !== "producer.alive" && event.previous === event.current) findings.push(`STATE_NOOP_FORBIDDEN:${event.eventId}`);
    previousByAxis.set(axis, event.current);
    const outputKey = stateOutputKey(event);
    byOutput.set(outputKey, [...(byOutput.get(outputKey) ?? []), event]);
  }
  return byOutput;
};

const collectLiveRunsByProducer = (
  events: readonly RuntimeLogEventV2[],
  freshRuns: ReadonlyMap<string, boolean>,
): ReadonlyMap<string, ReadonlySet<string>> => {
  const byProducer = new Map<string, Set<string>>();
  for (const event of events) {
    if (freshRuns.get(event.producerRunId) !== true) continue;
    const runs = byProducer.get(event.producer) ?? new Set<string>();
    runs.add(event.producerRunId);
    byProducer.set(event.producer, runs);
  }
  return byProducer;
};

const requiresLiveReconciliation = (
  candidates: readonly RuntimeStateEvent[],
  events: readonly RuntimeLogEventV2[],
): boolean => {
  const latest = [...candidates].sort((left, right) => left.producerSeq - right.producerSeq).at(-1)!;
  if (latest.authorityRef === undefined) return false;
  const activeStates: Readonly<Partial<Record<RuntimeStateKey, readonly string[]>>> = {
    "job.lifecycle": ["accepted", "running", "recovery_pending"],
    "browser.mutation": ["PREPARED", "DISPATCHED"],
  };
  if (activeStates[latest.stateKey]?.includes(latest.current)) return true;
  if (latest.stateKey === "job.lease") return latest.current !== "absent";
  if (latest.stateKey === "outbox.delivery") return latest.current !== "delivered";
  if (latest.stateKey !== "job.checkpoint") return false;
  const lifecycle = events.filter((event): event is RuntimeStateEvent =>
    event.type === "STATE" && event.traceId === latest.traceId && event.stateKey === "job.lifecycle")
    .sort((left, right) => left.producerSeq - right.producerSeq).at(-1);
  return !lifecycle || ["accepted", "running", "recovery_pending"].includes(lifecycle.current);
};

const lastEvent = (events: readonly RuntimeStateEvent[]): RuntimeStateEvent | null =>
  [...events].sort((left, right) => left.producerSeq - right.producerSeq).at(-1) ?? null;

const selectCrossRunCandidate = (
  key: string,
  candidates: readonly RuntimeStateEvent[],
  freshRuns: ReadonlyMap<string, boolean>,
  findings: string[],
): RuntimeStateEvent | null => {
  const liveRuns = new Set(candidates.filter((event) => freshRuns.get(event.producerRunId) === true)
    .map((event) => event.producerRunId));
  const reconciledRuns = new Set(candidates.filter((event) => event.reconciledFromAuthority === true)
    .map((event) => event.producerRunId));
  const selectedRun = liveRuns.size === 1
    ? [...liveRuns][0]!
    : reconciledRuns.size === 1 ? [...reconciledRuns][0]! : null;
  if (!selectedRun) {
    findings.push(`STATE_CROSS_RUN_ORDER_UNRESOLVED:${key}`);
    return null;
  }
  return lastEvent(candidates.filter((event) => event.producerRunId === selectedRun));
};

const selectCandidate = (
  key: string,
  candidates: readonly RuntimeStateEvent[],
  freshRuns: ReadonlyMap<string, boolean>,
  findings: string[],
): RuntimeStateEvent | null => {
  const runCount = new Set(candidates.map((event) => event.producerRunId)).size;
  return runCount === 1 ? lastEvent(candidates) : selectCrossRunCandidate(key, candidates, freshRuns, findings);
};

const reconcileLiveCandidate = (input: Readonly<{
  key: string;
  candidates: readonly RuntimeStateEvent[];
  events: readonly RuntimeLogEventV2[];
  liveRunsByProducer: ReadonlyMap<string, ReadonlySet<string>>;
  selected: RuntimeStateEvent | null;
  findings: string[];
}>): Readonly<{ selected: RuntimeStateEvent | null; pending: boolean }> => {
  const liveRuns = new Set(input.candidates.flatMap((event) => [...(input.liveRunsByProducer.get(event.producer) ?? [])]));
  if (liveRuns.size === 1) {
    const liveRunId = [...liveRuns][0]!;
    const liveCandidate = lastEvent(input.candidates.filter((event) => event.producerRunId === liveRunId));
    if (liveCandidate) return { selected: liveCandidate, pending: false };
    if (!requiresLiveReconciliation(input.candidates, input.events)) return { selected: input.selected, pending: false };
    const authorityRef = [...input.candidates].reverse().find((event) => event.authorityRef)?.authorityRef ?? input.key;
    input.findings.push(`AUTHORITY_RECONCILIATION_PENDING:${authorityRef}`);
    return { selected: input.selected, pending: true };
  }
  if (liveRuns.size > 1 && requiresLiveReconciliation(input.candidates, input.events)) {
    input.findings.push(`AUTHORITY_RECONCILIATION_PENDING:${input.key}`);
    return { selected: input.selected, pending: true };
  }
  return { selected: input.selected, pending: false };
};

const unknownState = (candidate: RuntimeStateEvent): CurrentState => ({
  value: "UNKNOWN_ORDER",
  owner: candidate.owner,
  producerRunId: "multiple",
  fresh: false,
  authorityRef: null,
  authorityHash: null,
});

const projectState = (
  selected: RuntimeStateEvent,
  pending: boolean,
  freshRuns: ReadonlyMap<string, boolean>,
  findings: string[],
): CurrentState => {
  const fresh = !pending && (selected.authorityRef !== undefined
    || (selected.stateKey === "producer.lifecycle" && selected.current === "stopped")
    || freshRuns.get(selected.producerRunId) === true);
  if (!fresh) findings.push(`PRODUCER_STALE:${selected.producerRunId}`);
  return {
    value: fresh ? selected.current : "UNKNOWN_STALE",
    owner: selected.owner,
    producerRunId: selected.producerRunId,
    fresh,
    authorityRef: selected.authorityRef ?? null,
    authorityHash: selected.authorityHash ?? null,
  };
};

export const deriveRuntimeCurrentStates = (input: Readonly<{
  events: readonly RuntimeLogEventV2[];
  allEvents: readonly RuntimeLogEventV2[];
  freshRuns: ReadonlyMap<string, boolean>;
  findings: string[];
}>): RuntimeDiagnosis["currentStates"] => {
  const result: Record<string, CurrentState> = {};
  const candidatesByKey = collectStateCandidates(input.events, input.findings);
  const liveRunsByProducer = collectLiveRunsByProducer(input.allEvents, input.freshRuns);
  for (const [key, candidates] of candidatesByKey) {
    const selected = selectCandidate(key, candidates, input.freshRuns, input.findings);
    const reconciled = reconcileLiveCandidate({
      key, candidates, events: input.events, liveRunsByProducer, selected, findings: input.findings,
    });
    result[key] = reconciled.selected
      ? projectState(reconciled.selected, reconciled.pending, input.freshRuns, input.findings)
      : unknownState(candidates[0]!);
  }
  return result;
};
