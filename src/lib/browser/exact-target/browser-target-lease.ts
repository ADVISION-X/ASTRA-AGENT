import type {
  BrowserActionResult,
  BrowserCaptureResult,
  BrowserGeometrySnapshot,
  BrowserOpenResult,
  BrowserTargetLease,
} from "../browser-authority-api.js";
import type {
  BrowserWireCommand,
  BrowserWireTargetDescriptor,
} from "../protocol/generated/browser-protocol.js";
import {
  BrowserTerminalError,
  type BrowserMutationClass,
} from "./browser-command-contract.js";
import type { BrowserTargetLeaseManager } from "./browser-target-lease-manager.js";
import type { ControlledBrowserTarget } from "./browser-target-ref.js";
import {
  setBrowserFileInputArtifact,
  type BrowserTargetLeaseFileArtifactPort,
} from "./browser-target-lease-file-artifact.js";
import {
  clickBrowserTarget,
  clickLocatedBrowserDomElement,
  fillLocatedBrowserDomElement,
  moveBrowserTarget,
  scrollBrowserTarget,
  textInputBrowserTarget,
} from "./browser-target-lease-interaction.js";
import {
  captureBrowserTargetScreenshot,
  readBrowserTargetGeometry,
  waitForBrowserTarget,
  type BrowserTargetLeaseObservationPort,
} from "./browser-target-lease-observation.js";
import {
  browserTargetLeaseHealth,
  browserTargetLeaseState,
} from "./browser-target-lease-state.js";
import {
  closeBrowserTarget,
  closeBrowserTargetLease,
  releaseBrowserTargetForOperator,
  type BrowserTargetLeaseTerminalPort,
} from "./browser-target-lease-terminal.js";
import {
  openBrowserTarget,
  type BrowserTargetLeaseOpenPort,
} from "./browser-target-lease-open.js";
import type { BrowserTargetLeaseInteractionPort } from "./browser-target-lease-interaction.js";
const recoverable = (e: unknown): boolean =>
  /(?:DEVTOOLS_ATTACHMENT_CONFLICT|TARGET_NOT_FOUND).*No tab with given id/iu.test(
    e instanceof Error ? e.message : String(e),
  );
