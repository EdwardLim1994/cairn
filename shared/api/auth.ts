import { z } from "zod";

export const authLoginRequestSchema = z.object({
  username: z.string(),
  password: z.string(),
});

export const authSessionStatusSchema = z.object({
  enabled: z.boolean(),
  authenticated: z.boolean(),
});
