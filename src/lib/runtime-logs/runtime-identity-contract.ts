export type RuntimeProducerIdentity = Readonly<{ kind: "producer"; producerId: string }>;
export type RuntimeRequestIdentity = Readonly<{ kind: "request"; requestId: string; jobId?: string }>;
export type RuntimeJobIdentity = Readonly<{ kind: "job"; jobId: string }>;
export type RuntimeJobAttemptIdentity = Readonly<{ kind: "job-attempt"; jobId: string; attemptId: string }>;
export type RuntimeLeaseIdentity = Readonly<{ kind: "lease"; jobId: string; attemptId: string; leaseVersion: number; fenceHash: string }>;
export type RuntimePluginStepIdentity = Readonly<{ kind: "plugin-step"; jobId: string; attemptId: string; pluginId: string; stepId: string }>;
export type RuntimeGptCallIdentity = Readonly<{ kind: "gpt-call"; jobId: string; attemptId: string; pluginId: string; pluginVersion: number; stepId: string; capabilityCallId: string }>;
export type RuntimeBrowserCommandIdentity = Readonly<{
  kind: "browser-command";
  jobId: string;
  attemptId: string;
  leaseVersion: number;
  fenceHash: string;
  pluginId: string;
  pluginVersion: number;
  commandId: string;
  capabilityCallId?: string;
  pluginStepId: string;
  childCapabilityId: string;
  actionOrdinal: number;
}>;
export type RuntimeBrowserMutationIdentity = Readonly<{ kind: "browser-mutation"; jobId: string; attemptId: string; commandId: string }>;
export type RuntimeCheckpointIdentity = Readonly<{ kind: "checkpoint"; jobId: string; attemptId: string; checkpointId: string }>;
export type RuntimeOutboxIdentity = Readonly<{ kind: "outbox"; jobId: string; outboxId: string }>;

export type RuntimeTypedIdentity = RuntimeProducerIdentity | RuntimeRequestIdentity | RuntimeJobIdentity
  | RuntimeJobAttemptIdentity | RuntimeLeaseIdentity | RuntimePluginStepIdentity | RuntimeGptCallIdentity
  | RuntimeBrowserCommandIdentity | RuntimeBrowserMutationIdentity | RuntimeCheckpointIdentity | RuntimeOutboxIdentity;
