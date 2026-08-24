export const CANONICAL_READY_PHASES = Object.freeze([
  "codex-entry-gate",
  "typecheck",
  "audit-self-test",
  "audit-system-mutants",
  "build-audit-artifacts",
  "active-law-full-coverage",
  "generated-plan-runner",
  "generated-artifact-truth",
  "acceptance-runner",
] as const);

export type CanonicalReadyPhase = typeof CANONICAL_READY_PHASES[number];

export type AcceptanceBinding = Readonly<{
  script: string;
  lawId: string;
  clauseId: string;
  ownerId: string;
  evidenceFacet: "static.ast" | "static.contract" | "exam.golden";
}>;

export const CANONICAL_ACCEPTANCE_BINDINGS: readonly AcceptanceBinding[] = Object.freeze([
  { script: "acceptance:constitutional-boundary-anti-escape", lawId: "LAW-ARCHITECTURE-BOUNDARY-001-V1", clauseId: "law-architecture-boundary-001-v1-requirement", ownerId: "architecture-boundary", evidenceFacet: "exam.golden" },
  { script: "acceptance:architecture-active-plugin-mediators", lawId: "LAW-ARCHITECTURE-BOUNDARY-001-V1", clauseId: "law-architecture-boundary-001-v1-requirement", ownerId: "architecture-boundary", evidenceFacet: "exam.golden" },
  { script: "acceptance:code-purity-zombie-deep", lawId: "LAW-CODE-PURITY-001-V1", clauseId: "law-code-purity-001-v1-requirement", ownerId: "code-purity", evidenceFacet: "exam.golden" },
  { script: "acceptance:audit-truth-coverage", lawId: "LAW-AUDIT-TRUTH-001-V1", clauseId: "law-audit-truth-001-v1-requirement", ownerId: "audit-truth", evidenceFacet: "exam.golden" },
  { script: "acceptance:ci-summary-truth", lawId: "LAW-AUDIT-SYSTEM-001-V1", clauseId: "law-audit-system-001-v1-requirement", ownerId: "audit-system", evidenceFacet: "exam.golden" },
  { script: "acceptance:audit-law-parser", lawId: "LAW-AUDIT-SYSTEM-001-V1", clauseId: "law-audit-system-001-v1-requirement", ownerId: "audit-system", evidenceFacet: "exam.golden" },
  { script: "acceptance:audit-source-evidence-reachability", lawId: "LAW-AUDIT-SYSTEM-001-V1", clauseId: "law-audit-system-001-v1-requirement", ownerId: "audit-system", evidenceFacet: "static.contract" },
  { script: "acceptance:audit-owner-filesystem-writer", lawId: "LAW-AUDIT-SYSTEM-001-V1", clauseId: "law-audit-system-001-v1-requirement", ownerId: "audit-system", evidenceFacet: "static.ast" },
  { script: "acceptance:runtime-log-spine", lawId: "LAW-RUNTIME-LOG-SPINE-001-V3", clauseId: "law-runtime-log-spine-001-v3-requirement", ownerId: "runtime-log-spine", evidenceFacet: "exam.golden" },
  { script: "acceptance:startup-entrypoint", lawId: "LAW-STARTUP-ENTRYPOINT-001-V4", clauseId: "law-startup-entrypoint-001-v4-requirement", ownerId: "startup-entrypoint", evidenceFacet: "exam.golden" },
  { script: "acceptance:workbench-api-boundary", lawId: "LAW-WORKBENCH-API-BOUNDARY-001-V4", clauseId: "law-workbench-api-boundary-001-v4-requirement", ownerId: "workbench-api-boundary", evidenceFacet: "exam.golden" },
  { script: "acceptance:forensics-persistence-capability", lawId: "LAW-FORENSICS-PERSISTENCE-CAPABILITY-001-V2", clauseId: "law-forensics-persistence-capability-001-v2-requirement", ownerId: "forensics-persistence-capability", evidenceFacet: "exam.golden" },
]);

