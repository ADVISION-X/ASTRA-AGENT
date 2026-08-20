export const assertAuthenticatedHeartbeat = (input: Readonly<{ authorityEpoch: number; sequence: number; expiresAt: string }>): void => {
  if (input.authorityEpoch < 1 || input.sequence < 1 || Date.parse(input.expiresAt) <= Date.now()) throw new Error("BROWSER_LIVENESS_EXPIRED");
};
