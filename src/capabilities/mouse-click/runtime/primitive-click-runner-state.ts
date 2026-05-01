const MAX_CONCURRENT_CLICKS = 1;
const CIRCUIT_BREAKER_FAILURE_THRESHOLD = 3;
const CIRCUIT_BREAKER_COOLDOWN_MS = 5_000;

type PrimitiveRunnerState = {
  activeClicks: number;
  consecutiveFailures: number;
  circuitOpenUntilMs: number;
};

const primitiveRunnerState: PrimitiveRunnerState = {
  activeClicks: 0,
  consecutiveFailures: 0,
  circuitOpenUntilMs: 0,
};

export const closePrimitiveCircuitIfExpired = (nowMs: number) => {
  if (primitiveRunnerState.circuitOpenUntilMs !== 0 && nowMs >= primitiveRunnerState.circuitOpenUntilMs) {
    primitiveRunnerState.circuitOpenUntilMs = 0;
    primitiveRunnerState.consecutiveFailures = 0;
  }
};

export const getPrimitiveCircuitOpenUntilMs = () => primitiveRunnerState.circuitOpenUntilMs;

export const isPrimitiveCircuitOpen = (nowMs: number) => primitiveRunnerState.circuitOpenUntilMs > nowMs;

export const hasPrimitiveExecutionCapacity = () => primitiveRunnerState.activeClicks < MAX_CONCURRENT_CLICKS;

export const reservePrimitiveExecutionSlot = () => {
  primitiveRunnerState.activeClicks += 1;
};

export const releasePrimitiveExecutionSlot = () => {
  primitiveRunnerState.activeClicks = Math.max(0, primitiveRunnerState.activeClicks - 1);
};

export const recordPrimitiveFailure = (nowMs: number) => {
  primitiveRunnerState.consecutiveFailures += 1;
  if (primitiveRunnerState.consecutiveFailures >= CIRCUIT_BREAKER_FAILURE_THRESHOLD) {
    primitiveRunnerState.circuitOpenUntilMs = nowMs + CIRCUIT_BREAKER_COOLDOWN_MS;
  }
};

export const recordPrimitiveSuccess = () => {
  primitiveRunnerState.consecutiveFailures = 0;
  primitiveRunnerState.circuitOpenUntilMs = 0;
};
