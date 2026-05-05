import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "tmp/audit/ability-law-census");

const groups = [
  ["commander-console", "GrassEye Commander Console 总司令控制台能力组施工图.md", "audit:commander-console", [".github/instructions/cursor-rules/modules/module-startup-entrypoint.instructions.md"]],
  ["orchestration", "GrassEye Orchestration 总指挥能力组施工图.md", "audit:orchestration"],
  ["nerve-bus", "GrassEye Nerve Bus 神经网络传输能力组施工图.md", "audit:nerve-bus"],
  ["ai", "GrassEye AI 大脑能力组施工图.md", "audit:ai", [".github/instructions/cursor-rules/modules/module-local-ai-runtime.instructions.md"]],
  ["open", "GrassEye Open 能力组施工图.md", "audit:open"],
  ["screenshot", "GrassEye Screenshot 能力组施工图.md", "audit:screenshot"],
  ["visual-target", "GrassEye Visual Target 视觉目标定位能力组施工图.md", "audit:visual-target"],
  ["geometry-guard", "GrassEye Geometry Guard 几何安全守卫能力组施工图.md", "audit:geometry-guard"],
  ["mouse-click", "GrassEye Mouse Click 能力组施工图.md", "audit:mouse-click"],
  ["text-input", "GrassEye Text Input 输入能力组施工图.md", "audit:text-input-capability"],
  ["mouse-scroll", "GrassEye Mouse Scroll 能力组施工图.md", "audit:mouse-scroll"],
  ["post-action-verification", "GrassEye Post-action Verification 动作后验证能力组施工图.md", "audit:post-action-verification"],
  ["forensics-persistence", "GrassEye Forensics Persistence 取证记账能力组施工图_FINAL.md", "audit:forensics-persistence"],
  ["page-state", "GrassEye Page State 页面状态感知能力组施工图.md", "audit:page-state"],
];

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));
const write = (rel, content) => {
  const target = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
};
const sha = (value) => crypto.createHash("sha256").update(value).digest("hex");
const getPackageScripts = () => JSON.parse(read("package.json")).scripts ?? {};
const loadJson = (rel, fallback) => exists(rel) ? JSON.parse(read(rel)) : fallback;

const extractField = (block, name) => {
  const match = block.match(new RegExp(`^${name}:\\s*(.+)$`, "m"));
  return match?.[1]?.trim() ?? "";
};

