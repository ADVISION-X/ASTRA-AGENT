import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { relative, resolve, sep } from "node:path";

import { Node, SyntaxKind, type Expression, type ObjectLiteralExpression } from "ts-morph";

import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";

const REPORT_PATH = "docs/项目方案/GPT页面操作子能力实证资料.json";
const MATRIX_PATH = "src/capabilities/gpt/page-operation-matrix.json";
const CONTRACT_PATH = "src/capabilities/gpt/contract.ts";
const GPT_ROOT = "src/capabilities/gpt";
const PLUGIN_ROOT = "src/plugins";
const ACTIVE_LAW_PATH = ".github/instructions/agent-rules/功能法案.md";
const REPORT_SCHEMA = "gpt-page-operation-evidence.v5";
const MATRIX_SCHEMA = "gpt-page-operation-matrix.v4";
const SHA256 = /^sha256:[a-f0-9]{64}$/u;
const RAW_CONVERSATION_PATH = /\/(?:c|g)\/(?!sha256:)[A-Za-z0-9_-]{8,}/iu;
const FORBIDDEN_EVIDENCE_KEY = /^(?:cookie|cookies|localstorage|sessionstorage|password|passwords|authorizationheader|accesstoken|refreshtoken)$/iu;
const FORBIDDEN_EVIDENCE_VALUE = /(?:\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b|\bBearer\s+[A-Za-z0-9._~-]{12,}\b|\bsk-[A-Za-z0-9_-]{12,}\b)/iu;
const DEMAND_CONTRACT_FIELDS = Object.freeze([
  "semanticIntent", "inputSchema", "requiredTargetKind", "allowedDocumentTransition",
  "profile", "boundedWait", "decisions", "precondition", "actionQualification",
  "mutationBudget", "oneObservationOrMutation", "positivePostcondition",
  "negativePostcondition", "evidenceSchema", "evidenceBoundary", "failureClassification",
  "replayPolicy",
]);
const DEMAND_CHAIN_FACTS = Object.freeze([
  "document-and-revision-identity", "precondition-observation", "typed-command-and-terminal-receipt",
  "direct-postcondition-observation", "owner-and-linked-node-relations",
]);

type FindingFactory = (
  checkId: string,
  filePath: string,
  message: string,
  line?: number,
) => InspectorFinding;

const sha256 = (value: string | Buffer): string =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const stable = (value: unknown): unknown => Array.isArray(value) ? value.map(stable)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable((value as Record<string, unknown>)[key])]))
    : value;

const repoPath = (root: string, path: string): string =>
  relative(root, path).split(sep).join("/");

const filesBelow = (root: string, suffixes: readonly string[]): string[] => {
  if (!existsSync(root)) return [];
  const output: string[] = [];
  const visit = (path: string): void => {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const absolute = resolve(path, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile() && suffixes.some((suffix) => entry.name.endsWith(suffix))) output.push(absolute);
    }
  };
  visit(root);
  return output.sort();
};

const literalValue = (expression: Expression): unknown => {
  if (Node.isStringLiteral(expression) || Node.isNoSubstitutionTemplateLiteral(expression)) {
    return expression.getLiteralValue();
  }
  if (Node.isNumericLiteral(expression)) return expression.getLiteralValue();
  if (expression.getKind() === SyntaxKind.TrueKeyword) return true;
  if (expression.getKind() === SyntaxKind.FalseKeyword) return false;
  if (expression.getKind() === SyntaxKind.NullKeyword) return null;
  if (Node.isArrayLiteralExpression(expression)) return expression.getElements()
    .map((entry) => literalValue(entry as Expression));
  if (Node.isObjectLiteralExpression(expression)) return objectValue(expression);
  if (Node.isAsExpression(expression) || Node.isSatisfiesExpression(expression)
    || Node.isParenthesizedExpression(expression)) return literalValue(expression.getExpression());
  throw new Error(`CONTRACT_LITERAL_UNSUPPORTED:${expression.getKindName()}`);
};

