export type ForensicsFailureReason = {
  code: string;
  message: string;
  retryable: boolean;
  detail?: string;
};

export function createForensicsFailureReason(input: {
  code: string;
  message: string;
  retryable?: boolean;
  detail?: string;
}): ForensicsFailureReason {
  return {
    code: input.code,
    message: input.message,
    retryable: input.retryable ?? false,
    ...(input.detail ? { detail: input.detail } : {}),
  };
}