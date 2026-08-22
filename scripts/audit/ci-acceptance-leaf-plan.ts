import { existsSync, readFileSync } from "node:fs";
import { basename } from "node:path";

import type { CommandStep } from "./ci-full-phase-plan.js";
import {
  acceptanceLawBindings,
  type AcceptanceLawBinding,
} from "./ci-acceptance-law-bindings.js";
import { resolveFromRepo } from "./shared/paths.js";
import {
  evidenceFacetIsDeferredDynamic,
  evidenceModeFacets,
  type ClauseEvidenceFacet,
} from "./shared/law-contracts.js";

type GeneratedPlanLawIndex = {
  entries?: Array<{
    bindings?: Array<{ clauseId?: string; evidenceMode?: string; lawId?: string }>;
    capabilityDomain?: string;
  }>;
};

type PackageScripts = Readonly<Record<string, string>>;

export type AcceptanceLeafSkeleton = Readonly<{
  command: readonly ["node", "--import", "tsx", string, ...string[]];
  filePath: string;
  minimalFixHint: string;
  name: string;
  timeoutMs: number;
}>;

const ACCEPTANCE_TIMEOUT_MS = 300_000;

const loadGeneratedPlan = (): GeneratedPlanLawIndex => JSON.parse(readFileSync(
  resolveFromRepo("scripts/audit/generated/audit-plan.generated.json"),
  "utf8",
)) as GeneratedPlanLawIndex;

const loadPackageScripts = (): PackageScripts => {
  const packageJson = JSON.parse(readFileSync(resolveFromRepo("package.json"), "utf8")) as {
    scripts?: Record<string, unknown>;
  };
  const scripts: Record<string, string> = {};
  for (const [name, command] of Object.entries(packageJson.scripts ?? {})) {
    if (typeof command === "string") scripts[name] = command;
  }
  return scripts;
};

const scriptNameIsValid = (value: string): boolean => value.length > 0
  && [...value].every((character) =>
    (character >= "a" && character <= "z")
    || (character >= "A" && character <= "Z")
    || (character >= "0" && character <= "9")
    || [":", "_", "-"].includes(character));

type AcceptanceLeafInvocation = Readonly<{
  command: readonly ["node", "--import", "tsx", string, ...string[]];
  filePath: string;
}>;

const directLeafInvocation = (command: string): AcceptanceLeafInvocation | null => {
  const tokens = command.split(" ").filter((token) => token.length > 0);
  if (tokens[0] !== "node" || tokens[1] !== "--import" || tokens[2] !== "tsx") return null;
  const filePath = tokens[3];
  if (!filePath || !filePath.endsWith(".ts")) return null;
  if (tokens.some((token) => [...token].some((character) => character.charCodeAt(0) <= 32))) return null;
  return Object.freeze({
    command: Object.freeze(tokens) as AcceptanceLeafInvocation["command"],
    filePath,
  });
};

const expandNpmScript = (
  scriptName: string,
  packageScripts: PackageScripts,
  visiting: Set<string>,
  discovered: Map<string, AcceptanceLeafInvocation>,
): void => {
  if (visiting.has(scriptName)) throw new Error(`Acceptance package script cycle detected at ${scriptName}.`);
  const command = packageScripts[scriptName];
  if (command === undefined) throw new Error(`Acceptance package script ${scriptName} does not exist.`);
  visiting.add(scriptName);
  try {
    for (const rawSegment of command.split("&&")) {
      const segment = rawSegment.trim();
      const npmPrefix = "npm run ";
      if (segment.startsWith(npmPrefix)) {
        const nestedName = segment.slice(npmPrefix.length);
        if (!scriptNameIsValid(nestedName)) {
          throw new Error(`Acceptance package script ${scriptName} has invalid nested command ${segment}.`);
        }
        expandNpmScript(nestedName, packageScripts, visiting, discovered);
        continue;
      }
      const invocation = directLeafInvocation(segment);
      if (!invocation) {
        throw new Error(`Acceptance package script ${scriptName} contains unsupported command ${segment}.`);
      }
      discovered.set(invocation.command.join("\u0000"), invocation);
    }
  } finally {
    visiting.delete(scriptName);
  }
};

