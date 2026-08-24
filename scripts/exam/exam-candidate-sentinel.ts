import { candidateSnapshotAt } from '../audit/governance-authority.js';

export function examCandidateIdentity(root = process.cwd()): string {
  return candidateSnapshotAt(root);
}

export function assertExamCandidateUnchanged(root: string, expected: string): void {
  if (examCandidateIdentity(root) !== expected) throw Object.assign(new Error('exam candidate drift'), { code: 'CANDIDATE_DRIFT' });
}
