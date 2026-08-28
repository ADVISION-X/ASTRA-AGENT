import { randomUUID } from "node:crypto";

import { runtimeEventHash } from "./integrity.js";
import { resolveRuntimeLogMode, type RuntimeLogMode } from "./mode.js";
import { redactRuntimeLogRecord } from "./redaction.js";
import { assertRuntimeLogEventV2 } from "./schema.js";
import type {
  RuntimeLogEventV2,
  RuntimeLogEventWithoutIntegrity,
  RuntimeLogWriteFailure,
  RuntimeLogWriteResult,
  RuntimeSpanStartedEvent,
  RuntimeSpanStartInput,
  RuntimeSpanTerminalEvent,
  RuntimeSpanTerminalInput,
  RuntimeStateEvent,
  RuntimeStateInput,
  RuntimeStateValue,
  WithoutEventHash,
} from "./runtime-event-contract.js";
import type { RuntimeLogOwner } from "./runtime-failure-contract.js";
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
  redactRuntimeLogRecord(event);

const optional = <TKey extends string, TValue>(key: TKey, value: TValue | undefined): Partial<Record<TKey, TValue>> =>
  value === undefined ? {} : { [key]: value } as Record<TKey, TValue>;

class RuntimeLoggerOwner implements RuntimeLogger {
  public readonly producerRunId: string;
  private readonly activeMode: RuntimeLogMode;
  private readonly fileSink: RuntimeFileSink | null;
  private producerSeq = 0;
  private previousEventHash: `sha256:${string}` | null = null;
  private sinkWritable = true;
  private sinkState: "ready" | "failed" | "capacity_blocked" = "ready";
  private readonly openSpans = new Set<string>();
  private readonly states = new Map<string, RuntimeStateValue>();

  public constructor(private readonly config: RuntimeLoggerConfig) {
    if (!tokenValid(config.producer) || !tokenValid(config.component)) throw new Error("RUNTIME_LOG_PRODUCER_INVALID");
    if (!config.fileSink && config.terminalEnabled === false) throw new Error("RUNTIME_LOG_MACHINE_SINK_MISSING");
    this.activeMode = resolveRuntimeLogMode(config.modeOverride);
    this.producerRunId = config.producerRunId ?? randomUUID();
    this.fileSink = config.fileSink
      ? createRuntimeFileSink(config.producer, this.producerRunId, config.fileSink)
      : null;
  }

  public getActiveMode(): RuntimeLogMode { return this.activeMode; }
  public isDebugEnabled(): boolean { return this.activeMode === "DEBUG" || this.activeMode === "TRACE"; }
  public isTraceEnabled(): boolean { return this.activeMode === "TRACE"; }
  public isWritable(): boolean { return this.sinkWritable; }
  public getSinkState(): "ready" | "failed" | "capacity_blocked" { return this.sinkState; }
  public currentSegmentPath(): string | null { return this.fileSink?.currentPath() ?? null; }

  private common(input: Readonly<{
    traceId: string;
    owner?: RuntimeLogOwner;
    component?: string;
    visibility?: RuntimeLogEventV2["visibility"];
  }>) {
    const component = input.component ?? this.config.component;
    assertBaseInput(input.traceId, component);
    return {
      schemaVersion: 2 as const,
      eventId: randomUUID(),
      occurredAt: new Date().toISOString(),
      producer: this.config.producer,
      producerRunId: this.producerRunId,
      producerSeq: this.producerSeq + 1,
      previousEventHash: this.previousEventHash,
      traceId: input.traceId,
      owner: input.owner ?? this.config.owner,
      component,
      visibility: input.visibility ?? "FLOW" as const,
    };
  }

  private emergencySinkState(event: RuntimeLogEventV2): boolean {
    try {
      const sinkTraceId = `producer:${this.producerRunId}`;
      const sinkUnsigned = redactedUnsigned({
        schemaVersion: 2, eventId: randomUUID(), occurredAt: new Date().toISOString(),
        producer: this.config.producer, producerRunId: this.producerRunId,
        producerSeq: event.producerSeq, previousEventHash: this.previousEventHash,
        type: "STATE", traceId: sinkTraceId, owner: "runtime-logs", component: "runtime-log-sink",
        visibility: "FLOW", stateKey: "log.sink",
        previous: this.states.get(`log.sink\u0000${sinkTraceId}`) ?? null, current: this.sinkState,
      } as WithoutEventHash<RuntimeStateEvent>);
      const sinkEvent = { ...sinkUnsigned, eventHash: runtimeEventHash(sinkUnsigned) } as RuntimeStateEvent;
      assertRuntimeLogEventV2(sinkEvent);
      writeEmergencyTerminalSink(sinkEvent);
      return true;
    } catch {
      return false;
    }
  }

  private primaryWriteFailure(error: unknown, event: RuntimeLogEventV2): RuntimeLogWriteFailure {
    this.sinkWritable = false;
    const code = writeFailureCode(error);
    this.sinkState = code === "RUNTIME_LOG_CAPACITY_BLOCKED" ? "capacity_blocked" : "failed";
    return { ok: false, code, emergencyProjected: this.emergencySinkState(event) };
  }

