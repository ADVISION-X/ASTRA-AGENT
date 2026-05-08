export type OwnerKind =
  | "ability-group"
  | "foundation-law"
  | "support-governance"
  | "local-development-governance"
  | "standalone-audit";

export interface DomainManifest {
  inspectorId: string;
  capabilityDomain: string;
  owner: boolean;
  entry: string;
  engine: string;
  supportsEvidenceModes: string[];
  allowedLawIds: string[];
  readsLawFiles: string[];
  readsBlueprintFiles?: string[];
}

export interface ResolvedDomainManifest extends DomainManifest {
  manifestPath: string;
  domainFolder: string;
}

export interface EnforcementMatrixOwner {
  inspectorId: string;
  capabilityDomain: string;
  ownerKind: OwnerKind;
  manifestPath: string;
  entry: string;
  engine: string;
  supportsEvidenceModes: string[];
  lawIds: string[];
  readsLawFiles: string[];
  readsBlueprintFiles: string[];
}

export interface EnforcementMatrix {
  generatedAt: string;
  owners: EnforcementMatrixOwner[];
}