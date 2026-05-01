import type { validateGeometryScrollProof } from "./geometry-scroll-proof-gate.js";
import type { MouseScrollExecutionContext } from "./mouse-scroll-runtime-context.js";
import type { MouseScrollExecutionSeed } from "./mouse-scroll-execution-contract.js";

export type ValidatedMouseScrollExecution = {
  seed: MouseScrollExecutionSeed;
  geometryGate: Extract<ReturnType<typeof validateGeometryScrollProof>, { ok: true }>;
  policyGate: Extract<ReturnType<typeof import("./scroll-policy-gate.js").validateScrollPolicy>, { ok: true }>;
  safetyGate: Extract<ReturnType<typeof import("./pre-scroll-safety-gate.js").validatePreScrollSafety>, { ok: true }>;
  deltaResolution: Extract<ReturnType<typeof import("./scroll-delta-resolver.js").resolveScrollDelta>, { ok: true }>;
};

export type ReservedMouseScrollExecution = ValidatedMouseScrollExecution & {
  reservation: Extract<ReturnType<MouseScrollExecutionContext["idempotency"]["reserve"]>, { ok: true }>;
};