import type { AiClockPort } from "./ai-clock-port.js";
import type { AiModelRoster } from "../contract.js";

export interface AiModelRosterPort {
  load(clock: AiClockPort): Promise<AiModelRoster>;
}
