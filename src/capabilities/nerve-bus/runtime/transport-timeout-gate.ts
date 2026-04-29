export function resolveTransportTimeoutGate(maxDurationMs: number): { ok: true; timeoutMs: number } | { ok: false; reason: string } {
  if (!Number.isFinite(maxDurationMs) || maxDurationMs <= 0) {
    return { ok: false, reason: "Transport timeout must be a positive finite duration." };
  }

  return { ok: true, timeoutMs: maxDurationMs };
}
