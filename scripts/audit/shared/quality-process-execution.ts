import { execFile } from "node:child_process";

export type CapturedExecution = {
  status: number | null;
  signal: NodeJS.Signals | null;
  stderr: string;
  stdout: string;
};

export const executeCaptured = (
  command: string,
  args: string[],
  options: { cwd: string; env: NodeJS.ProcessEnv; timeout?: number },
): Promise<CapturedExecution> => new Promise((resolveExecution) => {
  execFile(command, args, {
    cwd: options.cwd,
    encoding: "utf8",
    env: options.env,
    maxBuffer: 64 * 1024 * 1024,
    ...(options.timeout === undefined ? {} : { timeout: options.timeout }),
  }, (error, stdout, stderr) => resolveExecution({
    status: error === null ? 0 : typeof error.code === "number" ? error.code : null,
    signal: error?.signal ?? null,
    stderr,
    stdout,
  }));
});

export const mapWithConcurrency = async <T, R>(
  values: readonly T[],
  concurrency: number,
  task: (value: T, index: number) => Promise<R>,
): Promise<R[]> => {
  const results = new Array<R>(values.length);
  const errors: { error: unknown; index: number }[] = [];
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(Math.max(1, concurrency), values.length) }, async () => {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      try { results[index] = await task(values[index]!, index); }
      catch (error) { errors.push({ error, index }); }
    }
  });
  await Promise.all(workers);
  errors.sort((left, right) => left.index - right.index);
  if (errors.length) throw errors[0]!.error;
  return results;
};
