import { createHash } from "node:crypto";

export const SHA256 = /^sha256:[a-f0-9]{64}$/u;
const RAW_CONVERSATION_PATH = /\/(?:c|g)\/(?!sha256:)[A-Za-z0-9_-]{8,}/iu;
const FORBIDDEN_EVIDENCE_KEY = /^(?:cookie|cookies|localstorage|sessionstorage|password|passwords|authorizationheader|accesstoken|refreshtoken)$/iu;
const FORBIDDEN_EVIDENCE_VALUE = /(?:\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b|\bBearer\s+[A-Za-z0-9._~-]{12,}\b|\bsk-[A-Za-z0-9_-]{12,}\b)/iu;

export const sha256 = (value: string | Buffer): string =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

export const stable = (value: unknown): unknown => Array.isArray(value) ? value.map(stable)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable((value as Record<string, unknown>)[key])]))
    : value;


export const bindingPaths = (binding: unknown): string[] => {
  if (!binding || typeof binding !== "object" || Array.isArray(binding)) return [];
  const files = (binding as { files?: unknown }).files;
  if (!Array.isArray(files)) return [];
  return files.flatMap((entry) => entry && typeof entry === "object" && !Array.isArray(entry)
    && typeof (entry as { path?: unknown }).path === "string" ? [(entry as { path: string }).path] : []);
};

export const record = (value: unknown): Record<string, unknown> | null =>
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

type CaptureInspection = Readonly<{
  child: Record<string, unknown>;
  demand: Record<string, unknown>;
  collection: Record<string, unknown> | null;
  captureContext: Record<string, unknown> | null;
  demandFacts: string[];
  live: Record<string, unknown>[];
  derived: Record<string, unknown>[];
  liveByObservation: Map<string, Record<string, unknown>>;
  liveStates: string[];
}>;

const captureEnvelopeFailures = (
  child: Record<string, unknown>, demand: Record<string, unknown>,
): { failures: string[]; collection: Record<string, unknown> | null;
  captureContext: Record<string, unknown> | null; demandFacts: string[] } => {
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
  return { failures, collection, captureContext, demandFacts };
};

const captureInspection = (
  child: Record<string, unknown>, demand: Record<string, unknown>,
): { state: CaptureInspection; failures: string[] } => {
  const envelope = captureEnvelopeFailures(child, demand);
  const specimens = Array.isArray(envelope.collection?.specimens)
    ? envelope.collection.specimens.flatMap((entry) => record(entry) ? [record(entry)!] : []) : [];
  const live = specimens.filter((entry) => entry.evidenceKind === "LIVE_PAGE");
  const derived = specimens.filter((entry) => entry.evidenceKind === "DERIVED_FIXTURE");
  const liveByObservation = new Map(live.flatMap((entry) => typeof entry.observationId === "string"
    ? [[entry.observationId, entry] as const] : []));
  const liveStates = envelope.demandFacts.filter((factId) => factId.startsWith("live-state:"))
    .map((factId) => factId.slice("live-state:".length));
  return { failures: envelope.failures, state: {
    child, demand, collection: envelope.collection, captureContext: envelope.captureContext,
    demandFacts: envelope.demandFacts, live, derived, liveByObservation, liveStates,
  } };
};

const inspectSpecimenCoverage = (state: CaptureInspection, failures: string[]): void => {
  const derivedStates = state.demandFacts.filter((factId) => factId.startsWith("derived-state:"))
    .map((factId) => factId.slice("derived-state:".length));
  for (const stateId of state.liveStates) if (!state.live.some((entry) => entry.stateId === stateId)) {
    failures.push(`live:${stateId}`);
  }
  for (const stateId of derivedStates) if (!state.derived.some((entry) => entry.stateId === stateId
    && typeof entry.derivedFromObservationId === "string"
    && state.liveByObservation.has(entry.derivedFromObservationId)
    && typeof record(entry.mutation)?.kind === "string"
    && Array.isArray(record(entry.mutation)?.changes)
    && (record(entry.mutation)?.changes as unknown[]).length > 0)) failures.push(`derived:${stateId}`);
};

const inspectSceneBindings = (state: CaptureInspection, failures: string[]): void => {
  const requiredLive = state.live.filter((entry) => state.liveStates.includes(String(entry.stateId)));
  const sourceSceneIds = requiredLive.map((entry) => entry.sourceSceneId);
  if (sourceSceneIds.some((entry) => typeof entry !== "string" || entry.length === 0)
    || new Set(sourceSceneIds).size !== sourceSceneIds.length) failures.push("live-scene-reuse");
  if (requiredLive.some((entry) => typeof entry.stateSignature !== "string" || !SHA256.test(entry.stateSignature)
    || observedStateSignature(entry) !== entry.stateSignature)) failures.push("live-signatures");
  const sceneManifest = Array.isArray(state.captureContext?.sceneManifest)
    ? state.captureContext.sceneManifest.flatMap((entry) => record(entry) ? [record(entry)!] : []) : [];
  const sceneIds = sceneManifest.map((entry) => entry.sceneId);
  if (sceneIds.some((entry) => typeof entry !== "string") || new Set(sceneIds).size !== sceneIds.length) {
    failures.push("scene-manifest-duplicates");
  }
  for (const specimen of requiredLive) inspectSceneSpecimen(state, specimen, sceneManifest, failures);
};

