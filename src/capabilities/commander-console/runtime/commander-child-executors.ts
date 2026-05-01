import type {
	CommanderCommandChildContract,
	CommanderHumanCommandInput,
	CommanderReadChildContract,
} from "../contract.js";
import type { CommanderExecutionOutcome } from "../shared/commander-result.js";
import type { CommanderCommandReceiptView } from "../shared/commander-view-types.js";
import { buildCommanderCommandReceipt } from "./commander-result-builder.js";
import type { CommanderConsoleChildContext } from "./commander-console-executor.js";
import { executeCommanderCommandChild as executeCommanderCommandChildImplementation } from "./commander-command-child-executor.js";
import { executeCommanderReadChild } from "./commander-read-child-executor.js";

type CommandExecutorInput<TInput> = {
	contract: CommanderCommandChildContract;
	input: TInput;
	operatorRef: string;
	context: CommanderConsoleChildContext;
	buildCommandInput: (childInput: TInput) => CommanderHumanCommandInput;
};

type CommandReceiptOutcome = CommanderExecutionOutcome<CommanderCommandReceiptView>;

const buildFallbackReceipt = (input: {
	contract: CommanderCommandChildContract;
	outcome: CommandReceiptOutcome;
	message: string;
	transportStatus: CommanderCommandReceiptView["transportStatus"];
}): CommanderCommandReceiptView => buildCommanderCommandReceipt({
	commandId: input.outcome.commandId ?? `commander-receipt:${input.contract.childCapabilityId}:${input.outcome.inputRef}`,
	commandType: input.contract.ownedCommandType,
	priority: input.contract.hardStopPriority ?? "normal",
	envelopeRef: input.outcome.commandEnvelopeRef,
	resultEnvelopeRef: input.outcome.resultEnvelopeRef,
	transportStatus: input.transportStatus,
	failureReason: input.outcome.failureReason ?? input.message,
	reviewRequiredReason: input.outcome.reviewRequiredReason,
	targetMissionId: input.outcome.missionId,
	targetRecordId: input.outcome.targetRecordRef?.recordId ?? null,
	message: input.message,
});

const createBlockedReceiptOutcome = (input: {
	contract: CommanderCommandChildContract;
	outcome: CommandReceiptOutcome;
}): CommandReceiptOutcome => {
	const receipt = buildFallbackReceipt({
		contract: input.contract,
		outcome: input.outcome,
		message: input.outcome.failureReason ?? "Commander command was blocked before transport dispatch.",
		transportStatus: "failed",
	});
	return {
		...input.outcome,
		output: receipt,
		outputRef: input.outcome.outputRef ?? `commander_receipt:${receipt.commandId}`,
		transportDecision: input.outcome.transportDecision ?? "failed",
		hardStopDecision: input.outcome.hardStopDecision ?? (input.contract.hardStopPriority === "emergency" ? "hard-stop-dispatch-failed" : "not-hard-stop"),
		policyDecision: "blocked",
	};
};

const createTransportReceiptOutcome = (input: {
	contract: CommanderCommandChildContract;
	outcome: CommandReceiptOutcome;
}): CommandReceiptOutcome => {
	const receipt = buildFallbackReceipt({
		contract: input.contract,
		outcome: input.outcome,
		message: input.outcome.failureReason ?? input.outcome.reviewRequiredReason ?? "Commander command transport failed.",
		transportStatus: input.outcome.status === "review_required" ? "review_required" : "failed",
	});
	return {
		...input.outcome,
		output: receipt,
		outputRef: input.outcome.outputRef ?? `commander_receipt:${receipt.commandId}`,
		transportDecision: input.outcome.transportDecision ?? "failed",
		hardStopDecision: input.outcome.hardStopDecision ?? (input.contract.hardStopPriority === "emergency" ? "hard-stop-dispatch-failed" : "not-hard-stop"),
	};
};

const createHardStopReceiptOutcome = (input: {
	contract: CommanderCommandChildContract;
	outcome: CommandReceiptOutcome;
}): CommandReceiptOutcome => {
	const receipt = buildFallbackReceipt({
		contract: input.contract,
		outcome: input.outcome,
		message: input.outcome.failureReason ?? "Emergency stop transport failed before a governed receipt was recorded.",
		transportStatus: "failed",
	});
	return {
		...input.outcome,
		output: receipt,
		outputRef: input.outcome.outputRef ?? `commander_receipt:${receipt.commandId}`,
		transportDecision: input.outcome.transportDecision ?? "failed",
		hardStopDecision: "hard-stop-dispatch-failed",
		policyDecision: "blocked",
	};
};

export async function executeCommanderCommandChild<TInput>(input: CommandExecutorInput<TInput>): Promise<CommandReceiptOutcome> {
	const outcome = await executeCommanderCommandChildImplementation(input);
	if (outcome.output !== null) {
		return outcome;
	}

	if (input.contract.hardStopPriority === "emergency" || outcome.hardStopDecision === "hard-stop-required") {
		return createHardStopReceiptOutcome({ contract: input.contract, outcome });
	}

	if (outcome.commandDecision === "blocked-by-command-gate") {
		return createBlockedReceiptOutcome({ contract: input.contract, outcome });
	}

	return createTransportReceiptOutcome({ contract: input.contract, outcome });
}

export { executeCommanderReadChild };