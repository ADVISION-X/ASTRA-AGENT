import { createCommanderConsoleAbilityGroup } from "../../capabilities/commander-console/index.js";
import { createWorkbenchRuntime } from "./workbench-runtime.js";
import type { GrassEyeWorkbenchOptions, WorkbenchRuntime } from "./workbench-contract.js";
import { createWorkbenchFacade } from "./workbench-facade.js";
import { createWorkbenchCommanderDependencies } from "./workbench-commander-dependencies.js";
import { buildHumanCommandDispatchInput, describeHumanCommandTransportMessage } from "./workbench-human-command-dispatch.js";

export type { GrassEyePlatformTarget } from "./workbench-contract.js";

type CommanderTransportCommand = Parameters<
  Parameters<typeof createCommanderConsoleAbilityGroup>[0]["commandTransport"]["emitHumanCommand"]
>[0];

export class GrassEyeWorkbench {
  readonly commanderConsole;
  readonly nerveBusAbilityGroup;
  private readonly runtime: WorkbenchRuntime;

  constructor(options: GrassEyeWorkbenchOptions) {
    this.runtime = createWorkbenchRuntime(options);
    this.nerveBusAbilityGroup = this.runtime.nerveBusAbilityGroup;
    this.commanderConsole = createCommanderConsoleAbilityGroup({
      defaultOperatorRef: "commander-console:operator",
      commandTransport: {
        emitHumanCommand: async (command: CommanderTransportCommand) => {
          const transport = await this.nerveBusAbilityGroup.dispatchHumanCommand(buildHumanCommandDispatchInput(command));
          const status: "accepted" | "failed" | "review_required" = transport.resultEnvelope.status === "success"
            ? "accepted"
            : transport.resultEnvelope.status;
          return {
            commandId: command.commandId,
            envelopeRef: transport.commandEnvelope.envelopeId,
            resultEnvelopeRef: transport.resultEnvelope.envelopeId,
            status,
            failureReason: transport.resultEnvelope.failureReason,
            reviewRequiredReason: transport.resultEnvelope.status === "review_required"
              ? transport.resultEnvelope.failureReason ?? "review required"
              : null,
            message: describeHumanCommandTransportMessage(transport.resultEnvelope),
            debugLogRef: null,
          };
        },
      },
      ...createWorkbenchCommanderDependencies(this.runtime),
    });
    this.runtime.commanderConsole = this.commanderConsole;
  }

  createHandle() {
    return {
      commanderConsole: this.commanderConsole,
      ...createWorkbenchFacade(this.runtime),
    };
  }
}