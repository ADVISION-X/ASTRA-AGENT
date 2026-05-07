import type { PageStateClockPort } from "../ports/page-state-clock-port.js";
import type { PageStateChildCapability } from "./page-state-child-contract.js";
import { createPageStateRegistry } from "../registry.js";
import { createSystemPageStateClock } from "./page-state-clock.js";

export type PageStateRuntimeContext = {
  registry: Map<string, PageStateChildCapability>;
  clock: PageStateClockPort;
};

export function createDefaultPageStateRuntimeContext(): PageStateRuntimeContext {
  return {
    registry: createPageStateRegistry(),
    clock: createSystemPageStateClock(),
  };
}