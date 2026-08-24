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

type RegistryExamBinding = { bindingId?:unknown;examId?:unknown;examRef?:unknown;evidenceModes?:unknown };
type LawEvidenceRecord = {
  lawId?:unknown;evidenceModes?:unknown;
  enforcement?:{examBindings?:unknown};
};
type ValidationState={identities:Set<string>;refs:Set<string>};

const pushScriptResolutionFinding = (
  scripts: Readonly<Record<string, string>>,
  script: string,
  findings: string[],
): void => {
  try { resolveAcceptanceLeaves(scripts, script); } catch (error) {
    findings.push(error instanceof Error ? error.message : String(error));
  }
};

const examSelector=(ref:string):string[]=>ref.split("#")[1]?.split("|")??[];

const addIdentity=(state:ValidationState,value:string,findings:string[]):void=>{if(state.identities.has(value))findings.push(`ACCEPTANCE_IDENTITY_DUPLICATE:${value}`);state.identities.add(value)};
const validateExamBinding=(raw:RegistryExamBinding,lawId:string,scripts:Readonly<Record<string,string>>,state:ValidationState,findings:string[]):string[]=>{
  if(typeof raw.bindingId!=="string"||typeof raw.examId!=="string"||typeof raw.examRef!=="string"||!Array.isArray(raw.evidenceModes)){findings.push(`ACCEPTANCE_BINDING_INVALID:${lawId}`);return[]}
  const selector=examSelector(raw.examRef);const modes=raw.evidenceModes.filter((mode):mode is string=>typeof mode==="string");
  if(selector.length!==4||selector[0]!=="runExamBinding"||selector[2]!==lawId||modes.length!==1||selector[3]!==modes[0])findings.push(`ACCEPTANCE_REF_INVALID:${raw.bindingId}`);
  addIdentity(state,raw.bindingId,findings);addIdentity(state,raw.examId,findings);
  if(state.refs.has(raw.examRef))findings.push(`ACCEPTANCE_REF_DUPLICATE:${raw.examRef}`);state.refs.add(raw.examRef);
  pushScriptResolutionFinding(scripts,decodeURIComponent(selector[1]??""),findings);return modes;
};
const validateExamLaw=(law:LawEvidenceRecord,scripts:Readonly<Record<string,string>>,state:ValidationState,findings:string[]):void=>{
  if(typeof law.lawId!=="string"||!Array.isArray(law.evidenceModes)){findings.push("ACCEPTANCE_LAW_INVALID");return}
  const expected=law.evidenceModes.filter((mode):mode is string=>typeof mode==="string"&&mode.startsWith("exam.")).sort();
  const bindings=law.enforcement?.examBindings;if(!Array.isArray(bindings)){findings.push(`ACCEPTANCE_BINDING_MISSING:${law.lawId}`);return}
  const actual=(bindings as RegistryExamBinding[]).flatMap((raw)=>validateExamBinding(raw,law.lawId as string,scripts,state,findings)).sort();
  if(JSON.stringify(actual)!==JSON.stringify(expected))findings.push(`ACCEPTANCE_EXAM_DENOMINATOR_MISMATCH:${law.lawId}`);
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
  const state:ValidationState={identities:new Set(),refs:new Set()};
  for(const law of laws)validateExamLaw(law,scripts,state,findings);
  pushScriptResolutionFinding(scripts,"exam:check",findings);
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
