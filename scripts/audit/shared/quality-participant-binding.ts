import { fail } from "../governance-runtime.js";

export type ProviderDependency = Readonly<{
  contractId: string;
  providerRepo: string;
  providerDomain: string;
  version: number;
}>;

export const assertExactProviderContract = (
  repo: string,
  dependency: ProviderDependency,
  available: readonly ProviderDependency[],
): void => {
  const matches = available.filter((contract) => contract.providerRepo === repo
    && contract.providerDomain === dependency.providerDomain
    && contract.contractId === dependency.contractId && contract.version === dependency.version);
  if (matches.length !== 1) fail("EXTERNAL_SURFACE_AUTHORITY_MISSING", `${repo}:${dependency.contractId}:${dependency.version}`);
};

export const assertParticipantCommitIdentity = (expected: string, actual: string, repo: string): void => {
  if (actual !== expected) fail("RELEASE_PARTICIPANT_DRIFT", repo);
};
