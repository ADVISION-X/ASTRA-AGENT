import type { z } from "zod";
import type { CommanderCommandType, CommanderTargetRecordRef } from "../contract.js";
import type { CommanderCommandPriority } from "../shared/commander-proof.js";
import type { CommandTransportResultSchema, CommanderTransportPayloadSchema } from "../schema.js";
import type { RequestedPlatformIdSchema } from "../schema.js";
export type CommanderTransportPayload = z.infer<typeof CommanderTransportPayloadSchema>;
type RequestedPlatformId = z.infer<typeof RequestedPlatformIdSchema>;
export type CommanderHumanCommand = {
	commandId: string;
	commandType: CommanderCommandType;
	priority: CommanderCommandPriority;
	operatorRef: string;
	targetMissionId: string | null;
	selectedMapId: string | null;
	targetRecordRef: CommanderTargetRecordRef | null;
	requestedPlatformId: RequestedPlatformId | null;
	humanGoal: string | null;
	maxRounds: number | null;
	maxMinutes: number | null;
	operatorNote: string | null;
	idempotencyKey: string;
	timeoutMs: number;
	payload: CommanderTransportPayload;
};
export type HumanCommandTransportResult = z.infer<typeof CommandTransportResultSchema>;
export interface CommandTransportPort { emitHumanCommand(command: CommanderHumanCommand): Promise<HumanCommandTransportResult>; }
