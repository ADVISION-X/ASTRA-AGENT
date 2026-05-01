import type { PageStateAbilityInput } from "../schema.js";
import type { PageStateClockPort } from "../ports/page-state-clock-port.js";
import type { PageStateProfilePort } from "../ports/page-state-profile-port.js";
import { dispatchPageStateFailure } from "./page-state-dispatch-failure.js";
import { gateObservationProofBinding } from "./observation-proof-binding-gate.js";
import { gateObservationSources } from "./observation-source-gate.js";
import { gatePageStateInput } from "./page-state-input-gate.js";
import { gatePageStatePayloadBudget } from "./page-state-payload-budget-gate.js";
import { gatePlatformProfile } from "./platform-profile-gate.js";
import { gateSnapshotFreshness } from "./snapshot-freshness-gate.js";

type FailedPageStateGate = {
  ok: false;
  failure: {
    failureReason: Parameters<typeof dispatchPageStateFailure>[0]["failureReason"];
    stateSummary: string;
    reviewRequiredReason: string | null;
    pageStateType: Parameters<typeof dispatchPageStateFailure>[0]["pageStateType"];
    status: Parameters<typeof dispatchPageStateFailure>[0]["status"];
    decision: Parameters<typeof dispatchPageStateFailure>[0]["decision"];
    dataQualityFlags: NonNullable<Parameters<typeof dispatchPageStateFailure>[0]["dataQualityFlags"]>;
  };
};

type PageStatePreflightResolution =
  | { ok: true; state: PageStatePreflightState }
  | { ok: false; gate: FailedPageStateGate };

export type PageStatePreflightInput = {
  request: PageStateAbilityInput;
  clock: PageStateClockPort;
  profilePort: PageStateProfilePort;
};

type SuccessfulGate<TGate> = Extract<TGate, { ok: true }>;

export type PageStatePreflightState = {
  inputGate: SuccessfulGate<ReturnType<typeof gatePageStateInput>>;
  payloadBudgetGate: SuccessfulGate<ReturnType<typeof gatePageStatePayloadBudget>>;
  sourceGate: SuccessfulGate<ReturnType<typeof gateObservationSources>>;
  proofBindingGate: SuccessfulGate<ReturnType<typeof gateObservationProofBinding>>;
  freshnessGate: SuccessfulGate<ReturnType<typeof gateSnapshotFreshness>>;
  platformGate: SuccessfulGate<ReturnType<typeof gatePlatformProfile>>;
};

export type PageStatePreflightResult =
  | { ok: true; state: PageStatePreflightState }
  | { ok: false; result: import("../schema.js").PageStateAbilityResult };

function dispatchPreflightFailure(input: PageStatePreflightInput, gate: FailedPageStateGate) {
  const failureInput = {
    request: input.request,
    failureReason: gate.failure.failureReason,
    stateSummary: gate.failure.stateSummary,
    reviewRequiredReason: gate.failure.reviewRequiredReason,
    dataQualityFlags: gate.failure.dataQualityFlags,
    clock: input.clock,
  };

  const failureWithStatus = gate.failure.status === undefined
    ? failureInput
    : { ...failureInput, status: gate.failure.status };

  const failureWithDecision = gate.failure.decision === undefined
    ? failureWithStatus
    : { ...failureWithStatus, decision: gate.failure.decision };

  return gate.failure.pageStateType === undefined
    ? dispatchPageStateFailure(failureWithDecision)
    : dispatchPageStateFailure({ ...failureWithDecision, pageStateType: gate.failure.pageStateType });
}

function resolvePageStatePreflightValidationGates(input: PageStatePreflightInput): PageStatePreflightResolution {
  const inputGate = gatePageStateInput(input.request);
  if (!inputGate.ok) return { ok: false, gate: inputGate };

  const payloadBudgetGate = gatePageStatePayloadBudget(input.request);
  if (!payloadBudgetGate.ok) return { ok: false, gate: payloadBudgetGate };

  const sourceGate = gateObservationSources(input.request);
  if (!sourceGate.ok) return { ok: false, gate: sourceGate };

  const proofBindingGate = gateObservationProofBinding(input.request);
  if (!proofBindingGate.ok) return { ok: false, gate: proofBindingGate };

  return {
    ok: true,
    state: {
      inputGate,
      payloadBudgetGate,
      sourceGate,
      proofBindingGate,
      freshnessGate: gateSnapshotFreshness({ request: input.request, clock: input.clock }),
      platformGate: gatePlatformProfile({ request: input.request, profilePort: input.profilePort }),
    },
  };
}

function resolvePageStatePreflightEnvironmentGates(input: PageStatePreflightInput, state: PageStatePreflightState): PageStatePreflightResolution {
  if (!state.freshnessGate.ok) return { ok: false, gate: state.freshnessGate };
  if (!state.platformGate.ok) return { ok: false, gate: state.platformGate };

  return {
    ok: true,
    state,
  };
}

function resolvePageStatePreflight(input: PageStatePreflightInput): PageStatePreflightResolution {
  const validationResolution = resolvePageStatePreflightValidationGates(input);
  if (!validationResolution.ok) {
    return validationResolution;
  }

  return resolvePageStatePreflightEnvironmentGates(input, validationResolution.state);
}

export function runPageStatePreflight(input: PageStatePreflightInput): PageStatePreflightResult {
  const resolution = resolvePageStatePreflight(input);
  if (!resolution.ok) {
    return { ok: false, result: dispatchPreflightFailure(input, resolution.gate) };
  }

  return { ok: true, state: resolution.state };
}