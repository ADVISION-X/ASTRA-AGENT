import { createHash, randomUUID } from "node:crypto";
import type { BrowserAuthorityCertificateV1 } from "../infrastructure/browser-authority-certificate.js";
import { hashBrowserAuthorityCertificate } from "../infrastructure/browser-authority-certificate.js";
import type { BrowserCommandActor } from "./browser-command-actor.js";
import type { BrowserCapabilityId } from "../protocol/generated/browser-protocol.generated.js";
import type { BrowserCommandPermit, BrowserUnsignedCommandPermit } from "../transport/command-permit.js";
import type { BrowserTargetLease } from "./browser-target-lease.js";
import type { BrowserControlledTarget, BrowserDocumentRef } from "./browser-target-ref.js";
import type { BrowserDomIntent } from "./browser-dom-intent.js";
import type { BrowserFileArtifactGrantV1 } from "./browser-file-artifact-grant.js";
import type { BrowserExecutionBinding } from "../infrastructure/browser-authority-broker.js";
import type { BrowserSessionWorkspace, SessionWorkspaceBindingV6 } from "./browser-session-workspace.js";
import type { BrowserOutcomeResolutionReceipt } from "./browser-outcome-resolver.js";
import { browserExecutionFailure } from "../browser-failure.js";
export type { SessionWorkspaceBindingV6 } from "./browser-session-workspace.js";

export type BrowserExactTargetAcquisition = Readonly<{
  target: BrowserControlledTarget;
  ownerId: string;
}>;

export type BrowserCommandPermitSigner = Readonly<{
  signCurrentCommandPermit(permit: BrowserUnsignedCommandPermit): `sha256:${string}`;
}>;

type LeaseState = {
  current: BrowserControlledTarget;
  closed: boolean;
  sequence: number;
  pendingMutationCommandIds: string[];
  atomicStep: Readonly<{ pluginStepId: string; childCapabilityId: string }> | null;
  actionOrdinal: number;
};

type LeaseCommand = (
  capabilityId: BrowserCapabilityId,
  value: Parameters<BrowserCommandActor["execute"]>[1],
) => Promise<unknown>;

type AuthenticatedMedia = Awaited<ReturnType<BrowserTargetLease["downloadAuthenticatedMedia"]>>;

const authenticatedMediaIdentityValid = (
  input: Readonly<{ assistantTurnId: string; semanticMediaId: "gpt-generated-image-main" }>,
): boolean => /^conversation-turn-[1-9][0-9]*$/u.test(input.assistantTurnId)
  && input.semanticMediaId === "gpt-generated-image-main";

const authenticatedMediaBytesValid = (value: Readonly<Record<string, unknown>>): boolean =>
  typeof value.bytesBase64 === "string"
  && typeof value.sha256 === "string"
  && /^sha256:[a-f0-9]{64}$/u.test(value.sha256)
  && typeof value.sizeBytes === "number"
  && Number.isSafeInteger(value.sizeBytes)
  && value.sizeBytes >= 1
  && value.sizeBytes <= 25 * 1024 * 1024;

const authenticatedMediaShapeValid = (value: Readonly<Record<string, unknown>>): boolean =>
  typeof value.mediaType === "string"
  && /^image\/[a-z0-9.+-]+$/u.test(value.mediaType)
  && typeof value.width === "number"
  && Number.isSafeInteger(value.width)
  && value.width >= 1
  && typeof value.height === "number"
  && Number.isSafeInteger(value.height)
  && value.height >= 1;

const parseAuthenticatedMedia = (raw: unknown): AuthenticatedMedia => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  const value = raw as Readonly<Record<string, unknown>>;
  if (!authenticatedMediaBytesValid(value) || !authenticatedMediaShapeValid(value)) {
    throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  }
  return value as AuthenticatedMedia;
};

export class BrowserTargetLeaseManager {
  public constructor(
    private readonly certificate: BrowserAuthorityCertificateV1,
    private readonly executionBinding: BrowserExecutionBinding,
    private readonly commandActor: BrowserCommandActor,
    private readonly permitSigner: BrowserCommandPermitSigner,
    private readonly workspace: BrowserSessionWorkspace | undefined,
    private readonly resolveCurrentTarget: () => BrowserControlledTarget | null,
    private readonly resolveGrantPaths: (
      grants: readonly BrowserFileArtifactGrantV1[],
    ) => Promise<readonly string[]>,
  ) {}

