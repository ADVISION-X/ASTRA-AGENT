import { fail } from './governance-runtime.js';

export function requireSinglePrimaryOwner(owners: readonly string[], path: string): string {
  if (owners.length === 0) fail('UNOWNED_PRODUCTION_FILE', path);
  if (owners.length > 1) fail('MULTIPLE_PRIMARY_OWNERS', `${path}:${owners.join(',')}`);
  return owners[0]!;
}

export function requireProductionImportRole(source: string, target: string, targetRole: string): void {
  if (['TEST_ONLY', 'HISTORY_ONLY', 'QUALITY_REPORT'].includes(targetRole)) {
    fail('ROLE_ESCALATION_REQUIRED', `${source}->${target}`);
  }
}

export function requireAuthorizedProductionDelete(
  path: string,
  baseObjectExists: boolean,
  owners: readonly string[],
): void {
  if (!baseObjectExists) fail('UNAUTHORIZED_PRODUCTION_DELETE', path);
  requireSinglePrimaryOwner(owners, path);
}

export function requireCandidateStable(before: string, after: string, detail: string): void {
  if (before !== after) fail('CANDIDATE_DRIFT', detail);
}

export function requireExactProjection(
  actualFiles: readonly string[],
  expectedFiles: readonly string[],
  actualBytes: Uint8Array,
  expectedBytes: Uint8Array,
): void {
  if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
    fail('GENERATED_FILESET_INVALID', actualFiles.join(','));
  }
  if (!Buffer.from(actualBytes).equals(Buffer.from(expectedBytes))) {
    fail('GENERATED_PROJECTION_STALE', expectedFiles.join(','));
  }
}

export function requireReleaseCandidateBound(cleanTree: boolean, candidateId?: string): void {
  if (!cleanTree || (candidateId !== undefined && !/^[a-f0-9]{64}$/u.test(candidateId))) {
    fail('RELEASE_CANDIDATE_UNBOUND', 'RELEASE requires one clean, exact candidate');
  }
}

export function requireReleaseEvidence(present: boolean, detail: string): void {
  if (!present) fail('RELEASE_EVIDENCE_MISSING', detail);
}
