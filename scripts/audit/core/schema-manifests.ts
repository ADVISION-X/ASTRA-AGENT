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