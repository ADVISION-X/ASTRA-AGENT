import type { MapAuthoringAiOutput } from "./map-authoring-ai-output.schema.js";
import type { MapAuthoringInputPackage } from "./map-authoring-input-package.schema.js";
import {
  MAP_AUTHORING_OUTPUT_FORMAT_VERSION,
  MAP_AUTHORING_SCHEMA_VERSION,
  MAP_AUTHORING_SECURITY_POLICY_REF,
} from "./map-authoring-contract.js";
import {
  assertAuthoringChainConsistency,
  buildCanonicalMapAuthoringChain,
  type MapAuthoringChain,
} from "./map-authoring-proof-chain.js";
import { buildMapAuthoringGovernedCatalogs } from "./map-authoring-governed-catalogs.js";
import { buildMapAuthoringTemplate } from "./map-authoring-template.js";

type OptionalWithoutUndefined<T extends Record<string, unknown>> = {
  [K in keyof T]?: Exclude<T[K], undefined>;
};

function omitUndefinedValues<T extends Record<string, unknown>>(value: T): OptionalWithoutUndefined<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as OptionalWithoutUndefined<T>;
}

function buildPromptTemplateContract(input: {
  output: MapAuthoringAiOutput;
  promptContractId: string;
  promptVersion: string;
  securityPolicyRef?: string;
  outputFormatVersion?: string;
}) {
  return omitUndefinedValues({
    promptContractId: input.promptContractId,
    promptContractVersion: input.promptVersion,
    capabilityCatalogVersion: input.output.authoringChain.capabilityCatalogVersion,
    promptCatalogVersion: input.output.authoringChain.promptCatalogVersion,
    mapPackageSchemaVersion: input.output.authoringChain.mapPackageSchemaVersion ?? MAP_AUTHORING_SCHEMA_VERSION,
    securityPolicyRef: input.output.authoringChain.securityPolicyRef ?? input.securityPolicyRef ?? MAP_AUTHORING_SECURITY_POLICY_REF,
    outputFormatVersion: input.output.authoringChain.outputFormatVersion ?? input.outputFormatVersion ?? MAP_AUTHORING_OUTPUT_FORMAT_VERSION,
  });
}

export function buildCanonicalAuthoringChainForDraft(input: {
  inputPackage: MapAuthoringInputPackage;
  output: MapAuthoringAiOutput;
  promptContractId: string;
  promptVersion: string;
  providerPolicyRef?: string;
  securityPolicyRef?: string;
  outputFormatVersion?: string;
  identity: { createdAt: string };
}): MapAuthoringChain {
  const promptText = buildMapAuthoringTemplate(
    input.inputPackage,
    buildPromptTemplateContract(input),
  );
  const authoringChain = buildCanonicalMapAuthoringChain({
    inputPackage: input.inputPackage,
    promptContractId: input.promptContractId,
    promptContractVersion: input.promptVersion,
    promptText,
    generatedAt: input.identity.createdAt,
    ...omitUndefinedValues({
      providerPolicyRef: input.output.authoringChain.providerPolicyRef ?? input.providerPolicyRef,
      capabilityCatalogVersion: input.output.authoringChain.capabilityCatalogVersion,
      promptCatalogVersion: input.output.authoringChain.promptCatalogVersion,
      mapPackageSchemaVersion: input.output.authoringChain.mapPackageSchemaVersion,
      securityPolicyRef: input.output.authoringChain.securityPolicyRef ?? input.securityPolicyRef,
      outputFormatVersion: input.output.authoringChain.outputFormatVersion ?? input.outputFormatVersion,
    }),
  });

  assertAuthoringChainConsistency({
    candidate: omitUndefinedValues(input.output.authoringChain),
    canonical: authoringChain,
  });

  return authoringChain;
}