const extractSectionList = (block, heading) => {
  const start = block.search(new RegExp(`^${heading}:`, "m"));
  if (start < 0) return [];
  const tail = block.slice(start).split("\n").slice(1);
  const items = [];
  for (const line of tail) {
    if (/^###?\s/.test(line) || /^Required inspector:/.test(line) || /^Required negative proof:/.test(line)) break;
    const item = line.match(/^\s*-\s+(.+)$/);
    if (item) items.push(item[1].trim());
  }
  return items;
};

const extractRequiredInspector = (block) => extractSectionList(block, "Required inspector");
const extractRequiredNegativeProof = (block) => extractSectionList(block, "Required negative proof");

const extractTopic = (block) => {
  const topic = block.match(/^### 主题\s*\n+([^\n]+)/m);
  return topic?.[1]?.trim() ?? "";
};

const parseLaws = (abilityGroupId, lawFile) => {
  const content = read(lawFile);
  const matches = [...content.matchAll(/^## Law (GRASSEYE-[A-Z0-9-]+)$/gm)];
  return matches.map((match, index) => {
    const start = match.index ?? 0;
    const end = matches[index + 1]?.index ?? content.length;
    const block = content.slice(start, end);
    return {
      abilityGroupId,
      lawId: match[1],
      lawFile,
      lawStatus: extractField(block, "status"),
      tier: extractField(block, "tier"),
      capabilityDomain: extractField(block, "capabilityDomain"),
      enforcementMode: extractField(block, "enforcementMode"),
      evidenceMode: extractField(block, "evidenceMode"),
      lawTitle: extractTopic(block),
      summary: extractField(block, "summary"),
      requiredClauses: extractSectionList(block, "Required"),
      forbiddenClauses: extractSectionList(block, "Forbidden"),
      requiredInspectorClauses: extractRequiredInspector(block),
      requiredNegativeProofClauses: extractRequiredNegativeProof(block),
      clauseHash: sha(block),
    };
  }).filter((law) => law.lawStatus === "active");
};

const listFiles = (rel) => {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs, { withFileTypes: true })
    .flatMap((entry) => {
      const child = path.join(rel, entry.name);
      return entry.isDirectory() ? listFiles(child) : [child];
    })
    .sort();
};

const loadManifest = (rel) => exists(rel) ? JSON.parse(read(rel)) : {};
const hasStructuredInspection = (domainDir) => {
  const files = listFiles(domainDir).filter((file) => file.endsWith(".ts"));
  const haystack = files.map((file) => read(file)).join("\n");
  return /(ts-morph|createAuditProject|Project|SourceFile|SyntaxKind|getDescendantsOfKind|getImportDeclarations|JSON\.parse|parseJson|schema|zod|route graph|import graph|symbol)/i.test(haystack);
};

const hasCoreStringScanOnlySmell = (domainDir) => {
  const files = listFiles(domainDir).filter((file) => file.endsWith(".ts"));
  const haystack = files.map((file) => read(file)).join("\n");
  return /(scanForPatterns|grep|RegExp\(|\.includes\()/i.test(haystack) && !hasStructuredInspection(domainDir);
};

const findRuntimeProofFiles = (sourceRoot) =>
  listFiles(sourceRoot).filter((file) => /proof|receipt|evidence|runtime/i.test(file)).slice(0, 40);

const findChildCatalogFile = (sourceRoot) =>
  listFiles(sourceRoot).find((file) => /registry|child|catalog/i.test(file)) ?? "";

const makeInventory = (scripts) => groups.map(([abilityGroupId, blueprintName, npmAuditScript, additionalLawFiles = []]) => {
  const domain = `${abilityGroupId}-capability`;
  const domainDir = `scripts/audit/domains/${domain}`;
  const manifestPath = `${domainDir}/manifest.json`;
  const manifest = loadManifest(manifestPath);
  const sourceRoot = `src/capabilities/${abilityGroupId}`;
  return {
    abilityGroupId,
    lawFile: `.github/instructions/cursor-rules/modules/module-${abilityGroupId}-capability.instructions.md`,
    additionalLawFiles,
    blueprintFile: `docs/法案辅助文件/${blueprintName}`,
    sourceRoot,
    inspectorDomain: domain,
    inspectorManifest: manifestPath,
    runInspector: `${domainDir}/run-inspector.ts`,
    negativeProofHarness: `${domainDir}/negative-proof-harness.ts`,
    npmAuditScript,
    publicContractFile: `${sourceRoot}/contract.ts`,
    childCatalogFile: findChildCatalogFile(sourceRoot),
    runtimeProofFiles: findRuntimeProofFiles(sourceRoot),
    ownerBoundaryFiles: [
      `${sourceRoot}/ability-group.ts`,
      `${sourceRoot}/index.ts`,
      `${sourceRoot}/registry.ts`,
      manifest.entry ?? `${domainDir}/inspector.ts`,
    ].filter(Boolean),
    scriptExists: Boolean(scripts[npmAuditScript]),
    manifestLawIds: manifest.allowedLawIds ?? [],
  };
});

const scripts = getPackageScripts();
const previousValveStatePath = "tmp/audit/ability-law-census/one-way-valve-state.json";
const previousValveState = loadJson(previousValveStatePath, null);
const auditSummaryPath = "tmp/audit/ability-law-census/audit-runs/summary.json";
const auditSummary = loadJson(auditSummaryPath, []);
const auditSummaryByName = new Map(auditSummary.map((item) => [item.name, item]));
const staticClauseCoveragePath = "scripts/audit/generated/static-clause-coverage.generated.json";
const staticClauseCoverage = loadJson(staticClauseCoveragePath, {
  laws: [],
  globalChain: {
    observed: false,
    passed: false,
    blockers: ["static-clause-coverage.generated.json is missing."],
  },
});
const staticCoverageByLawId = new Map(staticClauseCoverage.laws.map((law) => [law.lawId, law]));
const inventory = makeInventory(scripts);
const inventoryByGroup = new Map(inventory.map((item) => [item.abilityGroupId, item]));
const laws = inventory.flatMap((inv) => [inv.lawFile, ...inv.additionalLawFiles].flatMap((lawFile) => parseLaws(inv.abilityGroupId, lawFile)));

const ledger = laws.map((law) => {
  const inv = inventoryByGroup.get(law.abilityGroupId);
  const coverageRecord = staticCoverageByLawId.get(law.lawId);
  const ownerInspectorPath = coverageRecord?.ownerInspectorEntry ?? `${path.dirname(inv.inspectorManifest)}/inspector.ts`;
  const negativeProofPath = coverageRecord?.negativeProofPath ?? inv.negativeProofHarness;
  const ownerBindingProofPath = coverageRecord?.ownerBindingProofPath ?? `tmp/audit/ability-law-census/regression-proofs/${law.abilityGroupId}/owner-binding/owner-binding-proof-summary.md`;
  const mutationProofPath = coverageRecord?.mutationProofPath ?? `tmp/audit/ability-law-census/regression-proofs/${law.abilityGroupId}/${law.lawId}/proof-summary.md`;
  return {
    ...law,
    lawTitle: law.lawTitle,
    blueprintRefs: [inv.blueprintFile, "docs/法案辅助文件/GrassEye 能力组与子能力总纲施工图.md"],
    ownerInspectorPath,
    negativeProofPath,
    ownerBindingProofPath,
    mutationProofPath,
    auditScript: `npm run ${coverageRecord?.ownerAuditScript ?? inv.npmAuditScript}`,
    coverageStatus: coverageRecord?.coverageStatus ?? "MISSING_STATIC_CLAUSE_COVERAGE_ENTRY",
    blockers: coverageRecord?.blockers ?? ["Missing static clause coverage entry."],
  };
});

const counts = ledger.reduce((acc, law) => {
  acc[law.coverageStatus] = (acc[law.coverageStatus] ?? 0) + 1;
  return acc;
}, {});
const countLines = Object.entries(counts)
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([status, count]) => `${status}: ${count}`);

const coverageHash = sha(JSON.stringify(ledger.map((law) => ({
  abilityGroupId: law.abilityGroupId,
  lawId: law.lawId,
  coverageStatus: law.coverageStatus,
  ownerInspectorPath: law.ownerInspectorPath,
  negativeProofPath: law.negativeProofPath,
  auditScript: law.auditScript,
}))));

const mdTable = (headers, rows) => [
  `| ${headers.join(" | ")} |`,
  `| ${headers.map(() => "---").join(" | ")} |`,
  ...rows.map((row) => `| ${row.map((cell) => String(cell ?? "").replaceAll("\n", "<br>").replaceAll("|", "\\|")).join(" | ")} |`),
].join("\n");

write("tmp/audit/ability-law-census/14-ability-groups.inventory.json", `${JSON.stringify(inventory, null, 2)}\n`);
write("tmp/audit/ability-law-census/14-ability-groups.inventory.md", [
  "# 14 Ability Groups Inventory",
  "",
  mdTable(
    ["abilityGroupId", "lawFile", "blueprintFile", "sourceRoot", "inspectorDomain", "inspectorManifest", "runInspector", "negativeProofHarness", "npmAuditScript"],
    inventory.map((item) => [item.abilityGroupId, item.lawFile, item.blueprintFile, item.sourceRoot, item.inspectorDomain, item.inspectorManifest, item.runInspector, item.negativeProofHarness, item.npmAuditScript]),
  ),
  "",
].join("\n"));

write("tmp/audit/ability-law-census/active-law-ledger.generated.json", `${JSON.stringify(ledger, null, 2)}\n`);
write("tmp/audit/ability-law-census/active-law-ledger.generated.md", [
  "# Active Law Ledger",
  "",
  mdTable(
    ["abilityGroupId", "lawId", "主题", "status", "tier", "enforcementMode", "evidenceMode", "coverageStatus", "ownerInspectorPath", "negativeProofPath", "auditScript"],
    ledger.map((law) => [law.abilityGroupId, law.lawId, law.lawTitle, law.lawStatus, law.tier, law.enforcementMode, law.evidenceMode, law.coverageStatus, law.ownerInspectorPath, law.negativeProofPath, law.auditScript]),
  ),
  "",
].join("\n"));

const matrixRows = ledger.map((law) => [
  law.abilityGroupId,
  law.lawId,
  exists(law.ownerInspectorPath) ? law.ownerInspectorPath : "MISSING",
  "Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof",
  exists(law.negativeProofPath) ? law.negativeProofPath : "MISSING",
  exists(`tmp/audit/ability-law-census/regression-proofs/${law.abilityGroupId}/${law.lawId}/proof-summary.md`) ? `tmp/audit/ability-law-census/regression-proofs/${law.abilityGroupId}/${law.lawId}/proof-summary.md` : "MISSING",
  law.coverageStatus,
]);

write("tmp/audit/ability-law-census/enforcement-coverage-matrix.md", [
  "# Enforcement Coverage Matrix",
  "",
  mdTable(["abilityGroupId", "lawId", "inspector", "check type", "negative proof", "mutation proof", "coverageStatus"], matrixRows),
  "",
].join("\n"));

const gaps = ledger.filter((law) => law.coverageStatus !== "ENFORCED");
write("tmp/audit/ability-law-census/owner-gap-matrix.md", [
  "# Owner Gap Matrix",
  "",
  mdTable(["abilityGroupId", "lawId", "gap type", "why", "fix files", "blueprint gap", "law change required"], gaps.map((law) => [
    law.abilityGroupId,
    law.lawId,
    law.coverageStatus,
    "Missing per-law production mutation proof and/or hard proof that negative proof covers required/forbidden/boundary/anti-escape clauses.",
    `${law.ownerInspectorPath}; ${law.negativeProofPath}; tmp/audit/ability-law-census/regression-proofs/${law.abilityGroupId}/${law.lawId}/`,
    "UNKNOWN_UNTIL_LOOP_N",
    "NO",
  ])),
  "",
].join("\n"));

write("tmp/audit/ability-law-census/negative-proof-matrix.md", [
  "# Negative Proof Matrix",
  "",
  mdTable(["abilityGroupId", "lawId", "negativeProofPath", "status"], ledger.map((law) => [
    law.abilityGroupId,
    law.lawId,
    law.negativeProofPath,
    exists(law.negativeProofPath) ? "PRESENT_NEEDS_CLAUSE_MAPPING_AND_MUTATION_VALIDATION" : "MISSING",
  ])),
  "",
].join("\n"));

write("tmp/audit/ability-law-census/production-mutation-proof-index.md", [
  "# Production Mutation Proof Index",
  "",
  mdTable(["abilityGroupId", "lawId", "proof directory", "status"], ledger.map((law) => {
    return [law.abilityGroupId, law.lawId, path.dirname(law.mutationProofPath), exists(law.mutationProofPath) ? "PRESENT" : "MISSING"];
  })),
  "",
].join("\n"));

write("tmp/audit/ability-law-census/loop-0-inventory-report.md", [
  "# LOOP-0 Inventory Report",
  "",
  `generatedAt: ${new Date().toISOString()}`,
  "",
  `Total active laws: ${ledger.length}`,
  ...countLines,
  "",
  "This report now mirrors audit-system static clause coverage status. It is evidence output only and no longer self-determines ENFORCED.",
  "",
  ...staticClauseCoverage.globalChain.blockers.map((blocker) => `Global blocker: ${blocker}`),
  "",
].join("\n"));

write("tmp/audit/ability-law-census/loop-progress.md", [
  "# Loop Progress",
  "",
  "- LOOP-0: completed inventory and conservative coverage classification.",
  "- LOOP-N: pending. Start with commander-console, one ability group at a time.",
  "",
].join("\n"));

write("tmp/audit/ability-law-census/final-coverage-report.md", [
  "# Final Coverage Report",
  "",
  ...inventory.flatMap((inv) => {
    const groupLaws = ledger.filter((law) => law.abilityGroupId === inv.abilityGroupId);
    const groupGaps = groupLaws.filter((law) => law.coverageStatus !== "ENFORCED");
    return [
      `## ${inv.abilityGroupId}`,
      "",
      "### 法条清单",
      "",
      mdTable(["lawId", "主题", "active", "tier", "enforcementMode", "status"], groupLaws.map((law) => [law.lawId, law.lawTitle, law.lawStatus === "active", law.tier, law.enforcementMode, law.coverageStatus])),
      "",
      "### 执法覆盖",
      "",
      mdTable(["lawId", "inspector", "check type", "negative proof", "mutation proof", "coverageStatus"], groupLaws.map((law) => [
        law.lawId,
        law.ownerInspectorPath,
        "Required Shape / Forbidden Shape / Boundary Attack / Anti-Escape / Runtime Proof",
        law.negativeProofPath,
        path.dirname(law.mutationProofPath),
        law.coverageStatus,
      ])),
      "",
      "### 缺口",
      "",
      groupGaps.length === 0 ? "NONE" : groupGaps.map((law) => `- ${law.lawId}: 缺口类型=${law.coverageStatus}; 为什么没覆盖=${law.blockers.join(" ")}; 需要修复文件=${law.ownerInspectorPath}, ${law.negativeProofPath}, ${path.dirname(law.mutationProofPath)}; 是否施工图缺失=UNKNOWN_UNTIL_LOOP_N; 是否需要申请修改法案=NO`).join("\n"),
      "",
      "### 本组运行结果",
      "",
      `- audit command: npm run ${inv.npmAuditScript}`,
      `- result: ${auditSummaryByName.has(inv.npmAuditScript) ? (auditSummaryByName.get(inv.npmAuditScript).exitCode === 0 ? "PASS" : "FAIL") : "NOT_RUN_IN_LOOP_0"}`,
      `- duration: ${auditSummaryByName.has(inv.npmAuditScript) ? `${auditSummaryByName.get(inv.npmAuditScript).durationMs}ms` : "N/A"}`,
      `- findings: ${auditSummaryByName.has(inv.npmAuditScript) ? `see tmp/audit/ability-law-census/audit-runs/${inv.npmAuditScript.replace(/[^a-z0-9.-]+/gi, "-")}.txt` : "inventory only"}`,
      "",
    ];
  }),
].join("\n"));

const failedAuditRows = auditSummary
  .filter((item) => item.exitCode !== 0)
  .map((item) => [item.name, item.command, item.exitCode, `${item.durationMs}ms`, `tmp/audit/ability-law-census/audit-runs/${item.name.replace(/[^a-z0-9.-]+/gi, "-")}.txt`]);

write("tmp/audit/ability-law-census/final-ready-decision.md", [
  "# Final Ready Decision",
  "",
  "ABILITY_LAW_ENFORCEMENT_CENSUS_NOT_READY",
  "",
  `Total active laws: ${ledger.length}`,
  ...countLines,
  "",
  "Reason: audit-system static-clause-coverage is the single source of truth, and the global chain is still blocked.",
  "",
  "## Global Chain Blockers",
  "",
  ...staticClauseCoverage.globalChain.blockers.map((blocker) => `- ${blocker}`),
  "",
  "## Failed Commands",
  "",
  failedAuditRows.length === 0 ? "NONE" : mdTable(["name", "command", "exitCode", "duration", "output"], failedAuditRows),
  "",
  "## 未覆盖 law 清单",
  "",
  mdTable(["lawId", "owner", "why", "fix files", "下一轮最小治理步骤"], gaps.map((law) => [
    law.lawId,
    law.abilityGroupId,
    law.blockers.join(" "),
    `${law.ownerInspectorPath}; ${law.negativeProofPath}; ${path.dirname(law.mutationProofPath)}`,
    `Run LOOP-N for ${law.abilityGroupId}: fix current owner audit failure if any, map clauses to structured checks, add/verify negative proof, perform production mutation FAIL→rollback→PASS proof, then rerun npm run ${inventoryByGroup.get(law.abilityGroupId).npmAuditScript}.`,
  ])),
  "",
].join("\n"));

const generatedFakePassDetected = ledger.some((law) => law.coverageStatus === "ENFORCED" && !staticClauseCoverage.globalChain.passed);
write("tmp/audit/ability-law-census/one-way-valve-state.json", `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  previousCoverageHash: previousValveState?.currentCoverageHash ?? null,
  currentCoverageHash: coverageHash,
  totalActiveLaws: ledger.length,
  enforcedCount: counts.ENFORCED ?? 0,
  partialCount: counts.OWNER_PROOF_COMPLETE_BUT_GLOBAL_CHAIN_BLOCKED ?? 0,
  notEnforcedCount: (counts.NOT_COVERED ?? 0) + (counts.MISSING_STATIC_CLAUSE_COVERAGE_ENTRY ?? 0),
  blockedCount: (counts.BLOCKED_BY_BLUEPRINT_DETAIL_GAP ?? 0) + (counts.LAW_CHANGE_APPLICATION_REQUIRED ?? 0),
  globalChainPassed: Boolean(staticClauseCoverage.globalChain.passed),
  regressionDetected: !staticClauseCoverage.globalChain.passed || generatedFakePassDetected,
  removedInspectorDetected: ledger.some((law) => !exists(law.ownerInspectorPath)),
  removedNegativeProofDetected: ledger.some((law) => !exists(law.negativeProofPath)),
  weakenedEnforcementDetected: ledger.some((law) => law.enforcementMode !== "machine-blocking"),
  warningOnlyDetected: false,
  generatedFakePassDetected,
}, null, 2)}\n`);

console.log(JSON.stringify({
  totalActiveLaws: ledger.length,
  counts,
  outputDir: "tmp/audit/ability-law-census",
}, null, 2));
