import type { RoundMissionPacket } from "./round-mission-packet.schema.js";

const roundMissionPackets = new Map<string, RoundMissionPacket>();

export function recordRoundMissionPacket(packetRef: string, packet: RoundMissionPacket): void {
  roundMissionPackets.set(packetRef, packet);
}

export function resolveRoundMissionPacket(packetRef: string | null | undefined): RoundMissionPacket | null {
  return packetRef ? roundMissionPackets.get(packetRef) ?? null : null;
}