const discoverAcceptanceLeafInvocations = (packageScripts: PackageScripts): readonly AcceptanceLeafInvocation[] => {
  const discovered = new Map<string, AcceptanceLeafInvocation>();
  for (const scriptName of Object.keys(packageScripts).sort()) {
    if (!scriptName.startsWith("acceptance:")) continue;
    expandNpmScript(scriptName, packageScripts, new Set<string>(), discovered);
  }
  return Object.freeze([...discovered.values()].sort((left, right) =>
    left.command.join(" ").localeCompare(right.command.join(" "))));
};

const assertAcceptanceBindingClosure = (
  invocations: readonly AcceptanceLeafInvocation[],
  lawBindings: ReadonlyMap<string, AcceptanceLawBinding>,
): void => {
  const discovered = new Set(invocations.map((invocation) => invocation.filePath));
  const missingBindings = [...discovered].filter((filePath) => !lawBindings.has(filePath));
  const orphanBindings = [...lawBindings.keys()].filter((filePath) => !discovered.has(filePath));
  if (missingBindings.length > 0 || orphanBindings.length > 0) {
    throw new Error(
      `Acceptance package/binding closure mismatch; missing=${missingBindings.join("|") || "none"}; orphan=${orphanBindings.join("|") || "none"}.`,
    );
  }
};

const dynamicFacetKey = (input: {
  readonly clauseId: string;
  readonly evidenceFacet: ClauseEvidenceFacet;
  readonly lawId: string;
}): string => [input.lawId, input.clauseId, input.evidenceFacet].join("\u0000");

const requiredDeferredDynamicFacets = (
  generatedPlan: GeneratedPlanLawIndex,
): ReadonlySet<string> => new Set((generatedPlan.entries ?? []).flatMap((entry) =>
    (entry.bindings ?? []).flatMap((binding) => {
      if (!binding.lawId || !binding.clauseId || !binding.evidenceMode) return [];
      return evidenceModeFacets(binding.evidenceMode)
        .filter(evidenceFacetIsDeferredDynamic)
        .map((evidenceFacet) => dynamicFacetKey({
          clauseId: binding.clauseId!,
          evidenceFacet,
          lawId: binding.lawId!,
        }));
    })));

const actualDeferredDynamicFacets = (
  invocations: readonly AcceptanceLeafInvocation[],
  lawBindings: ReadonlyMap<string, AcceptanceLawBinding>,
  generatedPlan: GeneratedPlanLawIndex,
): ReadonlyMap<string, string[]> => {
  const actual = new Map<string, string[]>();
  for (const invocation of invocations) {
    const binding = lawBindings.get(invocation.filePath);
    if (!binding) continue;
    const matches = (generatedPlan.entries ?? []).flatMap((entry) =>
      (entry.bindings ?? []).filter((candidate) =>
        candidate.lawId === binding.lawId && candidate.clauseId === binding.clauseId));
    if (matches.length !== 1 || !matches[0]?.evidenceMode) continue;
    const facets = evidenceModeFacets(matches[0].evidenceMode);
    const evidenceFacet = binding.evidenceFacet ?? (facets.length === 1 ? facets[0] : null);
    if (!evidenceFacet || !evidenceFacetIsDeferredDynamic(evidenceFacet)) continue;
    const key = dynamicFacetKey({
      clauseId: binding.clauseId,
      evidenceFacet,
      lawId: binding.lawId,
    });
    actual.set(key, [...(actual.get(key) ?? []), invocation.filePath]);
  }
  return actual;
};

