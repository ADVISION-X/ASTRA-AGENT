import { existsSync, readFileSync, readdirSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import { Node, SyntaxKind, ts, type Expression, type ObjectLiteralExpression } from "ts-morph";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";
import {
  bindingPaths,
  completeGptPageEvidenceCaptureFailures,
  gptPageEvidencePrivacyFailures,
  record,
  SHA256,
  sha256,
  stable,
} from "./gpt-page-evidence-capture-inspection.js";

const REPORT_PATH = "docs/项目方案/GPT页面操作子能力实证资料.json";
const MATRIX_PATH = "src/capabilities/gpt/page-operation-matrix.json";
const CONTRACT_PATH = "src/capabilities/gpt/contract.ts";
const GPT_ROOT = "src/capabilities/gpt";
const PLUGIN_ROOT = "src/plugins";
const ACTIVE_LAW_PATH = ".github/instructions/agent-rules/功能法案.md";
const REPORT_SCHEMA = "gpt-page-operation-evidence.v6";
const MATRIX_SCHEMA = "gpt-page-operation-matrix.v4";
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
type FindingFactory = (checkId: string, filePath: string, message: string, line?: number) => InspectorFinding;

const repoPath = (root: string, path: string): string => relative(root, path).split(sep).join("/");
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

const objectValue = (object: ObjectLiteralExpression): Record<string, unknown> =>
  Object.fromEntries(object.getProperties().map((property) => {
    if (!Node.isPropertyAssignment(property)) throw new Error("CONTRACT_PROPERTY_INVALID");
    return [property.getName().replace(/^['"]|['"]$/gu, ""), literalValue(property.getInitializerOrThrow())];
  }));

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

const semanticPrint = (path: string, source: string): string => {
  if (!path.endsWith(".ts") && !path.endsWith(".tsx")) return source.replace(/\s+/gu, " ").trim();
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
    return { path, contentHash: sha256(raw), semanticHash: sha256(semanticPrint(path, raw.toString("utf8"))) };
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

type DemandInventory = Readonly<{
  consumers: Record<string, string[]>;
  implementations: Record<string, string[]>;
}>;

const collectDemandInventory = (root: string, ids: readonly string[]): DemandInventory => {
  const readSources = (base: string) => filesBelow(resolve(root, base), [".ts"])
    .map((absolute) => ({ path: repoPath(root, absolute), text: readFileSync(absolute, "utf8") }));
  const gptFiles = readSources(GPT_ROOT);
  const pluginFiles = readSources(PLUGIN_ROOT);
  const pageIds = new Set(ids.filter((id) => {
    const handler = resolve(root, GPT_ROOT, "children", id, "handler.ts");
    return existsSync(handler) && readFileSync(handler, "utf8").includes("requireBrowser(");
  }));
  const implementations: Record<string, string[]> = Object.fromEntries(ids.map((id) => [id, []]));
  const consumers: Record<string, string[]> = Object.fromEntries(ids.map((id) => [id, []]));
  for (const file of gptFiles) for (const id of ids) {
    const isolated = file.path.startsWith(`${GPT_ROOT}/children/${id}/`);
    if ((file.text.includes(id) || isolated)
      && (file.path.startsWith(`${GPT_ROOT}/web/`) || (isolated && pageIds.has(id)))) implementations[id]!.push(file.path);
  }
  for (const file of pluginFiles) for (const id of ids) if (file.text.includes(id)) consumers[id]!.push(file.path);
  for (const id of ids) {
    const roots = new Set(consumers[id]!.map((path) => path.split("/").slice(0, 3).join("/")));
    for (const file of pluginFiles) if (roots.has(file.path.split("/").slice(0, 3).join("/"))
      && /\b(?:modelDisplayName|reasoningRequirement)\s*:/u.test(file.text)) consumers[id]!.push(file.path);
    consumers[id] = [...new Set(consumers[id])].sort();
  }
  return { consumers, implementations };
};

const authorizedRequirements = (
  root: string, requiredInputRefs: readonly string[], consumerBinding: SourceBinding,
): Record<string, unknown> => {
  const requirements: Record<string, unknown> = {};
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
    requirements[inputId] = stable({ sourceKind: "PRODUCT_PROFILE", variants: normalized,
      setHash: sha256(JSON.stringify(stable(normalized.map((entry) => entry.valueHash)))) });
  }
  return requirements;
};

const demandFacts = (
  contract: Record<string, unknown>, requirement: Record<string, unknown>,
  commonDerived: readonly string[], requiredInputRefs: readonly string[],
  authorizedInputRequirements: Record<string, unknown>, authorityPaths: readonly string[],
): Array<Record<string, unknown>> => {
  const facts: Array<Record<string, unknown>> = DEMAND_CONTRACT_FIELDS.map((field) => ({
    factId: `contract:${field}`, kind: "CONTRACT", expected: stable(contract[field]),
  }));
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
  return facts;
};

const deriveCurrentDemands = (
  root: string, contracts: Record<string, Record<string, unknown>>, matrix: Record<string, unknown>,
): Record<string, Record<string, unknown>> => {
  const ids = Object.keys(contracts);
  const matrixChildren = Array.isArray(matrix.children)
    ? matrix.children.flatMap((entry) => record(entry) ? [record(entry)!] : []) : [];
  const inventory = collectDemandInventory(root, ids);
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
    const consumerBinding = sourceBinding(root, inventory.consumers[id]!);
    const requiredInputRefs = Array.isArray(requirement.requiredInputRefs)
      ? requirement.requiredInputRefs.filter((entry): entry is string => typeof entry === "string") : [];
    const inputRequirements = authorizedRequirements(root, requiredInputRefs, consumerBinding);
    const projectedRequirement = stable({ ...requirement, authorizedInputRequirements: inputRequirements });
    const facts = demandFacts(contract, requirement, commonDerived, requiredInputRefs, inputRequirements, authorityPaths);
    const implementation = sourceBinding(root, inventory.implementations[id]!);
    const authority = sourceBinding(root, authorityPaths);
    const browser = sourceBinding(root, [
      ...(Array.isArray(browserBindings[id]) ? browserBindings[id] as string[] : []),
      ...(Array.isArray(requirement.browserImplementationSources) ? requirement.browserImplementationSources as string[] : []),
    ]);
    const payload = stable({ childCapabilityId: id, contract: stable({ ...contract }),
      collectionRequirement: projectedRequirement, facts, implementationSemanticDigest: implementation.semanticDigest,
      productConsumerSemanticDigest: consumerBinding.semanticDigest,
      authoritySemanticDigest: authority.semanticDigest, browserSemanticDigest: browser.semanticDigest });
    const digest = sha256(JSON.stringify(payload));
    const pageDemand = stable({ childCapabilityId: id, coreTargets: requirement.coreTargets,
      requiredLiveStates: requirement.requiredLiveStates, optionalLiveStates: requirement.optionalLiveStates,
      liveStateTargets: requirement.liveStateTargets, stateAssertions: requirement.stateAssertions,
      requiredDerivedStates: [...commonDerived, ...(requirement.childSpecificDerivedStates as string[])] });
    demands[id] = stable({ schemaVersion: "gpt-page-operation-demand.v2", facts, digest,
      projectionDigest: digest, pageDemandDigest: sha256(JSON.stringify(pageDemand)),
      childCandidateDigest: digest, authorizedInputRequirements: inputRequirements,
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
    inspectBoundFileEntry(context, childId, kind, entry, allowedPrefix, findings, finding);
  }
};

const inspectBoundFileEntry = (
  context: InspectorContext,
  childId: string,
  kind: "implementation" | "consumers" | "authority" | "browser",
  entry: unknown,
  allowedPrefix: readonly string[],
  findings: InspectorFinding[],
  finding: FindingFactory,
): void => {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    findings.push(finding("gpt/page-evidence-source-binding", REPORT_PATH,
      `${childId} has a malformed ${kind} file binding.`));
    return;
  }
  const fileBinding = entry as { path?: unknown; contentHash?: unknown; semanticHash?: unknown };
  const boundPath = typeof fileBinding.path === "string" ? fileBinding.path : "";
  const inScope = kind === "authority"
    ? [ACTIVE_LAW_PATH, "docs/blueprints/gpt/GPT-CAPABILITY-GROUP-V2-BLUEPRINT.md"].includes(boundPath)
    : allowedPrefix.some((prefix) => boundPath.startsWith(prefix));
  if (!boundPath || !inScope
    || typeof fileBinding.contentHash !== "string" || typeof fileBinding.semanticHash !== "string") {
    findings.push(finding("gpt/page-evidence-source-binding", REPORT_PATH,
      `${childId} has an out-of-scope ${kind} file binding.`));
    return;
  }
  const absolute = resolve(context.sealedRoot, boundPath);
  if (!existsSync(absolute) || repoPath(context.sealedRoot, absolute) !== boundPath
    || sha256(readFileSync(absolute)) !== fileBinding.contentHash) {
    findings.push(finding("gpt/page-evidence-source-binding-stale", REPORT_PATH,
      `${childId} ${kind} demand source ${boundPath} changed after evidence capture.`));
  }
};

const readEvidenceReport = (
  context: InspectorContext, findings: InspectorFinding[], finding: FindingFactory,
): Record<string, unknown> | null => {
  const absoluteReport = resolve(context.sealedRoot, REPORT_PATH);
  if (!existsSync(absoluteReport)) {
    findings.push(finding("gpt/page-evidence-report-required", REPORT_PATH,
      "The unique GPT page-operation evidence report is missing."));
    return null;
  }
  try { return JSON.parse(readFileSync(absoluteReport, "utf8")) as Record<string, unknown>; }
  catch {
    findings.push(finding("gpt/page-evidence-report-json", REPORT_PATH,
      "The unique GPT page-operation evidence report is not valid JSON."));
    return null;
  }
};

const inspectReportEnvelope = (
  report: Record<string, unknown>, findings: InspectorFinding[], finding: FindingFactory,
): void => {
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
};

type EvidenceChildInspection = Readonly<{
  context: InspectorContext;
  finding: FindingFactory;
  findings: InspectorFinding[];
  pluginFiles: readonly Readonly<{ path: string; text: string }>[];
}>;

const inspectEvidenceChild = (
  inspection: EvidenceChildInspection,
  id: string,
  child: Record<string, unknown>,
  contract: Record<string, unknown>,
  isPageChild: boolean,
): void => {
  const { context, finding, findings, pluginFiles } = inspection;
  if (JSON.stringify(stable(child.contract)) !== JSON.stringify(stable(contract))
    || child.contractVersion !== contract.contractVersion) findings.push(finding(
    "gpt/page-evidence-contract-binding-stale", REPORT_PATH,
    `${id} report contract does not match the current contract.`,
  ));
  if (!isPageChild) return;
  const demand = child.evidenceDemand as Record<string, unknown> | undefined;
  const source = demand?.sourceBinding as Record<string, unknown> | undefined;
  if (typeof demand?.digest !== "string" || !Array.isArray(demand?.facts) || demand.facts.length === 0) {
    findings.push(finding("gpt/page-evidence-demand-required", REPORT_PATH, `${id} has no complete evidenceDemand.`));
    return;
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
};

export const inspectGptPageEvidenceClosure = (
  context: InspectorContext, findings: InspectorFinding[], finding: FindingFactory,
): void => {
  const report = readEvidenceReport(context, findings, finding);
  if (!report) return;
  inspectReportEnvelope(report, findings, finding);
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
  const childInspection = { context, finding, findings, pluginFiles };
  for (const id of Object.keys(contracts).sort()) {
    const child = byId.get(id);
    if (!child) {
      findings.push(finding("gpt/page-evidence-child-required", REPORT_PATH, `Report is missing ${id}.`));
      continue;
    }
    inspectEvidenceChild(childInspection, id, child, contracts[id]!, pageIds.includes(id));
  }
  if (!new Set(["NOT_CAPTURED", "CAPTURE_PARTIAL", "CAPTURE_COMPLETE"]).has(String(report.captureStatus))) {
    findings.push(finding("gpt/page-evidence-capture-status", REPORT_PATH,
      `The unique report has invalid capture status ${String(report.captureStatus)}.`));
  }
};
