import { z } from "zod";
import { isoDateTimeSchema } from "./common";
export { idParamsSchema as otelAccessTokenIdRequestSchema } from "./common";

export const otelAccessTokenCreateRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(255),
    expiresAt: isoDateTimeSchema,
  })
  .superRefine(({ expiresAt }, context) => {
    if (new Date(expiresAt).getTime() <= Date.now()) {
      context.addIssue({
        code: "custom",
        path: ["expiresAt"],
        message: "Expiration must be in the future",
      });
    }
  });
export const otelAccessTokenDeleteResponseSchema = z.object({ deleted: z.literal(true) });
export const otelAccessTokenCreateResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  token: z.string(),
  expiresAt: isoDateTimeSchema,
});
export const otelAccessTokenListResponseSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    expiresAt: isoDateTimeSchema,
    createdAt: isoDateTimeSchema,
    expired: z.boolean(),
  }),
);

export type OtelAccessTokenCreateInput = z.infer<typeof otelAccessTokenCreateRequestSchema>;
export type OtelAccessTokenCreateResponse = z.infer<typeof otelAccessTokenCreateResponseSchema>;
export type OtelAccessTokenListItem = z.infer<typeof otelAccessTokenListResponseSchema>[number];
