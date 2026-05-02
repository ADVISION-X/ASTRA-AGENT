import type { NerveBusSequencePort } from "../ports/nerve-bus-sequence-port.js";

export function enforceTransportSequencePolicy(input: {
  sequence: NerveBusSequencePort;
  missionId: string;
  mapId: string;
  channelId: string;
  sequenceNo: number;
}): { ok: true } | { ok: false; sequenceDecision: "duplicate" | "out_of_order"; reason: string } {
  return input.sequence.checkAndAdvance({
    missionId: input.missionId,
    mapId: input.mapId,
    channelId: input.channelId,
    sequenceNo: input.sequenceNo,
  });
}
