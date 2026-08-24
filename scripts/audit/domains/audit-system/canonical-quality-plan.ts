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
export type ExamEvidenceFacet = "exam.golden" | "exam.property" | "exam.state-machine";

export type AcceptanceClaim = Readonly<{
  lawId: string;
  clauseId: string;
  evidenceFacet: ExamEvidenceFacet;
}>;

export type AcceptanceBinding = Readonly<{
  script: string;
  ownerId: string;
  claims: readonly AcceptanceClaim[];
}>;

const claim = (lawId: string, evidenceFacet: ExamEvidenceFacet): AcceptanceClaim => ({
  lawId,
  clauseId: `${lawId.toLowerCase()}-requirement`,
  evidenceFacet,
});

export const CANONICAL_ACCEPTANCE_BINDINGS: readonly AcceptanceBinding[] = Object.freeze([
  {
    script: "acceptance:ai-input-gateway",
    ownerId: "ai-input-gateway",
    claims: [
      claim("LAW-AI-INPUT-GATEWAY-001-V1", "exam.golden"),
      claim("LAW-AI-INPUT-GATEWAY-002-V1", "exam.golden"),
      claim("LAW-AI-INPUT-GATEWAY-003-V1", "exam.golden"),
      claim("LAW-AI-INPUT-GATEWAY-004-V1", "exam.golden"),
      claim("LAW-AI-INPUT-GATEWAY-005-V4", "exam.golden"),
      claim("LAW-AI-INPUT-GATEWAY-006-V1", "exam.golden"),
      claim("LAW-AI-INPUT-GATEWAY-007-V1", "exam.golden"),
    ],
  },
  {
    script: "acceptance:app-shell-ui",
    ownerId: "app-shell-ui",
    claims: [
      claim("LAW-APP-SHELL-UI-001-V2", "exam.golden"),
      claim("LAW-APP-SHELL-UI-002-V1", "exam.golden"),
      claim("LAW-APP-SHELL-UI-003-V1", "exam.golden"),
    ],
  },
  {
    script: "acceptance:audit-system",
    ownerId: "audit-system",
    claims: [claim("LAW-AUDIT-SYSTEM-001-V1", "exam.golden")],
  },
  {
    script: "acceptance:architecture-active-plugin-mediators",
    ownerId: "capability-governance",
    claims: [claim("LAW-CAPABILITY-GOVERNANCE-001-V1", "exam.golden")],
  },
  {
    script: "acceptance:code-purity-zombie-deep",
    ownerId: "code-purity",
    claims: [claim("LAW-CODE-PURITY-001-V1", "exam.golden")],
  },
  {
    script: "acceptance:forensics-persistence-capability",
    ownerId: "forensics-persistence-capability",
    claims: [
      claim("LAW-FORENSICS-PERSISTENCE-CAPABILITY-001-V2", "exam.golden"),
      claim("LAW-FORENSICS-PERSISTENCE-CAPABILITY-002-V1", "exam.golden"),
      claim("LAW-FORENSICS-PERSISTENCE-CAPABILITY-003-V2", "exam.golden"),
    ],
  },
  {
    script: "acceptance:local-app-shell",
    ownerId: "local-app-shell",
    claims: [
      claim("LAW-LOCAL-APP-SHELL-001-V4", "exam.golden"),
      claim("LAW-LOCAL-APP-SHELL-002-V3", "exam.golden"),
      claim("LAW-LOCAL-APP-SHELL-003-V1", "exam.golden"),
    ],
  },
  {
    script: "acceptance:local-browser-terminal",
    ownerId: "local-browser-session",
    claims: [
      claim("LAW-LOCAL-BROWSER-SESSION-004-V5", "exam.golden"),
      claim("LAW-LOCAL-BROWSER-SESSION-004-V5", "exam.property"),
    ],
  },
  {
    script: "acceptance:runtime-log-spine",
    ownerId: "runtime-log-spine",
    claims: [
      claim("LAW-RUNTIME-LOG-SPINE-001-V3", "exam.golden"),
      claim("LAW-RUNTIME-LOG-SPINE-002-V2", "exam.golden"),
      claim("LAW-RUNTIME-LOG-SPINE-003-V2", "exam.golden"),
    ],
  },
  {
    script: "acceptance:startup-entrypoint",
    ownerId: "startup-entrypoint",
    claims: [
      claim("LAW-STARTUP-ENTRYPOINT-001-V4", "exam.golden"),
      claim("LAW-STARTUP-ENTRYPOINT-002-V1", "exam.golden"),
    ],
  },
  {
    script: "acceptance:system-security",
    ownerId: "system-security",
    claims: [claim("LAW-SYSTEM-SECURITY-001-V1", "exam.golden")],
  },
  {
    script: "acceptance:xuanxue-ai-production",
    ownerId: "xuanxue-ai-production",
    claims: [
      claim("LAW-XUANXUE-AI-PRODUCTION-001-V7", "exam.golden"),
      claim("LAW-XUANXUE-AI-PRODUCTION-001-V7", "exam.property"),
      claim("LAW-XUANXUE-AI-PRODUCTION-001-V7", "exam.state-machine"),
    ],
  },
  {
    script: "acceptance:xuanxue-ai-production-localization-contract",
    ownerId: "xuanxue-ai-production-localization-contract",
    claims: [claim("LAW-XUANXUE-AI-PRODUCTION-LOCALIZATION-CONTRACT-001-V3", "exam.golden")],
  },
]);

