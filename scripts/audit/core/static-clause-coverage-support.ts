import { fileExists, readJsonFile } from "./filesystem.js";
import { pathFromRepoRoot } from "./paths.js";

export type CommandStatus = {
  name: string;
  command: string;
  passed: boolean;
  exitCode: number | null;
  evidencePath: string;
};

export type GlobalChainStatus = {
  observed: boolean;
  passed: boolean;
  commands: CommandStatus[];
  blockers: string[];
};

export type SourceEvidence = {
  checkPhase: string;
  checkFunction: string;
  sourceFile: string;
  targetSymbol: string;
  checkKind: "required-shape" | "forbidden-shape" | "boundary-attack" | "anti-escape" | "runtime-proof";
};

export type AuditSummaryEntry = {
  name: string;
  command?: string;
  exitCode: number;
  durationMs?: number;
};

const GLOBAL_CHAIN_COMMANDS = [
  { name: "typecheck", command: "npm run typecheck", evidencePath: "tmp/audit/ability-law-census/audit-runs/typecheck.txt" },
  { name: "lint", command: "npm run lint", evidencePath: "tmp/audit/ability-law-census/audit-runs/lint.txt" },
  { name: "ci:full", command: "npm run ci:full", evidencePath: "tmp/audit/ability-law-census/audit-runs/ci-full.txt" },
] as const;

const AUDIT_SUMMARY_PATH = pathFromRepoRoot("tmp/audit/ability-law-census/audit-runs/summary.json");

const createEmptyCommandStatus = (input: { name: string; command: string; evidencePath: string }): CommandStatus => ({
  name: input.name,
  command: input.command,
  passed: false,
  exitCode: null,
  evidencePath: input.evidencePath,
});

const normalizeAuditEntryName = (name: string): string => name.trim();

export const loadAuditSummary = async (): Promise<Map<string, AuditSummaryEntry>> => {
  if (!(await fileExists(AUDIT_SUMMARY_PATH))) {
    return new Map();
  }

  const entries = await readJsonFile<AuditSummaryEntry[]>(AUDIT_SUMMARY_PATH);
  return new Map(entries.map((entry) => [normalizeAuditEntryName(entry.name), entry]));
};

export const resolveCommandStatuses = async (): Promise<GlobalChainStatus> => {
  const summary = await loadAuditSummary();
  const commands = GLOBAL_CHAIN_COMMANDS.map((command) => {
    const entry = summary.get(command.name);
    return entry
      ? {
          name: command.name,
          command: entry.command ?? command.command,
          passed: entry.exitCode === 0,
          exitCode: entry.exitCode,
          evidencePath: command.evidencePath,
        }
      : createEmptyCommandStatus(command);
  });
  const blockers = commands.filter((command) => !command.passed).map((command) => `${command.name} failed or is missing fresh evidence.`);

  return {
    observed: commands.some((command) => command.exitCode !== null),
    passed: blockers.length === 0,
    commands,
    blockers,
  };
};

export { mergeEvidenceMaps } from "./static-clause-coverage-source-evidence.js";
