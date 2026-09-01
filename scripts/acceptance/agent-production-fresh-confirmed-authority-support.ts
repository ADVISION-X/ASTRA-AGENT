import type { BrowserExecutionBinding } from "../../src/lib/browser/browser-authority-api.js";
import type { WorkbenchBrowserAuthority } from
  "../../src/lib/local-runtime/workbench-browser-authority-support.js";

type Scenario = Readonly<{
  attemptId: string;
  submitExactCallIdentityHash: `sha256:${string}`;
  submitCall: Readonly<{
    productStepId: string;
    callId: string;
    child: string;
    actionOrdinal: number;
  }>;
}>;

export const freshConfirmedAuthority = (input: Readonly<{
  scenario: Scenario;
  captured: { value: BrowserExecutionBinding | null };
  onDispatchRead(): void;
  onBrowserAcquisition(): void;
}>): WorkbenchBrowserAuthority => Object.assign(Object.create(null) as WorkbenchBrowserAuthority, {
  readExactCallMutationFact: (query: Readonly<{
    attemptId: string;
    exactCallIdentityHash: `sha256:${string}`;
  }>) => query.attemptId === input.scenario.attemptId
    && query.exactCallIdentityHash === input.scenario.submitExactCallIdentityHash
    ? {
      effectScope: "provider_effect" as const, outcome: "CONFIRMED" as const,
      terminalAt: new Date().toISOString(), targetRef: "target:fresh-confirmed-submit",
      documentRef: "document:fresh-confirmed-submit",
      productStepId: input.scenario.submitCall.productStepId,
      callId: input.scenario.submitCall.callId,
      childCapabilityId: input.scenario.submitCall.child,
      actionOrdinal: input.scenario.submitCall.actionOrdinal,
    } : null,
  countProviderTurnDispatches: () => { input.onDispatchRead(); return 0; },
  acquireJobBoundTargetLease: async (binding: BrowserExecutionBinding) => {
    input.onBrowserAcquisition();
    input.captured.value = binding;
    throw new Error("CAPTURED_FRESH_CONFIRMED_READBACK_BINDING");
  },
});
