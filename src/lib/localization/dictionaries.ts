export type Locale = "en" | "zh";

export const supportedLocales = ["en", "zh"] as const;
export const defaultLocale: Locale = "en";
