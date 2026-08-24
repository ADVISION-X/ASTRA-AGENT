export type ExamVerdict = 'PASS' | 'FAIL' | 'BLOCKED';

export type ExamExecutionResult = Readonly<{
  bindingId: string;
  examId: string;
  lawId: string;
  evidenceModes: readonly string[];
  command: string;
  startedAt: string;
  finishedAt: string;
  exitStatus: number | null;
  signal: string | null;
  timedOut: boolean;
  stdoutSha256: string;
  stderrSha256: string;
  seed: string;
  timeoutMs: number;
  assertions: readonly Readonly<{ assertionId: string; passed: boolean; evidenceRefs: readonly string[] }>[];
  findings: readonly Readonly<{ code: string; evidenceRefs: readonly string[] }>[];
  verdict: ExamVerdict;
  reasonCode: string;
}>;

export function classifyExamOutcome(input: Readonly<{ exitStatus:number|null; signal:string|null; timedOut:boolean; spawnError:boolean }>): Readonly<{ verdict:ExamVerdict; reasonCode:string }> {
  if (input.timedOut) return { verdict: 'BLOCKED', reasonCode: 'BLOCKED_TIMEOUT' };
  if (input.spawnError) return { verdict: 'BLOCKED', reasonCode: 'BLOCKED_SPAWN_ERROR' };
  if (input.signal) return { verdict: 'BLOCKED', reasonCode: 'BLOCKED_SIGNAL' };
  if (input.exitStatus === 0) return { verdict: 'PASS', reasonCode: 'COMPLETED_PASS' };
  return { verdict: 'FAIL', reasonCode: 'COMPONENT_FAILED' };
}
