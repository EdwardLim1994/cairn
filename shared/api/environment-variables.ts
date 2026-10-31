import { z } from "zod";
import { isoDateTimeSchema } from "./common";
export { idParamsSchema as environmentVariableIdRequestSchema } from "./common";
export {
  idResponseSchema as environmentVariableCreateResponseSchema,
  idResponseSchema as environmentVariableUpdateResponseSchema,
  idResponseSchema as environmentVariableDeleteResponseSchema,
} from "./common";

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
export const environmentVariableListResponseSchema = z.array(
  z.object({
    id: z.string(),
    projectId: z.string(),
    name: z.string(),
    value: z.string(),
    createdAt: isoDateTimeSchema,
  }),
);

export type EnvironmentVariableInput = z.infer<typeof environmentVariableInputSchema>;
export type EnvironmentVariable = z.infer<typeof environmentVariableListResponseSchema>[number];