const assertDeferredDynamicDenominatorClosure = (
  invocations: readonly AcceptanceLeafInvocation[],
  lawBindings: ReadonlyMap<string, AcceptanceLawBinding>,
  generatedPlan: GeneratedPlanLawIndex,
): void => {
  const required = requiredDeferredDynamicFacets(generatedPlan);
  const actual = actualDeferredDynamicFacets(invocations, lawBindings, generatedPlan);
  const missing = [...required].filter((key) => !actual.has(key));
  const duplicated = [...actual].filter(([, paths]) => paths.length !== 1)
    .map(([key, paths]) => `${key}:${paths.join("|")}`);
  const extra = [...actual.keys()].filter((key) => !required.has(key));
  if (missing.length > 0 || duplicated.length > 0 || extra.length > 0) {
    throw new Error(
      `Deferred dynamic proof denominator mismatch; missing=${missing.join("|") || "none"}; duplicated=${duplicated.join("|") || "none"}; extra=${extra.join("|") || "none"}.`,
    );
  }
};

const assertDeferredDynamicRouteClosure = (
  invocations: readonly AcceptanceLeafInvocation[],
  lawBindings: ReadonlyMap<string, AcceptanceLawBinding>,
): void => {
  for (const invocation of invocations) {
    const binding = lawBindings.get(invocation.filePath);
    if (!binding?.evidenceFacet || !evidenceFacetIsDeferredDynamic(binding.evidenceFacet)) continue;
    const expectedSuffix = `.${binding.evidenceFacet}.ts`;
    if (!invocation.filePath.endsWith(expectedSuffix)) {
      throw new Error(`Deferred dynamic verifier ${invocation.filePath} must end with ${expectedSuffix}.`);
    }
    const producerFilePath = binding.producerFilePath;
    if (!producerFilePath || producerFilePath === invocation.filePath
      || producerFilePath.includes(".acceptance.")
      || !existsSync(resolveFromRepo(producerFilePath))) {
      throw new Error(`Deferred dynamic verifier ${invocation.filePath} has no independent repository producer.`);
    }
  }
};

const acceptanceName = (filePath: string): string => {
  const filename = basename(filePath);
  for (const suffix of [".acceptance.ts", ".smoke.ts", ".ts"]) {
    if (filename.endsWith(suffix)) return filename.slice(0, -suffix.length);
  }
  return filename;
};

const acceptanceLeafSkeleton = (invocation: AcceptanceLeafInvocation): AcceptanceLeafSkeleton => {
  const { command, filePath } = invocation;
  return Object.freeze({
    command,
    filePath,
    minimalFixHint: `Run ${filePath} directly and repair its first failing assertion.`,
    name: [acceptanceName(filePath), ...command.slice(4)].join(":"),
    timeoutMs: ACCEPTANCE_TIMEOUT_MS,
  });
};

export const buildAcceptancePackageSkeletons = (
  packageScripts: PackageScripts = loadPackageScripts(),
  lawBindings: ReadonlyMap<string, AcceptanceLawBinding> = acceptanceLawBindings,
): readonly AcceptanceLeafSkeleton[] => {
  const invocations = discoverAcceptanceLeafInvocations(packageScripts);
  assertAcceptanceBindingClosure(invocations, lawBindings);
  assertDeferredDynamicDenominatorClosure(invocations, lawBindings, loadGeneratedPlan());
  assertDeferredDynamicRouteClosure(invocations, lawBindings);
  return Object.freeze(invocations.map(acceptanceLeafSkeleton));
};

export const buildAcceptanceLeafSkeletons = (
  packageScripts: PackageScripts = loadPackageScripts(),
  lawBindings: ReadonlyMap<string, AcceptanceLawBinding> = acceptanceLawBindings,
): readonly AcceptanceLeafSkeleton[] => {
  const skeletons = buildAcceptancePackageSkeletons(packageScripts, lawBindings);
  return selectExecutableAcceptanceSkeletons(skeletons, lawBindings);
};

