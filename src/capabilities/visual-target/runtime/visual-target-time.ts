export function parseVisualTargetIsoTimestamp(isoTimestamp: string): number {
  const epochMs = Date.parse(isoTimestamp);
  if (Number.isNaN(epochMs)) {
    throw new Error(`Invalid Visual Target ISO timestamp: ${isoTimestamp}`);
  }

  return epochMs;
}

export function calculateVisualTargetAgeMs(input: {
  nowIso: string;
  observedIso: string;
}): number {
  return Math.max(0, parseVisualTargetIsoTimestamp(input.nowIso) - parseVisualTargetIsoTimestamp(input.observedIso));
}