const inspectSceneSpecimen = (
  state: CaptureInspection,
  specimen: Record<string, unknown>,
  sceneManifest: readonly Record<string, unknown>[],
  failures: string[],
): void => {
  const scene = sceneManifest.find((entry) => entry.sceneId === specimen.sourceSceneId);
  const binding = record(scene?.binding);
  const peripheral = record(specimen.peripheral);
  if (!scene || scene.stateSignature !== specimen.sourceSceneSignature
    || binding?.runId !== peripheral?.runId
    || binding?.qaTabIdentityHash !== scene.activeTabIdentityHash
    || (typeof state.captureContext?.captureEpoch === "string"
      && binding?.captureEpoch !== state.captureContext.captureEpoch)) {
    failures.push(`scene-binding:${String(specimen.stateId)}`);
  }
  const chain = record(record(specimen.related)?.transitionChain);
  const profile = record(state.child.contract)?.profile;
  if (profile === "DOM_OBSERVATION") {
    if (record(chain?.typedCommand)?.kind !== "NOT_APPLICABLE"
      || record(chain?.terminalReceipt)?.kind !== "NOT_APPLICABLE") failures.push("observation-action-contradiction");
    return;
  }
  if (!["CAPTURED_BROWSER_COMMAND", "ZERO_ACTION"].includes(String(record(chain?.typedCommand)?.kind))
    || !["CAPTURED_DISPATCH_RETURN", "COHERENT_READBACK"].includes(String(record(chain?.terminalReceipt)?.kind))
    || record(chain?.directPostcondition)?.passed !== true) failures.push(`action-receipt:${String(specimen.stateId)}`);
};

const bindingExpectedHashValid = (
  binding: Record<string, unknown>, demandFact: Record<string, unknown> | null,
): boolean => typeof binding.expectedHash === "string" && SHA256.test(binding.expectedHash)
  && binding.expectedHash === sha256(JSON.stringify(stable(demandFact?.expected)) ?? "undefined");

const inspectLiveFactBinding = (
  state: CaptureInspection, binding: Record<string, unknown>,
  factId: string, demandFact: Record<string, unknown> | null, failures: string[],
): void => {
  const observationId = typeof binding.observationId === "string" ? binding.observationId : "";
  const specimen = state.liveByObservation.get(observationId);
  const pointers = Array.isArray(binding.pointers)
    ? binding.pointers.filter((entry): entry is string => typeof entry === "string" && entry.length > 0) : [];
  if (binding.bindingKind !== "LIVE_OBSERVATION" || !specimen || pointers.length === 0
    || pointers.some((pointer) => !valuePresent(valueAtPath(specimen, pointer)))
    || !bindingExpectedHashValid(binding, demandFact)) {
    failures.push(`binding:${factId || "missing"}`);
    return;
  }
  inspectLiveStateFact(specimen, factId, failures);
  inspectTargetFact(specimen, factId, pointers, failures);
  inspectDerivedStateFact(state, observationId, factId, failures);
};

const inspectLiveStateFact = (
  specimen: Record<string, unknown>, factId: string, failures: string[],
): void => {
  if (factId.startsWith("live-state:") && specimen.stateId !== factId.slice("live-state:".length)) {
    failures.push(`binding-live:${factId}`);
  }
};

const inspectTargetFact = (
  specimen: Record<string, unknown>, factId: string, pointers: readonly string[], failures: string[],
): void => {
  if (!factId.startsWith("target:")) return;
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
};

const inspectDerivedStateFact = (
  state: CaptureInspection, observationId: string, factId: string, failures: string[],
): void => {
  if (factId.startsWith("derived-state:") && !state.derived.some((entry) =>
    entry.stateId === factId.slice("derived-state:".length)
    && entry.derivedFromObservationId === observationId)) failures.push(`binding-derived:${factId}`);
};

const inspectFactBindings = (state: CaptureInspection, failures: string[]): void => {
  const bindings = Array.isArray(state.collection?.factBindings)
    ? state.collection.factBindings.flatMap((entry) => record(entry) ? [record(entry)!] : []) : [];
  const boundFactIds = bindings.flatMap((entry) => typeof entry.factId === "string" ? [entry.factId] : []);
  if (!exactStringSet(boundFactIds, state.demandFacts)) failures.push("fact-binding-set");
  for (const binding of bindings) {
    const factId = typeof binding.factId === "string" ? binding.factId : "";
    const demandFact = Array.isArray(state.demand.facts)
      ? state.demand.facts.map(record).find((entry) => entry?.factId === factId) ?? null : null;
    if (binding.bindingKind === "CURRENT_PROJECTION") {
      if (["PAGE_TARGET", "LIVE_PAGE_STATE", "EVIDENCE_CHAIN"].includes(String(demandFact?.kind))
        || binding.projectionDigest !== state.demand.projectionDigest
        || !bindingExpectedHashValid(binding, demandFact)) failures.push(`binding-projection:${factId || "missing"}`);
    } else {
      inspectLiveFactBinding(state, binding, factId, demandFact, failures);
    }
  }
};

