export type Level = "CHANGE" | "READY" | "RELEASE";
export type Law = {
  schemaVersion: 2;
  lawId: string;
  supersedesLawId: string | null;
  status: "active";
  tier: "P0" | "P1" | "P2";
  capabilityDomain: string;
  enforcementMode: "static" | "exam" | "dynamic" | "composite";
  evidenceModes: string[];
  summary: string;
  appliesTo: string[];
  excludes: string[];
  forbidden: string[];
  dependsOnLawIds: string[];
  source: { path: string; lineStart: number; lineEnd: number };
  contractRefs: string[];
};
export type Manifest = {
  schemaVersion: 5;
  capabilityDomain: string;
  status: "active";
  lawIds: string[];
  ownedPaths: string[];
  observedPaths: string[];
  manifestPath: string;
};
export type Registry = {
  schemaVersion: 5;
  sourceSpec: { path: string };
  lawCorpus: { baseLawPath: string; functionalLawPath: string };
  laws: Law[];
  domains: Array<Pick<Manifest, "capabilityDomain" | "manifestPath" | "lawIds" | "ownedPaths" | "observedPaths">>;
};
