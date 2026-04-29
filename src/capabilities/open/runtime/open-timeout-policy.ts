import type { OpenTargetProfile } from "../contract.js";

export function resolveOpenTimeoutMs(profile: OpenTargetProfile): number {
  return profile.maxOpenDurationMs;
}

export async function withOpenTimeout<T>(input: {
  operation: Promise<T>;
  timeoutMs: number;
}): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`open navigation timed out after ${input.timeoutMs}ms`));
    }, input.timeoutMs);

    input.operation.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}