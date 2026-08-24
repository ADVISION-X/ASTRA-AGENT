const REQUIRED_OUTPUT: Readonly<Record<string, string>> = Object.freeze({
  'acceptance:ai-input-gateway': '[ai-input-gateway-exact-target] PASS',
  'acceptance:app-shell-ui': '[ACCEPTANCE][app-shell-ui] PASS',
  'acceptance:architecture-active-plugin-mediators': 'architecture-active-plugin-mediators-acceptance-ok',
  'acceptance:code-purity-zombie-deep': 'code-purity-zombie-deep-acceptance-ok',
  'acceptance:forensics-persistence-capability': '[ACCEPTANCE] forensics-persistence-capability PASS',
  'acceptance:local-app-shell': 'local-app-shell-acceptance-ok',
  'acceptance:local-browser-terminal': 'LOCAL_BROWSER_TERMINAL_CONTRACT_ACCEPTANCE_PASS',
  'acceptance:runtime-log-spine': '[ACCEPTANCE] runtime-log-redaction PASS',
  'acceptance:startup-entrypoint': 'startup initialization health acceptance: PASS',
  'acceptance:system-security': 'system-security-acceptance-ok',
  'acceptance:xuanxue-ai-production': '[ACCEPTANCE][XUANXUE-AI-PRODUCTION-V6] PASS',
  'acceptance:xuanxue-ai-production-localization-contract': '[ACCEPTANCE] localization generated projection PASS',
  'exam:governance-bindings': 'every V3.3 binding has a runnable negative case that fails closed',
});

export function verifyExamBehavior(command: string, stdout: string, bindingId: string): void {
  const required = REQUIRED_OUTPUT[command];
  if (!required) throw new Error(`EXAM_BEHAVIOR_PREDICATE_MISSING:${bindingId}`);
  if (!stdout.includes(required)) throw new Error(`EXAM_BEHAVIOR_NOT_OBSERVED:${bindingId}`);
}
