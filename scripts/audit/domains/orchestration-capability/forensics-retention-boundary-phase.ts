import { createFinding, createPhase, pathFromRepoRoot, readTextFile, type Finding } from "./inspection-core.js";

const LAW_PATH = ".github/instructions/cursor-rules/modules/module-orchestration-capability.instructions.md";
const BLUEPRINT_PATH = "docs/法案辅助文件/GrassEye Orchestration 总指挥能力组施工图.md";

const REQUIRED_LAW_SNIPPETS = [
  "artifactLifecycleManifestRef",
  "artifactHash",
  "promoted-evidence",
  "quota/backpressure",
] as const;

const REQUIRED_BLUEPRINT_SNIPPETS = [
  "artifactLifecycleManifestRef / artifactHash",
  "promotion / cleanup",
  "quota/backpressure",
] as const;

type PhaseResult = {
  findings: Finding[];
  phase: ReturnType<typeof createPhase>;
};

const createFatalFinding = (file: string, message: string): Finding =>
  createFinding({
    lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-007-V3",
    file,
    line: 1,
    severity: "fatal",
    message,
  });

const hasRequiredSnippets = (text: string, snippets: readonly string[]): boolean => snippets.every((snippet) => text.includes(snippet));

export const inspectForensicsRetentionBoundary = async (): Promise<PhaseResult> => {
  const [lawText, blueprintText] = await Promise.all([
    readTextFile(pathFromRepoRoot(LAW_PATH)),
    readTextFile(pathFromRepoRoot(BLUEPRINT_PATH)),
  ]);
  const findings: Finding[] = [];

  if (!hasRequiredSnippets(lawText, REQUIRED_LAW_SNIPPETS)) {
    findings.push(createFatalFinding(LAW_PATH, "Orchestration Forensics boundary law must encode screenshot retention, self-promotion ban, and quota/backpressure propagation."));
  }
  if (!hasRequiredSnippets(blueprintText, REQUIRED_BLUEPRINT_SNIPPETS)) {
    findings.push(createFatalFinding(BLUEPRINT_PATH, "Orchestration blueprint must describe screenshot lifecycle refs, promotion/cleanup routing, and quota/backpressure handling."));
  }

  return {
    findings,
    phase: createPhase(
      "forensics-retention-boundary",
      findings.length === 0 ? "PASS" : "CODE VIOLATION",
      findings.length === 0,
      findings.length === 0
        ? "Orchestration law and blueprint both describe screenshot retention refs, promotion routing, and quota/backpressure propagation at the Forensics boundary."
        : "Orchestration law or blueprint still omits screenshot lifecycle refs, promotion routing, or quota/backpressure propagation at the Forensics boundary.",
    ),
  };
};