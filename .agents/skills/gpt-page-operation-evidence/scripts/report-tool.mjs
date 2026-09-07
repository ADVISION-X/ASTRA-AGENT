#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readdir, readFile, rename, stat, writeFile, mkdir } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";

import { scopedGptPageEvidenceFactFailures }
  from "../../../../scripts/audit/domains/gpt/gpt-page-evidence-capture-inspection.ts";

const REPORT_SCHEMA = "gpt-page-operation-evidence.v5";
const CAPTURE_SCHEMA = "gpt-page-operation-capture.v5";
const FIXTURE_SCHEMA = "gpt-page-operation-fixtures.v2";
const MATRIX_SCHEMA = "gpt-page-operation-matrix.v4";
const CANONICAL_REPORT = "docs/项目方案/GPT页面操作子能力实证资料.json";
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

const FORBIDDEN_CAPTURE_KEYS = /^(cookie|cookies|localstorage|sessionstorage|password|passwords|authorizationheader|accesstoken|refreshtoken)$/i;
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
  }
  if (ids.length !== matrix.expectedPageOperationCount) {
    fail("MATRIX_COUNT_MISMATCH", `${ids.length}/${matrix.expectedPageOperationCount}`);
  }
  return matrix;
}

function gitOutput(repo, args) {
  const result = spawnSync("git", ["-C", repo, ...args], { encoding: "utf8" });
  if (result.status !== 0) fail("GIT_BINDING_FAILED", result.stderr.trim() || args.join(" "));
  return result.stdout.trim();
}

