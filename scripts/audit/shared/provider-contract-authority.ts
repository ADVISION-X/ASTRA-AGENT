import { cleanString, exactKeys, isStringArray, sortedUnique } from "../governance-json.js";
import { fail } from "../governance-runtime.js";

export type ProviderContract = {
  contractId: string;
  providerRepo: string;
  providerDomain: string;
  version: number;
  authorityArtifact: { path: string; selector: string };
};

const envelopeValid = (spec: Record<string, unknown>, domains: ReadonlySet<string>): boolean =>
  exactKeys(spec, ["contract", "lawIds", "owner", "schemaVersion", "specId", "specKind", "status", "version"])
  && spec.schemaVersion === 1 && spec.status === "active" && spec.specKind === "cross-repo-contract"
  && typeof spec.specId === "string" && cleanString(spec.specId)
  && typeof spec.owner === "string" && domains.has(spec.owner)
  && Number.isInteger(spec.version) && Number(spec.version) >= 1
  && isStringArray(spec.lawIds) && spec.lawIds.length > 0 && sortedUnique(spec.lawIds);

const contractValid = (contract: Record<string, unknown>, spec: Record<string, unknown>, repo: string, domains: ReadonlySet<string>): boolean =>
  exactKeys(contract, ["authorityArtifact", "contractId", "providerDomain", "providerRepo", "version"])
  && contract.contractId === spec.specId && contract.version === spec.version && contract.providerRepo === repo
  && contract.providerDomain === spec.owner && typeof contract.providerDomain === "string" && domains.has(contract.providerDomain);

const artifactValid = (artifact: Record<string, unknown>, artifactExists: (path: string) => boolean): boolean =>
  exactKeys(artifact, ["path", "selector"]) && typeof artifact.path === "string"
  && !artifact.path.startsWith("/") && artifact.path.split("/").every((part) => Boolean(part) && part !== "." && part !== "..")
  && typeof artifact.selector === "string" && cleanString(artifact.selector) && artifactExists(artifact.path);

export const validateProviderContractSpec = (
  raw: unknown,
  repo: string,
  domains: ReadonlySet<string>,
  artifactExists: (path: string) => boolean,
): ProviderContract => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) fail("EXTERNAL_SURFACE_AUTHORITY_MISSING", `${repo}:provider-spec`);
  const spec = raw as Record<string, unknown>;
  if (!envelopeValid(spec, domains)) fail("EXTERNAL_SURFACE_AUTHORITY_MISSING", `${repo}:provider-spec-envelope`);
  const contract = spec.contract as Record<string, unknown>;
  if (!contract || !contractValid(contract, spec, repo, domains)) fail("EXTERNAL_SURFACE_AUTHORITY_MISSING", `${repo}:${String(spec.specId)}:provider-contract`);
  const artifact = contract.authorityArtifact as Record<string, unknown>;
  if (!artifact || !artifactValid(artifact, artifactExists)) fail("EXTERNAL_SURFACE_AUTHORITY_MISSING", `${repo}:${String(spec.specId)}:authority-artifact`);
  return {
    contractId: contract.contractId as string, providerRepo: repo, providerDomain: contract.providerDomain as string,
    version: contract.version as number, authorityArtifact: { path: artifact.path as string, selector: artifact.selector as string },
  };
};