export const UNCLAIMED_MUTATION_SCRIPTS = Object.freeze([
  "acceptance:constitutional-boundary-anti-escape",
  "acceptance:audit-truth-coverage",
  "acceptance:audit-source-evidence-reachability",
  "acceptance:audit-owner-filesystem-writer",
  "acceptance:workbench-api-boundary",
] as const);

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

export function resolveAcceptanceLeaves(
  scripts: Readonly<Record<string, string>>,
  script: string,
  stack: readonly string[] = [],
): string[] {
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

type LawEvidenceRecord = { lawId?: unknown; capabilityDomain?: unknown; evidenceModes?: unknown };

const claimKey = (lawId: string, evidenceFacet: string): string => `${lawId}|${evidenceFacet}`;

type LawExamRecord = { ownerId: string; evidenceModes: string[] };

const buildLawRecords = (laws: readonly LawEvidenceRecord[]): Map<string, LawExamRecord> => new Map(
  laws.flatMap((law) =>
    typeof law.lawId === "string" && typeof law.capabilityDomain === "string" && Array.isArray(law.evidenceModes)
      ? [[law.lawId, {
          ownerId: law.capabilityDomain,
          evidenceModes: law.evidenceModes.filter((mode): mode is string => typeof mode === "string"),
        }] as const]
      : []),
);

const requiredExamClaims = (lawRecords: ReadonlyMap<string, LawExamRecord>): Set<string> => new Set(
  [...lawRecords.entries()].flatMap(([lawId, record]) =>
    record.evidenceModes.filter((mode) => mode.startsWith("exam.")).map((mode) => claimKey(lawId, mode))),
);

const pushScriptResolutionFinding = (
  scripts: Readonly<Record<string, string>>,
  script: string,
  findings: string[],
): void => {
  try { resolveAcceptanceLeaves(scripts, script); } catch (error) {
    findings.push(error instanceof Error ? error.message : String(error));
  }
};

const validateBindingClaims = (
  binding: AcceptanceBinding,
  lawRecords: ReadonlyMap<string, LawExamRecord>,
  observedClaims: Set<string>,
  findings: string[],
): void => {
  for (const current of binding.claims) {
    const law = lawRecords.get(current.lawId);
    const key = claimKey(current.lawId, current.evidenceFacet);
    if (!law || law.ownerId !== binding.ownerId) findings.push(`ACCEPTANCE_LAW_OWNER_MISMATCH:${binding.script}:${current.lawId}`);
    if (!law?.evidenceModes.includes(current.evidenceFacet)) findings.push(`ACCEPTANCE_EVIDENCE_FACET_UNDECLARED:${binding.script}:${key}`);
    if (current.clauseId !== `${current.lawId.toLowerCase()}-requirement`) findings.push(`ACCEPTANCE_CLAUSE_INVALID:${binding.script}:${current.lawId}`);
    if (observedClaims.has(key)) findings.push(`ACCEPTANCE_CLAIM_DUPLICATE:${key}`);
    observedClaims.add(key);
  }
};

const validateRuntimeLogLeaves = (scripts: Readonly<Record<string, string>>, findings: string[]): void => {
  try {
    const runtimeLeaves = resolveAcceptanceLeaves(scripts, "acceptance:runtime-log-spine");
    if (JSON.stringify(runtimeLeaves) !== JSON.stringify(REQUIRED_RUNTIME_LOG_LEAVES)) findings.push("RUNTIME_LOG_ACCEPTANCE_DENOMINATOR_MISMATCH");
  } catch (error) {
    findings.push(error instanceof Error ? error.message : String(error));
  }
};

export function validateAcceptanceBindings(
  scripts: Readonly<Record<string, string>>,
  laws: readonly LawEvidenceRecord[],
): string[] {
  const findings: string[] = [];
  const lawRecords = buildLawRecords(laws);
  const requiredClaims = requiredExamClaims(lawRecords);
  const observedClaims = new Set<string>();
  const seenScripts = new Set<string>();
  for (const binding of CANONICAL_ACCEPTANCE_BINDINGS) {
    if (seenScripts.has(binding.script)) findings.push(`ACCEPTANCE_BINDING_DUPLICATE:${binding.script}`);
    seenScripts.add(binding.script);
    if (binding.claims.length === 0) findings.push(`ACCEPTANCE_BINDING_EMPTY:${binding.script}`);
    pushScriptResolutionFinding(scripts, binding.script, findings);
    validateBindingClaims(binding, lawRecords, observedClaims, findings);
  }
  for (const required of requiredClaims) if (!observedClaims.has(required)) findings.push(`ACCEPTANCE_EXAM_CLAIM_MISSING:${required}`);
  for (const observed of observedClaims) if (!requiredClaims.has(observed)) findings.push(`ACCEPTANCE_EXAM_CLAIM_UNEXPECTED:${observed}`);
  for (const script of UNCLAIMED_MUTATION_SCRIPTS) pushScriptResolutionFinding(scripts, script, findings);
  validateRuntimeLogLeaves(scripts, findings);
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