  private terminalWriteFailure(event: RuntimeLogEventV2): RuntimeLogWriteFailure {
    this.sinkWritable = false;
    this.sinkState = "failed";
    let emergencyProjected = false;
    try {
      writeEmergencyTerminalSink(event);
      emergencyProjected = true;
    } catch {
      emergencyProjected = false;
    }
    return { ok: false, code: "RUNTIME_LOG_SINK_WRITE_FAILED", emergencyProjected };
  }

  private persist(unsignedInput: RuntimeLogEventWithoutIntegrity): RuntimeLogWriteResult<RuntimeLogEventV2> {
    if (!this.sinkWritable) return {
      ok: false,
      code: this.sinkState === "capacity_blocked" ? "RUNTIME_LOG_CAPACITY_BLOCKED" : "RUNTIME_LOG_SINK_WRITE_FAILED",
      emergencyProjected: false,
    };
    const unsigned = redactedUnsigned(unsignedInput);
    const event = { ...unsigned, eventHash: runtimeEventHash(unsigned) } as RuntimeLogEventV2;
    assertRuntimeLogEventV2(event);
    try {
      if (this.fileSink) this.fileSink.write(event);
      else writeTerminalSink(event, "TRACE");
    } catch (error) {
      return this.primaryWriteFailure(error, event);
    }
    if (this.fileSink && this.config.terminalEnabled !== false) {
      try {
        writeTerminalSink(event, this.activeMode);
      } catch {
        return this.terminalWriteFailure(event);
      }
    }
    this.producerSeq = event.producerSeq;
    this.previousEventHash = event.eventHash;
    return { ok: true, event };
  }

  public startSpan(input: RuntimeSpanStartInput): RuntimeLogWriteResult<RuntimeSpanHandle> {
    const spanId = input.spanId ?? randomUUID();
    if (!tokenValid(spanId) || this.openSpans.has(spanId)) throw new Error("RUNTIME_LOG_SPAN_ID_INVALID");
    const startedAt = performance.now();
    const written = this.persist({
      ...this.common(input), type: "SPAN", phase: "started", spanId, operation: input.operation,
      typedIdentity: input.typedIdentity, ...optional("parentSpanId", input.parentSpanId),
      ...optional("boundaryId", input.boundaryId),
    } satisfies WithoutEventHash<RuntimeSpanStartedEvent>);
    if (!written.ok) return written;
    this.openSpans.add(spanId);
    let closed = false;
    return { ok: true, event: {
      eventId: written.event.eventId, spanId, traceId: input.traceId,
      terminal: (terminalInput) => {
        if (closed || !this.openSpans.has(spanId)) {
          return { ok: false, code: "DUPLICATE_SPAN_TERMINAL", emergencyProjected: false };
        }
        const terminal = this.persist({
          ...this.common(input), type: "SPAN", phase: "terminal", spanId, operation: input.operation,
          outcome: terminalInput.outcome, durationMs: Math.max(0, performance.now() - startedAt),
          ...optional("authorityRef", terminalInput.authorityRef),
          ...optional("authorityHash", terminalInput.authorityHash),
          ...(terminalInput.outcome === "success" ? {} : { failure: terminalInput.failure }),
        } as WithoutEventHash<RuntimeSpanTerminalEvent>) as RuntimeLogWriteResult<RuntimeSpanTerminalEvent>;
        if (terminal.ok) {
          closed = true;
          this.openSpans.delete(spanId);
        }
        return terminal;
      },
    } };
  }

  public emitState(input: RuntimeStateInput): RuntimeLogWriteResult<RuntimeStateEvent> {
    const stateSubject = input.stateKey === "browser.mutation" || input.stateKey === "outbox.delivery"
      ? input.authorityRef ?? input.traceId : input.traceId;
    const stateIdentity = `${input.stateKey}\u0000${stateSubject}`;
    if (input.previous !== (this.states.get(stateIdentity) ?? null)) throw new Error("RUNTIME_LOG_STATE_TRANSITION_INVALID");
    if (input.stateKey !== "producer.alive" && input.stateKey !== "browser.mutation"
      && input.previous === input.current) throw new Error("RUNTIME_LOG_STATE_NOOP_FORBIDDEN");
    const written = this.persist({
      ...this.common(input), type: "STATE", stateKey: input.stateKey,
      previous: input.previous, current: input.current,
      ...optional("freshForMs", input.freshForMs), ...optional("authorityRef", input.authorityRef),
      ...optional("authorityHash", input.authorityHash),
      ...optional("reconciledFromAuthority", input.reconciledFromAuthority),
    } as WithoutEventHash<RuntimeStateEvent>) as RuntimeLogWriteResult<RuntimeStateEvent>;
    if (written.ok) this.states.set(stateIdentity, input.current);
    return written;
  }
}

export const createRuntimeLogger = (config: RuntimeLoggerConfig): RuntimeLogger => new RuntimeLoggerOwner(config);