export class ExactBrowserTargetLease {
  readonly executionBinding;
  target: ControlledBrowserTarget | null = null;
  private valid = true;
  private abortSignal: AbortSignal | null = null;
  private releasedTargetRequest:
    Parameters<BrowserTargetLease["open"]>[0] | null = null;
  constructor(
    readonly manager: BrowserTargetLeaseManager,
    readonly leaseRef: string,
    readonly ownerId: string,
  ) {
    this.executionBinding = manager.executionBinding;
  }
  assertValid(): void {
    this.manager.assertValid();
    if (!this.valid)
      throw new BrowserTerminalError(
        "BROWSER_TARGET_LEASE_STALE",
        `target lease ${this.leaseRef} is stale`,
      );
  }
  invalidate(): void {
    this.valid = false;
    this.target = null;
    this.releasedTargetRequest = null;
    this.abortSignal = null;
  }
  getTarget(): ControlledBrowserTarget | null {
    try {
      this.assertValid();
      return this.target ? { ...this.target } : null;
    } catch {
      return null;
    }
  }
  getHealth() {
    return browserTargetLeaseHealth(() => this.assertValid(), this.leaseRef);
  }
  getLeaseState() {
    this.assertValid();
    return browserTargetLeaseState({
      leaseRef: this.leaseRef,
      ownerId: this.ownerId,
      certificate: this.manager.authority.certificate,
      executionBinding: this.executionBinding,
      target: this.target,
    });
  }
  setExecutionAbortSignal(signal: AbortSignal | null): void {
    this.assertValid();
    this.abortSignal = signal;
  }
  rawTabId(): number {
    const target = this.requireTarget();
    return this.manager.registry.resolve(target.targetRef, target.documentRef)
      .descriptor.tabId;
  }
  requireTarget(): ControlledBrowserTarget {
    this.assertValid();
    if (!this.target)
      throw new BrowserTerminalError(
        "TARGET_NOT_FOUND",
        `lease ${this.leaseRef} has no exact target`,
      );
    return this.target;
  }
  async ensureTarget(): Promise<ControlledBrowserTarget> {
    this.assertValid();
    if (this.target) return this.target;
    if (!this.releasedTargetRequest) return this.requireTarget();
    const request = this.releasedTargetRequest;
    await openBrowserTarget(this.openPort(), request);
    return this.requireTarget();
  }
  async command<T>(
    command: BrowserWireCommand,
    mutationClass: BrowserMutationClass,
    abortSignal?: AbortSignal,
    timeoutMs?: number,
  ) {
    this.assertValid();
    let expectedLoaderId: string | undefined;
    if (command.kind !== "acquire_target") {
      const target = this.requireTarget();
      expectedLoaderId = this.manager.registry.resolve(
        target.targetRef,
        target.documentRef,
      ).descriptor.loaderId;
    }
    let response;
    try {
      response = await this.manager.commands.command<T>({
        executionBinding: this.executionBinding,
        targetLeaseRef: this.leaseRef,
        documentRef: this.target?.documentRef ?? "browser-document:unbound",
        command,
        mutationClass,
        ...(expectedLoaderId ? { expectedLoaderId } : {}),
        ...(abortSignal ? { abortSignal } : {}),
        ...(timeoutMs ? { timeoutMs } : {}),
      });
    } catch (error) {
      if (recoverable(error)) this.forgetTargetForRecovery();
      throw error;
    }
    this.assertValid();
    if (
      this.target &&
      command.kind !== "observe_capability" &&
      command.kind !== "screenshot_target"
    ) {
      try {
        this.target = this.manager.registry.updateDocument(
          this.target.targetRef,
          response.result as BrowserWireTargetDescriptor,
        );
      } catch (error) {
        if (mutationClass === "non_idempotent_mutation")
          throw new BrowserTerminalError(
            "OUTCOME_UNKNOWN",
            error instanceof Error ? error.message : String(error),
            mutationClass,
          );
        throw error;
      }
    }
    return response;
  }
  forgetTargetForRecovery(): void {
    if (!this.target) return;
    this.manager.registry.close(this.target.targetRef);
    this.target = null;
    this.releasedTargetRequest = null;
  }
  action(id: string, message: string, started: number): BrowserActionResult {
    const target = this.requireTarget(),
      entry = this.manager.registry.resolve(
        target.targetRef,
        target.documentRef,
      );
    return {
      browserActionId: id,
      ok: true,
      message,
      createdAt: new Date().toISOString(),
      targetRef: target.targetRef,
      documentRef: target.documentRef,
      observedUrl: entry.descriptor.url,
      startedAt: new Date(started).toISOString(),
      durationMs: Date.now() - started,
    };
  }

  observationPort(): BrowserTargetLeaseObservationPort {
    return {
      rawTabId: () => this.rawTabId(),
      requireTarget: () => this.requireTarget(),
      ensureTarget: () => this.ensureTarget(),
      descriptorFor: (target: ControlledBrowserTarget) =>
        this.manager.registry.resolve(target.targetRef, target.documentRef)
          .descriptor,
      updateDocument: (
        target: ControlledBrowserTarget,
        descriptor: BrowserWireTargetDescriptor,
      ) => {
        this.target = this.manager.registry.updateDocument(
          target.targetRef,
          descriptor,
        );
        return this.target;
      },
      forgetTargetForRecovery: () => this.forgetTargetForRecovery(),
      command: this.command.bind(this),
      defaultAbortSignal: () => this.abortSignal ?? undefined,
      assertValid: () => this.assertValid(),
      action: this.action.bind(this),
    };
  }

  terminalPort(): BrowserTargetLeaseTerminalPort {
    return {
      leaseRef: this.leaseRef,
      ownerId: this.ownerId,
      requireTarget: () => this.requireTarget(),
      descriptorFor: (target: ControlledBrowserTarget) =>
        this.manager.registry.resolve(target.targetRef, target.documentRef)
          .descriptor,
      command: this.command.bind(this),
      releaseRegistry: (targetRef: ControlledBrowserTarget["targetRef"]) =>
        this.manager.registry.release(targetRef),
      closeRegistry: (targetRef: ControlledBrowserTarget["targetRef"]) =>
        this.manager.registry.close(targetRef),
      clearTarget: () => {
        this.target = null;
      },
      setReleasedTargetRequest: (
        request: Parameters<BrowserTargetLease["open"]>[0],
      ) => {
        this.releasedTargetRequest = request;
      },
      action: this.action.bind(this),
      defaultAbortSignal: () => this.abortSignal ?? undefined,
    };
  }

