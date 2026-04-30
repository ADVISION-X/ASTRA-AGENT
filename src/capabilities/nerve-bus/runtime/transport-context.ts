import { createSystemNerveBusClockPort } from "../ports/nerve-bus-clock-port.js";
import type { NerveBusClockPort } from "../ports/nerve-bus-clock-port.js";
import { createInMemoryNerveBusIdempotencyPort } from "../ports/nerve-bus-idempotency-port.js";
import type { NerveBusIdempotencyPort } from "../ports/nerve-bus-idempotency-port.js";
import type { NerveBusHandlerPort } from "../ports/nerve-bus-handler-port.js";
import { createInMemoryNerveBusQueuePort } from "../ports/nerve-bus-queue-port.js";
import type { NerveBusQueuePort } from "../ports/nerve-bus-queue-port.js";
import { createInMemoryNerveBusTransportPort } from "../ports/nerve-bus-transport-port.js";
import type { NerveBusTransportPort } from "../ports/nerve-bus-transport-port.js";

export type NerveBusRuntimeContext = {
  clock: NerveBusClockPort;
  handlerPort: NerveBusHandlerPort;
  transport: NerveBusTransportPort;
  idempotency: NerveBusIdempotencyPort;
  queue: NerveBusQueuePort;
};

export function createNerveBusRuntimeContext(input: {
  handlerPort: NerveBusHandlerPort;
}): NerveBusRuntimeContext {
  return {
    clock: createSystemNerveBusClockPort(),
    transport: createInMemoryNerveBusTransportPort(),
    idempotency: createInMemoryNerveBusIdempotencyPort(),
    queue: createInMemoryNerveBusQueuePort(),
    handlerPort: input.handlerPort,
  };
}