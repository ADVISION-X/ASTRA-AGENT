import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { GIT_EVIDENCE_MAX_BUFFER, sha } from '../audit/governance-runtime.js';
import { canonicalBytes } from '../audit/governance-json.js';

export function examCandidateIdentity(root = process.cwd()): string {
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root }).toString().trim();
  const diff = execFileSync('git', ['diff', '--binary', '--no-ext-diff', 'HEAD', '--'], {
    cwd: root,
    maxBuffer: GIT_EVIDENCE_MAX_BUFFER,
  });
  const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard', '-z'], {
    cwd: root,
    maxBuffer: GIT_EVIDENCE_MAX_BUFFER,
  })
    .toString().split('\0').filter(Boolean).sort()
    .map((path) => ({ path, sha256: sha(readFileSync(resolve(root,path))) }));
  return sha(canonicalBytes({ commit, diffSha256: sha(diff), untracked }));
}

export function assertExamCandidateUnchanged(root: string, expected: string): void {
  if (examCandidateIdentity(root) !== expected) throw Object.assign(new Error('exam candidate drift'), { code: 'CANDIDATE_DRIFT' });
}