  openPort(): BrowserTargetLeaseOpenPort {
    return {
      executionBinding: this.executionBinding,
      leaseRef: this.leaseRef,
      ownerId: this.ownerId,
      manager: this.manager,
      target: this.target,
      setTarget: (target) => {
        this.target = target;
      },
      clearReleasedTargetRequest: () => {
        this.releasedTargetRequest = null;
      },
      forgetTargetForRecovery: () => this.forgetTargetForRecovery(),
      command: this.command.bind(this),
      action: this.action.bind(this),
      defaultAbortSignal: () => this.abortSignal ?? undefined,
    };
  }

  fileArtifactPort(): BrowserTargetLeaseFileArtifactPort {
    const certificate = this.manager.authority.certificate;
    return {
      rawTabId: () => this.rawTabId(),
      command: this.command.bind(this),
      resolveArtifact: (grant) =>
        this.manager.fileGrants.resolveBytesForSend({
          grant,
          authorityEpoch: certificate.authorityEpoch,
          executionFenceHash: this.executionBinding.writerFenceHash,
        }),
      destroyArtifact: (grantRef) => this.manager.fileGrants.destroy(grantRef),
      action: this.action.bind(this),
      defaultAbortSignal: () => this.abortSignal ?? undefined,
    };
  }

  interactionPort(): BrowserTargetLeaseInteractionPort {
    return {
      rawTabId: () => this.rawTabId(),
      command: this.command.bind(this),
      action: this.action.bind(this),
      defaultAbortSignal: () => this.abortSignal ?? undefined,
      observationPort: () => this.observationPort(),
    };
  }
}

export const browserTargetLeaseFacade = (
  core: ExactBrowserTargetLease,
): BrowserTargetLease => ({
  leaseRef: core.leaseRef,
  ownerId: core.ownerId,
  executionBinding: core.executionBinding,
  getTarget: () => core.getTarget(),
  getHealth: () => core.getHealth(),
  getLeaseState: () => core.getLeaseState(),
  setExecutionAbortSignal: (abortSignal) =>
    core.setExecutionAbortSignal(abortSignal),
  releaseTargetForOperator: (input) =>
    releaseBrowserTargetForOperator(core.terminalPort(), input),
  open: (input): Promise<BrowserOpenResult> =>
    openBrowserTarget(core.openPort(), input),
  scroll: (input) => scrollBrowserTarget(core.interactionPort(), input),
  click: (input) => clickBrowserTarget(core.interactionPort(), input),
  move: (input) => moveBrowserTarget(core.interactionPort(), input),
  clickLocatedDomElement: (input) =>
    clickLocatedBrowserDomElement(core.interactionPort(), input),
  fillLocatedDomElement: (input) =>
    fillLocatedBrowserDomElement(core.interactionPort(), input),
  textInput: (input) => textInputBrowserTarget(core.interactionPort(), input),
  screenshotRegion: (input): Promise<BrowserCaptureResult> =>
    captureBrowserTargetScreenshot(core.observationPort(), input),
  observeCapability: <T>(
    input: Parameters<BrowserTargetLease["observeCapability"]>[0],
  ) =>
    core
      .command<T>(
        {
          kind: "observe_capability",
          tabId: core.rawTabId(),
          capabilityId: input.capabilityId,
        },
        "observation",
        input.abortSignal,
        input.timeoutMs,
      )
      .then((response) => response.result),
  setFileInputArtifact: (input) =>
    setBrowserFileInputArtifact(core.fileArtifactPort(), input),
  getGeometrySnapshot: (
    abortSignal?: AbortSignal,
  ): Promise<BrowserGeometrySnapshot> =>
    readBrowserTargetGeometry(core.observationPort(), abortSignal),
  wait: (durationMs, abortSignal) =>
    waitForBrowserTarget(core.observationPort(), durationMs, abortSignal),
  closeTarget: (input) => closeBrowserTarget(core.terminalPort(), input),
  close: (): Promise<BrowserActionResult> =>
    closeBrowserTargetLease(core.terminalPort(), Boolean(core.target), () =>
      core.invalidate(),
    ),
});
