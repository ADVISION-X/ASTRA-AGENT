import { z } from "zod";

import {
  AmazonFieldDisclosureMapSchema,
  AmazonFieldDisclosureReasonSchema,
  AmazonFieldDisclosureSchema,
} from "./amazon-product-mining.field-disclosure-schema.js";

type AmazonFieldDisclosureReason = z.infer<typeof AmazonFieldDisclosureReasonSchema>;
type AmazonFieldDisclosure = z.infer<typeof AmazonFieldDisclosureSchema>;
type AmazonFieldDisclosureMap = z.infer<typeof AmazonFieldDisclosureMapSchema>;

export const createFieldDisclosure = (
  reason: AmazonFieldDisclosureReason,
  detail?: string | null,
): AmazonFieldDisclosure => ({
  reason,
  detail: detail ?? null,
});

const hasMeaningfulValue = (value: unknown): boolean => {
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  return value !== null && value !== undefined;
};

export const fieldDisclosureFromValue = (
  value: unknown,
  missingReason: Exclude<AmazonFieldDisclosureReason, "extracted"> = "not_present",
  detail?: string | null,
): AmazonFieldDisclosure => hasMeaningfulValue(value)
  ? createFieldDisclosure("extracted")
  : createFieldDisclosure(missingReason, detail);

export const buildFieldDisclosureMap = (
  entries: Record<string, AmazonFieldDisclosure>,
): AmazonFieldDisclosureMap => entries;