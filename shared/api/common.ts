import { z } from "zod";

export const idParamsSchema = z.object({ id: z.string().min(1) });
export const idResponseSchema = z.object({ id: z.string().min(1) });
export const isoDateTimeSchema = z.iso.datetime({ offset: true });
export const jsonObjectSchema = z.record(z.string(), z.unknown());

export type IdParams = z.infer<typeof idParamsSchema>;
export type IdResponse = z.infer<typeof idResponseSchema>;
