import type { PageStateClockPort } from "../ports/page-state-clock-port.js";
import type { PageStateProfilePort } from "../ports/page-state-profile-port.js";
import type { PageStateChildCapability } from "./page-state-child-contract.js";
import { createPageStateRegistry } from "../registry.js";
import { createSystemPageStateClock } from "./page-state-clock.js";
import { createDefaultPageStateProfilePort } from "./platform-profile-gate.js";

export type PageStateRuntimeContext = {
  registry: Map<string, PageStateChildCapability>;
  clock: PageStateClockPort;
  profilePort: PageStateProfilePort;
};

export function createDefaultPageStateRuntimeContext(): PageStateRuntimeContext {
  return {
    registry: createPageStateRegistry(),
    clock: createSystemPageStateClock(),
    profilePort: createDefaultPageStateProfilePort(),
  };
}