export const selectExecutableAcceptanceSkeletons = (
  skeletons: readonly AcceptanceLeafSkeleton[],
  lawBindings: ReadonlyMap<string, AcceptanceLawBinding> = acceptanceLawBindings,
): readonly AcceptanceLeafSkeleton[] => {
  const generatedPlan = loadGeneratedPlan();
  return Object.freeze(skeletons.map<AcceptanceLeafSkeleton | null>((skeleton) => {
    const authority = acceptanceAuthority(skeleton.filePath, generatedPlan, lawBindings);
    if (evidenceFacetIsDeferredDynamic(authority.evidenceFacet)) return null;
    return skeleton;
  }).filter((skeleton): skeleton is AcceptanceLeafSkeleton => skeleton !== null));
};

const acceptanceAuthority = (
  filePath: string,
  generatedPlan: GeneratedPlanLawIndex,
  lawBindings: ReadonlyMap<string, AcceptanceLawBinding> = acceptanceLawBindings,
): { clauseId: string; evidenceFacet: ClauseEvidenceFacet; evidenceMode: string; lawId: string; ownerId: string } => {
  const binding = lawBindings.get(filePath);
  if (!binding) throw new Error(`Acceptance leaf ${filePath} has no explicit law/clause binding.`);
  const ownerMatches = generatedPlan.entries?.flatMap((entry) => entry.bindings
    ?.filter((candidate) => candidate.lawId === binding.lawId && candidate.clauseId === binding.clauseId)
    .map((candidate) => ({ candidate, ownerId: entry.capabilityDomain })) ?? []) ?? [];
  if (ownerMatches.length !== 1 || !ownerMatches[0]?.ownerId) {
    throw new Error(`Acceptance leaf ${filePath} must resolve to exactly one generated-plan owner.`);
  }
  const [{ candidate, ownerId }] = ownerMatches;
  if (!candidate.evidenceMode) {
    throw new Error(`Acceptance leaf ${filePath} resolved to a law clause without evidenceMode.`);
  }
  const facets = evidenceModeFacets(candidate.evidenceMode);
  if (facets.length > 1 && binding.evidenceFacet === undefined) {
    throw new Error(`Acceptance leaf ${filePath} must explicitly bind one evidenceFacet for composite mode ${candidate.evidenceMode}.`);
  }
  const evidenceFacet = binding.evidenceFacet ?? facets[0];
  if (!evidenceFacet || !facets.includes(evidenceFacet)) {
    throw new Error(`Acceptance leaf ${filePath} binds evidenceFacet ${evidenceFacet ?? "missing"} outside ${candidate.evidenceMode}.`);
  }
  return {
    clauseId: binding.clauseId,
    evidenceFacet,
    evidenceMode: candidate.evidenceMode,
    lawId: binding.lawId,
    ownerId,
  };
};

export const sealAcceptanceLeafSteps = (
  skeletons: readonly AcceptanceLeafSkeleton[],
): readonly CommandStep[] => {
  const generatedPlan = loadGeneratedPlan();
  return Object.freeze(skeletons.map((skeleton) => {
    if (!existsSync(resolveFromRepo(skeleton.filePath))) {
      throw new Error(`Acceptance leaf ${skeleton.filePath} does not exist.`);
    }
    const { clauseId, evidenceFacet, lawId, ownerId } = acceptanceAuthority(skeleton.filePath, generatedPlan);
    if (evidenceFacetIsDeferredDynamic(evidenceFacet)) {
      throw new Error(`Acceptance leaf ${skeleton.filePath} cannot execute deferred ${evidenceFacet} facet ${lawId}/${clauseId}.`);
    }
    return [
      skeleton.name,
      skeleton.command,
      skeleton.filePath,
      lawId,
      skeleton.minimalFixHint,
      ownerId,
      skeleton.timeoutMs,
      clauseId,
      evidenceFacet,
    ] as const;
  }));
};
