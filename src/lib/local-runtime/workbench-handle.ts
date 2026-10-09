import type {
  WorkbenchHealthReport,
} from "./workbench-status-types.js";
import type { ProductionOperationsSnapshot } from "./production/operations-snapshot.js";

export type GrassEyeWorkbenchHandle = {
  init: () => Promise<void>;
  shutdown: (closeShell?: () => Promise<void>) => Promise<void>;
  recordWorkbenchApiBoundaryEvent: (input: {
    decision: "allowed" | "blocked";
    reason: string;
  }) => void;
  acceptBrowserAuthoritySocket: (input: Readonly<{ send(payload: string): void; close(code?: number): void }>) => Readonly<{ receive(payload: string): void; disconnect(reasonCode?: string, refs?: Readonly<Record<string, string>>): void }>;
  readBrowserExtensionBootstrapState: () => Readonly<{
    authority: "present" | "absent";
    pairingSecret: string | null;
    releaseBuildId: string | null;
  }>;
  getHealthReport: () => Promise<WorkbenchHealthReport>;
  readProductionOperationsSnapshot: (jobId?: string) => Promise<ProductionOperationsSnapshot>;
};