async function candidateBinding(repo) {
  const head = gitOutput(repo, ["rev-parse", "HEAD"]);
  const changed = gitOutput(repo, ["status", "--porcelain=v1", "--untracked-files=all", "--",
    "src/capabilities/gpt/contract.ts", "src/capabilities/gpt/child-types.ts", "src/capabilities/gpt/schema.ts",
    ".github/instructions/agent-rules/功能法案.md", "docs/blueprints/gpt"]);
  const tracked = [
    ...["src/capabilities/gpt/contract.ts", "src/capabilities/gpt/child-types.ts", "src/capabilities/gpt/schema.ts",
      ".github/instructions/agent-rules/功能法案.md"].map((path) => join(repo, path)),
    ...await walkFiles(join(repo, "docs/blueprints/gpt"), (path) => path.endsWith(".md")),
  ].sort();
  const sourceRows = [];
  for (const path of tracked) sourceRows.push([relative(repo, path).split(sep).join("/"), sha256(await readFile(path))]);
  const worktreeDigest = sha256(JSON.stringify(stable(sourceRows)));
  return stable({
    head,
    clean: changed.length === 0,
    worktreeDigest,
    candidate: changed.length === 0 ? head : `WORKTREE:${worktreeDigest.slice("sha256:".length)}`,
  });
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
  for (const path of uniquePaths) {
    const absolute = join(repo, path);
    if (!(await isFile(absolute))) fail("DEMAND_SOURCE_MISSING", path);
    const raw = await readFile(absolute);
    files.push({ path, contentHash: sha256(raw), semanticHash: sha256(semanticPrint(repo, path, raw.toString("utf8"))) });
  }
  return stable({ files, semanticDigest: sha256(JSON.stringify(stable(files.map(({ path, semanticHash }) => ({ path, semanticHash })))))});
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
      collection: null,
      captureComplete: false,
      captureMissing: pageSet.has(id) ? ["live-page-capture-not-present"] : [],
      demandCoverage: pageSet.has(id) ? { coveredFacts: 0, requiredFacts: evidenceDemand.facts.length, percent: 0 } : null,
    });
  }
  const candidate = await candidateBinding(repo);
  const projectionRevision = sha256(JSON.stringify(stable(children.filter((child) => child.pageOperationRequired)
    .map((child) => [child.childCapabilityId, child.evidenceDemand.projectionDigest])
    .sort((left, right) => left[0].localeCompare(right[0])))));

  return {
    schemaVersion: REPORT_SCHEMA,
    generatedAt: new Date().toISOString(),
    repository: "AGENT",
    candidateBinding: candidate,
    projectionRevision,
    captureEpoch: null,
    matrixBinding: { schemaVersion: matrix.schemaVersion, digest: sha256(JSON.stringify(stable(matrix))) },
    purpose: "Offline engineering evidence for GPT children that operate a page",
    evidenceRole: "stable Chrome page facts plus a cheap current-demand projection that every GPT page Child iteration must consume before editing",
    productionRuntimeConsumer: false,
    claimsQualityVerdict: false,
    captureStatus: "NOT_CAPTURED",
    productionValue: {
      supports: ["candidate-bound demand admission", "fixture design", "offline re-projection and deterministic regression from one stable capture epoch"],
      doesNotReplace: ["real GPT task execution when the task requires it", "native quality verdict", "READY", "RELEASE", "Website admission or storage"]
    },
    denominator: {
      rule: matrix.scopeRule,
      contractChildren: ids.length,
      pageOperationChildren: denominator.contractPageIds.length,
      nonPageChildren: denominator.contractNoPageIds.length,
      pageOperationChildIds: denominator.contractPageIds,
      nonPageChildIds: denominator.contractNoPageIds
    },
    productConsumers: summarizeConsumers(references.productConsumers, denominator.contractPageIds),
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

function stateAssertionMissing(specimen, assertions = []) {
  const missing = [];
  for (const assertion of assertions) {
    const actual = valueAtPath(specimen, assertion.path);
    if (assertion.operator === "equals" && JSON.stringify(actual) !== JSON.stringify(assertion.value)) {
      missing.push(`STATE_ASSERTION:${specimen.stateId}:${assertion.path}:equals`);
    } else if (assertion.operator === "present" && !valuePresent(actual)) {
      missing.push(`STATE_ASSERTION:${specimen.stateId}:${assertion.path}:present`);
    } else if (assertion.operator === "absent" && valuePresent(actual)) {
      missing.push(`STATE_ASSERTION:${specimen.stateId}:${assertion.path}:absent`);
    } else if (assertion.operator === "sameAs" && JSON.stringify(actual) !== JSON.stringify(valueAtPath(specimen, assertion.valuePath))) {
      missing.push(`STATE_ASSERTION:${specimen.stateId}:${assertion.path}:sameAs`);
    } else if (assertion.operator === "differentFrom" && JSON.stringify(actual) === JSON.stringify(valueAtPath(specimen, assertion.valuePath))) {
      missing.push(`STATE_ASSERTION:${specimen.stateId}:${assertion.path}:differentFrom`);
    } else if (assertion.operator === "greaterThan" && !(typeof actual === "number" && actual > assertion.value)) {
      missing.push(`STATE_ASSERTION:${specimen.stateId}:${assertion.path}:greaterThan`);
    } else if (!["equals", "present", "absent", "sameAs", "differentFrom", "greaterThan"].includes(assertion.operator)) {
      missing.push(`STATE_ASSERTION:${specimen.stateId}:operator`);
    }
  }
  return missing;
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
    mark(["SYNTHETIC_FIXTURE", "ALLOWLISTED_UI", "HASH_ONLY"].includes(text.kind), "core.textProjection.kind");
    mark(sha256String(text.sha256), "core.textProjection.sha256");
    mark(Number.isInteger(text.length) && text.length >= 0, "core.textProjection.length");
    if (text.kind === "HASH_ONLY") mark(text.value === undefined, "core.textProjection.valueForbidden");
    if (text.kind === "SYNTHETIC_FIXTURE" || text.kind === "ALLOWLISTED_UI") {
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
        mark(chain.directPostcondition.passed === true, "related.transitionChain.directPostcondition");
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
    missing.push(...stateAssertionMissing(specimen, requirements.stateAssertions?.[specimen.stateId] ?? []));
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

function exactStringSet(actual, expected) {
  return Array.isArray(actual)
    && actual.every(nonEmptyString)
    && new Set(actual).size === actual.length
    && JSON.stringify([...new Set(actual)].sort()) === JSON.stringify([...new Set(expected)].sort());
}

function sceneEnvelopeHash(scene) {
  const { envelopeHash: _ignored, ...entry } = scene;
  return sha256(JSON.stringify(stable(entry)));
}

function validateCaptureInputBindings(capture, matrix, expectedIdsOverride = null) {
  const fixtureManifest = capture.fixtureManifest;
  if (!nonEmptyObject(fixtureManifest)
    || fixtureManifest.schemaVersion !== FIXTURE_SCHEMA
    || fixtureManifest.runId !== capture.runId
    || fixtureManifest.syntheticOnly !== true
    || !nonEmptyObject(fixtureManifest.inputs)) {
    fail("CAPTURE_FIXTURE_MANIFEST_INVALID");
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
  const expectedSynthetic = [...new Set(requiredRefs.filter((id) => id.startsWith("synthetic-")))].sort();
  const expectedAuthorized = [...new Set(requiredRefs.filter((id) => id.startsWith("authorized-")))].sort();
  const expectedChain = [...new Set(requiredRefs.filter((id) => id.startsWith("chain-")))].sort();
  const unsupported = requiredRefs.filter((id) => !/^(?:synthetic|authorized|chain)-/u.test(id));
  if (unsupported.length > 0) fail("CAPTURE_INPUT_REF_KIND_INVALID", unsupported.join(","));
  const syntheticIds = Object.keys(fixtureManifest.inputs).sort();
  const authorizedIds = Object.keys(authorizedInputs).sort();
  const chainIds = Object.keys(chainInputs).sort();
  const setSatisfied = (actual, expected) => expectedIdsOverride === null
    ? exactStringSet(actual, expected) : expected.every((id) => actual.includes(id));
  if (!setSatisfied(syntheticIds, expectedSynthetic)) {
    fail("CAPTURE_SYNTHETIC_INPUT_SET_MISMATCH", `${syntheticIds.join(",")}/${expectedSynthetic.join(",")}`);
  }
  if (!setSatisfied(authorizedIds, expectedAuthorized)) {
    fail("CAPTURE_AUTHORIZED_INPUT_SET_MISMATCH", `${authorizedIds.join(",")}/${expectedAuthorized.join(",")}`);
  }
  if (!setSatisfied(chainIds, expectedChain)) {
    fail("CAPTURE_CHAIN_INPUT_SET_MISMATCH", `${chainIds.join(",")}/${expectedChain.join(",")}`);
  }
  for (const [id, descriptor] of Object.entries(fixtureManifest.inputs).filter(([id]) => expectedSynthetic.includes(id))) {
    if (!nonEmptyObject(descriptor) || descriptor.kind !== "SYNTHETIC_FIXTURE" || !sha256String(descriptor.sha256)) {
      fail("CAPTURE_SYNTHETIC_INPUT_INVALID", id);
    }
    if (descriptor.value !== undefined) {
      if (typeof descriptor.value !== "string" || descriptor.sha256 !== sha256(descriptor.value)
        || descriptor.length !== descriptor.value.length) fail("CAPTURE_SYNTHETIC_INPUT_VALUE_INVALID", id);
    } else if (!nonEmptyString(descriptor.fileName)
      || !Number.isSafeInteger(descriptor.bytes) || descriptor.bytes < 1) {
      fail("CAPTURE_SYNTHETIC_INPUT_FILE_INVALID", id);
    }
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
    if (!Array.isArray(trigger.scope) || trigger.scope.length === 0 || !trigger.scope.every(nonEmptyString)
      || !nonEmptyString(trigger.requestedAt) || !Number.isFinite(Date.parse(trigger.requestedAt))) {
      fail("RECAPTURE_TRIGGER_INVALID");
    }
    return;
  }
  const evidence = trigger.sameIncidentEvidence;
  if (!Array.isArray(trigger.affectedSceneIds) || trigger.affectedSceneIds.length === 0
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
    if (!nonEmptyObject(scene) || !nonEmptyString(scene.sceneId) || !sha256String(scene.stateSignature)
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

const captureContext = (capture) => stable({
  schemaVersion: capture.schemaVersion,
  capturedAt: capture.capturedAt,
  runId: capture.runId,
  captureEpoch: capture.captureEpoch,
  recaptureTrigger: capture.recaptureTrigger,
  candidateBinding: capture.candidateBinding,
  matrixDigest: capture.matrixDigest,
  browser: capture.browser,
  environment: capture.environment,
  fixtureManifest: capture.fixtureManifest,
  authorizedInputs: capture.authorizedInputs,
  chainInputs: capture.chainInputs,
  sceneManifest: capture.sceneManifest,
});

function mergeSceneManifests(priorScenes, currentScenes) {
  const merged = new Map();
  for (const scene of [...(priorScenes ?? []), ...(currentScenes ?? [])]) {
    const existing = merged.get(scene.sceneId);
    if (existing && existing.stateSignature !== scene.stateSignature) {
      fail("CAPTURE_SCENE_ID_COLLISION", scene.sceneId);
    }
    merged.set(scene.sceneId, scene);
  }
  return [...merged.values()];
}

async function mergeCapture(repo, matrixPath, capturePath, outputPath, baseReportPath = null, childArg = "all") {
  const inventory = await buildInventory(repo, matrixPath);
  const matrix = await loadMatrix(matrixPath);
  const capture = await readJson(capturePath);
  const base = baseReportPath ? await readJson(baseReportPath) : null;
  if (base && base.schemaVersion !== REPORT_SCHEMA) fail("REFRESH_BASE_REPORT_INVALID");
  const pageIds = inventory.denominator.pageOperationChildIds;
  const selectedIds = childArg === "all" ? pageIds : childArg.split(",").filter(Boolean);
  assertUnique(selectedIds, "REFRESH_CHILD_DUPLICATE");
  for (const id of selectedIds) if (!pageIds.includes(id)) fail("REFRESH_CHILD_NOT_PAGE_OPERATION", id);
  const assessment = assessCapture(capture, inventory, matrix, false,
    childArg === "all" ? null : selectedIds, true);
  inventory.captureMetadata = stable({
    capturedAt: capture.capturedAt ?? null,
    runId: capture.runId ?? null,
    captureEpoch: capture.captureEpoch,
    recaptureTrigger: capture.recaptureTrigger,
    browser: capture.browser,
    environment: capture.environment ?? null,
    fixtureManifest: capture.fixtureManifest,
    authorizedInputs: capture.authorizedInputs,
    chainInputs: capture.chainInputs,
    sceneManifest: capture.sceneManifest,
  });
  inventory.captureEpoch = capture.captureEpoch;
  inventory.children = inventory.children.map((child) => {
    if (!child.pageOperationRequired) return child;
    if (!selectedIds.includes(child.childCapabilityId)) {
      const prior = base?.children?.find((entry) => entry.childCapabilityId === child.childCapabilityId);
      if (prior?.collection && prior.evidenceDemand?.digest === child.evidenceDemand.digest
        && prior.collection.childCandidateDigest === child.evidenceDemand.childCandidateDigest) {
        return { ...child, collection: prior.collection, captureComplete: prior.captureComplete,
          captureMissing: prior.captureMissing, demandCoverage: prior.demandCoverage };
      }
      return child;
    }
    let assessed = assessment.assessments[child.childCapabilityId];
    let context = captureContext(capture);
    const prior = base?.children?.find((entry) => entry.childCapabilityId === child.childCapabilityId);
    if (childArg !== "all" && prior?.collection) {
      const currentLiveStateIds = new Set(assessed.specimens.filter((specimen) =>
        specimen.evidenceKind === "LIVE_PAGE").map((specimen) => specimen.stateId));
      const retainedLive = prior.collection.specimens.filter((specimen) =>
        specimen.evidenceKind === "LIVE_PAGE" && !currentLiveStateIds.has(specimen.stateId));
      const currentLive = assessed.specimens.filter((specimen) => specimen.evidenceKind === "LIVE_PAGE");
      const currentDerived = assessed.specimens.filter((specimen) => specimen.evidenceKind === "DERIVED_FIXTURE");
      const specimens = [...retainedLive, ...currentLive, ...currentDerived];
      const factBindings = reprojectFactBindings(child, {
        specimens,
        factBindings: [...(prior.collection.factBindings ?? []), ...(assessed.factBindings ?? [])],
      });
      const captureChild = capture.children.find((entry) =>
        entry.childCapabilityId === child.childCapabilityId) ?? fail("CAPTURE_CHILD_MISSING", child.childCapabilityId);
      const mergedCapture = {
        ...capture,
        sceneManifest: mergeSceneManifests(prior.collection.captureContext?.sceneManifest, capture.sceneManifest),
        children: [{ ...captureChild, specimens, factBindings }],
      };
      assessed = assessCapture(mergedCapture, inventory, matrix, false,
        [child.childCapabilityId], true).assessments[child.childCapabilityId];
      context = captureContext(mergedCapture);
    }
    return {
      ...child,
      collection: {
        demandDigest: assessed.demandDigest,
        childCandidateDigest: assessed.childCandidateDigest,
        inputRefs: assessed.inputRefs,
        factBindings: assessed.factBindings,
        specimens: assessed.specimens,
        captureContext: context,
      },
      captureComplete: assessed.complete,
      captureMissing: assessed.missing,
      demandCoverage: assessed.demandCoverage,
    };
  });
  const pageChildren = inventory.children.filter((child) => child.pageOperationRequired);
  inventory.captureStatus = pageChildren.every((child) => child.captureComplete === true)
    ? "CAPTURE_COMPLETE" : pageChildren.some((child) => child.collection) ? "CAPTURE_PARTIAL" : "NOT_CAPTURED";
  await writeJsonAtomic(outputPath, inventory);
  return inventory;
}

function reprojectChainInputs(chainInputs, inventory, baseChildren, matrix) {
  const currentById = Object.fromEntries(inventory.children.map((child) => [child.childCapabilityId, child]));
  const sourceByInput = matrix.chainInputSources ?? {};
  return stable(Object.fromEntries(Object.entries(sourceByInput).map(([inputId, sourceChildCapabilityId]) => {
    const descriptor = chainInputs?.[inputId];
    const source = currentById[sourceChildCapabilityId];
    const priorSource = baseChildren.find((child) => child.childCapabilityId === sourceChildCapabilityId);
    const live = (priorSource?.collection?.specimens ?? []).filter((entry) =>
      entry.evidenceKind === "LIVE_PAGE" && nonEmptyString(entry.observationId));
    const exact = descriptor?.kind === "PRIOR_CHILD_OUTPUT"
      ? live.find((entry) => entry.observationId === descriptor.observationId) : null;
    const terminal = [...live].filter((entry) =>
      /(?:readback|checkpoint|already-open)$/u.test(entry.stateId ?? ""))
      .sort((left, right) => Date.parse(left.capturedAt) - Date.parse(right.capturedAt)).at(-1);
    const specimen = terminal ?? exact;
    if (!source?.evidenceDemand || !specimen?.stateSignature) return [inputId, descriptor];
    const evidenceRef = `${sourceChildCapabilityId}:${source.evidenceDemand.childCandidateDigest}:${specimen.observationId}:${specimen.stateSignature}`;
    return [inputId, stable({
      kind: "PRIOR_CHILD_OUTPUT",
      sourceChildCapabilityId,
      sourceDemandDigest: source.evidenceDemand.digest,
      sourceChildCandidateDigest: source.evidenceDemand.childCandidateDigest,
      evidenceRef,
      observationId: specimen.observationId,
      observationSignature: specimen.stateSignature,
      sha256: sha256(evidenceRef),
    })];
  })));
}

function reprojectFactBindings(child, priorCollection) {
  const specimens = priorCollection?.specimens ?? [];
  const live = specimens.filter((specimen) => specimen.evidenceKind === "LIVE_PAGE");
  const liveByObservation = Object.fromEntries(live.map((specimen) => [specimen.observationId, specimen]));
  const priorByFact = Object.fromEntries((priorCollection?.factBindings ?? []).map((binding) => [binding.factId, binding]));
  const bindingFor = (fact) => {
    const prior = priorByFact[fact.factId];
    if (prior && liveByObservation[prior.observationId]
      && prior.pointers?.every((pointer) => valuePresent(valueAtPath(liveByObservation[prior.observationId], pointer)))) {
      return { ...prior, bindingKind: "LIVE_OBSERVATION",
        expectedHash: sha256(JSON.stringify(stable(fact.expected))) };
    }
    let specimen = live[0];
    let pointers = ["related.contractReference"];
    if (fact.factId.startsWith("target:")) {
      const target = fact.factId.slice("target:".length);
      specimen = live.find((entry) => valuePresent(entry.core?.targets?.[target]));
      pointers = [`core.targets.${target}`];
    } else if (fact.factId.startsWith("live-state:")) {
      const stateId = fact.factId.slice("live-state:".length);
      specimen = live.find((entry) => entry.stateId === stateId);
      pointers = ["stateFacts.stateId"];
    } else if (fact.factId.startsWith("derived-state:")) {
      const stateId = fact.factId.slice("derived-state:".length);
      const derived = specimens.find((entry) => entry.evidenceKind === "DERIVED_FIXTURE" && entry.stateId === stateId);
      specimen = liveByObservation[derived?.derivedFromObservationId];
    } else if (fact.factId.startsWith("input:")) pointers = ["stateFacts.inputRefs"];
    else if (fact.factId.startsWith("authorized-input:")) pointers = ["stateFacts.authorizedInputVariantHashes"];
    else if (fact.factId.startsWith("chain:")) pointers = ["related.transitionChain"];
    else if (fact.factId.startsWith("authority:")) pointers = ["related.authorityEvidence"];
    if (!specimen || !pointers.every((pointer) => valuePresent(valueAtPath(specimen, pointer)))) {
      if (["PAGE_TARGET", "LIVE_PAGE_STATE", "EVIDENCE_CHAIN"].includes(fact.kind)) return null;
      return {
        factId: fact.factId,
        bindingKind: "CURRENT_PROJECTION",
        projectionDigest: child.evidenceDemand.projectionDigest,
        expectedHash: sha256(JSON.stringify(stable(fact.expected))),
      };
    }
    return {
      factId: fact.factId,
      bindingKind: "LIVE_OBSERVATION",
      observationId: specimen.observationId,
      pointers,
      expectedHash: sha256(JSON.stringify(stable(fact.expected))),
    };
  };
  return child.evidenceDemand.facts.map(bindingFor).filter(Boolean);
}

function projectExistingChild(child, prior, chainInputs) {
  const specimens = prior.collection?.specimens ?? [];
  const live = specimens.filter((entry) => entry.evidenceKind === "LIVE_PAGE");
  const derived = specimens.filter((entry) => entry.evidenceKind === "DERIVED_FIXTURE");
  const requirements = child.collectionRequirements;
  const admittedLiveStates = requirements.requiredLiveStates.filter((stateId) =>
    live.some((entry) => entry.stateId === stateId));
  const missingLiveStates = requirements.requiredLiveStates.filter((stateId) =>
    !admittedLiveStates.includes(stateId));
  const requiredDerivedStates = [...new Set(child.evidenceDemand.facts.filter((fact) =>
    fact.kind === "DERIVED_FIXTURE_STATE").map((fact) => fact.expected))];
  const admittedDerivedStates = requiredDerivedStates.filter((stateId) =>
    derived.some((entry) => entry.stateId === stateId));
  const missingDerivedStates = requiredDerivedStates.filter((stateId) =>
    !admittedDerivedStates.includes(stateId));
  const requiredChainInputs = requirements.requiredInputRefs.filter((inputId) => inputId.startsWith("chain-"));
  const resolvedChainInputs = requiredChainInputs.filter((inputId) => chainInputs?.[inputId]?.kind === "PRIOR_CHILD_OUTPUT");
  const missingChainInputs = requiredChainInputs.filter((inputId) => !resolvedChainInputs.includes(inputId));
  const factBindings = reprojectFactBindings(child, prior.collection);
  const boundFacts = new Set(factBindings.map((entry) => entry.factId));
  const missingPageFacts = child.evidenceDemand.facts.filter((fact) =>
    ["PAGE_TARGET", "LIVE_PAGE_STATE", "EVIDENCE_CHAIN"].includes(fact.kind)
      && !boundFacts.has(fact.factId)).map((fact) => fact.factId);
  const missing = [
    ...missingLiveStates.map((stateId) => `PAGE_EVIDENCE_GAP:LIVE_PAGE:${stateId}`),
    ...missingDerivedStates.map((stateId) => `PAGE_EVIDENCE_GAP:DERIVED_FIXTURE:${stateId}`),
    ...missingChainInputs.map((inputId) => `PAGE_EVIDENCE_GAP:CHAIN_INPUT:${inputId}`),
    ...missingPageFacts.filter((factId) => !factId.startsWith("live-state:")
      && !factId.startsWith("chain:")).map((factId) => `PAGE_EVIDENCE_GAP:DEMAND_FACT_UNCOVERED:${factId}`),
  ];
  const requiredFacts = child.evidenceDemand.facts.length;
  return {
    factBindings,
    missing: [...new Set(missing)],
    coverage: {
      coveredFacts: boundFacts.size,
      requiredFacts,
      percent: Number(((boundFacts.size / requiredFacts) * 100).toFixed(2)),
    },
    pageEvidenceCoverage: stable({
      mode: "OBSERVATION_SCOPED",
      admittedLiveStates,
      missingLiveStates,
      admittedDerivedStates,
      missingDerivedStates,
      requiredChainInputs,
      resolvedChainInputs,
      missingChainInputs,
    }),
  };
}

function reprojectSceneManifest(priorCollection, baseChildren, captureEpoch, captureMetadata) {
  const specimens = priorCollection?.specimens ?? [];
  const requiredSceneIds = new Set(specimens.filter((entry) => entry.evidenceKind === "LIVE_PAGE")
    .map((entry) => entry.sourceSceneId).filter(nonEmptyString));
  const allLive = baseChildren.flatMap((child) => child.collection?.specimens ?? [])
    .filter((entry) => entry.evidenceKind === "LIVE_PAGE" && nonEmptyString(entry.sourceSceneId));
  const liveByScene = Object.fromEntries(allLive.map((entry) => [entry.sourceSceneId, entry]));
  const original = priorCollection?.captureContext?.sceneManifest ?? captureMetadata?.sceneManifest ?? [];
  for (const scene of original) {
    if (requiredSceneIds.has(scene.sceneId) && nonEmptyString(scene.transitionReceipt?.preSceneId)) {
      requiredSceneIds.add(scene.transitionReceipt.preSceneId);
    }
  }
  return original.filter((scene) => requiredSceneIds.has(scene.sceneId)).map((scene) => {
    const specimen = liveByScene[scene.sceneId];
    const entry = stable({
      ...scene,
      activeTabIdentityHash: scene.activeTabIdentityHash ?? captureMetadata?.browser?.qaTabIdentityHash,
      documentIdentityHash: scene.documentIdentityHash ?? specimen?.documentIdentityHash,
      observationRevisionHash: scene.observationRevisionHash ?? specimen?.revision,
      binding: {
        runId: scene.binding?.runId ?? specimen?.peripheral?.runId ?? priorCollection.captureContext.runId,
        captureEpoch: scene.binding?.captureEpoch ?? captureEpoch,
        qaTabIdentityHash: scene.binding?.qaTabIdentityHash ?? scene.activeTabIdentityHash
          ?? captureMetadata?.browser?.qaTabIdentityHash,
      },
    });
    const { envelopeHash: _ignored, ...withoutEnvelope } = entry;
    return stable({ ...withoutEnvelope, envelopeHash: sha256(JSON.stringify(stable(withoutEnvelope))) });
  });
}

async function reprojectReport(repo, matrixPath, baseReportPath, outputPath, childArg = "all") {
  const base = await readJson(baseReportPath);
  if (base.schemaVersion !== REPORT_SCHEMA) fail("REFRESH_BASE_REPORT_INVALID");
  const inventory = await buildInventory(repo, matrixPath);
  const matrix = await loadMatrix(matrixPath);
  const pageIds = inventory.denominator.pageOperationChildIds;
  const requestedIds = childArg === "all" ? pageIds : childArg.split(",").filter(Boolean);
  assertUnique(requestedIds, "REFRESH_CHILD_DUPLICATE");
  for (const id of requestedIds) if (!pageIds.includes(id)) fail("REFRESH_CHILD_NOT_PAGE_OPERATION", id);
  const selectedIds = pageIds;
  const baseById = Object.fromEntries(base.children.map((child) => [child.childCapabilityId, child]));
  const chainInputs = reprojectChainInputs(base.captureMetadata?.chainInputs, inventory, base.children, matrix);
  const gaps = [];

  inventory.captureMetadata = base.captureMetadata ? stable({ ...base.captureMetadata, chainInputs }) : null;
  inventory.captureEpoch = base.captureEpoch ?? (base.captureMetadata
    ? sha256(JSON.stringify(stable({
      runId: base.captureMetadata.runId,
      capturedAt: base.captureMetadata.capturedAt,
      qaTabIdentityHash: base.captureMetadata.browser?.qaTabIdentityHash,
    }))) : null);
  inventory.children = inventory.children.map((currentChild) => {
    const prior = baseById[currentChild.childCapabilityId];
    if (!currentChild.pageOperationRequired || !selectedIds.includes(currentChild.childCapabilityId)) {
      return prior ?? currentChild;
    }
    if (!prior?.collection) {
      gaps.push({ childCapabilityId: currentChild.childCapabilityId, missing: ["PAGE_EVIDENCE_GAP:collection-missing"] });
      return currentChild;
    }
    const context = stable({
      ...prior.collection.captureContext,
      captureEpoch: inventory.captureEpoch,
      candidateBinding: inventory.candidateBinding,
      matrixDigest: inventory.matrixBinding.digest,
      chainInputs,
      sceneManifest: reprojectSceneManifest(prior.collection, base.children,
        inventory.captureEpoch, base.captureMetadata),
    });
    const projected = projectExistingChild(currentChild, prior, chainInputs);
    if (projected.missing.length > 0) gaps.push({
      childCapabilityId: currentChild.childCapabilityId, missing: projected.missing,
    });
    return {
      ...currentChild,
      collection: {
        demandDigest: currentChild.evidenceDemand.digest,
        childCandidateDigest: currentChild.evidenceDemand.childCandidateDigest,
        inputRefs: currentChild.collectionRequirements.requiredInputRefs,
        factBindings: projected.factBindings,
        specimens: prior.collection.specimens,
        captureContext: context,
      },
      captureComplete: projected.missing.length === 0,
      captureMissing: projected.missing,
      demandCoverage: projected.coverage,
      pageEvidenceCoverage: projected.pageEvidenceCoverage,
    };
  });
  const pageChildren = inventory.children.filter((child) => child.pageOperationRequired);
  inventory.projectionRevision = sha256(JSON.stringify(stable(pageChildren.map((child) => [
    child.childCapabilityId, child.evidenceDemand?.projectionDigest ?? null,
  ]).sort((left, right) => left[0].localeCompare(right[0])))));
  inventory.captureStatus = pageChildren.every((child) => child.captureComplete === true)
    ? "CAPTURE_COMPLETE" : pageChildren.some((child) => child.collection) ? "CAPTURE_PARTIAL" : "NOT_CAPTURED";
  await writeJsonAtomic(outputPath, inventory);
  return { report: inventory, gaps };
}

async function validateReport(repo, matrixPath, reportPath, requireComplete, selectedIds = null) {
  const report = await readJson(reportPath);
  if (["gpt-page-operation-evidence.v1", "gpt-page-operation-evidence.v2", "gpt-page-operation-evidence.v3", "gpt-page-operation-evidence.v4"].includes(report.schemaVersion)) {
    fail("REPORT_LEGACY_INVALIDATED");
  }
  if (report.schemaVersion !== REPORT_SCHEMA) fail("REPORT_SCHEMA_INVALID");
  if (report.productionRuntimeConsumer !== false || report.claimsQualityVerdict !== false) {
    fail("REPORT_ROLE_BOUNDARY_INVALID");
  }
  const matrix = await loadMatrix(matrixPath);
  const current = await buildInventory(repo, matrixPath);
  if (selectedIds === null && JSON.stringify(report.candidateBinding) !== JSON.stringify(current.candidateBinding)) {
    fail("REPORT_PROJECTION_STALE", `candidate:${report.candidateBinding?.candidate ?? "missing"}/${current.candidateBinding.candidate}`);
  }
  if (selectedIds === null && JSON.stringify(report.matrixBinding) !== JSON.stringify(current.matrixBinding)) {
    fail("REPORT_PROJECTION_STALE", "matrix");
  }
  if (selectedIds === null && report.projectionRevision !== current.projectionRevision) {
    fail("REPORT_PROJECTION_STALE", "revision");
  }
  if (!Array.isArray(report.children)
    || !nonEmptyObject(report.denominator)
    || report.children.length !== report.denominator.contractChildren) {
    fail("REPORT_CHILD_COUNT_INVALID");
  }
  assertUnique(report.children.map((child) => child.childCapabilityId), "REPORT_CHILD_DUPLICATE");
  const currentById = Object.fromEntries(current.children.map((child) => [child.childCapabilityId, child]));
  for (const child of report.children) {
    const expected = currentById[child.childCapabilityId];
    const selected = selectedIds === null || selectedIds.includes(child.childCapabilityId);
    if (!expected || JSON.stringify(child.contract) !== JSON.stringify(expected.contract)
      || child.contractVersion !== expected.contractVersion) {
      if (selected) fail("REPORT_CONTRACT_BINDING_STALE", child.childCapabilityId);
    }
    if (selected && child.pageOperationRequired && (child.evidenceDemand?.digest !== expected.evidenceDemand?.digest
      || JSON.stringify(child.evidenceDemand?.facts) !== JSON.stringify(expected.evidenceDemand?.facts)
      || JSON.stringify(child.evidenceDemand?.authorizedInputRequirements) !== JSON.stringify(expected.evidenceDemand?.authorizedInputRequirements)
      || JSON.stringify(child.evidenceDemand?.sourceBinding) !== JSON.stringify(expected.evidenceDemand?.sourceBinding))) {
      fail("REPORT_PROJECTION_STALE", child.childCapabilityId);
    }
  }
  const pageIds = report.children.filter((child) => child.pageOperationRequired)
    .map((child) => child.childCapabilityId);
  const nonPageIds = report.children.filter((child) => !child.pageOperationRequired)
    .map((child) => child.childCapabilityId);
  if (!exactStringSet(pageIds, matrix.children.map((child) => child.childCapabilityId))
    || !exactStringSet(report.denominator.pageOperationChildIds, pageIds)
    || !exactStringSet(report.denominator.nonPageChildIds, nonPageIds)
    || report.denominator.pageOperationChildren !== pageIds.length
    || report.denominator.nonPageChildren !== nonPageIds.length) {
    fail("REPORT_DENOMINATOR_INVALID");
  }
  for (const child of report.children) {
    if (child.collection) scanCapturePrivacy(child.collection, `report.children.${child.childCapabilityId}.collection`);
  }
  const validStatuses = new Set(["NOT_CAPTURED", "CAPTURE_PARTIAL", "CAPTURE_COMPLETE"]);
  if (!validStatuses.has(report.captureStatus)) fail("REPORT_CAPTURE_STATUS_INVALID", report.captureStatus ?? "missing");
  let assessedComplete = false;
  if (report.captureStatus === "NOT_CAPTURED") {
    if (report.captureMetadata !== null) {
      fail("REPORT_NOT_CAPTURED_STATE_INVALID");
    }
  } else {
    let anyCollection = false;
    let allComplete = true;
    for (const [inputId, descriptor] of Object.entries(report.captureMetadata?.chainInputs ?? {})) {
      if (descriptor?.kind !== "PRIOR_CHILD_OUTPUT") continue;
      const consumers = matrix.children.filter((entry) => entry.requiredInputRefs.includes(inputId))
        .map((entry) => entry.childCapabilityId);
      if (selectedIds !== null && !consumers.some((id) => selectedIds.includes(id))) continue;
      const source = report.children.find((child) => child.childCapabilityId === descriptor.sourceChildCapabilityId);
      const sourceSpecimen = source?.collection?.specimens?.find((specimen) =>
        specimen.evidenceKind === "LIVE_PAGE" && specimen.observationId === descriptor.observationId);
      if (!sourceSpecimen || descriptor.sourceDemandDigest !== source?.evidenceDemand?.digest
        || descriptor.sourceChildCandidateDigest !== source?.evidenceDemand?.childCandidateDigest
        || sourceSpecimen?.stateSignature !== descriptor.observationSignature) {
        if (selectedIds !== null && consumers.some((id) => selectedIds.includes(id))) {
          fail("REPORT_CHAIN_SOURCE_NOT_ADMITTED", inputId);
        }
        allComplete = false;
      }
    }
    for (const child of report.children.filter((entry) => entry.pageOperationRequired
      && (selectedIds === null || selectedIds.includes(entry.childCapabilityId)))) {
      if (!child.collection) {
        allComplete = false;
        if (child.captureComplete !== false) fail("REPORT_CHILD_CAPTURE_CLAIM_MISMATCH", child.childCapabilityId);
        continue;
      }
      anyCollection = true;
      const context = child.collection.captureContext;
      if (!nonEmptyObject(context)) fail("REPORT_CHILD_CAPTURE_CONTEXT_REQUIRED", child.childCapabilityId);
      if (!nonEmptyObject(child.pageEvidenceCoverage)) {
        const assessment = assessCapture({
          ...context,
          children: [{
            childCapabilityId: child.childCapabilityId,
            demandDigest: child.collection.demandDigest,
            childCandidateDigest: child.collection.childCandidateDigest,
            inputRefs: child.collection.inputRefs ?? [],
            factBindings: child.collection.factBindings ?? [],
            specimens: child.collection.specimens ?? [],
          }],
        }, report, matrix, false, [child.childCapabilityId]);
        const assessed = assessment.assessments[child.childCapabilityId];
        if (!assessed.complete) allComplete = false;
        if (child.captureComplete !== assessed.complete
          || JSON.stringify(child.captureMissing) !== JSON.stringify(assessed.missing)
          || JSON.stringify(child.demandCoverage) !== JSON.stringify(assessed.demandCoverage)) {
          fail("REPORT_CHILD_CAPTURE_CLAIM_MISMATCH", child.childCapabilityId);
        }
        continue;
      }
      const projected = projectExistingChild(currentById[child.childCapabilityId], child,
        report.captureMetadata?.chainInputs ?? {});
      if (projected.missing.length > 0) allComplete = false;
      if (child.captureComplete !== (projected.missing.length === 0)
        || JSON.stringify(child.captureMissing) !== JSON.stringify(projected.missing)
        || JSON.stringify(child.demandCoverage) !== JSON.stringify(projected.coverage)
        || JSON.stringify(child.pageEvidenceCoverage) !== JSON.stringify(projected.pageEvidenceCoverage)
        || JSON.stringify(child.collection.factBindings) !== JSON.stringify(projected.factBindings)) {
        fail("REPORT_CHILD_CAPTURE_CLAIM_MISMATCH", child.childCapabilityId);
      }
    }
    assessedComplete = allComplete;
    const expectedStatus = selectedIds === null
      ? allComplete ? "CAPTURE_COMPLETE" : anyCollection ? "CAPTURE_PARTIAL" : "NOT_CAPTURED"
      : report.captureStatus;
    if (selectedIds === null && report.captureStatus !== expectedStatus) {
      fail("REPORT_CAPTURE_CLAIM_MISMATCH", `${report.captureStatus}/${expectedStatus}`);
    }
  }
  if (requireComplete) {
    if (report.captureStatus !== "CAPTURE_COMPLETE" || !assessedComplete) {
      fail("REPORT_NOT_COMPLETE", report.captureStatus ?? "missing");
    }
    const incomplete = report.children.filter((child) => child.pageOperationRequired
      && (child.captureComplete !== true || child.demandCoverage?.percent !== 100));
    if (incomplete.length > 0) fail("REPORT_CHILD_NOT_READY", incomplete.map((child) => child.childCapabilityId).join(","));
  }
  return { valid: true, complete: report.captureStatus === "CAPTURE_COMPLETE" };
}

function evidenceBrief(report, child, scopedFacts = []) {
  const bindings = child.collection?.factBindings ?? [];
  const selectedFacts = scopedFacts.length > 0
    ? scopedFacts
    : bindings.filter((binding) => binding.bindingKind === "LIVE_OBSERVATION").map((binding) => binding.factId);
  const facts = selectedFacts.map((factId) => {
    const demandFact = child.evidenceDemand.facts.find((entry) => entry.factId === factId);
    const binding = bindings.find((entry) => entry.factId === factId);
    const specimen = child.collection?.specimens?.find((entry) =>
      entry.evidenceKind === "LIVE_PAGE" && entry.observationId === binding?.observationId);
    return stable({
      factId,
      kind: demandFact?.kind ?? null,
      expected: demandFact?.expected ?? null,
      expectedHash: binding?.expectedHash ?? null,
      bindingKind: binding?.bindingKind ?? null,
      observationId: binding?.observationId ?? null,
      pointers: binding?.pointers ?? [],
      actualValues: (binding?.pointers ?? []).map((pointer) => ({
        pointer,
        value: valueAtPath(specimen, pointer),
      })),
    });
  });
  const observationIds = new Set(facts.map((entry) => entry.observationId).filter(nonEmptyString));
  const observations = (child.collection?.specimens ?? []).filter((entry) =>
    entry.evidenceKind === "LIVE_PAGE" && observationIds.has(entry.observationId)).map((entry) => stable({
      stateId: entry.stateId,
      observationId: entry.observationId,
      capturedAt: entry.capturedAt,
      sourceSceneId: entry.sourceSceneId,
      sourceSceneSignature: entry.sourceSceneSignature,
      documentIdentityHash: entry.documentIdentityHash,
      revision: entry.revision,
      stateSignature: entry.stateSignature,
      stateFacts: entry.stateFacts,
      core: entry.core,
      related: {
        ancestors: entry.related?.ancestors,
        siblings: entry.related?.siblings,
        linkedNodes: entry.related?.linkedNodes,
        beforeAfterDiff: entry.related?.beforeAfterDiff,
        postconditions: entry.related?.postconditions,
        transitionChain: entry.related?.transitionChain,
      },
      peripheral: {
        pageKind: entry.peripheral?.pageKind,
        sanitizedUrlIdentity: entry.peripheral?.sanitizedUrlIdentity,
        locale: entry.peripheral?.locale,
        viewport: entry.peripheral?.viewport,
        theme: entry.peripheral?.theme,
        chromeVersion: entry.peripheral?.chromeVersion,
        providerBuildMarker: entry.peripheral?.providerBuildMarker,
        uiVariant: entry.peripheral?.uiVariant,
        pageState: entry.peripheral?.pageState,
        runId: entry.peripheral?.runId,
      },
    }));
  const derivedFixtures = (child.collection?.specimens ?? []).filter((entry) =>
    entry.evidenceKind === "DERIVED_FIXTURE" && observationIds.has(entry.derivedFromObservationId))
    .map((entry) => stable({
      stateId: entry.stateId,
      evidenceKind: entry.evidenceKind,
      derivedFromObservationId: entry.derivedFromObservationId,
      mutation: entry.mutation,
      expectedFailureCode: entry.expectedFailureCode,
    }));
  return stable({
    childCapabilityId: child.childCapabilityId,
    captureEpoch: report.captureEpoch,
    projectionRevision: report.projectionRevision,
    factScope: selectedFacts,
    facts,
    observations,
    derivedFixtures,
    gaps: child.captureMissing ?? [],
    rules: {
      liveAndDerivedMustNotBeConfused: true,
      missingFactMustNotBeGuessed: true,
      unobservedSelectorAttributeOrOwnerRelationForbidden: true,
    },
  });
}

function admissionCandidate(report, selected, scopedFacts = []) {
  return `CHILDSET:${sha256(JSON.stringify(stable({
    captureEpoch: report.captureEpoch,
    projectionRevision: report.projectionRevision,
    factScope: [...scopedFacts].sort(),
    children: selected.map((child) => ({
      childCapabilityId: child.childCapabilityId,
      childCandidateDigest: child.evidenceDemand.childCandidateDigest,
      evidenceBriefHash: sha256(JSON.stringify(evidenceBrief(report, child, scopedFacts))),
    })).sort((left, right) => left.childCapabilityId.localeCompare(right.childCapabilityId)),
  }))).slice("sha256:".length)}`;
}

async function admitReport(repo, matrixPath, reportPath, childArg, candidateArg, factsArg = "") {
  if (!nonEmptyString(candidateArg)) fail("ADMISSION_CANDIDATE_REQUIRED");
  const report = await readJson(reportPath);
  const pageChildren = report.children.filter((child) => child.pageOperationRequired);
  const requested = childArg && childArg !== "all" ? childArg.split(",").filter(Boolean) : pageChildren.map((child) => child.childCapabilityId);
  assertUnique(requested, "ADMISSION_CHILD_DUPLICATE");
  await validateReport(repo, matrixPath, reportPath, false, requested);
  const selected = requested.map((id) => pageChildren.find((child) => child.childCapabilityId === id)
    ?? fail("ADMISSION_CHILD_NOT_PAGE_OPERATION", id));
  const scopedFacts = factsArg ? factsArg.split(",").filter(Boolean) : [];
  assertUnique(scopedFacts, "ADMISSION_FACT_DUPLICATE");
  if (scopedFacts.length > 0 && selected.length !== 1) fail("ADMISSION_FACT_SCOPE_REQUIRES_ONE_CHILD");
  const expectedCandidate = admissionCandidate(report, selected, scopedFacts);
  if (candidateArg !== expectedCandidate) {
    fail("ADMISSION_CANDIDATE_MISMATCH", `${candidateArg}/${expectedCandidate}`);
  }
  for (const child of selected) {
    if (scopedFacts.length === 0) {
      if (child.captureComplete !== true || child.demandCoverage?.percent !== 100) {
        fail("ADMISSION_CHILD_NOT_READY", child.childCapabilityId);
      }
      continue;
    }
    const failures = scopedGptPageEvidenceFactFailures(child, child.evidenceDemand, scopedFacts);
    if (failures.length > 0) fail("ADMISSION_FACT_EVIDENCE_INVALID", failures.join(","));
  }
  const evidenceBriefs = selected.map((child) => evidenceBrief(report, child, scopedFacts));
  const consumed = selected.map((child) => ({
    childCapabilityId: child.childCapabilityId,
    demandDigest: child.evidenceDemand.digest,
    requiredLiveStates: child.collectionRequirements.requiredLiveStates,
    coreTargets: child.collectionRequirements.coreTargets,
    authorizedProductVariantHashes: Object.values(child.evidenceDemand.authorizedInputRequirements ?? {})
      .flatMap((entry) => entry.variants.map((variant) => variant.valueHash)).sort(),
    observationSignatures: child.collection.specimens.filter((entry) => entry.evidenceKind === "LIVE_PAGE")
      .map((entry) => entry.stateSignature).sort(),
    factScope: scopedFacts.length > 0 ? scopedFacts : child.evidenceDemand.facts.map((fact) => fact.factId),
  }));
  const admissionReceipt = stable({
    candidate: expectedCandidate,
    reportSchema: report.schemaVersion,
    captureEpoch: report.captureEpoch,
    projectionRevision: report.projectionRevision,
    admissionMode: scopedFacts.length > 0 ? "OBSERVATION_SCOPED" : "FULL_CHILD",
    evidenceBriefHashes: evidenceBriefs.map((brief) => ({
      childCapabilityId: brief.childCapabilityId,
      hash: sha256(JSON.stringify(brief)),
    })),
    consumed,
  });
  return stable({
    status: "ADMITTED",
    candidate: expectedCandidate,
    reportSchema: report.schemaVersion,
    captureEpoch: report.captureEpoch,
    projectionRevision: report.projectionRevision,
    admissionReceipt,
    admissionReceiptHash: sha256(JSON.stringify(admissionReceipt)),
    evidenceBriefs,
    children: selected.map((child) => ({
      childCapabilityId: child.childCapabilityId,
      demandDigest: child.evidenceDemand.digest,
      demandCoverage: child.demandCoverage.percent,
      captureComplete: child.captureComplete,
    })),
  });
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
        wroteReport: false,
      })}\n`);
      return;
    }
    const outputPath = requiredArg(args, "output");
    assertCanonicalRepositoryOutput(repo, outputPath);
    await assertNoSecondRepositoryReport(repo, outputPath);
    await writeJsonAtomic(outputPath, report);
    process.stdout.write(`${JSON.stringify({ status: report.captureStatus, contracts: report.denominator.contractChildren, pageOperationChildren: report.denominator.pageOperationChildren, output: outputPath, wroteReport: true })}\n`);
    return;
  }
  if (command === "merge") {
    const repo = requiredArg(args, "repo");
    const capturePath = requiredArg(args, "capture");
    const outputPath = requiredArg(args, "output");
    assertCanonicalRepositoryOutput(repo, outputPath);
    await assertNoSecondRepositoryReport(repo, outputPath);
    const childArg = typeof args.child === "string" ? args.child : "all";
    const baseReportPath = typeof args["base-report"] === "string" ? args["base-report"] : null;
    if (childArg !== "all" && baseReportPath === null) fail("TARGETED_MERGE_BASE_REPORT_REQUIRED");
    const report = await mergeCapture(repo, matrixPath, capturePath, outputPath, baseReportPath, childArg);
    process.stdout.write(`${JSON.stringify({ status: report.captureStatus, output: outputPath,
      requestedChildren: childArg, preservedUnselectedChildren: childArg !== "all" })}\n`);
    return;
  }
  if (command === "refresh") {
    const repo = requiredArg(args, "repo");
    const baseReportPath = requiredArg(args, "base-report");
    const outputPath = requiredArg(args, "output");
    if (typeof args.child !== "string" || args.child.length === 0) fail("ARGUMENT_REQUIRED", "--child");
    assertCanonicalRepositoryOutput(repo, outputPath);
    await assertNoSecondRepositoryReport(repo, outputPath);
    const result = await reprojectReport(repo, matrixPath, baseReportPath, outputPath, args.child);
    process.stdout.write(`${JSON.stringify({
      status: result.report.captureStatus,
      output: outputPath,
      requestedChildren: args.child,
      reprojectedChildren: "all-page-children",
      captureEpoch: result.report.captureEpoch,
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
    const result = await admitReport(repo, matrixPath, reportPath,
      typeof args.child === "string" ? args.child : "all",
      typeof args.candidate === "string" ? args.candidate : "",
      typeof args.facts === "string" ? args.facts : "");
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }
  if (command === "candidate") {
    const repo = requiredArg(args, "repo");
    const reportPath = requiredArg(args, "report");
    assertCanonicalReportInput(repo, reportPath);
    await assertNoSecondRepositoryReport(repo, reportPath);
    const report = await readJson(reportPath);
    const pageChildren = report.children.filter((child) => child.pageOperationRequired);
    const requested = typeof args.child === "string" && args.child !== "all"
      ? args.child.split(",").filter(Boolean) : pageChildren.map((child) => child.childCapabilityId);
    await validateReport(repo, matrixPath, reportPath, false, requested);
    const selected = requested.map((id) => pageChildren.find((child) => child.childCapabilityId === id)
      ?? fail("ADMISSION_CHILD_NOT_PAGE_OPERATION", id));
    const scopedFacts = typeof args.facts === "string" ? args.facts.split(",").filter(Boolean) : [];
    assertUnique(scopedFacts, "ADMISSION_FACT_DUPLICATE");
    if (scopedFacts.length > 0 && selected.length !== 1) fail("ADMISSION_FACT_SCOPE_REQUIRES_ONE_CHILD");
    process.stdout.write(`${JSON.stringify({ candidate: admissionCandidate(report, selected, scopedFacts), children: requested,
      factScope: scopedFacts,
      evidenceBriefHashes: selected.map((child) => ({ childCapabilityId: child.childCapabilityId,
        hash: sha256(JSON.stringify(evidenceBrief(report, child, scopedFacts))) })) })}\n`);
    return;
  }
  fail("COMMAND_UNKNOWN", command);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
