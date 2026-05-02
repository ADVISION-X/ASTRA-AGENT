import type { NerveBusClockPort } from "../ports/nerve-bus-clock-port.js";
import type { NerveBusIdempotencyPort } from "../ports/nerve-bus-idempotency-port.js";
import { createSystemNerveBusClockPort } from "./system-nerve-bus-clock-port.js";
import { createInMemoryNerveBusIdempotencyPort } from "./transport-idempotency-store.js";
import type { NerveBusHandlerPort } from "../ports/nerve-bus-handler-port.js";
import type { NerveBusQueuePort } from "../ports/nerve-bus-queue-port.js";
import { createInMemoryNerveBusQueuePort } from "./transport-queue.js";
import type { NerveBusSequencePort } from "../ports/nerve-bus-sequence-port.js";
import type { NerveBusTransportPort } from "../ports/nerve-bus-transport-port.js";
import { createInMemoryNerveBusSequencePort } from "./transport-sequence-store.js";
import { createInMemoryNerveBusTransportPort } from "./transport-store.js";

export type NerveBusRuntimeContext = {
  clock: NerveBusClockPort;
  handlerPort: NerveBusHandlerPort;
  transport: NerveBusTransportPort;
  idempotency: NerveBusIdempotencyPort;
  queue: NerveBusQueuePort;
  sequence: NerveBusSequencePort;
};

export function createNerveBusRuntimeContext(input: {
  handlerPort: NerveBusHandlerPort;
  clockPort?: NerveBusClockPort;
  transportPort?: NerveBusTransportPort;
  idempotencyPort?: NerveBusIdempotencyPort;
  queuePort?: NerveBusQueuePort;
  sequencePort?: NerveBusSequencePort;
}): NerveBusRuntimeContext {
  return {
    clock: input.clockPort ?? createSystemNerveBusClockPort(),
    transport: input.transportPort ?? createInMemoryNerveBusTransportPort(),
    idempotency: input.idempotencyPort ?? createInMemoryNerveBusIdempotencyPort(),
    queue: input.queuePort ?? createInMemoryNerveBusQueuePort(),
    sequence: input.sequencePort ?? createInMemoryNerveBusSequencePort(),
    handlerPort: input.handlerPort,
  };
}