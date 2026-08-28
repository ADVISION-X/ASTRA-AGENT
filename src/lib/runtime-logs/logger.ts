import { randomUUID } from "node:crypto";

import { runtimeEventHash } from "./integrity.js";
import { resolveRuntimeLogMode, type RuntimeLogMode } from "./mode.js";
import { redactRuntimeLogRecord } from "./redaction.js";
import {
  assertRuntimeLogEventV2,
  type RuntimeLogEventV2,
  type RuntimeLogEventWithoutIntegrity,
  type RuntimeLogOwner,
  type RuntimeLogWriteFailure,
  type RuntimeLogWriteResult,
  type RuntimeSpanStartedEvent,
  type RuntimeSpanStartInput,
  type RuntimeSpanTerminalEvent,
  type RuntimeSpanTerminalInput,
  type RuntimeStateEvent,
  type RuntimeStateInput,
  type RuntimeStateValue,
  type WithoutEventHash,
} from "./schema.js";
import {
  createRuntimeFileSink,
  type RuntimeFileSink,
  type RuntimeFileSinkOptions,
  writeEmergencyTerminalSink,
  writeTerminalSink,
} from "./sinks.js";

export type RuntimeSpanHandle = Readonly<{
  eventId: string;
  spanId: string;
  traceId: string;
  terminal(input: RuntimeSpanTerminalInput): RuntimeLogWriteResult<RuntimeSpanTerminalEvent>;
}>;

export type RuntimeLoggerConfig = Readonly<{
  producer: string;
  owner: RuntimeLogOwner;
  component: string;
  producerRunId?: string;
  modeOverride?: RuntimeLogMode;
  terminalEnabled?: boolean;
  fileSink?: RuntimeFileSinkOptions;
}>;

export type RuntimeLogger = Readonly<{
  producerRunId: string;
  startSpan(input: RuntimeSpanStartInput): RuntimeLogWriteResult<RuntimeSpanHandle>;
  emitState(input: RuntimeStateInput): RuntimeLogWriteResult<RuntimeStateEvent>;
  getActiveMode(): RuntimeLogMode;
  isDebugEnabled(): boolean;
  isTraceEnabled(): boolean;
  isWritable(): boolean;
  getSinkState(): "ready" | "failed" | "capacity_blocked";
  currentSegmentPath(): string | null;
}>;

export const requireRuntimeLogWrite = <T>(result: RuntimeLogWriteResult<T>): T => {
  if (!result.ok) throw new Error(result.code);
  return result.event;
};

const tokenValid = (value: string): boolean => value.length > 0 && !/[\s\u0000-\u001f]/u.test(value);
const writeFailureCode = (error: unknown): RuntimeLogWriteFailure["code"] =>
  error instanceof Error && error.message === "RUNTIME_LOG_CAPACITY_BLOCKED"
    ? "RUNTIME_LOG_CAPACITY_BLOCKED"
    : "RUNTIME_LOG_SINK_WRITE_FAILED";

const assertBaseInput = (traceId: string, component: string): void => {
  if (!tokenValid(traceId)) throw new Error("RUNTIME_LOG_TRACE_ID_INVALID");
  if (!tokenValid(component)) throw new Error("RUNTIME_LOG_COMPONENT_INVALID");
};

const redactedUnsigned = (event: RuntimeLogEventWithoutIntegrity): RuntimeLogEventWithoutIntegrity =>
  redactRuntimeLogRecord(event as unknown as Readonly<Record<string, unknown>>) as unknown as RuntimeLogEventWithoutIntegrity;

const optional = <TKey extends string, TValue>(key: TKey, value: TValue | undefined): Partial<Record<TKey, TValue>> =>
  value === undefined ? {} : { [key]: value } as Record<TKey, TValue>;

