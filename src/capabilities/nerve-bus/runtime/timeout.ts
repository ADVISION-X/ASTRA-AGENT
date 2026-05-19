import { NERVE_BUS_DEFAULT_TIMEOUT_MS } from "../schema.js";

export const withNerveBusTimeout = async <T>(
  call: (signal: AbortSignal) => Promise<T>,
): Promise<T> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NERVE_BUS_DEFAULT_TIMEOUT_MS);
  try {
    return await call(controller.signal);
  } finally {
    clearTimeout(timer);
  }
};

export const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