const inspectModelState = (state: CaptureInspection, failures: string[]): void => {
  const unchecked = state.live.find((entry) => entry.stateId === "target-model-actionable-unchecked");
  const closed = state.live.filter((entry) =>
    ["model-panel-closed-after-selection", "model-selection-postcondition"].includes(String(entry.stateId)));
  if (unchecked && valueAtPath(unchecked, "core.attributes.aria-checked") !== "false") {
    failures.push("model-unchecked-contradiction");
  }
  if (closed.some((entry) => valueAtPath(entry, "core.attributes.aria-expanded") !== "false")) {
    failures.push("model-panel-close-contradiction");
  }
};

export const completeGptPageEvidenceCaptureFailures = (
  child: Record<string, unknown>, demand: Record<string, unknown>,
): string[] => {
  const inspection = captureInspection(child, demand);
  inspectSpecimenCoverage(inspection.state, inspection.failures);
  inspectSceneBindings(inspection.state, inspection.failures);
  inspectFactBindings(inspection.state, inspection.failures);
  inspectModelState(inspection.state, inspection.failures);
  return [...new Set(inspection.failures)];
};

export const scopedGptPageEvidenceFactFailures = (
  child: Record<string, unknown>, demand: Record<string, unknown>, factIds: readonly string[],
): string[] => {
  const failures: string[] = [];
  const collection = record(child.collection);
  const captureContext = record(collection?.captureContext);
  const specimens = Array.isArray(collection?.specimens)
    ? collection.specimens.flatMap((entry) => record(entry) ? [record(entry)!] : []) : [];
  const live = specimens.filter((entry) => entry.evidenceKind === "LIVE_PAGE");
  const liveByObservation = new Map(live.flatMap((entry) => typeof entry.observationId === "string"
    ? [[entry.observationId, entry] as const] : []));
  const demandFacts = Array.isArray(demand.facts)
    ? demand.facts.flatMap((entry) => record(entry) ? [record(entry)!] : []) : [];
  const bindings = Array.isArray(collection?.factBindings)
    ? collection.factBindings.flatMap((entry) => record(entry) ? [record(entry)!] : []) : [];
  const state: CaptureInspection = {
    child, demand, collection, captureContext,
    demandFacts: demandFacts.flatMap((entry) => typeof entry.factId === "string" ? [entry.factId] : []),
    live,
    derived: specimens.filter((entry) => entry.evidenceKind === "DERIVED_FIXTURE"),
    liveByObservation,
    liveStates: [],
  };

  if (collection?.demandDigest !== demand.digest) failures.push("collection-demand-digest");
  if (collection?.childCandidateDigest !== demand.childCandidateDigest) failures.push("child-candidate-digest");
  if (!captureContext || !Array.isArray(captureContext.sceneManifest)) failures.push("capture-context");
  if (new Set(factIds).size !== factIds.length) failures.push("fact-scope-duplicates");

  const sceneManifest = Array.isArray(captureContext?.sceneManifest)
    ? captureContext.sceneManifest.flatMap((entry) => record(entry) ? [record(entry)!] : []) : [];
  for (const factId of factIds) {
    const demandFact = demandFacts.find((entry) => entry.factId === factId) ?? null;
    if (!demandFact) {
      failures.push(`fact-not-declared:${factId}`);
      continue;
    }
    const matches = bindings.filter((entry) => entry.factId === factId);
    if (matches.length !== 1) {
      failures.push(`${matches.length === 0 ? "fact-not-observed" : "fact-binding-duplicate"}:${factId}`);
      continue;
    }
    const binding = matches[0]!;
    if (binding.bindingKind === "CURRENT_PROJECTION") {
      failures.push(`fact-not-live:${factId}`);
      continue;
    }
    inspectLiveFactBinding(state, binding, factId, demandFact, failures);
    const specimen = typeof binding.observationId === "string"
      ? liveByObservation.get(binding.observationId) : undefined;
    if (!specimen) continue;
    if (typeof specimen.stateSignature !== "string" || !SHA256.test(specimen.stateSignature)
      || observedStateSignature(specimen) !== specimen.stateSignature) failures.push(`live-signature:${factId}`);
    inspectSceneSpecimen(state, specimen, sceneManifest, failures);
  }
  inspectModelState(state, failures);
  return [...new Set(failures)];
};
