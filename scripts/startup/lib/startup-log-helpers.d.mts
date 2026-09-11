export type StartupStepTerminal = Readonly<{ eventId: string }>;

export function createStartupLogHelpers(input: Readonly<{
  runId: string;
  dataDir: string;
}>): Readonly<{
  toFailureReason: (error: unknown) => string;
  startStartupStep: (stepId: string) => unknown;
  completeStartupStep: (stepId: string) => void;
  failOpenStartupSteps: (error: unknown) => readonly StartupStepTerminal[];
  failStartupStep: (stepId: string, error: unknown) => StartupStepTerminal;
  logStartupShellReady: () => void;
  logStartupStopped: () => void;
  relayServiceStdoutLine: (line: string) => void;
  relayServiceStderrLine: (line: string) => void;
}>;
