import { z } from "zod";

const AmazonMarketplaceSchema = z.enum([
  "amazon.com", "amazon.co.uk", "amazon.de", "amazon.co.jp", "amazon.fr",
  "amazon.it", "amazon.es", "amazon.ca", "amazon.com.au", "amazon.com.br",
  "amazon.com.mx", "amazon.nl", "amazon.se", "amazon.pl", "amazon.ae",
  "amazon.sg", "amazon.com.tr",
]);

const AmazonProviderKindSchema = z.enum(["gemini-api", "gemini-web-chat", "gpt-web-chat"]);
const AmazonKeywordHistoryPolicySchema = z.enum(["new_keywords_only", "refresh_historical_keywords"]);

export const AmazonMiningInputSchema = z.object({
  taskId: z.string().trim().min(1).max(180).optional(),
  amazonMarketplace: AmazonMarketplaceSchema,
  targetMarket: z.string().trim().min(1).max(160),
  productDirection: z.string().trim().min(1).max(500),
  requestedKeywordCount: z.number().int().positive().max(100).default(10),
  languagePreference: z.string().trim().min(1).max(64).default("en"),
  providerKind: AmazonProviderKindSchema,
  keywordHistoryPolicy: AmazonKeywordHistoryPolicySchema.default("new_keywords_only"),
}).strict();

export type AmazonMiningInput = z.infer<typeof AmazonMiningInputSchema>;

export const AmazonMiningContinueInputSchema = z.object({}).strict();
export type AmazonMiningContinueInput = z.infer<typeof AmazonMiningContinueInputSchema>;
