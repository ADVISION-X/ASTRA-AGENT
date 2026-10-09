import type { ChildProcess } from "node:child_process";

type ServiceExit = { code: number | null; signal: NodeJS.Signals | null };
type LocalService = {
  child: ChildProcess;
  started: Promise<void>;
  waitForExit(): Promise<ServiceExit>;
  stop(signal: NodeJS.Signals): Promise<ServiceExit>;
};
export function startLocalService(input: {
  rootDir: string;
  env?: Record<string, string>;
  onStdoutLine?: (line: string) => void;
  onStderrLine?: (line: string) => void;
}): LocalService;
