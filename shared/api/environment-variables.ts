import { z } from "zod";
import { idParamsSchema, idResponseSchema, isoDateTimeSchema } from "./common";

export const environmentVariableInputSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[A-Za-z_]\w*$/),
  value: z.string(),
});
export const environmentVariableListRequestSchema = z.void();
export const environmentVariableCreateRequestSchema = environmentVariableInputSchema;
export const environmentVariableUpdateRequestSchema = environmentVariableInputSchema;
export const environmentVariableIdRequestSchema = idParamsSchema;
export const environmentVariableListResponseSchema = z.array(
  z.object({
    id: z.string(),
    projectId: z.string(),
    name: z.string(),
    value: z.string(),
    createdAt: isoDateTimeSchema,
  }),
);
export const environmentVariableCreateResponseSchema = idResponseSchema;
export const environmentVariableUpdateResponseSchema = idResponseSchema;
export const environmentVariableDeleteResponseSchema = idResponseSchema;

export type EnvironmentVariableInput = z.infer<typeof environmentVariableInputSchema>;
export type EnvironmentVariable = z.infer<typeof environmentVariableListResponseSchema>[number];