  public acquire(input: BrowserExactTargetAcquisition): BrowserTargetLease {
    this.assertAcquisition(input);
    const state: LeaseState = {
      current: input.target,
      closed: false,
      sequence: 0,
      pendingMutationCommandIds: [...this.commandActor.pendingMutationCommandIds(this.executionBinding)],
      atomicStep: null,
      actionOrdinal: 0,
    };
    const leaseRef = `target-lease-${randomUUID()}`;
    const command = this.createLeaseCommand(input, state, leaseRef);
    return this.createTargetLease(input, state, leaseRef, command);
  }

  private assertAcquisition(input: BrowserExactTargetAcquisition): void {
    if (!this.workspace) throw new Error("BROWSER_SESSION_WORKSPACE_REQUIRED");
    this.workspace.assertCurrent();
    if (!Number.isInteger(this.executionBinding.commandTtlMs)
      || this.executionBinding.commandTtlMs < 1
      || this.executionBinding.commandTtlMs > 3_600_000) {
      throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
    }
    if (
      input.target.target.authorityEpoch !== this.certificate.authorityEpoch
      || input.target.target.executionBindingHash !== this.executionBinding.executionRefHash
      || input.target.document.targetRef !== input.target.target.targetRef
    ) {
      throw new Error("BROWSER_TARGET_INVALID");
    }
  }

  private createLeaseCommand(
    input: BrowserExactTargetAcquisition,
    state: LeaseState,
    leaseRef: string,
  ): LeaseCommand {
    return async (capabilityId, value) => {
      if (state.closed) throw new Error("BROWSER_TARGET_INVALID");
      if (this.mutationClass(value) === "mutation" && state.pendingMutationCommandIds.length > 0) {
        throw new Error("BROWSER_MUTATION_UNSETTLED");
      }
      if (this.mutationClass(value) === "mutation" && state.atomicStep === null) {
        throw new Error("BROWSER_ATOMIC_STEP_IDENTITY_REQUIRED");
      }
      this.workspace?.assertCurrent();
      const currentTarget = this.resolveCurrentTarget();
      if (!currentTarget
        || currentTarget.target.targetRef !== input.target.target.targetRef
        || currentTarget.target.authorityEpoch !== input.target.target.authorityEpoch
        || currentTarget.target.executionBindingHash !== this.executionBinding.executionRefHash
        || currentTarget.document.targetRef !== currentTarget.target.targetRef
        || currentTarget.document.navigationEpoch < state.current.document.navigationEpoch) {
        throw new Error("BROWSER_DOCUMENT_INVALID");
      }
      state.current = currentTarget;
      const sequence = ++state.sequence;
      const step = state.atomicStep ?? {
        pluginStepId: "browser-lifecycle",
        childCapabilityId: capabilityId,
      };
      const actionOrdinal = state.atomicStep ? ++state.actionOrdinal : sequence;
      const permit = this.permit({
        leaseRef,
        sequence,
        targetRef: input.target.target.targetRef,
        documentRef: state.current.document.documentRef,
        pluginStepId: step.pluginStepId,
        childCapabilityId: step.childCapabilityId,
        actionOrdinal,
        capabilityId,
        mutationClass: this.mutationClass(value),
      });
      try {
        const result = await this.commandActor.execute(permit, value);
        return result;
      } catch (error) {
        const mutationOutcome = this.commandActor.mutationOutcome(permit.commandId);
        if (mutationOutcome === "dispatched") state.pendingMutationCommandIds.push(permit.commandId);
        throw browserExecutionFailure(error, mutationOutcome);
      }
    };
  }

