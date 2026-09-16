#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readdir, readFile, rename, stat, writeFile, mkdir } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import {
  derivePageInputBindingProof,
  pageInputBindingProofValid,
  pageInputBindingValid,
  requiredPageInputRoles,
} from "./page-input-binding.mjs";
import { captureTimePageRequirementSnapshot, captureTimePageRequirementSnapshotValid,
  pageEvidenceNotApplicableForTrace, requiredLiveStatesForTrace, stateAssertionFailures,
  transitionEvidenceFailures } from "./trace-page-requirements.mjs";

const REPORT_SCHEMA = "gpt-page-operation-evidence.v7";
const CAPTURE_SCHEMA = "gpt-page-operation-capture.v6";
const PRODUCTION_SOURCE_SCHEMA = "gpt-page-operation-production-source.v1";
const MATRIX_SCHEMA = "gpt-page-operation-matrix.v4";
const PRODUCT_PROJECTION_SCHEMA = "gpt-page-operation-product-projection.v1";
const CANONICAL_REPORT = "docs/项目方案/GPT页面操作子能力实证资料.json";
const DEMAND_CONTRACT_FIELDS = Object.freeze([
  "semanticIntent", "inputSchema", "requiredTargetKind",
  "profile", "boundedWait", "decisions", "precondition", "actionQualification",
  "mutationBudget", "oneObservationOrMutation", "positivePostcondition",
  "negativePostcondition", "evidenceSchema", "evidenceBoundary", "failureClassification",
  "replayPolicy",
]);
const DEMAND_CHAIN_FACTS = Object.freeze([
  "document-and-revision-identity", "precondition-observation", "typed-command-and-terminal-receipt",
  "direct-postcondition-observation", "owner-and-linked-node-relations",
]);

const FORBIDDEN_CAPTURE_KEYS = /^(cookie|cookies|localstorage|sessionstorage|password|passwords|authorizationheader|accesstoken|refreshtoken)$/i;
const FORBIDDEN_PLAINTEXT_KEYS = /^(?:rawprompt|prompttext|responsetext|body|content|plaintext|rawtext)$/i;
const RAW_CONVERSATION_PATH = /\/(?:c|g)\/(?!sha256:)[A-Za-z0-9_-]{8,}/i;
const FORBIDDEN_CAPTURE_VALUE = /(?:\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b|\bBearer\s+[A-Za-z0-9._~-]{12,}\b|\bsk-[A-Za-z0-9_-]{12,}\b)/iu;

function fail(code, detail = "") {
  throw new Error(detail ? `${code}:${detail}` : code);
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  if (!command) fail("COMMAND_REQUIRED");
  const args = {};
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith("--")) fail("ARGUMENT_INVALID", token);
    const key = token.slice(2);
    const next = rest[index + 1];
    if (!next || next.startsWith("--")) args[key] = true;
    else {
      args[key] = next;
      index += 1;
    }
  }
  return { command, args };
}

function requiredArg(args, name) {
  const value = args[name];
  if (typeof value !== "string" || value.length === 0) fail("ARGUMENT_REQUIRED", `--${name}`);
  return resolve(value);
}

function sha256(value) {
  const data = Buffer.isBuffer(value) ? value : Buffer.from(String(value), "utf8");
  return `sha256:${createHash("sha256").update(data).digest("hex")}`;
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

async function isFile(path) {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

async function walkFiles(root, predicate = () => true) {
  const output = [];
  async function visit(path) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      const absolute = join(path, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      else if (entry.isFile() && predicate(absolute)) output.push(absolute);
    }
  }
  if (await isFile(root)) return predicate(root) ? [root] : [];
  await visit(root);
  return output.sort();
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    fail("JSON_READ_FAILED", `${path}:${error.message}`);
  }
}

async function writeJsonAtomic(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, path);
}

function assertUnique(values, code) {
  const duplicates = values.filter((value, index) => values.indexOf(value) !== index);
  if (duplicates.length > 0) fail(code, [...new Set(duplicates)].join(","));
}

async function loadMatrix(path) {
  const matrix = await readJson(path);
  if (matrix.schemaVersion !== MATRIX_SCHEMA || !Array.isArray(matrix.children)) {
    fail("MATRIX_SCHEMA_INVALID");
  }
  if (matrix.requiredLiveStateOrder !== "capturedAt-ascending-same-run") fail("MATRIX_STATE_ORDER_INVALID");
  const ids = matrix.children.map((child) => child.childCapabilityId);
  assertUnique(ids, "MATRIX_CHILD_DUPLICATE");
  for (const child of matrix.children) {
    if (!Array.isArray(child.requiredInputRefs)) fail("MATRIX_INPUT_REFS_INVALID", child.childCapabilityId);
    assertUnique(child.requiredInputRefs, "MATRIX_INPUT_REF_DUPLICATE");
    if (!Array.isArray(child.coreTargets) || child.coreTargets.length === 0
      || !Array.isArray(child.requiredLiveStates) || child.requiredLiveStates.length === 0
      || !Array.isArray(child.childSpecificDerivedStates)) {
      fail("MATRIX_CHILD_DEMAND_INVALID", child.childCapabilityId);
    }
    assertUnique(child.coreTargets, "MATRIX_CORE_TARGET_DUPLICATE");
    assertUnique(child.requiredLiveStates, "MATRIX_LIVE_STATE_DUPLICATE");
    assertUnique(child.childSpecificDerivedStates, "MATRIX_DERIVED_STATE_DUPLICATE");
    if (!child.liveStateTargets || typeof child.liveStateTargets !== "object" || Array.isArray(child.liveStateTargets)
      || JSON.stringify(Object.keys(child.liveStateTargets).sort()) !== JSON.stringify([...child.requiredLiveStates].sort())) {
      fail("MATRIX_LIVE_STATE_TARGETS_INVALID", child.childCapabilityId);
    }
    for (const [stateId, targets] of Object.entries(child.liveStateTargets)) {
      if (!Array.isArray(targets) || targets.length === 0 || targets.some((target) => !child.coreTargets.includes(target))) {
        fail("MATRIX_LIVE_STATE_TARGET_INVALID", `${child.childCapabilityId}:${stateId}`);
      }
      assertUnique(targets, "MATRIX_LIVE_STATE_TARGET_DUPLICATE");
    }
    const coveredTargets = [...new Set(Object.values(child.liveStateTargets).flat())].sort();
    if (JSON.stringify(coveredTargets) !== JSON.stringify([...child.coreTargets].sort())) {
      fail("MATRIX_CORE_TARGET_UNCOVERED", child.childCapabilityId);
    }
    if (!child.stateAssertions || typeof child.stateAssertions !== "object" || Array.isArray(child.stateAssertions)
      || JSON.stringify(Object.keys(child.stateAssertions).sort()) !== JSON.stringify([...child.requiredLiveStates].sort())
      || Object.entries(child.stateAssertions).some(([, assertions]) => !Array.isArray(assertions) || assertions.length === 0)) {
      fail("MATRIX_STATE_ASSERTIONS_INVALID", child.childCapabilityId);
    }
    if (child.traceResultStatuses !== undefined
      && (!child.traceResultStatuses || typeof child.traceResultStatuses !== "object"
        || Array.isArray(child.traceResultStatuses)
        || JSON.stringify(Object.keys(child.traceResultStatuses).sort())
          !== JSON.stringify([...child.requiredLiveStates].sort())
        || Object.values(child.traceResultStatuses).some((statuses) => !Array.isArray(statuses)
          || statuses.length === 0 || new Set(statuses).size !== statuses.length
          || statuses.some((status) => !["success", "failed"].includes(status))))) {
      fail("MATRIX_TRACE_RESULT_STATUSES_INVALID", child.childCapabilityId);
    }
  }
  if (ids.length !== matrix.expectedPageOperationCount) {
    fail("MATRIX_COUNT_MISMATCH", `${ids.length}/${matrix.expectedPageOperationCount}`);
  }
  return matrix;
}

function semanticPrint(repo, path, source) {
  if (!path.endsWith(".ts") && !path.endsWith(".tsx")) return source.replace(/\s+/gu, " ").trim();
  const requireFromRepo = createRequire(join(repo, "package.json"));
  const ts = requireFromRepo("typescript");
  const kind = path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, kind);
  return ts.createPrinter({ removeComments: true, newLine: ts.NewLineKind.LineFeed }).printFile(ast);
}

async function sourceBinding(repo, refs) {
  const uniquePaths = [...new Set(refs.map((entry) => entry.path))].sort();
  const files = [];
  const repoRoot = `${resolve(repo)}${sep}`;
  for (const path of uniquePaths) {
    const absolute = resolve(repo, path);
    if (!absolute.startsWith(repoRoot)) fail("DEMAND_SOURCE_OUT_OF_SCOPE", path);
    if (!(await isFile(absolute))) fail("DEMAND_SOURCE_MISSING", path);
    const raw = await readFile(absolute);
    files.push({ path, contentHash: sha256(raw), semanticHash: sha256(semanticPrint(repo, path, raw.toString("utf8"))) });
  }
  return stable({ files, semanticDigest: sha256(JSON.stringify(stable(files.map(({ path, semanticHash }) => ({ path, semanticHash })))))});
}

const exactStringList = (value) => Array.isArray(value) && value.every((entry) => nonEmptyString(entry))
  && new Set(value).size === value.length;

function validProductRouteContract(route) {
  if (!nonEmptyString(route?.productId) || !nonEmptyString(route?.actionId)
    || route.materialPolicy?.kind !== "exact-task-material-set"
    || !exactStringList(route.materialPolicy?.requiredRoles)) return false;
  const topology = route.topology ?? {};
  if (topology.legalStageCallSequences !== undefined || topology.legalCallSequencesByStage !== undefined
    || topology.allowedFailureCleanupCalls !== undefined || topology.callSequenceTemplate !== undefined) return false;
  if (topology.kind === "single-task-action-stage") return true;
  if (topology.kind === "ordered-product-stages") return exactStringList(topology.stageOrder)
    && exactStringList(topology.legalTerminalBranches);
  return topology.kind === "material-declared-cohort-triplet"
    && nonEmptyString(topology.cohortArrayField) && nonEmptyString(topology.cohortIdField)
    && exactStringList(topology.passOrder);
}

