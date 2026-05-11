/**
 * Commander Console Public Types
 *
 * Exports the public interface for the Commander Console ability group.
 * Callers depend on these types; the implementation details are in schema.ts.
 */

import type {
  CommanderChildCapabilityId,
  CommanderConsoleResult,
  CommanderMissionStatusView,
} from "./schema.js";
import type { CommandTransportPort } from "./envelope.js";
import type { CommanderChildContext } from "./children.js";

export type {
  CommanderChildCapabilityId,
  CommanderConsoleResult,
  CommanderMissionStatusView,
  CommandTransportPort,
};

// ─── Ability group interface ──────────────────────────────────────────────────

export type CommanderConsoleAbilityGroup = {
  abilityGroupId: "commander-console";
  listChildCapabilityIds(): readonly CommanderChildCapabilityId[];
  execute(input: {
    childCapabilityId: string;
    operatorRef: string;
    input: Record<string, unknown>;
  }): Promise<CommanderConsoleResult>;
};

// ─── Factory input ────────────────────────────────────────────────────────────

export type CreateCommanderConsoleInput = {
  defaultOperatorRef: string;
  commandTransport: CommandTransportPort;
  getMissionStatus: CommanderChildContext["getMissionStatus"];
};