export const REQUIRED_RUNTIME_LOG_LEAVES = Object.freeze([
  "node --import tsx scripts/acceptance/runtime-log-redaction.acceptance.ts",
  "node --import tsx scripts/acceptance/runtime-log-stage-pair.acceptance.ts",
  "node --import tsx scripts/acceptance/runtime-log-debug-bundle.acceptance.ts",
  "node --import tsx scripts/acceptance/runtime-log-spine-ast-anti-escape.acceptance.ts",
] as const);

const splitSequence = (command: string): string[] => {
  if (/[|;<>`]|\$\(/u.test(command) || command.includes("||")) throw new Error("ACCEPTANCE_SHELL_AMBIGUOUS");
  return command.split("&&").map((item) => item.trim()).filter(Boolean);
};

export function resolveAcceptanceLeaves(scripts: Readonly<Record<string, string>>, script: string, stack: readonly string[] = []): string[] {
  if (stack.includes(script)) throw new Error(`ACCEPTANCE_SCRIPT_CYCLE:${[...stack, script].join("->")}`);
  const command = scripts[script];
  if (!command) throw new Error(`ACCEPTANCE_SCRIPT_MISSING:${script}`);
  const leaves: string[] = [];
  for (const part of splitSequence(command)) {
    const nested = part.match(/^npm run ([a-zA-Z0-9:_-]+)$/u);
    if (nested) leaves.push(...resolveAcceptanceLeaves(scripts, nested[1]!, [...stack, script]));
    else if (/^node(?:\s|$)/u.test(part)) leaves.push(part);
    else throw new Error(`ACCEPTANCE_LEAF_UNRECOGNIZED:${script}:${part}`);
  }
  if (leaves.length === 0) throw new Error(`ACCEPTANCE_LEAF_EMPTY:${script}`);
  return leaves;
}

export function validateAcceptanceBindings(
  scripts: Readonly<Record<string, string>>,
  laws: readonly { lawId?: unknown; capabilityDomain?: unknown }[],
): string[] {
  const findings: string[] = [];
  const lawOwners = new Map(laws.flatMap((law) => typeof law.lawId === "string" && typeof law.capabilityDomain === "string" ? [[law.lawId, law.capabilityDomain] as const] : []));
  const seenScripts = new Set<string>();
  for (const binding of CANONICAL_ACCEPTANCE_BINDINGS) {
    if (seenScripts.has(binding.script)) findings.push(`ACCEPTANCE_BINDING_DUPLICATE:${binding.script}`);
    seenScripts.add(binding.script);
    if (lawOwners.get(binding.lawId) !== binding.ownerId) findings.push(`ACCEPTANCE_LAW_OWNER_MISMATCH:${binding.script}`);
    if (!binding.clauseId || !binding.evidenceFacet) findings.push(`ACCEPTANCE_BINDING_INCOMPLETE:${binding.script}`);
    try { resolveAcceptanceLeaves(scripts, binding.script); } catch (error) { findings.push(error instanceof Error ? error.message : String(error)); }
  }
  try {
    const runtimeLeaves = resolveAcceptanceLeaves(scripts, "acceptance:runtime-log-spine");
    if (JSON.stringify(runtimeLeaves) !== JSON.stringify(REQUIRED_RUNTIME_LOG_LEAVES)) findings.push("RUNTIME_LOG_ACCEPTANCE_DENOMINATOR_MISMATCH");
  } catch (error) { findings.push(error instanceof Error ? error.message : String(error)); }
  return findings.sort();
}

export function validatePhaseReceipts(receipts: readonly { phaseId: string; outcome: "PASS" | "FAIL" }[]): string[] {
  const findings: string[] = [];
  const phases = receipts.map((receipt) => receipt.phaseId).filter((phase, index, all) => index === 0 || phase !== all[index - 1]);
  if (JSON.stringify(phases) !== JSON.stringify(CANONICAL_READY_PHASES)) findings.push("CI_PHASE_SET_OR_ORDER_MISMATCH");
  for (const phase of CANONICAL_READY_PHASES) {
    const phaseReceipts = receipts.filter((receipt) => receipt.phaseId === phase);
    if (phaseReceipts.length === 0) findings.push(`CI_PHASE_RECEIPT_MISSING:${phase}`);
    if (phaseReceipts.some((receipt) => receipt.outcome !== "PASS")) findings.push(`CI_PHASE_FAILED:${phase}`);
  }
  return findings;
}
