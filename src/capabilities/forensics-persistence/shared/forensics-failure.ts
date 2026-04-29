import { ForensicsFailureSchema, type ForensicsFailure } from "../schema.js";

export { ForensicsFailureSchema, type ForensicsFailure };

export function createForensicsFailure(input: {
  code: ForensicsFailure["code"];
  message: string;
  detail?: string | null;
}): ForensicsFailure {
  return ForensicsFailureSchema.parse({
    code: input.code,
    message: input.message,
    detail: input.detail ?? null,
  });
}
