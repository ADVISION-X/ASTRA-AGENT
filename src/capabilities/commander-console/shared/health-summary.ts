export type CommanderHealthTone = "good" | "warn" | "danger" | "muted";

export type CommanderHealthSummary = {
  id: string;
  label: string;
  tone: CommanderHealthTone;
  detail: string;
};