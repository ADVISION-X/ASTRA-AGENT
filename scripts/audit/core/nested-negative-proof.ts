import path from "node:path";

export const NESTED_NEGATIVE_PROOF_ENV = "GRASSEYE_AUDIT_NESTED_NEGATIVE_PROOF";

const STANDALONE_RUN_INSPECTOR_SEGMENT = `${path.sep}scripts${path.sep}audit${path.sep}domains${path.sep}`;
const STANDALONE_RUN_INSPECTOR_SUFFIX = `${path.sep}run-inspector.ts`;

export const isNestedNegativeProofExecution = (): boolean =>
  process.env[NESTED_NEGATIVE_PROOF_ENV] === "1";

export const isStandaloneDomainRunInspector = (entry = process.argv[1] ?? ""): boolean => {
  const normalized = path.normalize(entry);
  return normalized.includes(STANDALONE_RUN_INSPECTOR_SEGMENT)
    && normalized.endsWith(STANDALONE_RUN_INSPECTOR_SUFFIX);
};

export const shouldBypassDefaultNegativeProofSkips = (): boolean =>
  isStandaloneDomainRunInspector() && !isNestedNegativeProofExecution();

export const withNestedNegativeProofEnv = (env: NodeJS.ProcessEnv): NodeJS.ProcessEnv => ({
  ...env,
  [NESTED_NEGATIVE_PROOF_ENV]: "1",
});