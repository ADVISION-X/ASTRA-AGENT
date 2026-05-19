export type AppRunLimitSettings = {
  defaultMaxRounds: number;
  defaultMaxMinutes: number;
  updatedAt: string | null;
};

export type UserRequirementHistoryPlatformId = "facebook-web" | "tiktok-web";

export type UserRequirementHistoryEntry = {
  id: string;
  title: string;
  userRequirementText: string;
  selectedPlatforms: UserRequirementHistoryPlatformId[];
  maxRounds: number;
  maxMinutes: number;
  createdAt: string;
  lastUsedAt: string;
  useCount: number;
};

export type UserRequirementHistoryUpsertInput = {
  id?: string | null;
  title?: string | null;
  userRequirementText: string;
  selectedPlatforms: UserRequirementHistoryPlatformId[];
  maxRounds: number;
  maxMinutes: number;
};