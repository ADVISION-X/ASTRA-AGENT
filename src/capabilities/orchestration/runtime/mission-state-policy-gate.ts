import type { MissionState } from "../contract.js";

export type StatePolicyDecision = {
  allowed: boolean;
  reason: string | null;
};

const TERMINAL_STATUSES = new Set(["completed", "failed", "stopped"]);

export function checkCanPause(state: MissionState): StatePolicyDecision {
  if (state.status !== "running") {
    return { allowed: false, reason: `Cannot pause mission in status ${state.status}. Must be running.` };
  }
  if (state.emergencyStopLatched) {
    return { allowed: false, reason: "Cannot pause: emergency stop is latched." };
  }
  return { allowed: true, reason: null };
}

export function checkCanResume(state: MissionState): StatePolicyDecision {
  if (state.emergencyStopLatched) {
    return { allowed: false, reason: "Cannot resume: emergency stop is latched. Emergency stop is irreversible." };
  }
  if (TERMINAL_STATUSES.has(state.status)) {
    return { allowed: false, reason: `Cannot resume mission in terminal status ${state.status}.` };
  }
  if (state.status !== "paused" && state.status !== "review_required") {
    return { allowed: false, reason: `Cannot resume mission in status ${state.status}. Must be paused or review_required.` };
  }
  return { allowed: true, reason: null };
}

export function checkCanStop(state: MissionState): StatePolicyDecision {
  if (state.emergencyStopLatched) {
    return { allowed: false, reason: "Mission already emergency-stopped. Emergency stop is irreversible." };
  }
  if (TERMINAL_STATUSES.has(state.status)) {
    return { allowed: false, reason: `Cannot stop mission in terminal status ${state.status}.` };
  }
  return { allowed: true, reason: null };
}

export function checkCanEmergencyStop(state: MissionState): StatePolicyDecision {
  if (state.emergencyStopLatched) {
    return { allowed: false, reason: "Mission already emergency-stopped. Emergency stop is irreversible." };
  }
  if (state.status === "completed") {
    return { allowed: false, reason: "Cannot emergency-stop a completed mission." };
  }
  return { allowed: true, reason: null };
}

export function checkCanDispatchStep(state: MissionState): StatePolicyDecision {
  if (state.status !== "running") {
    return { allowed: false, reason: `Cannot dispatch step when mission status is ${state.status}. Must be running.` };
  }
  if (state.emergencyStopLatched) {
    return { allowed: false, reason: "Cannot dispatch step: emergency stop is latched." };
  }
  if (!state.currentStepId) {
    return { allowed: false, reason: "Cannot dispatch step: no current step set." };
  }
  return { allowed: true, reason: null };
}

export function checkRevisionConflict(stored: MissionState, incoming: MissionState): StatePolicyDecision {
  if (incoming.stateRevision < stored.stateRevision) {
    return { allowed: false, reason: `State revision conflict: incoming revision ${incoming.stateRevision} is behind stored ${stored.stateRevision}.` };
  }
  return { allowed: true, reason: null };
}
