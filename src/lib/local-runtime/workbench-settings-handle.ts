import { loadAppRunLimitSettings, saveAppRunLimitSettings } from "./settings.js";

export const buildSettingsHandle = (dataDir: string) => ({
  async getAppRunLimitSettings() {
    return loadAppRunLimitSettings(dataDir);
  },
  async saveAppRunLimitSettings(input: Parameters<typeof saveAppRunLimitSettings>[1]) {
    return saveAppRunLimitSettings(dataDir, input);
  },
});