async function buildProductInventory(repo) {
  const projectionRoot = join(repo,
    ".agents/skills/gpt-page-operation-evidence/references/product-flow-projections");
  const contracts = [];
  for (const entry of await readdir(projectionRoot, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const path = join(projectionRoot, entry.name);
    const contract = await readJson(path);
    if (contract.schemaVersion !== PRODUCT_PROJECTION_SCHEMA
      || contract.owner !== "gpt-page-operation-evidence"
      || !nonEmptyString(contract.sourcePluginId)
      || !Number.isSafeInteger(contract.sourcePluginVersion)
      || contract.traceAuthority?.kind !== "durable-product-forensics"
      || contract.traceAuthority?.sequenceOwner !== "accepted-production-attempt"
      || contract.traceAuthority?.currentFlowSourcesRole !== "projection-only"
      || !exactStringList(contract.flowOwnerSources)
      || contract.callSequenceTemplates !== undefined
      || !Array.isArray(contract.routes) || contract.routes.length === 0) {
      fail("PRODUCT_EVIDENCE_CONTRACT_INVALID", relative(repo, path));
    }
    const contractPath = relative(repo, path).split(sep).join("/");
    const ownerBinding = await sourceBinding(repo, [
      { path: contractPath }, ...contract.flowOwnerSources.map((sourcePath) => ({ path: sourcePath })),
    ]);
    for (const route of contract.routes) {
      if (!validProductRouteContract(route)) {
        fail("PRODUCT_EVIDENCE_CONTRACT_ROUTE_INVALID", contractPath);
      }
      contracts.push(stable({
        productKey: `${route.productId}/${route.actionId}`,
        productId: route.productId,
        actionId: route.actionId,
        pluginId: contract.sourcePluginId,
        contractPath,
        contractDigest: sha256(JSON.stringify(stable(route))),
        flowOwnerBinding: ownerBinding,
        captureStatus: "NOT_CAPTURED",
        runs: [],
        gaps: ["PRODUCT_PRODUCTION_CAPTURE_NOT_PRESENT"],
      }));
    }
  }
  assertUnique(contracts.map((entry) => entry.productKey), "PRODUCT_EVIDENCE_ROUTE_DUPLICATE");
  const catalogModule = await import(pathToFileURL(join(repo, "src/mediator/product-plugin-catalog.ts")).href);
  const catalog = catalogModule.productionPluginCatalog;
  if (!Array.isArray(catalog) || catalog.length === 0) fail("PRODUCT_CATALOG_INVALID");
  const byKey = Object.fromEntries(contracts.map((entry) => [entry.productKey, entry]));
  const products = [];
  for (const plugin of catalog) for (const route of plugin.accepts ?? []) {
    const productKey = `${route.productId}/${route.actionId}`;
    const declared = byKey[productKey];
    if (declared && declared.pluginId !== plugin.pluginId) {
      fail("PRODUCT_EVIDENCE_CONTRACT_IDENTITY_MISMATCH", productKey);
    }
    products.push(declared ? stable({ ...declared, pluginVersion: 0 }) : stable({
      productKey,
      productId: route.productId,
      actionId: route.actionId,
      pluginId: plugin.pluginId,
      pluginVersion: 0,
      contractPath: null,
      contractDigest: null,
      flowOwnerBinding: null,
      captureStatus: "NOT_CAPTURED",
      runs: [],
      gaps: ["PRODUCT_EVIDENCE_CONTRACT_NOT_IMPLEMENTED"],
    }));
  }
  assertUnique(products.map((entry) => entry.productKey), "PRODUCT_CATALOG_ROUTE_DUPLICATE");
  const unknown = contracts.filter((entry) => !products.some((product) => product.productKey === entry.productKey));
  if (unknown.length) fail("PRODUCT_EVIDENCE_CONTRACT_ROUTE_UNSUPPORTED", unknown.map((entry) => entry.productKey).join(","));
  return products.sort((left, right) => left.productKey.localeCompare(right.productKey));
}

export function preserveUnselectedProductSlices(currentProducts, priorProducts, selectedProductKey) {
  const currentByKey = Object.fromEntries((currentProducts ?? []).map((entry) => [entry.productKey, entry]));
  const prior = priorProducts ?? [];
  const preserved = prior.map((product) => product.productKey === selectedProductKey
    ? currentByKey[selectedProductKey] ?? product : product);
  const priorKeys = new Set(prior.map((entry) => entry.productKey));
  return [...preserved, ...(currentProducts ?? []).filter((entry) => !priorKeys.has(entry.productKey))];
}

function demandFacts(contract, requirement, matrix) {
  const facts = [];
  for (const field of DEMAND_CONTRACT_FIELDS) facts.push({
    factId: `contract:${field}`, kind: "CONTRACT", expected: stable(contract[field]),
  });
  for (const target of requirement.coreTargets) facts.push({ factId: `target:${target}`, kind: "PAGE_TARGET", expected: target });
  for (const state of requirement.requiredLiveStates) facts.push({ factId: `live-state:${state}`, kind: "LIVE_PAGE_STATE", expected: state });
  for (const state of [...matrix.commonRequiredDerivedStates, ...requirement.childSpecificDerivedStates]) {
    facts.push({ factId: `derived-state:${state}`, kind: "DERIVED_FIXTURE_STATE", expected: state });
  }
  for (const input of requirement.requiredInputRefs) facts.push({ factId: `input:${input}`, kind: "INPUT", expected: input });
  for (const [inputId, descriptor] of Object.entries(requirement.authorizedInputRequirements ?? {})) {
    for (const variant of descriptor.variants) facts.push({
      factId: `authorized-input:${inputId}:${variant.valueHash}`,
      kind: "AUTHORIZED_PRODUCT_VARIANT",
      expected: stable({ inputId, valueHash: variant.valueHash, sourcePaths: variant.sourceBindings.map((entry) => entry.path) }),
    });
  }
  for (const chain of DEMAND_CHAIN_FACTS) facts.push({ factId: `chain:${chain}`, kind: "EVIDENCE_CHAIN", expected: chain });
  for (const path of matrix.authoritySources ?? []) facts.push({
    factId: `authority:${sha256(path)}`,
    kind: "AUTHORITY_SOURCE",
    expected: path,
  });
  assertUnique(facts.map((entry) => entry.factId), "EVIDENCE_DEMAND_FACT_DUPLICATE");
  return facts;
}

function productAuthorizationValues(inputId, source) {
  if (inputId === "authorized-model-id") {
    return [...source.matchAll(/\bmodelDisplayName\s*:\s*["'`]([^"'`]+)["'`]/gu)].map((match) => match[1]);
  }
  if (inputId === "authorized-reasoning-requirement") {
    return [...source.matchAll(/\breasoningRequirement\s*:\s*(?:Object\.freeze\s*\(\s*)?\{([\s\S]{0,1200}?)\}\s*\)?/gu)]
      .flatMap((match) => {
        const selectionPolicy = match[1].match(/\bselectionPolicy\s*:\s*["'`]([^"'`]+)["'`]/u)?.[1];
        const requestedTier = match[1].match(/\brequestedTier\s*:\s*["'`]([^"'`]+)["'`]/u)?.[1];
        return selectionPolicy && requestedTier ? [`${selectionPolicy}:${requestedTier}`] : [];
      });
  }
  return [];
}

async function authorizedInputRequirements(repo, requirement, consumerBinding) {
  const authorizedIds = requirement.requiredInputRefs.filter((id) => id.startsWith("authorized-")).sort();
  const result = {};
  for (const inputId of authorizedIds) {
    const variants = new Map();
    for (const sourceBindingEntry of consumerBinding.files) {
      const source = await readFile(join(repo, sourceBindingEntry.path), "utf8");
      for (const value of productAuthorizationValues(inputId, source)) {
        const valueHash = sha256(value);
        const existing = variants.get(valueHash) ?? { valueHash, sourceBindings: [] };
        existing.sourceBindings.push(sourceBindingEntry);
        variants.set(valueHash, existing);
      }
    }
    if (variants.size === 0) fail("AUTHORIZED_PRODUCT_VARIANT_MISSING", inputId);
    const normalized = [...variants.values()].map((entry) => stable({
      valueHash: entry.valueHash,
      sourceBindings: entry.sourceBindings.sort((left, right) => left.path.localeCompare(right.path)),
    })).sort((left, right) => left.valueHash.localeCompare(right.valueHash));
    result[inputId] = stable({
      sourceKind: "PRODUCT_PROFILE",
      variants: normalized,
      setHash: sha256(JSON.stringify(stable(normalized.map(({ valueHash }) => valueHash)))),
    });
  }
  return stable(result);
}

async function buildChildDemand(repo, contract, requirement, matrix, refs) {
  const implementation = await sourceBinding(repo, refs.webImplementationReferences);
  const consumers = await sourceBinding(repo, refs.productConsumers);
  const authority = await sourceBinding(repo, (matrix.authoritySources ?? []).map((path) => ({ path })));
  const browser = await sourceBinding(repo, [
    ...(matrix.browserSourceBindings?.[contract.childCapabilityId] ?? []),
    ...(requirement.browserImplementationSources ?? []),
  ].map((path) => ({ path })));
  const authorizationRequirements = await authorizedInputRequirements(repo, requirement, consumers);
  const projectedRequirement = stable({ ...requirement, authorizedInputRequirements: authorizationRequirements });
  const facts = demandFacts(contract, projectedRequirement, matrix);
  const payload = stable({
    childCapabilityId: contract.childCapabilityId,
    contract: stable({ ...contract }),
    collectionRequirement: projectedRequirement,
    facts,
    implementationSemanticDigest: implementation.semanticDigest,
    productConsumerSemanticDigest: consumers.semanticDigest,
    authoritySemanticDigest: authority.semanticDigest,
    browserSemanticDigest: browser.semanticDigest,
  });
  const digest = sha256(JSON.stringify(payload));
  const pageDemand = stable({
    childCapabilityId: contract.childCapabilityId,
    coreTargets: requirement.coreTargets,
    requiredLiveStates: requirement.requiredLiveStates,
    optionalLiveStates: requirement.optionalLiveStates,
    liveStateTargets: requirement.liveStateTargets,
    stateAssertions: requirement.stateAssertions,
    requiredDerivedStates: [...matrix.commonRequiredDerivedStates, ...requirement.childSpecificDerivedStates],
  });
  return stable({
    schemaVersion: "gpt-page-operation-demand.v2",
    facts,
    digest,
    projectionDigest: digest,
    pageDemandDigest: sha256(JSON.stringify(pageDemand)),
    childCandidateDigest: digest,
    authorizedInputRequirements: authorizationRequirements,
    sourceBinding: { implementation, consumers, authority, browser },
  });
}

async function loadContracts(repo) {
  const contractPath = join(repo, "src/capabilities/gpt/contract.ts");
  const module = await import(`${pathToFileURL(contractPath).href}?evidence=${Date.now()}`);
  const ids = [...module.GPT_CHILD_CAPABILITY_IDS];
  const contracts = module.GPT_CHILD_CAPABILITY_CONTRACTS;
  assertUnique(ids, "CONTRACT_CHILD_DUPLICATE");
  for (const id of ids) {
    if (!contracts[id] || contracts[id].childCapabilityId !== id) fail("CONTRACT_ENTRY_INVALID", id);
  }
  return { ids, contracts };
}

function lineNumbers(text, needle) {
  const lines = text.split("\n");
  const result = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index].includes(needle)) result.push(index + 1);
  }
  return result;
}

async function collectReferences(repo, ids) {
  const gptRoot = join(repo, "src/capabilities/gpt");
  const pluginRoot = join(repo, "src/plugins");
  const gptFiles = await walkFiles(gptRoot, (path) => path.endsWith(".ts"));
  const pluginFiles = await walkFiles(pluginRoot, (path) => path.endsWith(".ts"));
  const sourceRefs = Object.fromEntries(ids.map((id) => [id, []]));
  const productConsumers = Object.fromEntries(ids.map((id) => [id, []]));
  const webImplementationRefs = Object.fromEntries(ids.map((id) => [id, []]));
  const pageChildIds = new Set();
  for (const id of ids) {
    const handlerPath = join(gptRoot, "children", id, "handler.ts");
    if (await isFile(handlerPath) && (await readFile(handlerPath, "utf8")).includes("requireBrowser(")) pageChildIds.add(id);
  }

  for (const file of gptFiles) {
    const text = await readFile(file, "utf8");
    const repoPath = relative(repo, file).split(sep).join("/");
    for (const id of ids) {
      const lines = lineNumbers(text, id);
      const isolatedChildFile = repoPath.startsWith(`src/capabilities/gpt/children/${id}/`);
      if (lines.length === 0 && !isolatedChildFile) continue;
      sourceRefs[id].push({ path: repoPath, lines });
      const isolatedPageChild = isolatedChildFile && pageChildIds.has(id);
      if (repoPath.startsWith("src/capabilities/gpt/web/") || isolatedPageChild) {
        webImplementationRefs[id].push({ path: repoPath, lines });
      }
    }
  }

  for (const file of pluginFiles) {
    const text = await readFile(file, "utf8");
    const repoPath = relative(repo, file).split(sep).join("/");
    const consumer = repoPath.split("/")[2] ?? repoPath;
    for (const id of ids) {
      if (!text.includes(id)) continue;
      const lines = lineNumbers(text, id);
      productConsumers[id].push({ consumer, path: repoPath, lines });
    }
  }

  const pluginProfileFiles = pluginFiles.map((file) => ({
    file,
    path: relative(repo, file).split(sep).join("/"),
  }));
  for (const id of ids) {
    const consumerRoots = new Set(productConsumers[id].map((entry) => entry.path.split("/").slice(0, 3).join("/")));
    for (const entry of pluginProfileFiles.filter((candidate) =>
      consumerRoots.has(candidate.path.split("/").slice(0, 3).join("/")))) {
      const text = await readFile(entry.file, "utf8");
      if (!/\b(?:modelDisplayName|reasoningRequirement)\s*:/u.test(text)) continue;
      if (productConsumers[id].some((consumer) => consumer.path === entry.path)) continue;
      productConsumers[id].push({
        consumer: entry.path.split("/")[2] ?? entry.path,
        path: entry.path,
        lines: [
          ...lineNumbers(text, "modelDisplayName"),
          ...lineNumbers(text, "reasoningRequirement"),
        ].sort((left, right) => left - right),
      });
    }
    productConsumers[id].sort((left, right) => left.path.localeCompare(right.path));
  }

  return { sourceRefs, productConsumers, webImplementationRefs };
}

function validatePageOperationDenominator(ids, contracts, matrix, sourceRefs, webImplementationRefs) {
  const contractPageIds = ids.filter((id) => contracts[id].requiredTargetKind !== "none");
  const contractNoPageIds = ids.filter((id) => contracts[id].requiredTargetKind === "none");
  const matrixIds = matrix.children.map((child) => child.childCapabilityId);
  const missingFromMatrix = contractPageIds.filter((id) => !matrixIds.includes(id));
  const unexpectedInMatrix = matrixIds.filter((id) => !contractPageIds.includes(id));
  if (missingFromMatrix.length || unexpectedInMatrix.length) {
    fail("PAGE_OPERATION_MATRIX_DRIFT", `missing=${missingFromMatrix.join(",")};unexpected=${unexpectedInMatrix.join(",")}`);
  }
  const missingWebImplementation = contractPageIds.filter((id) => webImplementationRefs[id].length === 0);
  const forbiddenWebImplementation = contractNoPageIds.filter((id) => webImplementationRefs[id].length > 0);
  const missingIsolatedHandler = ids.filter((id) => !sourceRefs[id]
    .some((entry) => entry.path === `src/capabilities/gpt/children/${id}/handler.ts`));
  if (missingWebImplementation.length || forbiddenWebImplementation.length || missingIsolatedHandler.length) {
    fail("PAGE_OPERATION_CONTRACT_IMPLEMENTATION_MISMATCH", `missingWeb=${missingWebImplementation.join(",")};noPageInWeb=${forbiddenWebImplementation.join(",")};missingHandler=${missingIsolatedHandler.join(",")}`);
  }
  if (ids.length !== matrix.currentContractCount || contractPageIds.length !== matrix.expectedPageOperationCount) {
    fail("PAGE_OPERATION_DENOMINATOR_MISMATCH", `contracts=${ids.length};page=${contractPageIds.length}`);
  }
  return { contractPageIds, contractNoPageIds };
}

function summarizeConsumers(productConsumers, pageIds) {
  return [...new Set(pageIds.flatMap((id) => productConsumers[id].map((entry) => entry.consumer)))].sort();
}

async function buildInventory(repo, matrixPath) {
  const matrix = await loadMatrix(matrixPath);
  const { ids, contracts } = await loadContracts(repo);
  const references = await collectReferences(repo, ids);
  const denominator = validatePageOperationDenominator(
    ids, contracts, matrix, references.sourceRefs, references.webImplementationRefs,
  );
  const matrixById = Object.fromEntries(matrix.children.map((entry) => [entry.childCapabilityId, entry]));
  const pageSet = new Set(denominator.contractPageIds);
  const children = [];
  for (const id of ids) {
    const requirement = matrixById[id] ?? null;
    const evidenceDemand = requirement ? await buildChildDemand(repo, contracts[id], requirement, matrix, {
      webImplementationReferences: references.webImplementationRefs[id],
      productConsumers: references.productConsumers[id],
    }) : null;
    children.push({
      childCapabilityId: id,
      contractVersion: contracts[id].contractVersion,
      pageOperationRequired: pageSet.has(id),
      inclusionBasis: pageSet.has(id)
        ? "requiredTargetKind is not none and the isolated Child implementation requires Browser page authority"
        : "requiredTargetKind is none and the isolated Child implementation does not require Browser page authority",
      contract: stable({ ...contracts[id] }),
      sourceReferences: references.sourceRefs[id],
      webImplementationReferences: references.webImplementationRefs[id],
      productConsumers: references.productConsumers[id],
      collectionRequirements: requirement,
      evidenceDemand,
    });
  }
  const projectionRevision = sha256(JSON.stringify(stable(children.filter((child) => child.pageOperationRequired)
    .map((child) => [child.childCapabilityId, child.evidenceDemand.projectionDigest])
    .sort((left, right) => left[0].localeCompare(right[0])))));

  const products = await buildProductInventory(repo);
  return {
    schemaVersion: REPORT_SCHEMA,
    projectionRevision,
    captureEpoch: null,
    matrixBinding: { schemaVersion: matrix.schemaVersion, digest: sha256(JSON.stringify(stable(matrix))) },
    captureStatus: "NOT_CAPTURED",
    denominator: {
      rule: matrix.scopeRule,
      contractChildren: ids.length,
      pageOperationChildren: denominator.contractPageIds.length,
      nonPageChildren: denominator.contractNoPageIds.length,
      pageOperationChildIds: denominator.contractPageIds,
      nonPageChildIds: denominator.contractNoPageIds
    },
    productConsumers: summarizeConsumers(references.productConsumers, denominator.contractPageIds),
    products,
    captureMetadata: null,
    children
  };
}

function nonEmptyObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 0;
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function sha256String(value) {
  return typeof value === "string" && /^sha256:[a-f0-9]{64}$/.test(value);
}

function exactObjectKeys(value, keys) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
    && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
}

function decisionReceiptValid(receipt) {
  if (receipt === null) return true;
  if (receipt?.kind === "ALREADY_SATISFIED") return exactObjectKeys(receipt, ["kind"]);
  return receipt?.kind === "ACTION_REQUIRED"
    && exactObjectKeys(receipt, ["kind", "actionId", "operation"])
    && nonEmptyString(receipt.actionId) && nonEmptyString(receipt.operation);
}

function transitionReceiptValid(receipt) {
  return receipt === null || (exactObjectKeys(receipt, ["actionId", "operation", "issuedAt", "completedAt",
    "outcome", "preSceneId", "preSceneSignature", "postconditionPassed"])
    && nonEmptyString(receipt.actionId) && nonEmptyString(receipt.operation)
    && receipt.outcome === "DISPATCH_RETURNED" && nonEmptyString(receipt.preSceneId)
    && sha256String(receipt.preSceneSignature) && typeof receipt.postconditionPassed === "boolean"
    && Number.isFinite(Date.parse(receipt.issuedAt)) && Number.isFinite(Date.parse(receipt.completedAt))
    && Date.parse(receipt.completedAt) >= Date.parse(receipt.issuedAt));
}

function captureMetadataValid(capture) {
  const browser = capture?.browser;
  const environment = capture?.environment;
  const trigger = capture?.recaptureTrigger;
  const browserValid = exactObjectKeys(browser, ["family", "version", "controlSkill", "dedicatedQaTab",
    "qaTabCreatedByRun", "livePageObserved", "productionBrowserIdleEvidence", "qaTabIdentityHash"])
    && exactObjectKeys(browser.productionBrowserIdleEvidence, ["observed"])
    && browser.productionBrowserIdleEvidence.observed === true
    && String(browser.family).toLowerCase() === "chrome"
    && nonEmptyString(browser.version)
    && browser.controlSkill === "chrome:control-chrome"
    && browser.dedicatedQaTab === true && browser.qaTabCreatedByRun === true
    && browser.livePageObserved === true && sha256String(browser.qaTabIdentityHash);
  const environmentValid = exactObjectKeys(environment, ["locale", "viewport", "theme", "providerBuildMarker"])
    && exactObjectKeys(environment.viewport, ["width", "height"])
    && Number.isFinite(environment.viewport.width) && environment.viewport.width > 0
    && Number.isFinite(environment.viewport.height) && environment.viewport.height > 0
    && nonEmptyString(environment.locale) && nonEmptyString(environment.theme)
    && nonEmptyString(environment.providerBuildMarker);
  const triggerValid = trigger?.kind === "HUMAN_REQUESTED_RECAPTURE"
    ? exactObjectKeys(trigger, ["kind", "scope", "requestedAt"])
      && Array.isArray(trigger.scope) && trigger.scope.length > 0 && trigger.scope.every(nonEmptyString)
      && Number.isFinite(Date.parse(trigger.requestedAt))
    : trigger?.kind === "PAGE_EVIDENCE_CONFLICT_CONFIRMED"
      && exactObjectKeys(trigger, ["kind", "affectedSceneIds", "sameIncidentEvidence"])
      && exactObjectKeys(trigger.sameIncidentEvidence, ["codeEvidenceHash", "logEvidenceHash", "pageReadbackHash"])
      && Array.isArray(trigger.affectedSceneIds) && trigger.affectedSceneIds.length > 0
      && trigger.affectedSceneIds.every(nonEmptyString)
      && [trigger.sameIncidentEvidence.codeEvidenceHash, trigger.sameIncidentEvidence.logEvidenceHash,
        trigger.sameIncidentEvidence.pageReadbackHash].every(sha256String);
  return browserValid && environmentValid && triggerValid;
}

function rawSceneMetadataValid(scene) {
  return exactObjectKeys(scene, ["sceneId", "capturedAt", "stateSignature", "activeTabIdentityHash",
    "documentIdentityHash", "observationRevisionHash", "binding", "transitionReceipt", "decisionReceipt", "envelopeHash"])
    && exactObjectKeys(scene.binding, ["runId", "captureEpoch", "qaTabIdentityHash"])
    && decisionReceiptValid(scene.decisionReceipt) && transitionReceiptValid(scene.transitionReceipt)
    && (scene.transitionReceipt === null
      || Date.parse(scene.capturedAt) >= Date.parse(scene.transitionReceipt.completedAt));
}

function publicSceneMetadataValid(scene) {
  return exactObjectKeys(scene, ["sceneId", "capturedAt", "stateSignature", "activeTabIdentityHash",
    "documentIdentityHash", "observationRevisionHash", "binding", "transitionReceipt", "decisionReceipt",
    "sourceEnvelopeHash", "envelopeHash"])
    && exactObjectKeys(scene.binding, ["runId", "captureEpoch", "qaTabIdentityHash"])
    && sha256String(scene.sourceEnvelopeHash)
    && decisionReceiptValid(scene.decisionReceipt) && transitionReceiptValid(scene.transitionReceipt)
    && (scene.transitionReceipt === null
      || Date.parse(scene.capturedAt) >= Date.parse(scene.transitionReceipt.completedAt));
}

function authorizedInputDescriptorValid(descriptor) {
  if (!exactObjectKeys(descriptor, ["kind", "sourceKind", "variants", "setHash"])
    || descriptor.kind !== "AUTHORIZED_FACT_SET" || descriptor.sourceKind !== "PRODUCT_PROFILE"
    || !sha256String(descriptor.setHash) || !Array.isArray(descriptor.variants)
    || descriptor.variants.length === 0) return false;
  for (const variant of descriptor.variants) {
    if (!exactObjectKeys(variant, ["valueHash", "sourceBindings"]) || !sha256String(variant.valueHash)
      || !Array.isArray(variant.sourceBindings) || variant.sourceBindings.length === 0
      || variant.sourceBindings.some((binding) => !exactObjectKeys(binding,
        ["path", "contentHash", "semanticHash"])
        || !nonEmptyString(binding.path) || !sha256String(binding.contentHash)
        || !sha256String(binding.semanticHash))) return false;
  }
  const normalized = descriptor.variants.map((variant) => variant.valueHash).sort();
  return new Set(normalized).size === normalized.length
    && descriptor.setHash === sha256(JSON.stringify(stable(normalized)));
}

function chainInputDescriptorValid(descriptor, expectedSource = null) {
  if (descriptor?.kind === "MISSING_PRIOR_CHILD_OUTPUT") {
    return exactObjectKeys(descriptor, ["kind", "sourceChildCapabilityId"])
      && nonEmptyString(descriptor.sourceChildCapabilityId)
      && (expectedSource === null || descriptor.sourceChildCapabilityId === expectedSource);
  }
  return exactObjectKeys(descriptor, ["kind", "sourceChildCapabilityId", "sourceDemandDigest",
    "sourceChildCandidateDigest", "evidenceRef", "observationId", "observationSignature", "sha256"])
    && descriptor.kind === "PRIOR_CHILD_OUTPUT"
    && nonEmptyString(descriptor.sourceChildCapabilityId)
    && (expectedSource === null || descriptor.sourceChildCapabilityId === expectedSource)
    && nonEmptyString(descriptor.evidenceRef) && nonEmptyString(descriptor.observationId)
    && sha256String(descriptor.sourceDemandDigest) && sha256String(descriptor.sourceChildCandidateDigest)
    && sha256String(descriptor.observationSignature) && sha256String(descriptor.sha256)
    && descriptor.sha256 === sha256(descriptor.evidenceRef)
    && descriptor.evidenceRef === `${descriptor.sourceChildCapabilityId}:${descriptor.sourceChildCandidateDigest}:${descriptor.observationId}:${descriptor.observationSignature}`;
}

const authorizedInputsProjectionValid = (value) => Boolean(value) && typeof value === "object"
  && !Array.isArray(value) && Object.entries(value).every(([id, descriptor]) =>
    nonEmptyString(id) && authorizedInputDescriptorValid(descriptor));
const chainInputsProjectionValid = (value) => Boolean(value) && typeof value === "object"
  && !Array.isArray(value) && Object.entries(value).every(([id, descriptor]) =>
    nonEmptyString(id) && chainInputDescriptorValid(descriptor));

function publicCaptureContextValid(context) {
  return exactObjectKeys(context, ["schemaVersion", "capturedAt", "runId", "captureEpoch",
    "recaptureTrigger", "matrixDigest", "browser", "environment", "authorizedInputs", "chainInputs",
    "sceneManifest"])
    && context.schemaVersion === CAPTURE_SCHEMA
    && nonEmptyString(context.capturedAt) && Number.isFinite(Date.parse(context.capturedAt))
    && sha256String(context.runId) && sha256String(context.captureEpoch) && sha256String(context.matrixDigest)
    && captureMetadataValid(context)
    && authorizedInputsProjectionValid(context.authorizedInputs)
    && chainInputsProjectionValid(context.chainInputs)
    && Array.isArray(context.sceneManifest) && context.sceneManifest.length > 0
    && context.sceneManifest.every((scene) => publicSceneMetadataValid(scene)
      && scene.binding.runId === context.runId
      && scene.binding.captureEpoch === context.captureEpoch
      && scene.binding.qaTabIdentityHash === context.browser.qaTabIdentityHash
      && scene.activeTabIdentityHash === context.browser.qaTabIdentityHash);
}

function terminalProofValid(source) {
  const proof = source?.terminalBranchProof;
  if (source?.flowStatus === "PARTIAL") return proof === null;
  if (source?.terminalBranch !== "production-failure") {
    return exactObjectKeys(proof, ["kind", "receiptHash", "resultPayloadHash", "resultObjectReceiptHash",
      "resultPayloadOutboxHash"])
      && proof.kind === "DURABLE_COMPLETION_RECEIPT"
      && [proof.receiptHash, proof.resultPayloadHash, proof.resultObjectReceiptHash,
        proof.resultPayloadOutboxHash].every(sha256String);
  }
  const failedTraceIds = new Set((source.actualTrace ?? [])
    .filter((entry) => entry?.resultStatus === "failed").map((entry) => entry.traceEntryId));
  return exactObjectKeys(proof, ["kind", "failedTraceEntryId", "terminalSource", "durableFailureReceiptHash",
    "durableFailureCodeHash", "traceFailureCodeHash", "codeRelation", "childCorrelation", "evidenceCorrelation"])
    && proof.kind === "DURABLE_FAILURE_AND_TRACE_TERMINAL"
    && failedTraceIds.has(proof.failedTraceEntryId)
    && ["ATTEMPT_FAILURE_ROW", "CURRENT_TASK_ROW"].includes(proof.terminalSource)
    && sha256String(proof.durableFailureReceiptHash)
    && (proof.durableFailureCodeHash === null || sha256String(proof.durableFailureCodeHash))
    && (proof.traceFailureCodeHash === null || sha256String(proof.traceFailureCodeHash))
    && ["EXACT", "PRODUCT_FAILURE_WRAPS_TRACE_FAILURE"].includes(proof.codeRelation)
    && ["MATCHED", "NOT_DECLARED"].includes(proof.childCorrelation)
    && ["MATCHED", "NOT_DECLARED"].includes(proof.evidenceCorrelation);
}

function valueAtPath(root, path) {
  if (!nonEmptyString(path)) return undefined;
  return path.split(".").reduce((value, part) => {
    if (value === null || value === undefined || typeof value !== "object") return undefined;
    return value[part];
  }, root);
}

function valuePresent(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

function observedStateSignature(specimen) {
  return sha256(JSON.stringify(stable({
    sceneSignature: specimen.sourceSceneSignature,
    url: specimen.peripheral?.sanitizedUrlIdentity,
    targets: specimen.core?.targets,
  })));
}

function specimenShapeMissing(specimen, capture, liveObservationIds, childRecord, requirements, liveSpecimensByObservation) {
  const missing = [];
  const transitionObservationIds = new Set([
    ...liveObservationIds,
    ...((capture.sceneManifest ?? [])
      .map((scene) => `${childRecord.childCapabilityId}:${scene.sceneId}:live`)),
  ]);
  const mark = (condition, field) => { if (!condition) missing.push(`SHAPE:${specimen.stateId ?? "missing"}:${field}`); };
  mark(nonEmptyString(specimen.stateId), "stateId");
  mark(["LIVE_PAGE", "DERIVED_FIXTURE"].includes(specimen.evidenceKind), "evidenceKind");
  mark(nonEmptyString(specimen.capturedAt) && Number.isFinite(Date.parse(specimen.capturedAt)), "capturedAt");
  if (specimen.evidenceKind === "DERIVED_FIXTURE") {
    mark(nonEmptyString(specimen.derivedFromObservationId), "derivedFromObservationId");
    if (nonEmptyString(specimen.derivedFromObservationId)) {
      mark(liveObservationIds.has(specimen.derivedFromObservationId), "derivedFromObservationIdNotLive");
    }
    mark(nonEmptyObject(specimen.mutation), "mutation");
    if (nonEmptyObject(specimen.mutation)) {
      mark(nonEmptyString(specimen.mutation.kind), "mutation.kind");
    mark(Array.isArray(specimen.mutation.changes) && specimen.mutation.changes.length === 1,
        "mutation.changes");
      const change = specimen.mutation.changes?.[0];
      const source = liveSpecimensByObservation?.[specimen.derivedFromObservationId];
      mark(Boolean(source) && nonEmptyString(change?.path) && sha256String(change?.fromHash)
        && sha256String(change?.toValueHash) && change.fromHash !== change.toValueHash
        && change.fromHash === sha256(JSON.stringify(stable(valueAtPath(source, change.path)))), "mutation.change");
    }
    mark(nonEmptyString(specimen.expectedFailureCode), "expectedFailureCode");
    return missing;
  }
  mark(nonEmptyObject(specimen.core), "core");
  mark(nonEmptyObject(specimen.related), "related");
  mark(nonEmptyObject(specimen.peripheral), "peripheral");
  if (!nonEmptyObject(specimen.core) || !nonEmptyObject(specimen.related) || !nonEmptyObject(specimen.peripheral)) return missing;

  mark(nonEmptyObject(specimen.core.normalizedStructure), "core.normalizedStructure");
  mark(nonEmptyString(specimen.core.sanitizedOuterHtml), "core.sanitizedOuterHtml");
  mark(specimen.core.attributes && typeof specimen.core.attributes === "object" && !Array.isArray(specimen.core.attributes), "core.attributes");
  mark(nonEmptyObject(specimen.core.computedStyle), "core.computedStyle");
  mark(typeof specimen.core.connected === "boolean", "core.connected");
  mark(nonEmptyObject(specimen.core.layout), "core.layout");
  mark(nonEmptyObject(specimen.core.scope), "core.scope");
  mark(Array.isArray(specimen.core.candidates), "core.candidates");
  mark(nonEmptyObject(specimen.core.targets), "core.targets");
  mark(nonEmptyObject(specimen.core.textProjection), "core.textProjection");
  mark(nonEmptyObject(specimen.core.actionQualification), "core.actionQualification");
  if (nonEmptyObject(specimen.core.targets)) {
    for (const target of requirements.liveStateTargets?.[specimen.stateId] ?? []) {
      const observedTarget = specimen.core.targets[target];
      mark(nonEmptyObject(observedTarget), `core.targets.${target}`);
      if (nonEmptyObject(observedTarget)) {
        mark(observedTarget.observed === true, `core.targets.${target}.observed`);
        mark(sha256String(observedTarget.identityHash), `core.targets.${target}.identityHash`);
        mark(Number.isInteger(observedTarget.nodeIndex) && observedTarget.nodeIndex >= 0,
          `core.targets.${target}.nodeIndex`);
        mark(nonEmptyString(observedTarget.sourceSceneId), `core.targets.${target}.sourceSceneId`);
        mark(sha256String(observedTarget.sourceSceneSignature), `core.targets.${target}.sourceSceneSignature`);
        mark(nonEmptyObject(observedTarget.attributes), `core.targets.${target}.attributes`);
      }
    }
  }
  if (specimen.core.attributes && typeof specimen.core.attributes === "object" && !Array.isArray(specimen.core.attributes)) {
    const unsafeAttributes = Object.keys(specimen.core.attributes).filter((key) => !/^(?:id|class|data-testid|data-message-author-role|data-state|role|aria-[a-z0-9_-]+|disabled|hidden|inert|type|tabindex|contenteditable|accept|multiple|kind|count|setHash|conversation)$/i.test(key));
    if (unsafeAttributes.length > 0) missing.push(`SHAPE:${specimen.stateId}:core.attributes.unsafe=${unsafeAttributes.join(",")}`);
  }
  if (nonEmptyObject(specimen.core.scope) && Array.isArray(specimen.core.candidates)) {
    mark(Number.isInteger(specimen.core.scope.candidateCount), "core.scope.candidateCount");
    if (Number.isInteger(specimen.core.scope.candidateCount)) {
      mark(specimen.core.scope.candidateCount === specimen.core.candidates.length, "core.scope.candidateCountMismatch");
    }
    for (const [index, candidate] of specimen.core.candidates.entries()) {
      mark(nonEmptyObject(candidate), `core.candidates[${index}]`);
      if (nonEmptyObject(candidate)) {
        mark(typeof candidate.qualified === "boolean", `core.candidates[${index}].qualified`);
        mark(Array.isArray(candidate.rejectionReasons), `core.candidates[${index}].rejectionReasons`);
        mark(sha256String(candidate.identityHash), `core.candidates[${index}].identityHash`);
      }
    }
  }
  if (nonEmptyObject(specimen.core.textProjection)) {
    const text = specimen.core.textProjection;
    mark(["ALLOWLISTED_UI", "HASH_ONLY"].includes(text.kind), "core.textProjection.kind");
    mark(sha256String(text.sha256), "core.textProjection.sha256");
    mark(Number.isInteger(text.length) && text.length >= 0, "core.textProjection.length");
    if (text.kind === "HASH_ONLY") mark(text.value === undefined, "core.textProjection.valueForbidden");
    if (text.kind === "ALLOWLISTED_UI") {
      mark(typeof text.value === "string", "core.textProjection.value");
      if (typeof text.value === "string") {
        mark(text.length === text.value.length, "core.textProjection.lengthMismatch");
        mark(text.sha256 === sha256(text.value), "core.textProjection.hashMismatch");
      }
    }
  }

  mark(Array.isArray(specimen.related.ancestors), "related.ancestors");
  mark(Array.isArray(specimen.related.siblings), "related.siblings");
  mark(Array.isArray(specimen.related.linkedNodes), "related.linkedNodes");
  if (Array.isArray(specimen.related.ancestors) && Array.isArray(specimen.related.siblings)
    && Array.isArray(specimen.related.linkedNodes)) {
    mark(specimen.related.ancestors.length + specimen.related.siblings.length
      + specimen.related.linkedNodes.length > 0, "related.contextRelationsEmpty");
  }
  mark(nonEmptyObject(specimen.related.beforeAfterDiff), "related.beforeAfterDiff");
  mark(nonEmptyObject(specimen.related.contractReference), "related.contractReference");
  mark(Array.isArray(specimen.related.sourceReferences) && specimen.related.sourceReferences.length > 0, "related.sourceReferences");
  mark(nonEmptyObject(specimen.related.postconditions), "related.postconditions");
  mark(nonEmptyObject(specimen.related.browserCommand), "related.browserCommand");
  mark(nonEmptyObject(specimen.related.walProjection), "related.walProjection");
  mark(nonEmptyObject(specimen.related.transitionChain), "related.transitionChain");
  if (nonEmptyObject(specimen.related.contractReference)) {
    mark(specimen.related.contractReference.childCapabilityId === childRecord.childCapabilityId,
      "related.contractReference.childCapabilityId");
    mark(specimen.related.contractReference.contractVersion === childRecord.contractVersion,
      "related.contractReference.contractVersion");
  }
  if (Array.isArray(specimen.related.sourceReferences)) {
    const referencedPaths = specimen.related.sourceReferences.map((entry) => entry?.path);
    mark(referencedPaths.every(nonEmptyString), "related.sourceReferences.path");
    mark(new Set(referencedPaths).size === referencedPaths.length, "related.sourceReferences.duplicatePath");
  }

  mark(nonEmptyString(specimen.peripheral.pageKind), "peripheral.pageKind");
  mark(nonEmptyString(specimen.peripheral.sanitizedUrlIdentity), "peripheral.sanitizedUrlIdentity");
  mark(nonEmptyString(specimen.peripheral.locale), "peripheral.locale");
  mark(nonEmptyObject(specimen.peripheral.viewport), "peripheral.viewport");
  mark(nonEmptyString(specimen.peripheral.theme), "peripheral.theme");
  mark(nonEmptyString(specimen.peripheral.chromeVersion), "peripheral.chromeVersion");
  mark(nonEmptyString(specimen.peripheral.providerBuildMarker), "peripheral.providerBuildMarker");
  mark(nonEmptyObject(specimen.peripheral.uiVariant), "peripheral.uiVariant");
  mark(nonEmptyObject(specimen.peripheral.pageState), "peripheral.pageState");
  mark(nonEmptyString(specimen.peripheral.runId), "peripheral.runId");

  if (specimen.evidenceKind === "LIVE_PAGE") {
    mark(nonEmptyString(specimen.observationId), "observationId");
    mark(sha256String(specimen.documentIdentityHash), "documentIdentityHash");
    mark(sha256String(specimen.targetIdentityHash), "targetIdentityHash");
    mark(typeof specimen.revision === "string" || Number.isInteger(specimen.revision), "revision");
    mark(nonEmptyObject(specimen.stateFacts), "stateFacts");
    mark(sha256String(specimen.stateSignature), "stateSignature");
    mark(specimen.stateSignature === observedStateSignature(specimen), "stateSignatureMismatch");
    mark(nonEmptyString(specimen.sourceSceneId), "sourceSceneId");
    mark(sha256String(specimen.sourceSceneSignature), "sourceSceneSignature");
    const sourceScene = (capture.sceneManifest ?? []).find((entry) => entry?.sceneId === specimen.sourceSceneId);
    mark(sourceScene?.binding?.runId === specimen.peripheral.runId, "peripheral.runIdSceneBinding");
    mark(sourceScene?.documentIdentityHash === specimen.documentIdentityHash, "documentIdentityHashMismatch");
    mark(sourceScene?.observationRevisionHash === specimen.revision, "observationRevisionHashMismatch");
    if (nonEmptyObject(specimen.related.transitionChain)) {
      const chain = specimen.related.transitionChain;
      mark(nonEmptyString(chain.preObservationId), "related.transitionChain.preObservationId");
      mark(nonEmptyString(chain.postObservationId), "related.transitionChain.postObservationId");
      if (nonEmptyString(chain.preObservationId)) mark(transitionObservationIds.has(chain.preObservationId), "related.transitionChain.preObservationNotLive");
      if (nonEmptyString(chain.postObservationId)) mark(transitionObservationIds.has(chain.postObservationId), "related.transitionChain.postObservationNotLive");
      mark(nonEmptyObject(chain.typedCommand), "related.transitionChain.typedCommand");
      mark(nonEmptyObject(chain.terminalReceipt), "related.transitionChain.terminalReceipt");
      mark(nonEmptyObject(chain.directPostcondition), "related.transitionChain.directPostcondition");
      if (childRecord.contract.profile === "DOM_OBSERVATION") {
        mark(chain.typedCommand.kind === "NOT_APPLICABLE", "related.transitionChain.observationCommandKind");
        mark(chain.terminalReceipt.kind === "NOT_APPLICABLE", "related.transitionChain.observationReceiptKind");
      } else {
        mark(["CAPTURED_BROWSER_COMMAND", "ZERO_ACTION"].includes(chain.typedCommand.kind),
          "related.transitionChain.actionCommandKind");
        mark(["CAPTURED_DISPATCH_RETURN", "COHERENT_READBACK"].includes(chain.terminalReceipt.kind),
          "related.transitionChain.actionReceiptKind");
        mark(typeof chain.directPostcondition.passed === "boolean",
          "related.transitionChain.directPostcondition");
        const observationScene = (observationId) => {
          const observed = liveSpecimensByObservation?.[observationId];
          return observed ? (capture.sceneManifest ?? []).find((entry) => entry?.sceneId === observed.sourceSceneId) : null;
        };
        if (chain.typedCommand.kind === "CAPTURED_BROWSER_COMMAND") {
          const preScene = observationScene(chain.preObservationId);
          const postScene = observationScene(chain.postObservationId);
          const receipt = postScene?.transitionReceipt;
          mark(Boolean(preScene && postScene && receipt?.outcome === "DISPATCH_RETURNED"
            && preScene.stateSignature === receipt.preSceneSignature
            && preScene.decisionReceipt?.kind === "ACTION_REQUIRED"
            && preScene.decisionReceipt?.actionId === chain.typedCommand.actionId
            && preScene.decisionReceipt?.operation === chain.typedCommand.operation
            && receipt.actionId === chain.typedCommand.actionId
            && receipt.operation === chain.typedCommand.operation
            && receipt.postconditionPassed === chain.directPostcondition.passed
            && chain.terminalReceipt.actionId === chain.typedCommand.actionId
            && chain.terminalReceipt.operation === chain.typedCommand.operation
            && chain.terminalReceipt.preSceneSignature === preScene.stateSignature
            && chain.directPostcondition.sourceSceneId === postScene.sceneId
            && chain.directPostcondition.sourceSceneSignature === postScene.stateSignature),
          "related.transitionChain.receiptLinkage");
          if (childRecord.contract.allowedDocumentTransition === "forbidden") {
            mark(preScene?.documentIdentityHash === postScene?.documentIdentityHash,
              "related.transitionChain.forbiddenDocumentTransition");
          }
        }
      }
    }
  } else {
    mark(specimen.peripheral.runId === capture.runId, "peripheral.runIdCaptureBinding");
  }
  return missing;
}

function scanCapturePrivacy(value, path = "capture") {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanCapturePrivacy(entry, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (FORBIDDEN_CAPTURE_KEYS.test(key)) fail("CAPTURE_SECRET_FIELD_FORBIDDEN", `${path}.${key}`);
      if (FORBIDDEN_PLAINTEXT_KEYS.test(key)) fail("CAPTURE_PLAINTEXT_FIELD_FORBIDDEN", `${path}.${key}`);
      scanCapturePrivacy(child, `${path}.${key}`);
    }
    return;
  }
  if (typeof value === "string" && RAW_CONVERSATION_PATH.test(value)) {
    fail("CAPTURE_RAW_CONVERSATION_ID_FORBIDDEN", path);
  }
  if (typeof value === "string" && FORBIDDEN_CAPTURE_VALUE.test(value)) {
    fail("CAPTURE_SECRET_VALUE_FORBIDDEN", path);
  }
}

function assertNoRepositoryCandidateBinding(value, path = "report") {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoRepositoryCandidateBinding(entry, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (["candidateBinding", "worktreeDigest", "gitHead", "headCommit"].includes(key)) {
      fail("REPORT_GIT_BINDING_FORBIDDEN", `${path}.${key}`);
    }
    assertNoRepositoryCandidateBinding(child, `${path}.${key}`);
  }
}

function exactStringSet(actual, expected) {
  return Array.isArray(actual)
    && actual.every(nonEmptyString)
    && new Set(actual).size === actual.length
    && JSON.stringify([...new Set(actual)].sort()) === JSON.stringify([...new Set(expected)].sort());
}

const publicTraceEntry = (entry) => stable({
  traceEntryId: entry.traceEntryId,
  productStepId: entry.productStepId,
  capabilityCallId: entry.capabilityCallId,
  callId: entry.callId,
  actionOrdinal: entry.actionOrdinal,
  childId: entry.childId,
  exactCallIdentityHash: entry.exactCallIdentityHash,
  resultStatus: entry.resultStatus,
  failureCode: entry.failureCode ?? null,
  mutationOutcome: entry.mutationOutcome ?? null,
  postconditionResult: entry.postconditionResult ?? null,
  candidateCardinality: entry.candidateCardinality ?? null,
  observationRevisionHash: entry.observationRevisionHash ?? null,
  evidenceHash: entry.evidenceHash ?? null,
  inputBinding: entry.inputBinding,
  browserReceiptHashes: entry.browserReceiptHashes
    ?? (entry.browserReceipts ?? []).map((receipt) => sha256(JSON.stringify(stable(receipt)))),
});

function publicProductionSource(source) {
  const taskBinding = stable({
    requestHash: source.taskBinding?.requestHash,
    taskEnvelopeHash: source.taskBinding?.taskEnvelopeHash,
    businessContextHash: source.taskBinding?.businessContextHash,
    productId: source.taskBinding?.productId,
    actionId: source.taskBinding?.actionId,
    parametersHash: source.taskBinding?.parametersHash,
    resultContractId: source.taskBinding?.resultContractId,
    resultContractVersion: source.taskBinding?.resultContractVersion,
  });
  const materials = (source.materials ?? []).map((material) => stable({
    ordinal: material.ordinal,
    role: material.role,
    bytes: material.bytes,
    sha256: material.sha256,
    mediaType: material.mediaType,
    storageClass: material.storageClass,
  }));
  const actualTrace = (source.actualTrace ?? []).map(publicTraceEntry);
  const reportInputs = Object.fromEntries(Object.entries(source.reportInputs ?? {}).map(([id, descriptor]) =>
    [id, stable({ kind: descriptor?.kind, ...(descriptor?.count === undefined ? {} : { count: descriptor.count }),
      sha256: descriptor?.sha256 })]));
  const pageEvidenceContract = stable({ path: source.pageEvidenceContract?.path,
    sha256: source.pageEvidenceContract?.sha256 });
  const flowContractBinding = stable({ digest: source.flowContractBinding?.digest,
    files: (source.flowContractBinding?.files ?? []).map((entry) => stable({ path: entry.path, sha256: entry.sha256 })) });
  return stable({
    schemaVersion: source.schemaVersion,
    sourceKind: source.sourceKind,
    synthetic: source.synthetic,
    productId: source.productId,
    actionId: source.actionId,
    pluginId: source.pluginId,
    pluginVersion: source.pluginVersion,
    taskStatus: source.taskStatus,
    attemptTerminalSource: source.attemptTerminalSource,
    sourceSnapshotId: source.sourceSnapshotId,
    taskBinding,
    materials,
    materialSetHash: source.materialSetHash,
    reportSourceSnapshotId: sha256(JSON.stringify(stable({ taskBinding, materials }))),
    pageEvidenceContract,
    flowContractBinding,
    flowContractDigest: source.flowContractDigest,
    flowStatus: source.flowStatus,
    flowProjectionStatus: source.flowProjectionStatus ?? null,
    flowProjectionGaps: source.flowProjectionGaps ?? [],
    terminalBranch: source.terminalBranch,
    terminalBranchProof: source.terminalBranchProof ?? null,
    flowGaps: source.flowGaps,
    expectedStageCount: source.expectedStageCount,
    observedStageCount: source.observedStageCount,
    actualTrace,
    traceDigest: source.traceDigest,
    reportTraceDigest: sha256(JSON.stringify(actualTrace)),
    reportInputs,
  });
}

const publicRunId = (value) => sha256String(value) ? value : sha256(String(value));

const publicScene = (scene) => {
  if (!rawSceneMetadataValid(scene)) fail("CAPTURE_SCENE_PUBLIC_SCHEMA_INVALID", scene?.sceneId ?? "missing");
  const entry = stable({
    sceneId: scene.sceneId,
    capturedAt: scene.capturedAt,
    stateSignature: scene.stateSignature,
    activeTabIdentityHash: scene.activeTabIdentityHash,
    documentIdentityHash: scene.documentIdentityHash,
    observationRevisionHash: scene.observationRevisionHash,
    binding: { runId: publicRunId(scene.binding.runId), captureEpoch: scene.binding.captureEpoch,
      qaTabIdentityHash: scene.binding.qaTabIdentityHash },
    transitionReceipt: scene.transitionReceipt,
    decisionReceipt: scene.decisionReceipt,
    sourceEnvelopeHash: scene.envelopeHash,
  });
  return stable({ ...entry, envelopeHash: sha256(JSON.stringify(entry)) });
};

const publicSpecimen = (specimen) => {
  const entry = stable({
    ...specimen,
    peripheral: nonEmptyObject(specimen?.peripheral)
      ? { ...specimen.peripheral, runId: publicRunId(specimen.peripheral.runId) }
      : specimen?.peripheral,
  });
  const { envelopeHash: _ignored, ...withoutEnvelope } = entry;
  return stable({ ...withoutEnvelope, envelopeHash: sha256(JSON.stringify(withoutEnvelope)) });
};

const sealProductCall = (call) => {
  const body = stable(call);
  return stable({ ...body, derivationEnvelopeHash: sha256(JSON.stringify(body)) });
};

const publicProductCall = (call) => sealProductCall({
  ...publicTraceEntry(call),
  pageOperationRequired: call.pageOperationRequired,
  pageRequirementSnapshot: call.pageRequirementSnapshot,
  inputBindingProof: call.inputBindingProof,
  domEvidence: call.domEvidence === null ? null : {
    specimens: (call.domEvidence?.specimens ?? []).map(publicSpecimen),
  },
  captureComplete: call.captureComplete,
  gaps: call.gaps,
});

const traceIdentity = (entry) => stable({
  traceEntryId: entry.traceEntryId,
  productStepId: entry.productStepId,
  capabilityCallId: entry.capabilityCallId,
  callId: entry.callId,
  actionOrdinal: entry.actionOrdinal,
  childId: entry.childId,
  exactCallIdentityHash: entry.exactCallIdentityHash,
  resultStatus: entry.resultStatus,
  failureCode: entry.failureCode ?? null,
  mutationOutcome: entry.mutationOutcome ?? null,
  postconditionResult: entry.postconditionResult ?? null,
  candidateCardinality: entry.candidateCardinality ?? null,
  observationRevisionHash: entry.observationRevisionHash ?? null,
  evidenceHash: entry.evidenceHash ?? null,
  inputBinding: entry.inputBinding,
  browserReceiptHashes: entry.browserReceiptHashes
    ?? (entry.browserReceipts ?? []).map((receipt) => sha256(JSON.stringify(stable(receipt)))),
});

function productRunFailures(run, source, matrix, inventory = null, captureOverride = null, currentProjection = true) {
  const failures = [];
  const mark = (condition, code) => { if (!condition) failures.push(code); };
  const effectiveCapture = captureOverride ?? run?.captureContext;
  mark(nonEmptyObject(run), "run");
  mark(nonEmptyObject(source), "productionSource");
  if (!nonEmptyObject(run) || !nonEmptyObject(source)) return failures;
  if (source.reportTraceDigest) {
    mark(JSON.stringify(stable(source)) === JSON.stringify(publicProductionSource(source)),
      "productionSource.publicProjection");
  }
  mark(run.productId === source.productId, "productId");
  mark(run.actionId === source.actionId, "actionId");
  mark(run.pluginId === source.pluginId, "pluginId");
  mark(run.pluginVersion === source.pluginVersion, "pluginVersion");
  mark(source.taskBinding?.productId === source.productId, "productionSource.taskBinding.productId");
  mark(source.taskBinding?.actionId === source.actionId, "productionSource.taskBinding.actionId");
  mark(run.sourceSnapshotId === source.sourceSnapshotId, "sourceSnapshotId");
  mark(run.flowContractDigest === source.flowContractDigest, "flowContractDigest");
  mark(run.traceDigest === source.traceDigest, "traceDigest");
  if (source.reportTraceDigest) {
    mark(source.reportTraceDigest === sha256(JSON.stringify(stable(source.actualTrace))),
      "productionSource.reportTraceDigest");
    mark(run.reportTraceDigest === source.reportTraceDigest, "reportTraceDigest");
    mark(source.reportSourceSnapshotId === sha256(JSON.stringify(stable({
      taskBinding: source.taskBinding, materials: source.materials,
    }))), "productionSource.reportSourceSnapshotId");
    mark(run.reportSourceSnapshotId === source.reportSourceSnapshotId, "reportSourceSnapshotId");
    mark(nonEmptyObject(run.captureContext), "captureContext");
    mark(publicCaptureContextValid(run.captureContext), "captureContext.schema");
    const scenes = run.captureContext?.sceneManifest;
    mark(Array.isArray(scenes), "captureContext.sceneManifest");
    if (Array.isArray(scenes)) {
      mark(new Set(scenes.map((scene) => scene.sceneId)).size === scenes.length,
        "captureContext.sceneManifest.duplicate");
      for (const scene of scenes) {
        mark(publicSceneMetadataValid(scene), `scene.${scene.sceneId}.schema`);
        mark(scene.envelopeHash === sceneEnvelopeHash(scene), `scene.${scene.sceneId}.envelopeHash`);
        mark(scene.binding?.runId === effectiveCapture?.runId, `scene.${scene.sceneId}.runId`);
        mark(scene.binding?.captureEpoch === effectiveCapture?.captureEpoch, `scene.${scene.sceneId}.captureEpoch`);
        mark(scene.binding?.qaTabIdentityHash === effectiveCapture?.browser?.qaTabIdentityHash
          && scene.activeTabIdentityHash === effectiveCapture?.browser?.qaTabIdentityHash,
        `scene.${scene.sceneId}.qaTabIdentityHash`);
        if (scene.transitionReceipt?.outcome === "DISPATCH_RETURNED") {
          const receipt = scene.transitionReceipt;
          const pre = scenes.find((entry) => entry.sceneId === receipt.preSceneId);
          mark(Boolean(pre && pre.stateSignature === receipt.preSceneSignature
            && pre.decisionReceipt?.kind === "ACTION_REQUIRED"
            && pre.decisionReceipt.actionId === receipt.actionId
            && pre.decisionReceipt.operation === receipt.operation
            && Date.parse(receipt.issuedAt) >= Date.parse(pre.capturedAt)
            && Date.parse(receipt.completedAt) >= Date.parse(receipt.issuedAt)
            && Date.parse(scene.capturedAt) >= Date.parse(receipt.completedAt)),
          `scene.${scene.sceneId}.receiptLinkage`);
        }
      }
      for (const [callIndex, call] of (Array.isArray(run.calls) ? run.calls : []).entries()) for (const specimen of call.domEvidence?.specimens ?? []) {
        const scene = scenes.find((entry) => entry.sceneId === specimen.sourceSceneId);
        mark(Boolean(scene), `call[${callIndex}].scene`);
        mark(scene?.stateSignature === specimen.sourceSceneSignature, `call[${callIndex}].sceneSignature`);
        mark(scene?.documentIdentityHash === specimen.documentIdentityHash, `call[${callIndex}].documentIdentityHash`);
        mark(scene?.observationRevisionHash === specimen.revision, `call[${callIndex}].revision`);
      }
    }
  } else {
    mark(source.traceDigest === sha256(JSON.stringify(stable(source.actualTrace))),
      "productionSource.traceDigest");
    mark(source.materialSetHash === sha256(JSON.stringify(stable(source.materials))),
      "productionSource.materialSetHash");
    mark(source.sourceSnapshotId === sha256(JSON.stringify(stable({
      taskBinding: source.taskBinding, materials: source.materials,
    }))), "productionSource.sourceSnapshotId");
  }
  mark(run.flowStatus === source.flowStatus, "flowStatus");
  if (source.flowProjectionStatus !== undefined) {
    mark(run.flowProjectionStatus === source.flowProjectionStatus, "flowProjectionStatus");
    mark(JSON.stringify(run.flowProjectionGaps) === JSON.stringify(source.flowProjectionGaps), "flowProjectionGaps");
  }
  mark(run.terminalBranch === source.terminalBranch, "terminalBranch");
  mark(terminalProofValid(source), "productionSource.terminalBranchProofShape");
  mark(JSON.stringify(run.terminalBranchProof) === JSON.stringify(source.terminalBranchProof), "terminalBranchProof");
  mark(Array.isArray(run.calls), "calls");
  mark(Array.isArray(source.actualTrace), "actualTrace");
  if (!Array.isArray(run.calls) || !Array.isArray(source.actualTrace)) return failures;
  for (const [index, trace] of source.actualTrace.entries()) {
    mark(pageInputBindingValid(trace?.inputBinding), `actualTrace[${index}].inputBinding`);
  }
  mark(run.calls.length === source.actualTrace.length, "callCount");
  const matrixById = Object.fromEntries(matrix.children.map((entry) => [entry.childCapabilityId, entry]));
  const sceneOwners = new Map();
  for (let index = 0; index < Math.max(run.calls.length, source.actualTrace.length); index += 1) {
    const call = run.calls[index];
    const trace = source.actualTrace[index];
    if (!call || !trace) continue;
    const { derivationEnvelopeHash, ...callBody } = call;
    mark(sha256String(derivationEnvelopeHash)
      && derivationEnvelopeHash === sha256(JSON.stringify(stable(callBody))),
    `call[${index}].derivationEnvelopeHash`);
    mark(JSON.stringify(traceIdentity(call)) === JSON.stringify(traceIdentity(trace)), `call[${index}].identity`);
    const requirement = matrixById[trace.childId];
    mark(typeof call.pageOperationRequired === "boolean", `call[${index}].pageOperationRequired.shape`);
    const pageRequired = currentProjection ? Boolean(requirement) : call.pageOperationRequired === true;
    if (currentProjection) mark(call.pageOperationRequired === pageRequired, `call[${index}].pageOperationRequired`);
    if (!pageRequired) {
      mark(call.pageRequirementSnapshot === null, `call[${index}].pageRequirementSnapshot`);
      mark(call.inputBindingProof === null, `call[${index}].inputBindingProof`);
      mark(call.domEvidence === null, `call[${index}].domEvidence`);
      mark(call.captureComplete === true, `call[${index}].captureComplete`);
      mark(Array.isArray(call.gaps) && call.gaps.length === 0, `call[${index}].gaps`);
      continue;
    }
    const snapshot = call.pageRequirementSnapshot;
    const snapshotValid = captureTimePageRequirementSnapshotValid(snapshot);
    mark(snapshotValid, `call[${index}].pageRequirementSnapshot`);
    if (snapshotValid) {
      mark(snapshot.matrixDigest === effectiveCapture?.matrixDigest,
        `call[${index}].pageRequirementSnapshot.matrixDigest`);
    }
    const inventoryChild = inventory?.children?.find((entry) => entry.childCapabilityId === trace.childId);
    if (currentProjection && snapshotValid && inventoryChild && requirement) {
      const expectedSnapshot = captureTimePageRequirementSnapshot(
        requirement, trace, inventoryChild, effectiveCapture?.matrixDigest,
      );
      mark(JSON.stringify(snapshot) === JSON.stringify(expectedSnapshot),
        `call[${index}].pageRequirementSnapshot.currentProjection`);
      mark(JSON.stringify(snapshot.requiredInputRoles) === JSON.stringify(requiredPageInputRoles(trace.childId)),
        `call[${index}].pageRequirementSnapshot.requiredInputRoles`);
    }
    const specimens = call.domEvidence?.specimens;
    const stateIds = Array.isArray(specimens)
      ? specimens.filter((entry) => entry?.evidenceKind === "LIVE_PAGE").map((entry) => entry.stateId)
      : [];
    if (Array.isArray(specimens)) {
      mark(new Set(stateIds).size === stateIds.length, `call[${index}].stateDuplicate`);
      const sourceSceneIds = specimens.map((entry) => entry?.sourceSceneId).filter(nonEmptyString);
      mark(new Set(sourceSceneIds).size === sourceSceneIds.length, `call[${index}].sceneDuplicate`);
      for (const specimen of specimens) {
        const priorOwner = sceneOwners.get(specimen?.sourceSceneId);
        mark(!priorOwner || priorOwner === trace.traceEntryId, `call[${index}].sceneCrossCallReuse`);
        if (nonEmptyString(specimen?.sourceSceneId)) sceneOwners.set(specimen.sourceSceneId, trace.traceEntryId);
        if (source.reportTraceDigest) {
          mark(nonEmptyObject(specimen) && specimen.envelopeHash === sceneEnvelopeHash(specimen),
            `call[${index}].specimenEnvelope`);
        }
      }
    }
    const requiredInputRoles = snapshotValid ? snapshot.requiredInputRoles : [];
    const inputBindingProof = derivePageInputBindingProof(trace, specimens ?? [], requiredInputRoles);
    mark(pageInputBindingProofValid(call.inputBindingProof, trace, specimens ?? [], requiredInputRoles),
      `call[${index}].inputBindingProof`);
    const captureRequirement = snapshotValid ? {
      liveStateTargets: snapshot.liveStateTargets,
      stateAssertions: snapshot.stateAssertions,
    } : null;
    const captureChild = snapshotValid ? {
      childCapabilityId: trace.childId,
      contractVersion: snapshot.childContract.contractVersion,
      contract: {
        profile: snapshot.childContract.profile,
        ...(snapshot.childContract.allowedDocumentTransition === undefined ? {}
          : { allowedDocumentTransition: snapshot.childContract.allowedDocumentTransition }),
      },
    } : null;
    const liveObservationIds = new Set((specimens ?? []).filter((entry) => entry?.evidenceKind === "LIVE_PAGE")
      .map((entry) => entry.observationId).filter(nonEmptyString));
    const liveByObservation = Object.fromEntries((specimens ?? []).filter((entry) => entry?.evidenceKind === "LIVE_PAGE"
      && nonEmptyString(entry.observationId)).map((entry) => [entry.observationId, entry]));
    const fullShapeComplete = Boolean(captureRequirement && captureChild && effectiveCapture)
      && Array.isArray(specimens) && specimens.every((entry) => specimenShapeMissing(entry, effectiveCapture,
        liveObservationIds, captureChild, captureRequirement, liveByObservation).length === 0);
    const requiredLiveStates = snapshotValid ? snapshot.requiredLiveStates : [];
    const assertionGaps = (specimens ?? []).flatMap((specimen) => [
      ...stateAssertionFailures(specimen, captureRequirement?.stateAssertions?.[specimen.stateId] ?? []),
      ...transitionEvidenceFailures(specimen, effectiveCapture?.sceneManifest ?? [], captureChild?.contract),
    ].map((failure) => `PAGE_EVIDENCE_CONFLICT:${failure}`));
    mark(assertionGaps.every((gap) => call.gaps?.includes(gap)),
      `call[${index}].stateAssertionGaps`);
    const shapeComplete = snapshotValid && Array.isArray(specimens)
      && exactStringSet(stateIds, requiredLiveStates)
      && fullShapeComplete
      && specimens.every((entry) => entry?.evidenceKind === "LIVE_PAGE"
        && nonEmptyString(entry?.capturedAt) && Number.isFinite(Date.parse(entry.capturedAt))
        && nonEmptyString(entry?.observationId)
        && nonEmptyString(entry?.sourceSceneId)
        && sha256String(entry?.sourceSceneSignature)
        && sha256String(entry?.documentIdentityHash)
        && sha256String(entry?.targetIdentityHash)
        && sha256String(entry?.revision)
        && nonEmptyObject(entry?.stateFacts)
        && sha256String(entry?.stateSignature)
        && entry.stateSignature === observedStateSignature(entry)
        && nonEmptyObject(entry?.core?.normalizedStructure)
        && nonEmptyString(entry?.core?.sanitizedOuterHtml)
        && nonEmptyObject(entry?.related)
        && nonEmptyObject(entry?.peripheral)
        && nonEmptyString(entry?.peripheral?.runId)
        && (!source.reportTraceDigest || entry.envelopeHash === sceneEnvelopeHash(entry)));
    const inputBindingSatisfied = inputBindingProof.complete || pageEvidenceNotApplicableForTrace(trace);
    const expectedComplete = shapeComplete && assertionGaps.length === 0 && inputBindingSatisfied
      && Array.isArray(call.gaps) && call.gaps.length === 0;
    mark(call.captureComplete === expectedComplete, `call[${index}].captureComplete`);
    mark(Array.isArray(call.gaps) && (call.captureComplete ? call.gaps.length === 0 : call.gaps.length > 0),
      `call[${index}].gaps`);
  }
  const expectedGaps = [...(source.flowGaps ?? []),
    ...run.calls.flatMap((call) => (call.gaps ?? []).map((gap) =>
      `${call.productStepId}/${call.actionOrdinal}/${call.childId}:${gap}`))];
  mark(JSON.stringify(run.gaps) === JSON.stringify(expectedGaps), "gaps");
  const expectedComplete = source.flowStatus === "OBSERVED_COMPLETE_PATH"
    && run.calls.every((call) => call.captureComplete === true);
  mark(run.captureComplete === expectedComplete, "captureComplete");
  return failures;
}

export { publicProductionSource, productRunFailures };

function productCaptureProjection(product) {
  if (!Array.isArray(product.runs) || product.runs.length === 0) {
    return { captureStatus: "NOT_CAPTURED", gaps: product.gaps };
  }
  return {
    captureStatus: product.runs.every((run) => run.captureComplete === true)
      ? "CAPTURE_COMPLETE" : "CAPTURE_PARTIAL",
    gaps: [...new Set(product.runs.flatMap((run) => run.gaps ?? []))],
  };
}

function sceneEnvelopeHash(scene) {
  const { envelopeHash: _ignored, ...entry } = scene;
  return sha256(JSON.stringify(stable(entry)));
}

function validateCaptureInputBindings(capture, matrix, expectedIdsOverride = null) {
  if (!captureMetadataValid(capture)) fail("CAPTURE_PUBLIC_METADATA_INVALID");
  const productionSource = capture.productionSource;
  if (!nonEmptyObject(productionSource)
    || productionSource.schemaVersion !== PRODUCTION_SOURCE_SCHEMA
    || productionSource.sourceKind !== "PRODUCTION_RUNTIME_DURABLE_TASK"
    || productionSource.synthetic !== false
    || !sha256String(productionSource.sourceSnapshotId)
    || !sha256String(productionSource.flowContractDigest)
    || !["OBSERVED_COMPLETE_PATH", "PARTIAL"].includes(productionSource.flowStatus)
    || (productionSource.flowStatus === "OBSERVED_COMPLETE_PATH"
      ? !nonEmptyString(productionSource.terminalBranch) : productionSource.terminalBranch !== null)
    || !terminalProofValid(productionSource)
    || !Array.isArray(productionSource.flowGaps)
    || !nonEmptyObject(productionSource.reportInputs)
    || !Array.isArray(productionSource.actualTrace)
    || productionSource.actualTrace.length === 0) {
    fail("CAPTURE_PRODUCTION_SOURCE_INVALID");
  }
  const authorizedInputs = capture.authorizedInputs;
  if (!authorizedInputs || typeof authorizedInputs !== "object" || Array.isArray(authorizedInputs)) {
    fail("CAPTURE_AUTHORIZED_INPUTS_INVALID");
  }
  const chainInputs = capture.chainInputs;
  if (!chainInputs || typeof chainInputs !== "object" || Array.isArray(chainInputs)) {
    fail("CAPTURE_CHAIN_INPUTS_INVALID");
  }
  const selectedChildren = expectedIdsOverride === null ? matrix.children
    : matrix.children.filter((child) => expectedIdsOverride.includes(child.childCapabilityId));
  const requiredRefs = selectedChildren.flatMap((child) => child.requiredInputRefs);
  const expectedProduction = [...new Set(requiredRefs.filter((id) => id.startsWith("production-")))].sort();
  const expectedAuthorized = [...new Set(requiredRefs.filter((id) => id.startsWith("authorized-")))].sort();
  const expectedChain = [...new Set(requiredRefs.filter((id) => id.startsWith("chain-")))].sort();
  const unsupported = requiredRefs.filter((id) => !/^(?:production|authorized|chain)-/u.test(id));
  if (unsupported.length > 0) fail("CAPTURE_INPUT_REF_KIND_INVALID", unsupported.join(","));
  const productionIds = Object.keys(productionSource.reportInputs).sort();
  const authorizedIds = Object.keys(authorizedInputs).sort();
  const chainIds = Object.keys(chainInputs).sort();
  const setSatisfied = (actual, expected) => expectedIdsOverride === null
    ? exactStringSet(actual, expected) : expected.every((id) => actual.includes(id));
  if (!setSatisfied(productionIds, expectedProduction)) {
    fail("CAPTURE_PRODUCTION_INPUT_SET_MISMATCH", `${productionIds.join(",")}/${expectedProduction.join(",")}`);
  }
  if (!setSatisfied(authorizedIds, expectedAuthorized)) {
    fail("CAPTURE_AUTHORIZED_INPUT_SET_MISMATCH", `${authorizedIds.join(",")}/${expectedAuthorized.join(",")}`);
  }
  if (!setSatisfied(chainIds, expectedChain)) {
    fail("CAPTURE_CHAIN_INPUT_SET_MISMATCH", `${chainIds.join(",")}/${expectedChain.join(",")}`);
  }
  for (const [id, descriptor] of Object.entries(productionSource.reportInputs)
    .filter(([id]) => expectedProduction.includes(id))) {
    if (!nonEmptyObject(descriptor) || !nonEmptyString(descriptor.kind)
      || !sha256String(descriptor.sha256)) fail("CAPTURE_PRODUCTION_INPUT_INVALID", id);
  }
  for (const [id, descriptor] of Object.entries(authorizedInputs).filter(([id]) => expectedAuthorized.includes(id))) {
    if (!nonEmptyObject(descriptor) || descriptor.kind !== "AUTHORIZED_FACT_SET"
      || descriptor.sourceKind !== "PRODUCT_PROFILE" || !sha256String(descriptor.setHash)
      || !Array.isArray(descriptor.variants) || descriptor.variants.length === 0
      || !exactStringSet(Object.keys(descriptor), ["kind", "sourceKind", "variants", "setHash"])) {
      fail("CAPTURE_AUTHORIZED_INPUT_INVALID", id);
    }
    for (const variant of descriptor.variants) {
      if (!nonEmptyObject(variant) || !sha256String(variant.valueHash)
        || !Array.isArray(variant.sourceBindings) || variant.sourceBindings.length === 0
        || variant.sourceBindings.some((binding) => !nonEmptyObject(binding) || !nonEmptyString(binding.path)
          || !sha256String(binding.contentHash) || !sha256String(binding.semanticHash))) {
        fail("CAPTURE_AUTHORIZED_INPUT_VARIANT_INVALID", id);
      }
    }
    const normalized = descriptor.variants.map((variant) => variant.valueHash).sort();
    if (new Set(normalized).size !== normalized.length
      || descriptor.setHash !== sha256(JSON.stringify(stable(normalized)))) {
      fail("CAPTURE_AUTHORIZED_INPUT_VARIANT_SET_INVALID", id);
    }
  }
  for (const [id, descriptor] of Object.entries(chainInputs).filter(([id]) => expectedChain.includes(id))) {
    const expectedSource = matrix.chainInputSources?.[id];
    if (nonEmptyObject(descriptor) && descriptor.kind === "MISSING_PRIOR_CHILD_OUTPUT"
      && descriptor.sourceChildCapabilityId === expectedSource
      && exactStringSet(Object.keys(descriptor), ["kind", "sourceChildCapabilityId"])) continue;
    if (!nonEmptyObject(descriptor) || descriptor.kind !== "PRIOR_CHILD_OUTPUT"
      || !nonEmptyString(descriptor.sourceChildCapabilityId) || !nonEmptyString(descriptor.evidenceRef)
      || descriptor.sourceChildCapabilityId !== expectedSource || !nonEmptyString(descriptor.observationId)
      || !sha256String(descriptor.sourceDemandDigest) || !sha256String(descriptor.sourceChildCandidateDigest)
      || !sha256String(descriptor.observationSignature)
      || !sha256String(descriptor.sha256)
      || descriptor.sha256 !== sha256(descriptor.evidenceRef)
      || descriptor.evidenceRef !== `${descriptor.sourceChildCapabilityId}:${descriptor.sourceChildCandidateDigest}:${descriptor.observationId}:${descriptor.observationSignature}`
      || !exactStringSet(Object.keys(descriptor), ["kind", "sourceChildCapabilityId", "sourceDemandDigest",
        "sourceChildCandidateDigest", "evidenceRef", "observationId", "observationSignature", "sha256"])) {
      fail("CAPTURE_CHAIN_INPUT_INVALID", id);
    }
  }
}

function validateRecaptureTrigger(trigger) {
  if (!nonEmptyObject(trigger)
    || !["PAGE_EVIDENCE_CONFLICT_CONFIRMED", "HUMAN_REQUESTED_RECAPTURE"].includes(trigger.kind)) {
    fail("RECAPTURE_FORBIDDEN");
  }
  if (trigger.kind === "HUMAN_REQUESTED_RECAPTURE") {
    if (!exactObjectKeys(trigger, ["kind", "scope", "requestedAt"])
      || !Array.isArray(trigger.scope) || trigger.scope.length === 0 || !trigger.scope.every(nonEmptyString)
      || !nonEmptyString(trigger.requestedAt) || !Number.isFinite(Date.parse(trigger.requestedAt))) {
      fail("RECAPTURE_TRIGGER_INVALID");
    }
    return;
  }
  const evidence = trigger.sameIncidentEvidence;
  if (!exactObjectKeys(trigger, ["kind", "affectedSceneIds", "sameIncidentEvidence"])
    || !exactObjectKeys(evidence, ["codeEvidenceHash", "logEvidenceHash", "pageReadbackHash"])
    || !Array.isArray(trigger.affectedSceneIds) || trigger.affectedSceneIds.length === 0
    || !trigger.affectedSceneIds.every(nonEmptyString) || !nonEmptyObject(evidence)
    || ![evidence.codeEvidenceHash, evidence.logEvidenceHash, evidence.pageReadbackHash].every(sha256String)) {
    fail("RECAPTURE_TRIGGER_INVALID");
  }
}

function assessCapture(capture, inventory, matrix, requireComplete, expectedIdsOverride = null, requireRecaptureTrigger = false) {
  if (!capture || capture.schemaVersion !== CAPTURE_SCHEMA) fail("CAPTURE_SCHEMA_INVALID");
  if (requireRecaptureTrigger) validateRecaptureTrigger(capture.recaptureTrigger);
  if (requireRecaptureTrigger && !sha256String(capture.captureEpoch)) fail("CAPTURE_EPOCH_REQUIRED");
  if (capture.browser?.family?.toLowerCase() !== "chrome" || capture.browser?.dedicatedQaTab !== true) {
    fail("CAPTURE_BROWSER_BOUNDARY_INVALID");
  }
  if (capture.browser?.controlSkill !== "chrome:control-chrome"
    || capture.browser?.qaTabCreatedByRun !== true
    || capture.browser?.livePageObserved !== true
    || !nonEmptyObject(capture.browser?.productionBrowserIdleEvidence)) {
    fail("CAPTURE_LIVE_CHROME_DECLARATION_INVALID");
  }
  if (!sha256String(capture.browser?.qaTabIdentityHash)) {
    fail("CAPTURE_QA_TAB_IDENTITY_REQUIRED");
  }
  if (!nonEmptyString(capture.runId) || !nonEmptyString(capture.capturedAt) || !Number.isFinite(Date.parse(capture.capturedAt))) {
    fail("CAPTURE_IDENTITY_INVALID");
  }
  if (!nonEmptyString(capture.browser?.version) || !nonEmptyObject(capture.environment)) fail("CAPTURE_ENVIRONMENT_INVALID");
  if (!Array.isArray(capture.children)) fail("CAPTURE_CHILDREN_INVALID");
  if (!Array.isArray(capture.sceneManifest)) fail("CAPTURE_SCENE_MANIFEST_INVALID");
  scanCapturePrivacy(capture);
  const expectedIds = expectedIdsOverride ?? inventory.denominator.pageOperationChildIds;
  validateCaptureInputBindings(capture, matrix, expectedIdsOverride);
  for (const child of inventory.children.filter((entry) => entry.pageOperationRequired
    && expectedIds.includes(entry.childCapabilityId))) {
    for (const [inputId, expected] of Object.entries(child.evidenceDemand?.authorizedInputRequirements ?? {})) {
      const actual = capture.authorizedInputs?.[inputId];
      if (!actual || actual.sourceKind !== expected.sourceKind || actual.setHash !== expected.setHash
        || JSON.stringify(actual.variants) !== JSON.stringify(expected.variants)) {
        fail("CAPTURE_AUTHORIZED_INPUT_DEMAND_STALE", `${child.childCapabilityId}:${inputId}`);
      }
    }
  }
  const captureIds = capture.children.map((entry) => entry.childCapabilityId);
  assertUnique(captureIds, "CAPTURE_CHILD_DUPLICATE");
  const extras = captureIds.filter((id) => !expectedIds.includes(id));
  if (extras.length > 0) fail("CAPTURE_CHILD_OUT_OF_SCOPE", extras.join(","));

  const captureById = Object.fromEntries(capture.children.map((entry) => [entry.childCapabilityId, entry]));
  const matrixById = Object.fromEntries(matrix.children.map((entry) => [entry.childCapabilityId, entry]));
  const allLiveObservationIds = capture.children.flatMap((entry) => Array.isArray(entry.specimens)
    ? entry.specimens.filter((specimen) => specimen.evidenceKind === "LIVE_PAGE").map((specimen) => specimen.observationId)
    : []).filter(nonEmptyString);
  assertUnique(allLiveObservationIds, "CAPTURE_LIVE_OBSERVATION_ID_DUPLICATE");
  const sceneIds = capture.sceneManifest.map((entry) => entry?.sceneId).filter(nonEmptyString);
  assertUnique(sceneIds, "CAPTURE_SCENE_ID_DUPLICATE");
  const scenesById = Object.fromEntries(capture.sceneManifest.map((entry) => [entry.sceneId, entry]));
  for (const scene of capture.sceneManifest) {
    if (!rawSceneMetadataValid(scene) || !nonEmptyString(scene.sceneId) || !sha256String(scene.stateSignature)
      || !sha256String(scene.activeTabIdentityHash) || !sha256String(scene.documentIdentityHash)
      || !sha256String(scene.observationRevisionHash) || scene.envelopeHash !== sceneEnvelopeHash(scene)) {
      fail("CAPTURE_SCENE_ENVELOPE_INVALID", scene?.sceneId ?? "missing");
    }
    if (scene.transitionReceipt?.outcome === "DISPATCH_RETURNED") {
      const receipt = scene.transitionReceipt;
      const pre = scenesById[receipt.preSceneId];
      if (!pre || pre.stateSignature !== receipt.preSceneSignature
        || pre.decisionReceipt?.kind !== "ACTION_REQUIRED"
        || pre.decisionReceipt.actionId !== receipt.actionId
        || pre.decisionReceipt.operation !== receipt.operation
        || Date.parse(receipt.issuedAt) < Date.parse(pre.capturedAt)
        || Date.parse(receipt.completedAt) < Date.parse(receipt.issuedAt)
        || Date.parse(scene.capturedAt) < Date.parse(receipt.completedAt)) {
        fail("CAPTURE_SCENE_RECEIPT_INVALID", scene.sceneId);
      }
    }
  }
  const assessments = {};
  for (const id of expectedIds) {
    const entry = captureById[id];
    const specimens = Array.isArray(entry?.specimens) ? entry.specimens : [];
    const requirements = matrixById[id];
    const inventoryChild = inventory.children.find((child) => child.childCapabilityId === id);
    const missing = [];
    if (entry?.demandDigest !== inventoryChild.evidenceDemand.digest) {
      missing.push("DEMAND_DIGEST:current-candidate-mismatch");
    }
    if (entry?.childCandidateDigest !== inventoryChild.evidenceDemand.childCandidateDigest) {
      missing.push("CHILD_CANDIDATE_DIGEST:current-candidate-mismatch");
    }
    if (!exactStringSet(entry?.inputRefs, requirements.requiredInputRefs)) {
      missing.push(`INPUT_REFS:${requirements.requiredInputRefs.join(",")}`);
    }
    for (const inputRef of requirements.requiredInputRefs.filter((id) => id.startsWith("chain-"))) {
      if (capture.chainInputs?.[inputRef]?.kind !== "PRIOR_CHILD_OUTPUT") missing.push(`CHAIN_INPUT:${inputRef}`);
    }
    const specimenKeys = specimens.map((specimen) => `${specimen.evidenceKind}:${specimen.stateId}`);
    const duplicateSpecimenKeys = specimenKeys.filter((value, index) => specimenKeys.indexOf(value) !== index);
    if (duplicateSpecimenKeys.length > 0) missing.push(`DUPLICATE_SPECIMEN:${[...new Set(duplicateSpecimenKeys)].join(",")}`);
    const liveObservationIds = new Set(specimens.filter((specimen) => specimen.evidenceKind === "LIVE_PAGE").map((specimen) => specimen.observationId).filter(nonEmptyString));
    const liveSpecimensByObservation = Object.fromEntries(specimens.filter((specimen) => specimen.evidenceKind === "LIVE_PAGE"
      && nonEmptyString(specimen.observationId)).map((specimen) => [specimen.observationId, specimen]));
    for (const stateId of requirements.requiredLiveStates) {
      if (!specimens.some((item) => item.stateId === stateId && item.evidenceKind === "LIVE_PAGE")) {
        missing.push(`LIVE_PAGE:${stateId}`);
      }
    }
    const requiredDerived = [...matrix.commonRequiredDerivedStates, ...requirements.childSpecificDerivedStates];
    for (const stateId of requiredDerived) {
      if (!specimens.some((item) => item.stateId === stateId && item.evidenceKind === "DERIVED_FIXTURE")) {
        missing.push(`DERIVED_FIXTURE:${stateId}`);
      }
    }
    for (const specimen of specimens) {
      if (!requirements.requiredLiveStates.includes(specimen.stateId)
        && !requirements.optionalLiveStates.includes(specimen.stateId)
        && !requiredDerived.includes(specimen.stateId)) {
        missing.push(`UNKNOWN_STATE:${specimen.stateId ?? "missing"}`);
      }
      missing.push(...specimenShapeMissing(
        specimen, capture, liveObservationIds,
        inventoryChild, requirements, liveSpecimensByObservation,
      ));
    }
    const requiredLiveSpecimens = specimens.filter((specimen) => specimen.evidenceKind === "LIVE_PAGE"
      && requirements.requiredLiveStates.includes(specimen.stateId));
    const orderedLive = requirements.requiredLiveStates.map((stateId) =>
      requiredLiveSpecimens.find((specimen) => specimen.stateId === stateId)).filter(Boolean);
    const liveRunIds = new Set(orderedLive.map((specimen) => specimen.peripheral?.runId).filter(nonEmptyString));
    const singleRun = liveRunIds.size <= 1;
    if (singleRun && orderedLive.length === requirements.requiredLiveStates.length
      && orderedLive.some((specimen, index) => index > 0
        && Date.parse(specimen.capturedAt) <= Date.parse(orderedLive[index - 1].capturedAt))) {
      missing.push("LIVE_STATE_ORDER:capturedAt-not-strictly-ascending");
    }
    if (singleRun && inventoryChild.contract.allowedDocumentTransition === "forbidden"
      && new Set(orderedLive.map((specimen) => specimen.documentIdentityHash)).size > 1) {
      missing.push("LIVE_STATE_DOCUMENT:forbidden-transition");
    }
    const sourceSceneIds = requiredLiveSpecimens.map((specimen) => specimen.sourceSceneId).filter(nonEmptyString);
    if (new Set(sourceSceneIds).size !== sourceSceneIds.length) missing.push("LIVE_STATE_SCENES:required-states-reused");
    for (const specimen of requiredLiveSpecimens) {
      const scene = scenesById[specimen.sourceSceneId];
      if (!scene || scene.stateSignature !== specimen.sourceSceneSignature
        || scene.binding?.runId !== specimen.peripheral?.runId
        || scene.binding?.qaTabIdentityHash !== scene.activeTabIdentityHash
        || (capture.captureEpoch && scene.binding?.captureEpoch !== capture.captureEpoch)) {
        missing.push(`SCENE_BINDING:${specimen.stateId}`);
      }
    }

    const factBindings = Array.isArray(entry?.factBindings) ? entry.factBindings : [];
    const demandFactIds = inventoryChild.evidenceDemand.facts.map((fact) => fact.factId);
    const unknownFactIds = factBindings.map((binding) => binding?.factId).filter((factId) => !demandFactIds.includes(factId));
    if (unknownFactIds.length > 0) missing.push(`DEMAND_BINDING:unknown=${[...new Set(unknownFactIds)].join(",")}`);
    const liveByObservation = Object.fromEntries(specimens.filter((specimen) => specimen.evidenceKind === "LIVE_PAGE"
      && nonEmptyString(specimen.observationId)).map((specimen) => [specimen.observationId, specimen]));
    for (const binding of factBindings) {
      if (!nonEmptyObject(binding) || !nonEmptyString(binding.factId) || !nonEmptyString(binding.observationId)
        || !Array.isArray(binding.pointers) || binding.pointers.length === 0 || !binding.pointers.every(nonEmptyString)
        || !sha256String(binding.expectedHash)) {
        missing.push(`DEMAND_BINDING:shape=${binding?.factId ?? "missing"}`);
        continue;
      }
      const demandFact = inventoryChild.evidenceDemand.facts.find((fact) => fact.factId === binding.factId);
      if (!demandFact || binding.expectedHash !== sha256(JSON.stringify(stable(demandFact.expected)))) {
        missing.push(`DEMAND_BINDING:expected=${binding.factId}`);
      }
      const specimen = liveByObservation[binding.observationId];
      if (!specimen) {
        missing.push(`DEMAND_BINDING:not-live=${binding.factId}`);
        continue;
      }
      for (const pointer of binding.pointers) {
        if (!valuePresent(valueAtPath(specimen, pointer))) missing.push(`DEMAND_BINDING:pointer=${binding.factId}:${pointer}`);
      }
      if (binding.factId.startsWith("live-state:")
        && specimen.stateId !== binding.factId.slice("live-state:".length)) {
        missing.push(`DEMAND_BINDING:wrong-live-state=${binding.factId}`);
      }
      if (binding.factId.startsWith("target:")
        && !binding.pointers.includes(`core.targets.${binding.factId.slice("target:".length)}`)) {
        missing.push(`DEMAND_BINDING:target-pointer=${binding.factId}`);
      }
      if (binding.factId.startsWith("derived-state:")) {
        const derivedState = binding.factId.slice("derived-state:".length);
        if (!specimens.some((specimenEntry) => specimenEntry.evidenceKind === "DERIVED_FIXTURE"
          && specimenEntry.stateId === derivedState && specimenEntry.derivedFromObservationId === binding.observationId)) {
          missing.push(`DEMAND_BINDING:derived-source=${binding.factId}`);
        }
      }
    }
    const coveredFacts = demandFactIds.filter((factId) => factBindings.some((binding) => binding?.factId === factId));
    for (const factId of demandFactIds.filter((factId) => !coveredFacts.includes(factId))) {
      missing.push(`DEMAND_FACT_UNCOVERED:${factId}`);
    }
    assessments[id] = {
      complete: missing.length === 0,
      missing: [...new Set(missing)],
      inputRefs: entry?.inputRefs ?? [],
      specimens,
      factBindings,
      demandDigest: entry?.demandDigest ?? null,
      childCandidateDigest: entry?.childCandidateDigest ?? null,
      demandCoverage: {
        coveredFacts: coveredFacts.length,
        requiredFacts: demandFactIds.length,
        percent: demandFactIds.length === 0 ? 100 : Number(((coveredFacts.length / demandFactIds.length) * 100).toFixed(2)),
      },
    };
  }
  if (expectedIdsOverride === null) {
    for (const [inputId, descriptor] of Object.entries(capture.chainInputs ?? {})) {
      if (descriptor?.kind !== "PRIOR_CHILD_OUTPUT") continue;
      const sourceAssessment = assessments[descriptor.sourceChildCapabilityId];
      const sourceInventory = inventory.children.find((child) => child.childCapabilityId === descriptor.sourceChildCapabilityId);
      const sourceSpecimen = sourceAssessment?.specimens.find((specimen) =>
        specimen.evidenceKind === "LIVE_PAGE" && specimen.observationId === descriptor.observationId);
      if (!sourceAssessment?.complete || descriptor.sourceDemandDigest !== sourceInventory?.evidenceDemand?.digest
        || descriptor.sourceChildCandidateDigest !== sourceInventory?.evidenceDemand?.childCandidateDigest
        || sourceSpecimen?.stateSignature !== descriptor.observationSignature) {
        fail("CAPTURE_CHAIN_SOURCE_NOT_ADMITTED", `${inputId}:${sourceAssessment?.missing?.join("|") ?? "source-missing"}`);
      }
    }
  }
  const complete = expectedIds.every((id) => assessments[id].complete);
  if (requireComplete && !complete) {
    const detail = expectedIds.filter((id) => !assessments[id].complete)
      .map((id) => `${id}=[${assessments[id].missing.join(",")}]`).join(";");
    fail("CAPTURE_INCOMPLETE", detail);
  }
  return { complete, assessments };
}

export function captureContext(capture) {
  if (!captureMetadataValid(capture)) fail("CAPTURE_PUBLIC_METADATA_INVALID");
  return stable({
    schemaVersion: capture.schemaVersion,
    capturedAt: capture.capturedAt,
    runId: publicRunId(capture.runId),
    captureEpoch: capture.captureEpoch,
    recaptureTrigger: capture.recaptureTrigger.kind === "HUMAN_REQUESTED_RECAPTURE"
      ? { kind: capture.recaptureTrigger.kind, scope: capture.recaptureTrigger.scope,
        requestedAt: capture.recaptureTrigger.requestedAt }
      : { kind: capture.recaptureTrigger.kind, affectedSceneIds: capture.recaptureTrigger.affectedSceneIds,
        sameIncidentEvidence: {
          codeEvidenceHash: capture.recaptureTrigger.sameIncidentEvidence.codeEvidenceHash,
          logEvidenceHash: capture.recaptureTrigger.sameIncidentEvidence.logEvidenceHash,
          pageReadbackHash: capture.recaptureTrigger.sameIncidentEvidence.pageReadbackHash,
        } },
    matrixDigest: capture.matrixDigest,
    browser: {
      family: capture.browser.family, version: capture.browser.version, controlSkill: capture.browser.controlSkill,
      dedicatedQaTab: capture.browser.dedicatedQaTab, qaTabCreatedByRun: capture.browser.qaTabCreatedByRun,
      livePageObserved: capture.browser.livePageObserved,
      productionBrowserIdleEvidence: { observed: capture.browser.productionBrowserIdleEvidence.observed },
      qaTabIdentityHash: capture.browser.qaTabIdentityHash,
    },
    environment: { locale: capture.environment.locale,
      viewport: { width: capture.environment.viewport.width, height: capture.environment.viewport.height },
      theme: capture.environment.theme, providerBuildMarker: capture.environment.providerBuildMarker },
    authorizedInputs: capture.authorizedInputs,
    chainInputs: capture.chainInputs,
    sceneManifest: (capture.sceneManifest ?? []).map(publicScene),
  });
}

async function productRunSourcesCurrent(repo, productionSource) {
  if (!nonEmptyObject(productionSource)
    || productionSource.schemaVersion !== PRODUCTION_SOURCE_SCHEMA
    || productionSource.sourceKind !== "PRODUCTION_RUNTIME_DURABLE_TASK"
    || productionSource.synthetic !== false
    || !["OBSERVED_COMPLETE_PATH", "PARTIAL"].includes(productionSource.flowStatus)
    || (productionSource.flowStatus === "OBSERVED_COMPLETE_PATH"
      ? !nonEmptyString(productionSource.terminalBranch) : productionSource.terminalBranch !== null)
    || !Array.isArray(productionSource.flowGaps)
    || !Array.isArray(productionSource.flowContractBinding?.files)
    || productionSource.flowContractBinding.files.length === 0
    || !nonEmptyString(productionSource.pageEvidenceContract?.path)
    || !sha256String(productionSource.pageEvidenceContract?.sha256)) {
    return false;
  }
  const root = `${resolve(repo)}${sep}`;
  for (const binding of productionSource.flowContractBinding.files) {
    if (!nonEmptyString(binding?.path) || !sha256String(binding?.sha256)) return false;
    const path = resolve(repo, binding.path);
    if (!path.startsWith(root) || !(await isFile(path))
      || sha256(await readFile(path)) !== binding.sha256) return false;
  }
  const files = stable(productionSource.flowContractBinding.files);
  const bindingDigest = sha256(JSON.stringify(files));
  if (productionSource.flowContractBinding.digest !== bindingDigest) return false;
  const contractPath = resolve(repo, productionSource.pageEvidenceContract.path);
  if (!contractPath.startsWith(root) || !(await isFile(contractPath))
    || sha256(await readFile(contractPath)) !== productionSource.pageEvidenceContract.sha256) return false;
  const expectedFlowDigest = sha256(JSON.stringify(stable({
    contract: productionSource.pageEvidenceContract.sha256,
    binding: bindingDigest,
  })));
  if (productionSource.flowContractDigest !== expectedFlowDigest) return false;
  return true;
}

async function assertCurrentProductRunSources(repo, productionSource) {
  if (!(await productRunSourcesCurrent(repo, productionSource))) {
    fail("PRODUCT_FLOW_PROJECTION_STALE");
  }
}

async function mergeProductRun(repo, inventory, matrix, base, capture) {
  if (!nonEmptyObject(capture.productRun)) fail("PRODUCT_CAPTURE_RUN_REQUIRED");
  await assertCurrentProductRunSources(repo, capture.productionSource);
  const productKey = `${capture.productRun.productId}/${capture.productRun.actionId}`;
  const current = inventory.products.find((entry) => entry.productKey === productKey)
    ?? fail("PRODUCT_EVIDENCE_ROUTE_NOT_FOUND", productKey);
  if (capture.productRun.pluginId !== current.pluginId
    || capture.productRun.pluginVersion !== current.pluginVersion
    || capture.productRun.sourceSnapshotId !== capture.productionSource.sourceSnapshotId
    || capture.productRun.flowContractDigest !== capture.productionSource.flowContractDigest
    || capture.productRun.traceDigest !== capture.productionSource.traceDigest
    || !Array.isArray(capture.productRun.calls)) fail("PRODUCT_CAPTURE_BINDING_INVALID", productKey);
  const runFailures = productRunFailures(capture.productRun, capture.productionSource, matrix, inventory, capture);
  if (runFailures.length > 0) fail("PRODUCT_CAPTURE_RUN_DERIVATION_INVALID", runFailures.join(","));
  const priorByKey = Object.fromEntries((base?.products ?? []).map((entry) => [entry.productKey, entry]));
  inventory.products = preserveUnselectedProductSlices(inventory.products, base?.products, productKey).map((product) => {
    const priorRuns = priorByKey[product.productKey]?.runs ?? [];
    if (product.productKey !== productKey) return product;
    const reportSource = publicProductionSource(capture.productionSource);
    const run = stable({ ...capture.productRun,
      calls: capture.productRun.calls.map(publicProductCall), capturedAt: capture.capturedAt,
      captureEpoch: capture.captureEpoch, recaptureTrigger: capture.recaptureTrigger,
      reportSourceSnapshotId: reportSource.reportSourceSnapshotId,
      reportTraceDigest: reportSource.reportTraceDigest,
      captureContext: captureContext(capture),
      productionSource: reportSource });
    const runs = [...priorRuns.filter((entry) => entry.sourceSnapshotId !== run.sourceSnapshotId), run];
    const projection = productCaptureProjection({ ...product, runs, gaps: run.gaps });
    return { ...product, runs, ...projection };
  });
}

async function mergeCapture(repo, matrixPath, capturePath, outputPath, baseReportPath, productId, actionId) {
  const inventory = await buildInventory(repo, matrixPath);
  const matrix = await loadMatrix(matrixPath);
  const capture = await readJson(capturePath);
  const base = baseReportPath ? await readJson(baseReportPath) : null;
  if (base && base.schemaVersion !== REPORT_SCHEMA) fail("REFRESH_BASE_REPORT_INVALID");
  const pageIds = inventory.denominator.pageOperationChildIds;
  if (capture.productRun?.productId !== productId || capture.productRun?.actionId !== actionId) {
    fail("PRODUCT_CAPTURE_SCOPE_MISMATCH", `${productId}/${actionId}`);
  }
  const selectedIds = [...new Set((capture.productRun.calls ?? [])
    .filter((call) => call.pageOperationRequired === true).map((call) => call.childId))];
  if (selectedIds.length === 0) fail("PRODUCT_CAPTURE_PAGE_CALL_EMPTY", `${productId}/${actionId}`);
  assertUnique(selectedIds, "REFRESH_CHILD_DUPLICATE");
  for (const id of selectedIds) if (!pageIds.includes(id)) fail("REFRESH_CHILD_NOT_PAGE_OPERATION", id);
  assessCapture(capture, inventory, matrix, false, selectedIds, true);
  await mergeProductRun(repo, inventory, matrix, base, capture);
  inventory.captureMetadata = null;
  inventory.captureEpoch = null;
  inventory.captureStatus = "NOT_CAPTURED";
  await writeJsonAtomic(outputPath, inventory);
  return inventory;
}

async function reprojectReport(repo, matrixPath, baseReportPath, outputPath, productId, actionId) {
  const base = await readJson(baseReportPath);
  if (base.schemaVersion !== REPORT_SCHEMA) fail("REFRESH_BASE_REPORT_INVALID");
  assertNoRepositoryCandidateBinding(base);
  const inventory = await buildInventory(repo, matrixPath);
  const productKey = `${productId}/${actionId}`;
  if (!inventory.products.some((entry) => entry.productKey === productKey)) {
    fail("PRODUCT_EVIDENCE_ROUTE_NOT_FOUND", productKey);
  }
  const gaps = [];
  const baseProducts = Object.fromEntries((base.products ?? []).map((entry) => [entry.productKey, entry]));
  inventory.products = preserveUnselectedProductSlices(inventory.products, base.products, productKey);
  inventory.products = await Promise.all(inventory.products.map(async (currentProduct) => {
    const prior = baseProducts[currentProduct.productKey];
    if (currentProduct.productKey !== productKey) return currentProduct;
    if (!prior?.runs?.length) return currentProduct;
    const currentBinding = JSON.stringify(currentProduct.flowOwnerBinding);
    const priorBinding = JSON.stringify(prior.flowOwnerBinding);
    const runSourcesCurrent = (await Promise.all(prior.runs.map((run) =>
      productRunSourcesCurrent(repo, run.productionSource)))).every(Boolean);
    if (currentProduct.contractDigest !== prior.contractDigest || currentBinding !== priorBinding
      || !runSourcesCurrent) {
      gaps.push({ productKey, missing: ["PRODUCT_FLOW_PROJECTION_STALE"] });
      const projection = productCaptureProjection({ ...currentProduct, runs: prior.runs, gaps: prior.gaps });
      return { ...currentProduct, runs: prior.runs, ...projection };
    }
    const projection = productCaptureProjection({ ...currentProduct, runs: prior.runs, gaps: prior.gaps });
    return { ...currentProduct, runs: prior.runs, ...projection };
  }));
  inventory.captureMetadata = null;
  inventory.captureEpoch = null;
  inventory.captureStatus = "NOT_CAPTURED";
  await writeJsonAtomic(outputPath, inventory);
  return { report: inventory, gaps };
}

async function validateReport(repo, matrixPath, reportPath, requireComplete) {
  const report = await readJson(reportPath);
  if (["gpt-page-operation-evidence.v1", "gpt-page-operation-evidence.v2", "gpt-page-operation-evidence.v3", "gpt-page-operation-evidence.v4", "gpt-page-operation-evidence.v5", "gpt-page-operation-evidence.v6"].includes(report.schemaVersion)) {
    fail("REPORT_LEGACY_INVALIDATED");
  }
  if (report.schemaVersion !== REPORT_SCHEMA) fail("REPORT_SCHEMA_INVALID");
  assertNoRepositoryCandidateBinding(report);
  const matrix = await loadMatrix(matrixPath);
  const current = await buildInventory(repo, matrixPath);
  if (!Array.isArray(report.products)
    || report.products.length === 0) fail("REPORT_PRODUCT_INDEX_INVALID");
  assertUnique(report.products.map((entry) => entry.productKey), "REPORT_PRODUCT_DUPLICATE");
  const currentProducts = Object.fromEntries(current.products.map((entry) => [entry.productKey, entry]));
  const staleProducts = [];
  for (const product of report.products) {
    const expected = currentProducts[product.productKey];
    if (!nonEmptyString(product.productId) || !nonEmptyString(product.actionId)
      || product.productKey !== `${product.productId}/${product.actionId}`
      || !nonEmptyString(product.pluginId) || !Number.isSafeInteger(product.pluginVersion)
      || !Array.isArray(product.runs) || !Array.isArray(product.gaps)) {
      fail("REPORT_PRODUCT_BINDING_INVALID", product.productKey ?? "missing");
    }
    const currentBinding = JSON.stringify(expected?.flowOwnerBinding);
    const runSourcesCurrent = (await Promise.all(product.runs.map((run) =>
      productRunSourcesCurrent(repo, run.productionSource)))).every(Boolean);
    const runMatricesCurrent = product.runs.every((run) =>
      run.captureContext?.matrixDigest === current.matrixBinding?.digest);
    const stale = !expected || product.productId !== expected.productId || product.actionId !== expected.actionId
      || product.pluginId !== expected.pluginId
      || product.contractDigest !== expected.contractDigest
      || JSON.stringify(product.flowOwnerBinding) !== currentBinding || !runSourcesCurrent || !runMatricesCurrent;
    if (stale) staleProducts.push(product.productKey);
    for (const run of product.runs) {
      if (!sha256String(run.sourceSnapshotId) || !sha256String(run.flowContractDigest)
        || !sha256String(run.traceDigest) || !Array.isArray(run.calls)
        || !["OBSERVED_COMPLETE_PATH", "PARTIAL"].includes(run.flowStatus)
        || (run.flowStatus === "OBSERVED_COMPLETE_PATH"
          ? !nonEmptyString(run.terminalBranch) : run.terminalBranch !== null)
        || (run.flowStatus === "OBSERVED_COMPLETE_PATH"
          ? !nonEmptyObject(run.terminalBranchProof) : run.terminalBranchProof !== null)
        || run.productId !== product.productId || run.actionId !== product.actionId
        || run.pluginId !== product.pluginId || !Number.isSafeInteger(run.pluginVersion)
        || run.productionSource?.productId !== product.productId
        || run.productionSource?.actionId !== product.actionId
        || run.productionSource?.pluginId !== product.pluginId
        || run.productionSource?.pluginVersion !== run.pluginVersion
        || run.productionSource?.sourceKind !== "PRODUCTION_RUNTIME_DURABLE_TASK"
        || run.productionSource?.synthetic !== false) fail("REPORT_PRODUCT_RUN_INVALID", product.productKey);
      if (run.calls.some((call) => !sha256String(call.traceEntryId))
        || new Set(run.calls.map((call) => call.traceEntryId)).size !== run.calls.length) {
        fail("REPORT_PRODUCT_CALL_IDENTITY_INVALID", product.productKey);
      }
      const derivationFailures = productRunFailures(
        run, run.productionSource, matrix, current, null, !stale,
      );
      if (derivationFailures.length > 0) {
        fail("REPORT_PRODUCT_RUN_DERIVATION_INVALID", `${product.productKey}:${derivationFailures.join(",")}`);
      }
      scanCapturePrivacy(run, `report.products.${product.productKey}.runs`);
    }
    const projection = product.runs.length === 0
      ? { captureStatus: "NOT_CAPTURED", gaps: stale ? product.gaps : expected.gaps }
      : productCaptureProjection(product);
    if (product.captureStatus !== projection.captureStatus
      || JSON.stringify(product.gaps) !== JSON.stringify(projection.gaps)) {
      fail("REPORT_PRODUCT_CAPTURE_PROJECTION_INVALID", product.productKey);
    }
  }
  const expectedProductCaptureStatus = report.products.every((entry) => entry.captureStatus === "CAPTURE_COMPLETE")
    ? "CAPTURE_COMPLETE" : report.products.some((entry) => entry.captureStatus !== "NOT_CAPTURED")
      ? "CAPTURE_PARTIAL" : "NOT_CAPTURED";
  const globalProjectionCurrent = JSON.stringify(report.matrixBinding) === JSON.stringify(current.matrixBinding)
    && report.projectionRevision === current.projectionRevision;
  if (!Array.isArray(report.children)
    || !nonEmptyObject(report.denominator)
    || report.children.length !== report.denominator.contractChildren) {
    fail("REPORT_CHILD_COUNT_INVALID");
  }
  assertUnique(report.children.map((child) => child.childCapabilityId), "REPORT_CHILD_DUPLICATE");
  const currentById = Object.fromEntries(current.children.map((child) => [child.childCapabilityId, child]));
  for (const child of report.children) {
    if (!exactObjectKeys(child, ["childCapabilityId", "contractVersion", "pageOperationRequired",
      "inclusionBasis", "contract", "sourceReferences", "webImplementationReferences",
      "productConsumers", "collectionRequirements", "evidenceDemand"])) {
      fail("REPORT_CHILD_EVIDENCE_SECOND_TRUTH", child.childCapabilityId);
    }
    const expected = currentById[child.childCapabilityId];
    if (globalProjectionCurrent && (!expected || JSON.stringify(child.contract) !== JSON.stringify(expected.contract)
      || child.contractVersion !== expected.contractVersion
      || (child.pageOperationRequired && (child.evidenceDemand?.digest !== expected.evidenceDemand?.digest
        || JSON.stringify(child.evidenceDemand?.facts) !== JSON.stringify(expected.evidenceDemand?.facts)
        || JSON.stringify(child.evidenceDemand?.authorizedInputRequirements) !== JSON.stringify(expected.evidenceDemand?.authorizedInputRequirements)
        || JSON.stringify(child.evidenceDemand?.sourceBinding) !== JSON.stringify(expected.evidenceDemand?.sourceBinding))))) {
      fail("REPORT_CURRENT_CHILD_PROJECTION_INVALID", child.childCapabilityId);
    }
  }
  const pageIds = report.children.filter((child) => child.pageOperationRequired)
    .map((child) => child.childCapabilityId);
  const nonPageIds = report.children.filter((child) => !child.pageOperationRequired)
    .map((child) => child.childCapabilityId);
  if (!exactStringSet(report.denominator.pageOperationChildIds, pageIds)
    || !exactStringSet(report.denominator.nonPageChildIds, nonPageIds)
    || report.denominator.pageOperationChildren !== pageIds.length
    || report.denominator.nonPageChildren !== nonPageIds.length) {
    fail("REPORT_DENOMINATOR_INVALID");
  }
  if (globalProjectionCurrent && !exactStringSet(pageIds, matrix.children.map((child) => child.childCapabilityId))) {
    fail("REPORT_CURRENT_DENOMINATOR_INVALID");
  }
  if (report.captureStatus !== "NOT_CAPTURED" || report.captureMetadata !== null || report.captureEpoch !== null) {
    fail("REPORT_CHILD_EVIDENCE_SECOND_TRUTH");
  }
  const projectionCurrent = globalProjectionCurrent && staleProducts.length === 0;
  if (requireComplete && !projectionCurrent) fail("REPORT_PROJECTION_STALE", staleProducts.join(",") || "global");
  if (requireComplete && expectedProductCaptureStatus !== "CAPTURE_COMPLETE") {
    fail("REPORT_NOT_COMPLETE", expectedProductCaptureStatus);
  }
  return { valid: true, complete: expectedProductCaptureStatus === "CAPTURE_COMPLETE",
    projectionCurrent, staleProducts };
}

function productEvidenceBrief(report, product, stepId = "") {
  const runs = (product.runs ?? []).map((run) => {
    const calls = (run.calls ?? []).filter((call) => !stepId || call.productStepId === stepId);
    return stable({
      sourceSnapshotId: run.sourceSnapshotId,
      flowContractDigest: run.flowContractDigest,
      traceDigest: run.traceDigest,
      captureEpoch: run.captureEpoch,
      flowStatus: run.flowStatus,
      flowProjectionStatus: run.flowProjectionStatus ?? null,
      flowProjectionGaps: run.flowProjectionGaps ?? [],
      terminalBranch: run.terminalBranch,
      terminalBranchProof: run.terminalBranchProof,
      captureComplete: stepId ? calls.length > 0 && calls.every((call) => call.captureComplete === true)
        : run.captureComplete,
      calls,
      gaps: stepId ? calls.flatMap((call) => call.gaps ?? []) : run.gaps,
    });
  }).filter((run) => !stepId || run.calls.length > 0);
  return stable({
    productKey: product.productKey,
    productId: product.productId,
    actionId: product.actionId,
    pluginId: product.pluginId,
    pluginVersion: product.pluginVersion,
    contractDigest: product.contractDigest,
    flowOwnerBinding: product.flowOwnerBinding,
    stepScope: stepId || "ALL_PRODUCT_STEPS",
    runs,
  });
}

function productAdmissionCandidate(report, product, stepId = "") {
  const brief = productEvidenceBrief(report, product, stepId);
  return `PRODUCT:${sha256(JSON.stringify(stable({
    productKey: product.productKey,
    stepScope: stepId || null,
    evidenceBriefHash: sha256(JSON.stringify(brief)),
  }))).slice("sha256:".length)}`;
}

async function validateSelectedProduct(repo, matrixPath, reportPath, productId, actionId) {
  const report = await readJson(reportPath);
  if (report.schemaVersion !== REPORT_SCHEMA) fail("REPORT_SCHEMA_INVALID");
  if (!Array.isArray(report.products)) {
    fail("REPORT_ROLE_BOUNDARY_INVALID");
  }
  assertNoRepositoryCandidateBinding(report);
  const product = report.products.find((entry) => entry.productId === productId && entry.actionId === actionId)
    ?? fail("ADMISSION_PRODUCT_NOT_FOUND", `${productId}/${actionId}`);
  const currentInventory = await buildInventory(repo, matrixPath);
  const current = currentInventory.products.find((entry) => entry.productKey === product.productKey)
    ?? fail("ADMISSION_PRODUCT_NOT_FOUND", product.productKey);
  if (product.productId !== current.productId || product.actionId !== current.actionId
    || product.pluginId !== current.pluginId || product.pluginVersion !== current.pluginVersion
    || product.contractDigest !== current.contractDigest
    || JSON.stringify(product.flowOwnerBinding) !== JSON.stringify(current.flowOwnerBinding)
    || !Array.isArray(product.runs) || !Array.isArray(product.gaps)) {
    fail("ADMISSION_PRODUCT_PROJECTION_STALE", product.productKey);
  }
  const matrix = await loadMatrix(matrixPath);
  for (const run of product.runs) {
    if (!(await productRunSourcesCurrent(repo, run.productionSource))) {
      fail("ADMISSION_PRODUCT_PROJECTION_STALE", product.productKey);
    }
    const failures = productRunFailures(run, run.productionSource, matrix, currentInventory);
    if (failures.length > 0) fail("ADMISSION_PRODUCT_RUN_INVALID", `${product.productKey}:${failures.join(",")}`);
  }
  const projection = product.runs.length === 0
    ? { captureStatus: "NOT_CAPTURED", gaps: current.gaps }
    : productCaptureProjection(product);
  if (product.captureStatus !== projection.captureStatus
    || JSON.stringify(product.gaps) !== JSON.stringify(projection.gaps)) {
    fail("ADMISSION_PRODUCT_CAPTURE_PROJECTION_INVALID", product.productKey);
  }
  scanCapturePrivacy(product, `report.products.${product.productKey}`);
  return { report, product };
}

async function admitProductReport(repo, matrixPath, reportPath, productId, actionId, stepId, candidateArg) {
  if (!nonEmptyString(productId) || !nonEmptyString(actionId)) fail("ADMISSION_PRODUCT_SCOPE_REQUIRED");
  if (!nonEmptyString(candidateArg)) fail("ADMISSION_CANDIDATE_REQUIRED");
  const { report, product } = await validateSelectedProduct(repo, matrixPath, reportPath, productId, actionId);
  if (product.captureStatus === "PROJECTION_STALE") fail("ADMISSION_PRODUCT_PROJECTION_STALE", product.productKey);
  const brief = productEvidenceBrief(report, product, stepId);
  const expected = productAdmissionCandidate(report, product, stepId);
  if (candidateArg !== expected) fail("ADMISSION_CANDIDATE_MISMATCH", `${candidateArg}/${expected}`);
  if (brief.runs.length === 0 || brief.runs.some((run) => run.captureComplete !== true)) {
    fail("ADMISSION_PRODUCT_EVIDENCE_INCOMPLETE", product.productKey);
  }
  const receipt = stable({
    candidate: expected,
    reportSchema: report.schemaVersion,
    productKey: product.productKey,
    stepScope: stepId || "ALL_PRODUCT_STEPS",
    sourceSnapshotIds: brief.runs.map((run) => run.sourceSnapshotId),
    flowContractDigests: brief.runs.map((run) => run.flowContractDigest),
    evidenceBriefHash: sha256(JSON.stringify(brief)),
  });
  return stable({ status: "ADMITTED", candidate: expected, admissionMode: stepId ? "PRODUCT_STEP" : "FULL_PRODUCT",
    admissionReceipt: receipt, admissionReceiptHash: sha256(JSON.stringify(receipt)), evidenceBrief: brief });
}

function assertCanonicalRepositoryOutput(repo, outputPath) {
  const canonical = resolve(repo, CANONICAL_REPORT);
  if (outputPath.startsWith(`${resolve(repo)}${sep}`) && outputPath !== canonical) {
    fail("REPORT_CANONICAL_PATH_REQUIRED", outputPath);
  }
}

function assertCanonicalReportInput(repo, reportPath) {
  if (resolve(reportPath).startsWith(`${resolve(repo)}${sep}`)
    && resolve(reportPath) !== resolve(repo, CANONICAL_REPORT)) fail("REPORT_CANONICAL_PATH_REQUIRED", reportPath);
}

async function assertNoSecondRepositoryReport(repo, outputPath) {
  if (!resolve(outputPath).startsWith(`${resolve(repo)}${sep}`)) return;
  const root = resolve(repo);
  for (const path of await walkFiles(root, (entry) => entry.endsWith(".json"))) {
    if (resolve(path) === resolve(outputPath)) continue;
    let parsed;
    try { parsed = JSON.parse(await readFile(path, "utf8")); } catch { continue; }
    if (parsed?.schemaVersion === REPORT_SCHEMA) {
      fail("REPORT_SECOND_COPY_FORBIDDEN", relative(repo, path));
    }
  }
}

async function main() {
  const { command, args } = parseArgs(process.argv.slice(2));
  const matrixPath = requiredArg(args, "matrix");
  if (command === "inventory") {
    const repo = requiredArg(args, "repo");
    const report = await buildInventory(repo, matrixPath);
    if (args["read-only"] === true) {
      process.stdout.write(`${JSON.stringify({
        contracts: report.denominator.contractChildren,
        pageOperationChildren: report.denominator.pageOperationChildren,
        pageOperationChildIds: report.denominator.pageOperationChildIds,
        nonPageChildIds: report.denominator.nonPageChildIds,
        productRoutes: report.products.map((entry) => entry.productKey),
        wroteReport: false,
      })}\n`);
      return;
    }
    const outputPath = requiredArg(args, "output");
    assertCanonicalRepositoryOutput(repo, outputPath);
    await assertNoSecondRepositoryReport(repo, outputPath);
    await writeJsonAtomic(outputPath, report);
    process.stdout.write(`${JSON.stringify({ status: report.captureStatus, contracts: report.denominator.contractChildren,
      pageOperationChildren: report.denominator.pageOperationChildren, productRoutes: report.products.length,
      output: outputPath, wroteReport: true })}\n`);
    return;
  }
  if (command === "merge") {
    const repo = requiredArg(args, "repo");
    const capturePath = requiredArg(args, "capture");
    const outputPath = requiredArg(args, "output");
    assertCanonicalRepositoryOutput(repo, outputPath);
    await assertNoSecondRepositoryReport(repo, outputPath);
    if (typeof args.product !== "string" || typeof args.action !== "string") {
      fail("ARGUMENT_REQUIRED", "--product/--action");
    }
    if (args.child !== undefined) fail("PRODUCT_CHILD_SCOPE_FORBIDDEN");
    const baseReportPath = typeof args["base-report"] === "string" ? args["base-report"] : null;
    if (baseReportPath === null) fail("TARGETED_MERGE_BASE_REPORT_REQUIRED");
    const report = await mergeCapture(repo, matrixPath, capturePath, outputPath, baseReportPath,
      args.product, args.action);
    process.stdout.write(`${JSON.stringify({ status: report.captureStatus, output: outputPath,
      requestedProduct: `${args.product}/${args.action}`, preservedUnselectedProducts: true })}\n`);
    return;
  }
  if (command === "refresh") {
    const repo = requiredArg(args, "repo");
    const baseReportPath = requiredArg(args, "base-report");
    const outputPath = requiredArg(args, "output");
    if (typeof args.product !== "string" || typeof args.action !== "string") {
      fail("ARGUMENT_REQUIRED", "--product/--action");
    }
    if (args.child !== undefined) fail("PRODUCT_CHILD_SCOPE_FORBIDDEN");
    assertCanonicalRepositoryOutput(repo, outputPath);
    await assertNoSecondRepositoryReport(repo, outputPath);
    const result = await reprojectReport(repo, matrixPath, baseReportPath, outputPath, args.product, args.action);
    process.stdout.write(`${JSON.stringify({
      status: result.report.captureStatus,
      output: outputPath,
      requestedProduct: `${args.product}/${args.action}`,
      preservedUnselectedProducts: true,
      gaps: result.gaps,
      chromeOpened: false,
    })}\n`);
    return;
  }
  if (command === "validate") {
    const repo = requiredArg(args, "repo");
    const reportPath = requiredArg(args, "report");
    assertCanonicalReportInput(repo, reportPath);
    await assertNoSecondRepositoryReport(repo, reportPath);
    const result = await validateReport(repo, matrixPath, reportPath, args["require-complete"] === true);
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }
  if (command === "admit") {
    const repo = requiredArg(args, "repo");
    const reportPath = requiredArg(args, "report");
    assertCanonicalReportInput(repo, reportPath);
    await assertNoSecondRepositoryReport(repo, reportPath);
    if (typeof args.product !== "string") fail("ADMISSION_PRODUCT_SCOPE_REQUIRED");
    if (args.child !== undefined) fail("ADMISSION_CHILD_SCOPE_FORBIDDEN");
    const result = await admitProductReport(repo, matrixPath, reportPath, args.product,
      typeof args.action === "string" ? args.action : "",
      typeof args.step === "string" ? args.step : "",
      typeof args.candidate === "string" ? args.candidate : "");
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }
  if (command === "candidate") {
    const repo = requiredArg(args, "repo");
    const reportPath = requiredArg(args, "report");
    assertCanonicalReportInput(repo, reportPath);
    await assertNoSecondRepositoryReport(repo, reportPath);
    if (typeof args.product !== "string") fail("ADMISSION_PRODUCT_SCOPE_REQUIRED");
    if (typeof args.action !== "string") fail("ARGUMENT_REQUIRED", "--action");
    if (args.child !== undefined) fail("ADMISSION_CHILD_SCOPE_FORBIDDEN");
    const { report, product } = await validateSelectedProduct(repo, matrixPath, reportPath, args.product, args.action);
    const stepId = typeof args.step === "string" ? args.step : "";
    const brief = productEvidenceBrief(report, product, stepId);
    process.stdout.write(`${JSON.stringify({ candidate: productAdmissionCandidate(report, product, stepId),
      productKey: product.productKey, stepScope: stepId || "ALL_PRODUCT_STEPS",
      evidenceBriefHash: sha256(JSON.stringify(brief)) })}\n`);
    return;
  }
  fail("COMMAND_UNKNOWN", command);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