export const createRuntimeLogger = (config: RuntimeLoggerConfig): RuntimeLogger => {
  if (!tokenValid(config.producer) || !tokenValid(config.component)) throw new Error("RUNTIME_LOG_PRODUCER_INVALID");
  if (!config.fileSink && config.terminalEnabled === false) throw new Error("RUNTIME_LOG_MACHINE_SINK_MISSING");
  const activeMode = resolveRuntimeLogMode(config.modeOverride);
  const producerRunId = config.producerRunId ?? randomUUID();
  const fileSink: RuntimeFileSink | null = config.fileSink
    ? createRuntimeFileSink(config.producer, producerRunId, config.fileSink)
    : null;
  let producerSeq = 0;
  let previousEventHash: `sha256:${string}` | null = null;
  let sinkWritable = true;
  let sinkState: "ready" | "failed" | "capacity_blocked" = "ready";
  const openSpans = new Set<string>();
  const states = new Map<string, RuntimeStateValue>();

  const persist = (unsignedInput: RuntimeLogEventWithoutIntegrity): RuntimeLogWriteResult<RuntimeLogEventV2> => {
    if (!sinkWritable) {
      return {
        ok: false,
        code: sinkState === "capacity_blocked" ? "RUNTIME_LOG_CAPACITY_BLOCKED" : "RUNTIME_LOG_SINK_WRITE_FAILED",
        emergencyProjected: false,
      };
    }
    const unsigned = redactedUnsigned(unsignedInput);
    const event = { ...unsigned, eventHash: runtimeEventHash(unsigned) } as RuntimeLogEventV2;
    assertRuntimeLogEventV2(event);
    try {
      if (fileSink) fileSink.write(event as RuntimeLogEventV2);
      else writeTerminalSink(event as RuntimeLogEventV2, "TRACE");
    } catch (error) {
      sinkWritable = false;
      const code = writeFailureCode(error);
      sinkState = code === "RUNTIME_LOG_CAPACITY_BLOCKED" ? "capacity_blocked" : "failed";
      let emergencyProjected = false;
      try {
        const sinkTraceId = `producer:${producerRunId}`;
        const sinkUnsigned = redactedUnsigned({
          schemaVersion: 2,
          eventId: randomUUID(),
          occurredAt: new Date().toISOString(),
          producer: config.producer,
          producerRunId,
          producerSeq: event.producerSeq,
          previousEventHash,
          type: "STATE",
          traceId: sinkTraceId,
          owner: "runtime-logs",
          component: "runtime-log-sink",
          visibility: "FLOW",
          stateKey: "log.sink",
          previous: states.get(`log.sink\u0000${sinkTraceId}`) ?? null,
          current: sinkState,
        } as WithoutEventHash<RuntimeStateEvent>);
        const sinkEvent = { ...sinkUnsigned, eventHash: runtimeEventHash(sinkUnsigned) } as RuntimeStateEvent;
        assertRuntimeLogEventV2(sinkEvent);
        writeEmergencyTerminalSink(sinkEvent);
        emergencyProjected = true;
      } catch {
        emergencyProjected = false;
      }
      return { ok: false, code, emergencyProjected };
    }
    if (fileSink && config.terminalEnabled !== false) {
      try {
        writeTerminalSink(event as RuntimeLogEventV2, activeMode);
      } catch {
        sinkWritable = false;
        sinkState = "failed";
        let emergencyProjected = false;
        try {
          writeEmergencyTerminalSink(event);
          emergencyProjected = true;
        } catch {
          emergencyProjected = false;
        }
        return { ok: false, code: "RUNTIME_LOG_SINK_WRITE_FAILED", emergencyProjected };
      }
    }
    producerSeq = event.producerSeq;
    previousEventHash = event.eventHash;
    return { ok: true, event };
  };

  const common = (input: Readonly<{
    traceId: string;
    owner?: RuntimeLogOwner;
    component?: string;
    visibility?: RuntimeLogEventV2["visibility"];
  }>) => {
    const component = input.component ?? config.component;
    assertBaseInput(input.traceId, component);
    return {
      schemaVersion: 2 as const,
      eventId: randomUUID(),
      occurredAt: new Date().toISOString(),
      producer: config.producer,
      producerRunId,
      producerSeq: producerSeq + 1,
      previousEventHash,
      traceId: input.traceId,
      owner: input.owner ?? config.owner,
      component,
      visibility: input.visibility ?? "FLOW" as const,
    };
  };

  return {
    producerRunId,
    getActiveMode: () => activeMode,
    isDebugEnabled: () => activeMode === "DEBUG" || activeMode === "TRACE",
    isTraceEnabled: () => activeMode === "TRACE",
    isWritable: () => sinkWritable,
    getSinkState: () => sinkState,
    currentSegmentPath: () => fileSink?.currentPath() ?? null,
    startSpan(input) {
      const spanId = input.spanId ?? randomUUID();
      if (!tokenValid(spanId) || openSpans.has(spanId)) throw new Error("RUNTIME_LOG_SPAN_ID_INVALID");
      const startedAt = performance.now();
      const written = persist({
        ...common(input),
        type: "SPAN",
        phase: "started",
        spanId,
        operation: input.operation,
        typedIdentity: input.typedIdentity,
        ...optional("parentSpanId", input.parentSpanId),
        ...optional("boundaryId", input.boundaryId),
      } satisfies WithoutEventHash<RuntimeSpanStartedEvent>);
      if (!written.ok) return written;
      openSpans.add(spanId);
      let closed = false;
      return {
        ok: true,
        event: {
          eventId: written.event.eventId,
          spanId,
          traceId: input.traceId,
          terminal(terminalInput) {
            if (closed || !openSpans.has(spanId)) {
              return { ok: false, code: "DUPLICATE_SPAN_TERMINAL", emergencyProjected: false };
            }
            const written = persist({
              ...common(input),
              type: "SPAN",
              phase: "terminal",
              spanId,
              operation: input.operation,
              outcome: terminalInput.outcome,
              durationMs: Math.max(0, performance.now() - startedAt),
              ...optional("authorityRef", terminalInput.authorityRef),
              ...optional("authorityHash", terminalInput.authorityHash),
              ...(terminalInput.outcome === "success" ? {} : { failure: terminalInput.failure }),
            } as WithoutEventHash<RuntimeSpanTerminalEvent>) as RuntimeLogWriteResult<RuntimeSpanTerminalEvent>;
            if (written.ok) {
              closed = true;
              openSpans.delete(spanId);
            }
            return written;
          },
        },
      };
    },
    emitState(input) {
      const stateSubject = input.stateKey === "browser.mutation" || input.stateKey === "outbox.delivery"
        ? input.authorityRef ?? input.traceId
        : input.traceId;
      const stateIdentity = `${input.stateKey}\u0000${stateSubject}`;
      const actualPrevious = states.get(stateIdentity) ?? null;
      if (input.previous !== actualPrevious) throw new Error("RUNTIME_LOG_STATE_TRANSITION_INVALID");
      if (input.stateKey !== "producer.alive" && input.stateKey !== "browser.mutation"
        && input.previous === input.current) {
        throw new Error("RUNTIME_LOG_STATE_NOOP_FORBIDDEN");
      }
      const written = persist({
        ...common(input),
        type: "STATE",
        stateKey: input.stateKey,
        previous: input.previous,
        current: input.current,
        ...optional("freshForMs", input.freshForMs),
        ...optional("authorityRef", input.authorityRef),
        ...optional("authorityHash", input.authorityHash),
        ...optional("reconciledFromAuthority", input.reconciledFromAuthority),
      } as WithoutEventHash<RuntimeStateEvent>) as RuntimeLogWriteResult<RuntimeStateEvent>;
      if (written.ok) states.set(stateIdentity, input.current);
      return written;
    },
  };
};
