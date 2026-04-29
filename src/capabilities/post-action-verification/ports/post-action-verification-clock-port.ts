export type PostActionVerificationClockSnapshot = {
  isoTimestamp: string;
  monotonicMs: number;
};

export type PostActionVerificationClockPort = {
  readonly portKind: "post-action-verification-clock";
  now(): PostActionVerificationClockSnapshot;
};