const objectValue = (object: ObjectLiteralExpression): Record<string, unknown> => Object.fromEntries(
  object.getProperties().map((property) => {
    if (!Node.isPropertyAssignment(property)) throw new Error("CONTRACT_PROPERTY_INVALID");
    return [property.getName().replace(/^['"]|['"]$/gu, ""), literalValue(property.getInitializerOrThrow())];
  }),
);

const currentContracts = (context: InspectorContext): Record<string, Record<string, unknown>> => {
  const source = context.project.getSourceFile(resolve(context.sealedRoot, CONTRACT_PATH));
  const initializer = source?.getVariableDeclaration("GPT_CHILD_CONTRACTS")?.getInitializer();
  const object = initializer && Node.isObjectLiteralExpression(initializer)
    ? initializer : initializer?.getFirstDescendantByKind(SyntaxKind.ObjectLiteralExpression);
  if (!object) throw new Error("GPT_CHILD_CONTRACTS_NOT_FOUND");
  return Object.fromEntries(object.getProperties().map((property) => {
    if (!Node.isPropertyAssignment(property)) throw new Error("GPT_CHILD_CONTRACT_PROPERTY_INVALID");
    const child = property.getInitializerIfKindOrThrow(SyntaxKind.ObjectLiteralExpression);
    return [property.getName().replace(/^['"]|['"]$/gu, ""), objectValue(child)];
  }));
};

const semanticPrint = (root: string, path: string, source: string): string => {
  if (!path.endsWith(".ts") && !path.endsWith(".tsx")) return source.replace(/\s+/gu, " ").trim();
  const requireFromRepo = createRequire(resolve(root, "package.json"));
  const ts = requireFromRepo("typescript") as typeof import("typescript");
  const kind = path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, kind);
  return ts.createPrinter({ removeComments: true, newLine: ts.NewLineKind.LineFeed }).printFile(ast);
};

type SourceBinding = Readonly<{
  files: ReadonlyArray<Readonly<{ path: string; contentHash: string; semanticHash: string }>>;
  semanticDigest: string;
}>;

const sourceBinding = (root: string, paths: readonly string[]): SourceBinding => {
  const files = [...new Set(paths)].sort().map((path) => {
    const absolute = resolve(root, path);
    if (!existsSync(absolute)) throw new Error(`DEMAND_SOURCE_MISSING:${path}`);
    const raw = readFileSync(absolute);
    return { path, contentHash: sha256(raw), semanticHash: sha256(semanticPrint(root, path, raw.toString("utf8"))) };
  });
  return stable({ files, semanticDigest: sha256(JSON.stringify(stable(
    files.map(({ path, semanticHash }) => ({ path, semanticHash })),
  ))) }) as SourceBinding;
};

const productAuthorizationValues = (inputId: string, source: string): string[] => {
  if (inputId === "authorized-model-id") {
    return [...source.matchAll(/\bmodelDisplayName\s*:\s*["'`]([^"'`]+)["'`]/gu)].map((match) => match[1]!);
  }
  if (inputId === "authorized-reasoning-requirement") {
    return [...source.matchAll(/\breasoningRequirement\s*:\s*(?:Object\.freeze\s*\(\s*)?\{([\s\S]{0,1200}?)\}\s*\)?/gu)]
      .flatMap((match) => {
        const selectionPolicy = match[1]!.match(/\bselectionPolicy\s*:\s*["'`]([^"'`]+)["'`]/u)?.[1];
        const requestedTier = match[1]!.match(/\brequestedTier\s*:\s*["'`]([^"'`]+)["'`]/u)?.[1];
        return selectionPolicy && requestedTier ? [`${selectionPolicy}:${requestedTier}`] : [];
      });
  }
  return [];
};

const deriveCurrentDemands = (
  root: string,
  contracts: Record<string, Record<string, unknown>>,
  matrix: Record<string, unknown>,
): Record<string, Record<string, unknown>> => {
  const ids = Object.keys(contracts);
  const matrixChildren = Array.isArray(matrix.children)
    ? matrix.children.flatMap((entry) => record(entry) ? [record(entry)!] : []) : [];
  const gptFiles = filesBelow(resolve(root, GPT_ROOT), [".ts"])
    .map((absolute) => ({ path: repoPath(root, absolute), text: readFileSync(absolute, "utf8") }));
  const pluginFiles = filesBelow(resolve(root, PLUGIN_ROOT), [".ts"])
    .map((absolute) => ({ path: repoPath(root, absolute), text: readFileSync(absolute, "utf8") }));
  const pageIds = new Set(ids.filter((id) => {
    const handler = resolve(root, GPT_ROOT, "children", id, "handler.ts");
    return existsSync(handler) && readFileSync(handler, "utf8").includes("requireBrowser(");
  }));
  const implementations: Record<string, string[]> = Object.fromEntries(ids.map((id) => [id, []]));
  const consumers: Record<string, string[]> = Object.fromEntries(ids.map((id) => [id, []]));
  for (const file of gptFiles) for (const id of ids) {
    const isolated = file.path.startsWith(`${GPT_ROOT}/children/${id}/`);
    if (!file.text.includes(id) && !isolated) continue;
    if (file.path.startsWith(`${GPT_ROOT}/web/`) || (isolated && pageIds.has(id))) implementations[id]!.push(file.path);
  }
  for (const file of pluginFiles) for (const id of ids) if (file.text.includes(id)) consumers[id]!.push(file.path);
  for (const id of ids) {
    const roots = new Set(consumers[id]!.map((path) => path.split("/").slice(0, 3).join("/")));
    for (const file of pluginFiles) if (roots.has(file.path.split("/").slice(0, 3).join("/"))
      && /\b(?:modelDisplayName|reasoningRequirement)\s*:/u.test(file.text)) consumers[id]!.push(file.path);
    consumers[id] = [...new Set(consumers[id])].sort();
  }

  const authorityPaths = Array.isArray(matrix.authoritySources)
    ? matrix.authoritySources.filter((entry): entry is string => typeof entry === "string") : [];
  const commonDerived = Array.isArray(matrix.commonRequiredDerivedStates)
    ? matrix.commonRequiredDerivedStates.filter((entry): entry is string => typeof entry === "string") : [];
  const browserBindings = record(matrix.browserSourceBindings) ?? {};
  const demands: Record<string, Record<string, unknown>> = {};
  for (const requirement of matrixChildren) {
    const id = String(requirement.childCapabilityId ?? "");
    const contract = contracts[id];
    if (!contract) throw new Error(`MATRIX_CHILD_UNKNOWN:${id}`);
    const consumerBinding = sourceBinding(root, consumers[id]!);
    const authorizedInputRequirements: Record<string, unknown> = {};
    const requiredInputRefs = Array.isArray(requirement.requiredInputRefs)
      ? requirement.requiredInputRefs.filter((entry): entry is string => typeof entry === "string") : [];
    for (const inputId of requiredInputRefs.filter((entry) => entry.startsWith("authorized-")).sort()) {
      const variants = new Map<string, { valueHash: string; sourceBindings: SourceBinding["files"] }>();
      for (const bindingEntry of consumerBinding.files) {
        const source = readFileSync(resolve(root, bindingEntry.path), "utf8");
        for (const value of productAuthorizationValues(inputId, source)) {
          const valueHash = sha256(value);
          const prior = variants.get(valueHash) ?? { valueHash, sourceBindings: [] };
          variants.set(valueHash, { valueHash, sourceBindings: [...prior.sourceBindings, bindingEntry] });
        }
      }
      if (variants.size === 0) throw new Error(`AUTHORIZED_PRODUCT_VARIANT_MISSING:${inputId}`);
      const normalized = [...variants.values()].map((entry) => stable({
        valueHash: entry.valueHash,
        sourceBindings: [...entry.sourceBindings].sort((left, right) => left.path.localeCompare(right.path)),
      }) as Record<string, unknown>).sort((left, right) => String(left.valueHash).localeCompare(String(right.valueHash)));
      authorizedInputRequirements[inputId] = stable({
        sourceKind: "PRODUCT_PROFILE", variants: normalized,
        setHash: sha256(JSON.stringify(stable(normalized.map((entry) => entry.valueHash)))),
      });
    }
    const projectedRequirement = stable({ ...requirement, authorizedInputRequirements }) as Record<string, unknown>;
    const facts: Array<Record<string, unknown>> = [];
    for (const field of DEMAND_CONTRACT_FIELDS) facts.push({
      factId: `contract:${field}`, kind: "CONTRACT", expected: stable(contract[field]),
    });
    for (const target of requirement.coreTargets as string[]) facts.push({ factId: `target:${target}`, kind: "PAGE_TARGET", expected: target });
    for (const state of requirement.requiredLiveStates as string[]) facts.push({ factId: `live-state:${state}`, kind: "LIVE_PAGE_STATE", expected: state });
    for (const state of [...commonDerived, ...(requirement.childSpecificDerivedStates as string[])]) {
      facts.push({ factId: `derived-state:${state}`, kind: "DERIVED_FIXTURE_STATE", expected: state });
    }
    for (const input of requiredInputRefs) facts.push({ factId: `input:${input}`, kind: "INPUT", expected: input });
    for (const [inputId, descriptorValue] of Object.entries(authorizedInputRequirements)) {
      const descriptor = descriptorValue as { variants: Array<{ valueHash: string; sourceBindings: Array<{ path: string }> }> };
      for (const variant of descriptor.variants) facts.push({
        factId: `authorized-input:${inputId}:${variant.valueHash}`, kind: "AUTHORIZED_PRODUCT_VARIANT",
        expected: stable({ inputId, valueHash: variant.valueHash, sourcePaths: variant.sourceBindings.map((entry) => entry.path) }),
      });
    }
    for (const chain of DEMAND_CHAIN_FACTS) facts.push({ factId: `chain:${chain}`, kind: "EVIDENCE_CHAIN", expected: chain });
    for (const path of authorityPaths) facts.push({ factId: `authority:${sha256(path)}`, kind: "AUTHORITY_SOURCE", expected: path });
    const implementation = sourceBinding(root, implementations[id]!);
    const authority = sourceBinding(root, authorityPaths);
    const browser = sourceBinding(root, [
      ...(Array.isArray(browserBindings[id]) ? browserBindings[id] as string[] : []),
      ...(Array.isArray(requirement.browserImplementationSources) ? requirement.browserImplementationSources as string[] : []),
    ]);
    const payload = stable({
      childCapabilityId: id, contract: stable({ ...contract }), collectionRequirement: projectedRequirement,
      facts, implementationSemanticDigest: implementation.semanticDigest,
      productConsumerSemanticDigest: consumerBinding.semanticDigest,
      authoritySemanticDigest: authority.semanticDigest, browserSemanticDigest: browser.semanticDigest,
    });
    const digest = sha256(JSON.stringify(payload));
    const pageDemand = stable({
      childCapabilityId: id,
      coreTargets: requirement.coreTargets,
      requiredLiveStates: requirement.requiredLiveStates,
      optionalLiveStates: requirement.optionalLiveStates,
      liveStateTargets: requirement.liveStateTargets,
      stateAssertions: requirement.stateAssertions,
      requiredDerivedStates: [...commonDerived, ...(requirement.childSpecificDerivedStates as string[])],
    });
    demands[id] = stable({ schemaVersion: "gpt-page-operation-demand.v2", facts, digest,
      projectionDigest: digest, pageDemandDigest: sha256(JSON.stringify(pageDemand)),
      childCandidateDigest: digest, authorizedInputRequirements,
      sourceBinding: { implementation, consumers: consumerBinding, authority, browser } }) as Record<string, unknown>;
  }
  return demands;
};

export const currentGptPageEvidenceDemandFailures = (
  root: string,
  report: Record<string, unknown>,
  contracts: Record<string, Record<string, unknown>>,
): string[] => {
  const matrix = JSON.parse(readFileSync(resolve(root, MATRIX_PATH), "utf8")) as Record<string, unknown>;
  const failures: string[] = [];
  if (matrix.schemaVersion !== MATRIX_SCHEMA || matrix.requiredLiveStateOrder !== "capturedAt-ascending-same-run") {
    return ["matrix-schema"];
  }
  const matrixChildren = Array.isArray(matrix.children)
    ? matrix.children.flatMap((entry) => record(entry) ? [record(entry)!] : []) : [];
  if (matrixChildren.some((entry) => {
    const states = Array.isArray(entry.requiredLiveStates) ? entry.requiredLiveStates : [];
    const assertions = record(entry.stateAssertions) ?? {};
    return JSON.stringify(Object.keys(assertions).sort()) !== JSON.stringify([...states].sort())
      || Object.values(assertions).some((value) => !Array.isArray(value) || value.length === 0);
  })) failures.push("matrix-state-assertions");
  const expectedMatrixDigest = sha256(JSON.stringify(stable(matrix)));
  const matrixBinding = record(report.matrixBinding);
  if (matrixBinding?.schemaVersion !== MATRIX_SCHEMA || matrixBinding.digest !== expectedMatrixDigest) failures.push("matrix-binding");
  let expected: Record<string, Record<string, unknown>>;
  try { expected = deriveCurrentDemands(root, contracts, matrix); }
  catch (error) { return [...failures, `demand-derivation:${error instanceof Error ? error.message : String(error)}`]; }
  const expectedProjectionRevision = sha256(JSON.stringify(stable(Object.entries(expected).sort()
    .map(([id, demand]) => [id, demand.projectionDigest]))));
  if (report.projectionRevision !== expectedProjectionRevision) failures.push("projection-revision");
  const children = Array.isArray(report.children)
    ? report.children.flatMap((entry) => record(entry) ? [record(entry)!] : []) : [];
  for (const requirement of matrixChildren) {
    const id = String(requirement.childCapabilityId);
    const child = children.find((entry) => entry.childCapabilityId === id);
    if (!child || JSON.stringify(stable(child.collectionRequirements)) !== JSON.stringify(stable(requirement))) {
      failures.push(`${id}:collection-requirement`);
    }
    if (!child || JSON.stringify(stable(child.evidenceDemand)) !== JSON.stringify(stable(expected[id]))) {
      failures.push(`${id}:current-demand`);
    }
  }
  return failures;
};

const bindingPaths = (binding: unknown): string[] => {
  if (!binding || typeof binding !== "object" || Array.isArray(binding)) return [];
  const files = (binding as { files?: unknown }).files;
  if (!Array.isArray(files)) return [];
  return files.flatMap((entry) => entry && typeof entry === "object" && !Array.isArray(entry)
    && typeof (entry as { path?: unknown }).path === "string" ? [(entry as { path: string }).path] : []);
};

const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;

const valueAtPath = (value: unknown, path: string): unknown =>
  path.split(".").reduce<unknown>((current, key) => record(current)?.[key], value);

const valuePresent = (value: unknown): boolean => value !== undefined && value !== null
  && (typeof value !== "string" || value.length > 0);

const exactStringSet = (actual: unknown, expected: readonly string[]): boolean =>
  Array.isArray(actual) && actual.every((entry) => typeof entry === "string" && entry.length > 0)
  && new Set(actual).size === actual.length
  && JSON.stringify([...actual].sort()) === JSON.stringify([...new Set(expected)].sort());

const observedStateSignature = (specimen: Record<string, unknown>): string => {
  const core = record(specimen.core);
  const peripheral = record(specimen.peripheral);
  return sha256(JSON.stringify(stable({
    sceneSignature: specimen.sourceSceneSignature,
    url: peripheral?.sanitizedUrlIdentity,
    targets: core?.targets,
  })));
};

export const gptPageEvidencePrivacyFailures = (value: unknown, path = "report"): string[] => {
  if (Array.isArray(value)) return value.flatMap((entry, index) =>
    gptPageEvidencePrivacyFailures(entry, `${path}[${index}]`));
  const object = record(value);
  if (object) return Object.entries(object).flatMap(([key, child]) => [
    ...(FORBIDDEN_EVIDENCE_KEY.test(key) ? [`${path}.${key}`] : []),
    ...gptPageEvidencePrivacyFailures(child, `${path}.${key}`),
  ]);
  return typeof value === "string" && (RAW_CONVERSATION_PATH.test(value)
    || FORBIDDEN_EVIDENCE_VALUE.test(value)) ? [path] : [];
};

export const completeGptPageEvidenceCaptureFailures = (
  child: Record<string, unknown>,
  demand: Record<string, unknown>,
): string[] => {
  const failures: string[] = [];
  const collection = record(child.collection);
  const captureContext = record(collection?.captureContext);
  const coverage = record(child.demandCoverage);
  const demandFacts = Array.isArray(demand.facts)
    ? demand.facts.flatMap((entry) => typeof record(entry)?.factId === "string"
      ? [record(entry)!.factId as string] : []) : [];
  const expectedInputs = demandFacts.filter((factId) => factId.startsWith("input:"))
    .map((factId) => factId.slice("input:".length));
  if (!collection || collection.demandDigest !== demand.digest) failures.push("collection-demand-digest");
  if (collection?.childCandidateDigest !== demand.childCandidateDigest) failures.push("child-candidate-digest");
  if (!captureContext || !Array.isArray(captureContext.sceneManifest)) failures.push("capture-context");
  if (!Array.isArray(child.captureMissing) || child.captureMissing.length !== 0) failures.push("capture-missing");
  if (coverage?.percent !== 100 || coverage.coveredFacts !== demandFacts.length
    || coverage.requiredFacts !== demandFacts.length) failures.push("coverage-summary");
  if (!exactStringSet(collection?.inputRefs, expectedInputs)) failures.push("input-refs");

  const specimens = Array.isArray(collection?.specimens)
    ? collection.specimens.flatMap((entry) => record(entry) ? [record(entry)!] : []) : [];
  const live = specimens.filter((entry) => entry.evidenceKind === "LIVE_PAGE");
  const derived = specimens.filter((entry) => entry.evidenceKind === "DERIVED_FIXTURE");
  const liveByObservation = new Map(live.flatMap((entry) => typeof entry.observationId === "string"
    ? [[entry.observationId, entry] as const] : []));
  const liveStates = demandFacts.filter((factId) => factId.startsWith("live-state:"))
    .map((factId) => factId.slice("live-state:".length));
  const derivedStates = demandFacts.filter((factId) => factId.startsWith("derived-state:"))
    .map((factId) => factId.slice("derived-state:".length));
  for (const stateId of liveStates) if (!live.some((entry) => entry.stateId === stateId)) {
    failures.push(`live:${stateId}`);
  }
  for (const stateId of derivedStates) if (!derived.some((entry) => entry.stateId === stateId
    && typeof entry.derivedFromObservationId === "string"
    && liveByObservation.has(entry.derivedFromObservationId)
    && typeof record(entry.mutation)?.kind === "string"
    && Array.isArray(record(entry.mutation)?.changes)
    && (record(entry.mutation)?.changes as unknown[]).length > 0)) failures.push(`derived:${stateId}`);

  const requiredLive = live.filter((entry) => liveStates.includes(String(entry.stateId)));
  const sourceSceneIds = requiredLive.map((entry) => entry.sourceSceneId);
  if (sourceSceneIds.some((entry) => typeof entry !== "string" || entry.length === 0)
    || new Set(sourceSceneIds).size !== sourceSceneIds.length) failures.push("live-scene-reuse");
  if (requiredLive.some((entry) => typeof entry.stateSignature !== "string" || !SHA256.test(entry.stateSignature)
    || observedStateSignature(entry) !== entry.stateSignature)) failures.push("live-signatures");
  const sceneManifest = Array.isArray(captureContext?.sceneManifest)
    ? captureContext.sceneManifest.flatMap((entry) => record(entry) ? [record(entry)!] : []) : [];
  const sceneIds = sceneManifest.map((entry) => entry.sceneId);
  if (sceneIds.some((entry) => typeof entry !== "string") || new Set(sceneIds).size !== sceneIds.length) {
    failures.push("scene-manifest-duplicates");
  }
  for (const specimen of requiredLive) {
    const scene = sceneManifest.find((entry) => entry.sceneId === specimen.sourceSceneId);
    const binding = record(scene?.binding);
    if (!scene || scene.stateSignature !== specimen.sourceSceneSignature
      || binding?.runId !== captureContext?.runId
      || (typeof captureContext?.captureEpoch === "string"
        && binding?.captureEpoch !== captureContext.captureEpoch)) {
      failures.push(`scene-binding:${String(specimen.stateId)}`);
    }
    const chain = record(record(specimen.related)?.transitionChain);
    const profile = record(child.contract)?.profile;
    if (profile === "DOM_OBSERVATION") {
      if (record(chain?.typedCommand)?.kind !== "NOT_APPLICABLE"
        || record(chain?.terminalReceipt)?.kind !== "NOT_APPLICABLE") failures.push("observation-action-contradiction");
    } else if (!["CAPTURED_BROWSER_COMMAND", "ZERO_ACTION"].includes(String(record(chain?.typedCommand)?.kind))
      || !["CAPTURED_DISPATCH_RETURN", "COHERENT_READBACK"].includes(String(record(chain?.terminalReceipt)?.kind))
      || record(chain?.directPostcondition)?.passed !== true) failures.push(`action-receipt:${String(specimen.stateId)}`);
  }

  const bindings = Array.isArray(collection?.factBindings)
    ? collection.factBindings.flatMap((entry) => record(entry) ? [record(entry)!] : []) : [];
  const boundFactIds = bindings.flatMap((entry) => typeof entry.factId === "string" ? [entry.factId] : []);
  if (!exactStringSet(boundFactIds, demandFacts)) failures.push("fact-binding-set");
  for (const binding of bindings) {
    const factId = typeof binding.factId === "string" ? binding.factId : "";
    const demandFact = Array.isArray(demand.facts)
      ? demand.facts.map(record).find((entry) => entry?.factId === factId) : null;
    if (binding.bindingKind === "CURRENT_PROJECTION") {
      if (["PAGE_TARGET", "LIVE_PAGE_STATE", "EVIDENCE_CHAIN"].includes(String(demandFact?.kind))
        || binding.projectionDigest !== demand.projectionDigest
        || typeof binding.expectedHash !== "string" || !SHA256.test(binding.expectedHash)
        || binding.expectedHash !== sha256(JSON.stringify(stable(demandFact?.expected)) ?? "undefined")) {
        failures.push(`binding-projection:${factId || "missing"}`);
      }
      continue;
    }
    const observationId = typeof binding.observationId === "string" ? binding.observationId : "";
    const specimen = liveByObservation.get(observationId);
    const pointers = Array.isArray(binding.pointers)
      ? binding.pointers.filter((entry): entry is string => typeof entry === "string" && entry.length > 0) : [];
    if (binding.bindingKind !== "LIVE_OBSERVATION" || !specimen || pointers.length === 0
      || pointers.some((pointer) => !valuePresent(valueAtPath(specimen, pointer)))
      || typeof binding.expectedHash !== "string" || !SHA256.test(binding.expectedHash)
      || binding.expectedHash !== sha256(JSON.stringify(stable(demandFact?.expected)) ?? "undefined")) {
      failures.push(`binding:${factId || "missing"}`);
      continue;
    }
    if (factId.startsWith("live-state:") && specimen.stateId !== factId.slice("live-state:".length)) {
      failures.push(`binding-live:${factId}`);
    }
    if (factId.startsWith("target:")) {
      const targetId = factId.slice("target:".length);
      const pointer = `core.targets.${targetId}`;
      const target = record(valueAtPath(specimen, pointer));
      if (!pointers.includes(pointer) || target?.observed !== true
        || typeof target.identityHash !== "string" || !SHA256.test(target.identityHash)
        || !Number.isInteger(target.nodeIndex) || (target.nodeIndex as number) < 0) {
        failures.push(`binding-target:${targetId}`);
      }
      if (!record(target?.attributes) || typeof target?.sourceSceneId !== "string"
        || typeof target?.sourceSceneSignature !== "string" || !SHA256.test(target.sourceSceneSignature)) {
        failures.push(`binding-target-detail:${targetId}`);
      }
    }
    if (factId.startsWith("derived-state:") && !derived.some((entry) =>
      entry.stateId === factId.slice("derived-state:".length)
      && entry.derivedFromObservationId === observationId)) failures.push(`binding-derived:${factId}`);
  }
  const unchecked = live.find((entry) => entry.stateId === "target-model-actionable-unchecked");
  const closedAfterSelection = live.filter((entry) =>
    ["model-panel-closed-after-selection", "model-selection-postcondition"].includes(String(entry.stateId)));
  if (unchecked && valueAtPath(unchecked, "core.attributes.aria-checked") !== "false") {
    failures.push("model-unchecked-contradiction");
  }
  if (closedAfterSelection.some((entry) => valueAtPath(entry, "core.attributes.aria-expanded") !== "false")) {
    failures.push("model-panel-close-contradiction");
  }
  return [...new Set(failures)];
};

const inspectBoundFiles = (
  context: InspectorContext,
  childId: string,
  kind: "implementation" | "consumers" | "authority" | "browser",
  binding: unknown,
  findings: InspectorFinding[],
  finding: FindingFactory,
): void => {
  if (!binding || typeof binding !== "object" || Array.isArray(binding)
    || typeof (binding as { semanticDigest?: unknown }).semanticDigest !== "string"
    || !Array.isArray((binding as { files?: unknown }).files)) {
    findings.push(finding("gpt/page-evidence-source-binding", REPORT_PATH,
      `${childId} has an invalid ${kind} demand binding.`));
    return;
  }
  const allowedPrefix = kind === "implementation" ? [
    `${GPT_ROOT}/children/${childId}/`, `${GPT_ROOT}/web/`,
  ] : kind === "consumers" ? [`${PLUGIN_ROOT}/`]
    : kind === "browser" ? ["src/lib/browser/"] : [];
  for (const entry of (binding as { files: unknown[] }).files) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      findings.push(finding("gpt/page-evidence-source-binding", REPORT_PATH,
        `${childId} has a malformed ${kind} file binding.`));
      continue;
    }
    const record = entry as { path?: unknown; contentHash?: unknown; semanticHash?: unknown };
    const boundPath = typeof record.path === "string" ? record.path : "";
    const inScope = kind === "authority"
      ? [ACTIVE_LAW_PATH, "docs/blueprints/gpt/GPT-CAPABILITY-GROUP-V2-BLUEPRINT.md"].includes(boundPath)
      : allowedPrefix.some((prefix) => boundPath.startsWith(prefix));
    if (!boundPath || !inScope
      || typeof record.contentHash !== "string" || typeof record.semanticHash !== "string") {
      findings.push(finding("gpt/page-evidence-source-binding", REPORT_PATH,
        `${childId} has an out-of-scope ${kind} file binding.`));
      continue;
    }
    const absolute = resolve(context.sealedRoot, boundPath);
    if (!existsSync(absolute) || repoPath(context.sealedRoot, absolute) !== boundPath
      || sha256(readFileSync(absolute)) !== record.contentHash) {
      findings.push(finding("gpt/page-evidence-source-binding-stale", boundPath,
        `${childId} ${kind} demand source changed after evidence capture.`));
    }
  }
};

export const inspectGptPageEvidenceClosure = (
  context: InspectorContext,
  findings: InspectorFinding[],
  finding: FindingFactory,
): void => {
  const absoluteReport = resolve(context.sealedRoot, REPORT_PATH);
  if (!existsSync(absoluteReport)) {
    findings.push(finding("gpt/page-evidence-report-required", REPORT_PATH,
      "The unique GPT page-operation evidence report is missing."));
    return;
  }
  let report: Record<string, unknown>;
  try { report = JSON.parse(readFileSync(absoluteReport, "utf8")) as Record<string, unknown>; }
  catch {
    findings.push(finding("gpt/page-evidence-report-json", REPORT_PATH,
      "The unique GPT page-operation evidence report is not valid JSON."));
    return;
  }
  if (report.schemaVersion !== REPORT_SCHEMA) findings.push(finding(
    "gpt/page-evidence-report-schema", REPORT_PATH,
    `Expected ${REPORT_SCHEMA}; found ${String(report.schemaVersion)}.`,
  ));
  if ((report.matrixBinding as { schemaVersion?: unknown } | undefined)?.schemaVersion !== MATRIX_SCHEMA) {
    findings.push(finding("gpt/page-evidence-matrix-binding", REPORT_PATH,
      `The report is not bound to ${MATRIX_SCHEMA}.`));
  }
  if (report.productionRuntimeConsumer !== false || report.claimsQualityVerdict !== false) {
    findings.push(finding("gpt/page-evidence-role-boundary", REPORT_PATH,
      "The report must remain offline evidence and must not claim a quality verdict."));
  }
  const browser = record(record(report.captureMetadata)?.browser);
  if (report.captureStatus !== "NOT_CAPTURED" && (
    browser?.family !== "chrome" || browser.controlSkill !== "chrome:control-chrome"
    || browser.dedicatedQaTab !== true || browser.qaTabCreatedByRun !== true
    || browser.livePageObserved !== true || !SHA256.test(String(browser.qaTabIdentityHash ?? ""))
    || !record(browser.productionBrowserIdleEvidence)
  )) findings.push(finding(
    "gpt/page-evidence-live-browser-binding", REPORT_PATH,
    "Captured evidence is missing its dedicated live Chrome or production-idle binding.",
  ));
  const privacyFailures = gptPageEvidencePrivacyFailures(report);
  if (privacyFailures.length > 0) findings.push(finding(
    "gpt/page-evidence-privacy", REPORT_PATH,
    `Evidence contains forbidden raw browser identity or secret fields: ${privacyFailures.slice(0, 5).join(",")}.`,
  ));
  let contracts: Record<string, Record<string, unknown>>;
  try { contracts = currentContracts(context); }
  catch (error) {
    findings.push(finding("gpt/page-evidence-contract-read", CONTRACT_PATH,
      error instanceof Error ? error.message : String(error)));
    return;
  }
  const demandFailures = currentGptPageEvidenceDemandFailures(context.sealedRoot, report, contracts);
  if (demandFailures.length > 0) findings.push(finding(
    "gpt/page-evidence-current-demand", REPORT_PATH,
    `The report is not the current offline projection: ${demandFailures.slice(0, 12).join(",")}.`,
  ));
  const reportChildren = Array.isArray(report.children) ? report.children : [];
  const children = reportChildren.filter((entry): entry is Record<string, unknown> =>
    Boolean(entry) && typeof entry === "object" && !Array.isArray(entry));
  const byId = new Map(children.flatMap((child) => typeof child.childCapabilityId === "string"
    ? [[child.childCapabilityId, child] as const] : []));
  const pageIds = Object.keys(contracts).filter((id) => contracts[id]?.requiredTargetKind !== "none").sort();
  if (children.length !== Object.keys(contracts).length || pageIds.length !== 22) findings.push(finding(
    "gpt/page-evidence-denominator", REPORT_PATH,
    `Expected ${Object.keys(contracts).length}/22 contract/page records; found ${children.length}/${pageIds.length}.`,
  ));

  const pluginFiles = filesBelow(resolve(context.sealedRoot, PLUGIN_ROOT), [".ts"])
    .map((path) => ({ path: repoPath(context.sealedRoot, path), text: readFileSync(path, "utf8") }));
  for (const id of Object.keys(contracts).sort()) {
    const child = byId.get(id);
    if (!child) {
      findings.push(finding("gpt/page-evidence-child-required", REPORT_PATH, `Report is missing ${id}.`));
      continue;
    }
    if (JSON.stringify(stable(child.contract)) !== JSON.stringify(stable(contracts[id]))
      || child.contractVersion !== contracts[id]?.contractVersion) findings.push(finding(
      "gpt/page-evidence-contract-binding-stale", REPORT_PATH,
      `${id} report contract does not match the current contract.`,
    ));
    if (!pageIds.includes(id)) continue;
    const demand = child.evidenceDemand as Record<string, unknown> | undefined;
    const source = demand?.sourceBinding as Record<string, unknown> | undefined;
    if (typeof demand?.digest !== "string" || !Array.isArray(demand?.facts) || demand.facts.length === 0) {
      findings.push(finding("gpt/page-evidence-demand-required", REPORT_PATH, `${id} has no complete evidenceDemand.`));
      continue;
    }
    if (child.captureComplete === true) {
      const captureFailures = completeGptPageEvidenceCaptureFailures(child, demand);
      if (captureFailures.length > 0) findings.push(finding(
        "gpt/page-evidence-capture-integrity", REPORT_PATH,
        `${id} claims admission with invalid capture internals: ${captureFailures.slice(0, 12).join(",")}.`,
      ));
    }
    inspectBoundFiles(context, id, "implementation", source?.implementation, findings, finding);
    inspectBoundFiles(context, id, "consumers", source?.consumers, findings, finding);
    inspectBoundFiles(context, id, "authority", source?.authority, findings, finding);
    inspectBoundFiles(context, id, "browser", source?.browser, findings, finding);
    const implementationPaths = new Set(bindingPaths(source?.implementation));
    const requiredImplementation = filesBelow(resolve(context.sealedRoot, GPT_ROOT, "children", id), [".ts"])
      .map((path) => repoPath(context.sealedRoot, path));
    for (const path of requiredImplementation.filter((path) => !implementationPaths.has(path))) findings.push(finding(
      "gpt/page-evidence-implementation-binding-missing", path, `${id} demand omits its private implementation file.`,
    ));
    const consumerPaths = new Set(bindingPaths(source?.consumers));
    for (const consumer of pluginFiles.filter((entry) => entry.text.includes(id))) if (!consumerPaths.has(consumer.path)) {
      findings.push(finding("gpt/page-evidence-consumer-binding-missing", consumer.path,
        `${id} demand omits a current Product consumer.`));
    }
  }
  if (!new Set(["NOT_CAPTURED", "CAPTURE_PARTIAL", "CAPTURE_COMPLETE"]).has(String(report.captureStatus))) {
    findings.push(finding("gpt/page-evidence-capture-status", REPORT_PATH,
      `The unique report has invalid capture status ${String(report.captureStatus)}.`));
  }
};
