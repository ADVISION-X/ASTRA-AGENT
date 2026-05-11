/**
 * Commander Console Envelope + Transport Port
 *
 * Governance:
 *   - Commander only emits HumanCommandEnvelope.
 *   - Commander does not directly call AI, browser/action owners, or Forensics writers.
 *   - Transport port is the sole Commander→Nerve Bus boundary.
 */

export type { CommanderEnvelope } from "./schema.js";

// ─── Transport port ───────────────────────────────────────────────────────────

export type CommandTransportResult = {
  ok: boolean;
  transportRef: string | null;
  failureReason: string | null;
};

export interface CommandTransportPort {
  sendHumanCommandEnvelope(envelope: import("./schema.js").CommanderEnvelope): Promise<CommandTransportResult>;
  emitHumanCommand(command: import("./ports/command-transport-port.js").CommanderHumanCommand): Promise<CommandTransportResult>;
}
