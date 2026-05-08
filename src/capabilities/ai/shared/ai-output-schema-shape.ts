import { z } from "zod";

const unwrapSchema = (schema: z.ZodTypeAny): z.ZodTypeAny => {
  if (schema instanceof z.ZodDefault || schema instanceof z.ZodOptional || schema instanceof z.ZodNullable) {
    return unwrapSchema(schema._def.innerType);
  }
  return schema;
};

const listObjectSchemas = (schema: z.ZodTypeAny): z.ZodObject<z.ZodRawShape>[] => {
  const resolved = unwrapSchema(schema);
  if (resolved instanceof z.ZodObject) {
    return [resolved];
  }
  if (resolved instanceof z.ZodUnion) {
    return (resolved._def.options as z.ZodTypeAny[]).flatMap((option) => listObjectSchemas(option));
  }
  return [];
};

export const listAiOutputSchemaFieldNames = (schema: z.ZodTypeAny): string[] => {
  const fields = new Set<string>();
  for (const objectSchema of listObjectSchemas(schema)) {
    for (const fieldName of Object.keys(objectSchema.shape)) {
      fields.add(fieldName);
    }
  }
  return [...fields];
};

export const findAiOutputSchemaField = (schema: z.ZodTypeAny, fieldName: string): z.ZodTypeAny | null => {
  for (const objectSchema of listObjectSchemas(schema)) {
    const fieldSchema = objectSchema.shape[fieldName];
    if (fieldSchema) {
      return fieldSchema;
    }
  }
  return null;
};