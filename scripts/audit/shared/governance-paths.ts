export const SPEC = 'docs/governance/法案系统建设说明书-冻结定稿版.md';
export const BASE = '.github/instructions/agent-rules/基础法案.md';
export const FUNCTIONAL = '.github/instructions/agent-rules/功能法案.md';
export const REGISTRY = 'scripts/audit/generated/law-registry.generated.json';
export const REPORT = 'scripts/audit/reports/law-quality.report.json';

const authorityExactPaths = new Set([SPEC, 'AGENTS.md', BASE, FUNCTIONAL]);
const testPrefixes = ['tests/', 'fixtures/', 'examples/'];

export type CandidatePathRole = 'GOVERNANCE_AUTHORITY' | 'GENERATED_REGISTRY' | 'QUALITY_REPORT'
  | 'TEST_ONLY' | 'HISTORY_ONLY' | 'PRODUCTION';

export function pathRole(path: string): CandidatePathRole {
  if (authorityExactPaths.has(path) || path.startsWith('docs/blueprints/') || path.startsWith('docs/specs/')
    || /^scripts\/audit\/domains\/[^/]+\/manifest\.json$/u.test(path)) return 'GOVERNANCE_AUTHORITY';
  if (path === REGISTRY) return 'GENERATED_REGISTRY';
  if (path === REPORT || path.startsWith('scripts/audit/reports/')) return 'QUALITY_REPORT';
  if (testPrefixes.some((prefix) => path.startsWith(prefix)) || path.includes('/fixtures/') || path.includes('/examples/')) return 'TEST_ONLY';
  if (path.startsWith('docs/history/')) return 'HISTORY_ONLY';
  return 'PRODUCTION';
}
