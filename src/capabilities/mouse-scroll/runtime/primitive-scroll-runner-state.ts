import type { PrimitiveCircuitBreakerState } from "./primitive-scroll-runner-result.js";

const MAX_CONCURRENT_SCROLLS = 1;
const CIRCUIT_BREAKER_FAILURE_THRESHOLD = 3;
const CIRCUIT_BREAKER_COOLDOWN_MS = 5_000;

type PrimitiveRunnerState = {
  activeScrolls: number;
  consecutiveFailures: number;
  circuitOpenUntilMs: number;
};

const primitiveRunnerState: PrimitiveRunnerState = {
  activeScrolls: 0,
  consecutiveFailures: 0,
  circuitOpenUntilMs: 0,
};

export const closeCircuitIfExpired = (nowMs: number) => {
  if (primitiveRunnerState.circuitOpenUntilMs !== 0 && nowMs >= primitiveRunnerState.circuitOpenUntilMs) {
    primitiveRunnerState.circuitOpenUntilMs = 0;
    primitiveRunnerState.consecutiveFailures = 0;
  }
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

export const getPrimitiveCircuitBreakerState = (nowMs: number): PrimitiveCircuitBreakerState => {
  return primitiveRunnerState.circuitOpenUntilMs > nowMs ? "open" : "closed";
};

export const isPrimitiveCircuitOpen = (nowMs: number) => primitiveRunnerState.circuitOpenUntilMs > nowMs;
export const isPrimitiveConcurrencyBlocked = () => primitiveRunnerState.activeScrolls >= MAX_CONCURRENT_SCROLLS;
export const markPrimitiveScrollStarted = () => {
  primitiveRunnerState.activeScrolls += 1;
};
export const markPrimitiveScrollFinished = () => {
  primitiveRunnerState.activeScrolls = Math.max(0, primitiveRunnerState.activeScrolls - 1);
};