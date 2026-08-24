import { fail } from './governance-runtime.js';

export type BindingVerdictInput = Readonly<{
  lawId: string;
  bindingId: string;
  summarySatisfied: boolean;
  triggeredForbidden: readonly string[];
  assertions: readonly Readonly<{ passed: boolean; evidenceRefs: readonly string[] }>[];
  findingCount: number;
}>;

export function enforceBindingVerdict(input: BindingVerdictInput): void {
  const exactIdentity = /^LAW-[A-Z0-9-]+-V\d+$/u.test(input.lawId) && input.bindingId.length > 0;
  const exactEvidence = input.assertions.length > 0
    && input.assertions.every((assertion) => assertion.passed && assertion.evidenceRefs.length > 0);
  if (!exactIdentity || !input.summarySatisfied || input.triggeredForbidden.length > 0
    || !exactEvidence || input.findingCount > 0) {
    fail('COMPONENT_FAILED', input.bindingId);
  }
}