  private createTargetLease(
    input: BrowserExactTargetAcquisition,
    state: LeaseState,
    leaseRef: string,
    command: LeaseCommand,
  ): BrowserTargetLease {
    return {
      leaseRef,
      authorityRef: this.certificate.authorityRef,
      authorityEpoch: this.certificate.authorityEpoch,
      executionBindingHash: this.executionBinding.executionRefHash,
      ownerId: input.ownerId,
      agentJobRefHash: this.executionBinding.jobRefHash,
      agentExecutionRefHash: this.executionBinding.executionRefHash,
      writerLeaseEpoch: this.executionBinding.writerLeaseEpoch,
      writerFenceHash: this.executionBinding.writerFenceHash,
      target: input.target.target,
      get document() { return state.current.document; },
      runAtomicStep: async (identity, action) => {
        if (!identity.pluginStepId || !identity.childCapabilityId || state.atomicStep !== null) {
          throw new Error("BROWSER_ATOMIC_STEP_IDENTITY_INVALID");
        }
        state.atomicStep = Object.freeze({ ...identity });
        state.actionOrdinal = 0;
        try {
          return await action();
        } finally {
          state.atomicStep = null;
          state.actionOrdinal = 0;
        }
      },
      navigate: ({ url, title }) => this.navigate(input, state, command, url, title),
      executeDomIntent: async (intent: BrowserDomIntent) => command(this.capabilityForIntent(intent), { kind: "dom-intent", intent }),
      observeCapability: async ({ capabilityId }) => command(capabilityId, { kind: "observe", capabilityId }),
      captureScreenshot: ({ regionLabel }) => this.captureScreenshot(command, regionLabel),
      attachFile: ({ selector, grants }) => this.attachFile(command, selector, grants),
      downloadAuthenticatedMedia: (media) => this.downloadAuthenticatedMedia(command, media),
      registerFileArtifact: async () => {
        throw new Error("BROWSER_FILE_GRANT_INVALID");
      },
      issueFileArtifactGrant: async () => {
        throw new Error("BROWSER_FILE_GRANT_INVALID");
      },
      wait: async ({ durationMs }) => { await command("browser.wait.v1", { kind: "wait", durationMs }); },
      close: async ({ reason }) => {
        if (state.pendingMutationCommandIds.length > 0) throw new Error("BROWSER_MUTATION_UNSETTLED");
        await command("browser.close-target.v1", { kind: "close-target", reason });
        state.closed = true;
      },
      resolvePendingMutation: (receipt) => this.resolvePendingMutation(state, receipt),
      pendingMutationCount: () => state.pendingMutationCommandIds.length,
      assertNoPendingMutations: () => {
        if (state.pendingMutationCommandIds.length > 0) throw new Error("BROWSER_MUTATION_UNSETTLED");
      },
    };
  }

  private async navigate(
    input: BrowserExactTargetAcquisition,
    state: LeaseState,
    command: LeaseCommand,
    url: string,
    title: string,
  ): Promise<BrowserDocumentRef> {
    const result = await command("browser.navigate.v1", { kind: "navigate", url, title });
    const document = result as BrowserDocumentRef;
    if (!document || typeof document.documentRef !== "string"
      || document.targetRef !== input.target.target.targetRef
      || !Number.isInteger(document.navigationEpoch)
      || document.navigationEpoch <= state.current.document.navigationEpoch) {
      throw new Error("BROWSER_DOCUMENT_INVALID");
    }
    state.current = { ...state.current, document, url, title };
    return document;
  }

  private async captureScreenshot(command: LeaseCommand, regionLabel: string): Promise<Readonly<{
    artifactRef: string;
    contentHash: `sha256:${string}`;
  }>> {
    const result = await command("browser.screenshot.v1", { kind: "screenshot", regionLabel });
    const artifact = result as { artifactRef?: unknown; contentHash?: unknown };
    if (typeof artifact.artifactRef !== "string" || typeof artifact.contentHash !== "string") {
      throw new Error("BROWSER_EXTENSION_CHANNEL_UNAVAILABLE");
    }
    return { artifactRef: artifact.artifactRef, contentHash: artifact.contentHash as `sha256:${string}` };
  }

  private async attachFile(
    command: LeaseCommand,
    selector: string,
    grants: readonly BrowserFileArtifactGrantV1[],
  ): Promise<void> {
    if (grants.length === 0 || grants.length > 20 || new Set(grants.map((grant) => grant.grantRef)).size !== grants.length) {
      throw new Error("BROWSER_FILE_GRANT_INVALID");
    }
    if (grants.some((grant) => grant.authorityEpoch !== this.certificate.authorityEpoch
      || grant.executionBindingHash !== this.executionBinding.executionRefHash)) {
      throw new Error("BROWSER_FILE_GRANT_INVALID");
    }
    const resolvedFilePaths = await this.resolveGrantPaths(grants);
    await command("browser.file-input.v1", {
      kind: "file-input",
      selector,
      grantRefs: grants.map((grant) => grant.grantRef),
      resolvedFilePaths,
    });
  }

