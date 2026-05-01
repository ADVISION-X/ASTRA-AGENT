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

export function runPageStatePreflight(input: PageStatePreflightInput): PageStatePreflightResult {
  const inputGate = gatePageStateInput(input.request);
  if (!inputGate.ok) {
    return { ok: false, result: dispatchPreflightFailure(input, inputGate) };
  }

  const payloadBudgetGate = gatePageStatePayloadBudget(input.request);
  if (!payloadBudgetGate.ok) {
    return { ok: false, result: dispatchPreflightFailure(input, payloadBudgetGate) };
  }

  const sourceGate = gateObservationSources(input.request);
  if (!sourceGate.ok) {
    return { ok: false, result: dispatchPreflightFailure(input, sourceGate) };
  }

  const proofBindingGate = gateObservationProofBinding(input.request);
  if (!proofBindingGate.ok) {
    return { ok: false, result: dispatchPreflightFailure(input, proofBindingGate) };
  }

  const freshnessGate = gateSnapshotFreshness({ request: input.request, clock: input.clock });
  if (!freshnessGate.ok) {
    return { ok: false, result: dispatchPreflightFailure(input, freshnessGate) };
  }

  const platformGate = gatePlatformProfile({ request: input.request, profilePort: input.profilePort });
  if (!platformGate.ok) {
    return { ok: false, result: dispatchPreflightFailure(input, platformGate) };
  }

  return {
    ok: true,
    state: {
      inputGate,
      payloadBudgetGate,
      sourceGate,
      proofBindingGate,
      freshnessGate,
      platformGate,
    },
  };
}