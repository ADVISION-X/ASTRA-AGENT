import { z } from "zod";

const finiteNumber = z.number().finite();
const positiveFiniteNumber = z.number().finite().positive();
const nullableString = z.string().min(1).nullable().optional().default(null);

export { finiteNumber, positiveFiniteNumber, nullableString };