  private async downloadAuthenticatedMedia(
    command: LeaseCommand,
    input: Readonly<{ assistantTurnId: string; semanticMediaId: "gpt-generated-image-main" }>,
  ): Promise<Readonly<{
    bytesBase64: string;
    sha256: `sha256:${string}`;
    sizeBytes: number;
    mediaType: `image/${string}`;
    width: number;
    height: number;
  }>> {
    if (!authenticatedMediaIdentityValid(input)) {
      throw new Error("BROWSER_TARGET_INVALID");
    }
    const raw = await command("browser.authenticated-media.v1", {
      kind: "authenticated-media",
      assistantTurnId: input.assistantTurnId,
      semanticMediaId: input.semanticMediaId,
    });
    const value = parseAuthenticatedMedia(raw);
    const bytes = Buffer.from(value.bytesBase64, "base64");
    const digest = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
    if (bytes.byteLength !== value.sizeBytes || digest !== value.sha256) {
      throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
    }
    return value;
  }

  private async resolvePendingMutation(
    state: LeaseState,
    receipt: Omit<BrowserOutcomeResolutionReceipt, "commandId">,
  ): Promise<number> {
    const commandIds = [...state.pendingMutationCommandIds];
    const commandId = commandIds[0];
    if (commandIds.length !== 1 || commandId === undefined) throw new Error("BROWSER_MUTATION_UNSETTLED");
    await this.commandActor.resolveDispatchedMutation({ ...receipt, commandId });
    state.pendingMutationCommandIds.splice(state.pendingMutationCommandIds.indexOf(commandId), 1);
    return 1;
  }

  private permit(input: Readonly<{
    leaseRef: string;
    sequence: number;
    targetRef: string;
    documentRef: string;
    pluginStepId: string;
    childCapabilityId: string;
    actionOrdinal: number;
    capabilityId: BrowserCapabilityId;
    mutationClass: BrowserCommandPermit["mutationClass"];
  }>): BrowserCommandPermit {
    const commandId = randomUUID();
    const replyChannelToken = randomUUID();
    const certificateHash = hashBrowserAuthorityCertificate(this.certificate);
    const unsigned: BrowserUnsignedCommandPermit = {
      permitRef: randomUUID(),
      authorityRef: this.certificate.authorityRef,
      authorityEpoch: this.certificate.authorityEpoch,
      certificateHash,
      channelSessionHash: this.certificate.channelSessionHash,
      executionBindingHash: this.executionBinding.executionRefHash,
      writerFenceHash: this.executionBinding.writerFenceHash,
      candidateHash: this.executionBinding.candidateHash,
      contractManifestHash: this.executionBinding.contractManifestHash,
      ownerPluginId: this.executionBinding.ownerPluginId,
      jobId: this.executionBinding.jobId,
      attemptId: this.executionBinding.attemptId,
      deviceId: this.executionBinding.deviceId,
      leaseVersion: this.executionBinding.leaseVersion,
      localOrderId: this.executionBinding.localOrderId,
      targetLeaseRef: input.leaseRef,
      targetRef: input.targetRef,
      documentRef: input.documentRef,
      pluginStepId: input.pluginStepId,
      childCapabilityId: input.childCapabilityId,
      actionOrdinal: input.actionOrdinal,
      capabilityId: input.capabilityId,
      commandId,
      sequence: input.sequence,
      mutationClass: input.mutationClass,
      workspaceRef: this.workspace?.ref() ?? "",
      commandTtlMs: this.executionBinding.commandTtlMs,
      replyChannelToken,
    };
    return {
      ...unsigned,
      commandFrameMac: this.permitSigner.signCurrentCommandPermit(unsigned),
    };
  }

  private mutationClass(command: Parameters<BrowserCommandActor["execute"]>[1]): BrowserCommandPermit["mutationClass"] {
    if (command.kind === "navigate" || command.kind === "close-target") return "lifecycle";
    if (command.kind === "file-input") return "mutation";
    if (command.kind === "dom-intent" && (command.intent.kind === "click" || command.intent.kind === "hover"
      || command.intent.kind === "doubleClick" || command.intent.kind === "keypress" || command.intent.kind === "fill")) return "mutation";
    return "observation";
  }

  private capabilityForIntent(intent: BrowserDomIntent): BrowserCapabilityId {
    const capabilities: Readonly<Record<BrowserDomIntent["kind"], BrowserCapabilityId>> = {
      document: "browser.dom.inspect.v1",
      inspect: "browser.dom.inspect.v1",
      find: "browser.dom.find.v1",
      readText: "browser.dom.read-text.v1",
      readAttribute: "browser.dom.read-attribute.v1",
      click: "browser.dom.click.v1",
      hover: "browser.dom.hover.v1",
      doubleClick: "browser.dom.double-click.v1",
      keypress: "browser.dom.keypress.v1",
      fill: "browser.dom.fill.v1",
    };
    return capabilities[intent.kind];
  }
}
