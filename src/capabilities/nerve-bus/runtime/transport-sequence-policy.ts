const lastSequenceByScope = new Map<string, number>();

export function enforceTransportSequencePolicy(input: {
  missionId: string;
  mapId: string;
  stepId: string;
  channelId: string;
  sequenceNo: number;
}): { ok: true } | { ok: false; integrityDecision: "out_of_order"; reason: string } {
  const key = `${input.missionId}:${input.mapId}:${input.stepId}:${input.channelId}`;
  const previous = lastSequenceByScope.get(key);
  if (previous !== undefined && input.sequenceNo !== previous + 1) {
    return { ok: false, integrityDecision: "out_of_order", reason: `Sequence ${input.sequenceNo} is out of order; expected ${previous + 1}.` };
  }

  lastSequenceByScope.set(key, input.sequenceNo);
  return { ok: true };
}
